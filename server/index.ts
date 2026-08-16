import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { dbService, isPlaceholderSubmission, participantCode } from './db.js';
import { seedArlecchinoQuiz } from './seed.js';
import { isProfane } from './profanityFilter.js';

const app = new Hono<{ Bindings: { DATABASE_URL?: string; ADMIN_SECRET?: string } }>();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'],
}));

let leaderboardCache: { quizId: string; timestamp: number; data: any[] } | null = null;
const CACHE_TTL_MS = 3000;

/**
 * Cloudflare does not cache Worker responses on workers.dev routes on its own,
 * so the Cache API has to be driven explicitly. Undefined under plain Node,
 * where every call simply falls through to the origin.
 */
const edgeCache: any = (globalThis as any).caches?.default;

/**
 * Serve a JSON payload through the edge cache, keyed on the full request URL.
 *
 * This is what makes participant count stop mattering: 200 clients polling the
 * status endpoint collapse into roughly one origin hit every `ttlSeconds`, and
 * the question set is fetched from the database once for the entire room.
 */
async function cachedJson(c: any, ttlSeconds: number, build: () => Promise<any>) {
  const key = new Request(c.req.url, { method: 'GET' });

  if (edgeCache) {
    const hit = await edgeCache.match(key);
    if (hit) {
      // Responses handed back by the Cache API have immutable headers, and the
      // CORS middleware writes to them after the handler returns. Copying into
      // a fresh Response keeps them writable.
      const headers = new Headers(hit.headers);
      headers.set('X-Cache', 'HIT');
      return new Response(hit.body, { status: hit.status, headers });
    }
  }

  const payload = await build();
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': `public, max-age=${ttlSeconds}`,
    // So the caching can actually be confirmed against the deployed Worker:
    // `curl -sI .../status | grep -i x-cache` should show MISS then HIT.
    'X-Cache': edgeCache ? 'MISS' : 'BYPASS',
  };

  if (edgeCache) {
    const storable = new Response(body, { headers });
    const waitUntil = c.executionCtx?.waitUntil?.bind(c.executionCtx);
    const put = edgeCache.put(key, storable);
    if (waitUntil) waitUntil(put);
    else await put;
  }

  return new Response(body, { headers: new Headers(headers) });
}

/**
 * Cache-busting token for the question set. Changes when the host unlocks (and
 * on a reset-then-unlock), which guarantees nobody is served a question payload
 * cached from a previous run.
 */
function questionsVersion(quiz: { opens_at?: string | null }): string {
  const t = quiz.opens_at ? Date.parse(quiz.opens_at) : NaN;
  return Number.isNaN(t) ? '0' : String(t);
}

/**
 * The 50 questions are immutable for the duration of an event, but /api/submit
 * re-read all of them from the database for every single participant. Memoized
 * per isolate, so the submission burst costs one fetch per isolate rather than
 * one per submission.
 */
let internalQuestionsCache: { quizId: string; data: any[] } | null = null;
async function getInternalQuestionsCached(quizId: string, envDbUrl?: string) {
  if (internalQuestionsCache?.quizId === quizId) return internalQuestionsCache.data;
  const data = await dbService.getInternalQuestions(quizId, envDbUrl);
  internalQuestionsCache = { quizId, data };
  return data;
}

async function getAuthenticatedParticipant(c: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return dbService.getParticipantByToken(token, c.env?.DATABASE_URL);
}

function verifyAdminSecret(c: any) {
  const secret = c.req.header('X-Admin-Secret') || c.req.query('secret');
  const expected = c.env?.ADMIN_SECRET || (typeof process !== 'undefined' ? process.env.ADMIN_SECRET : undefined) || 'arlecchino-secret-key';
  return secret === expected;
}

const startSchema = z.object({
  quizId: z.string().min(1),
  displayName: z.string().min(1).max(50).trim(),
  // Presented by a returning tab to reclaim its own session. Identity comes
  // from this token alone — never from the display name, which may be shared.
  sessionToken: z.string().min(1).optional(),
});

app.post('/api/session/start', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = startSchema.parse(body);

    if (isProfane(parsed.displayName)) {              
      return c.json({ error: 'Please choose a different display name.' }, 400);
    }

    let quiz = await dbService.getQuiz(parsed.quizId, c.env?.DATABASE_URL);
    if (!quiz) {
      return c.json({ error: 'Quiz not found' }, 404);
    }
    quiz = await dbService.maybeAutoFinish(quiz, c.env?.DATABASE_URL);

    let participant = null;
    if (parsed.sessionToken) {
      const existing = await dbService.getParticipantByToken(parsed.sessionToken, c.env?.DATABASE_URL);
      if (existing && existing.quiz_id === quiz.id) {
        participant = existing;
      }
    }
    if (!participant) {
      participant = await dbService.createParticipant(quiz.id, parsed.displayName, c.env?.DATABASE_URL);
    }

    const submission = await dbService.getSubmission(participant.id, c.env?.DATABASE_URL);
    const startedAtTime = new Date(quiz.opens_at || participant.started_at).getTime();
    const deadline = new Date(startedAtTime + quiz.duration_ms).toISOString();

    return c.json({
      participantId: participant.id,
      participantCode: participantCode(participant.id),
      displayName: participant.display_name,
      sessionToken: participant.session_token,
      startedAt: participant.started_at,
      deadline,
      durationMs: quiz.duration_ms,
      quizStatus: quiz.status,
      alreadySubmitted: Boolean(submission) && !isPlaceholderSubmission(submission),
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: err.errors }, 400);
    }
    console.error('Error starting session:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Status poll. Both the waiting room and the in-quiz force-end watcher hit this
 * every few seconds, so it is deliberately tiny and carries nothing that varies
 * per participant — that is what lets it sit behind the edge cache.
 *
 * It replaces polling /api/quiz/:quizId, which returned the entire 50-question
 * payload (~30 KB, 3 database round trips) to answer a single-field question.
 * Both callers read exactly one property and discarded the rest.
 */
app.get('/api/quiz/:quizId/status', async (c) => {
  const quizId = c.req.param('quizId');

  return cachedJson(c, 2, async () => {
    let quiz = await dbService.getQuiz(quizId, c.env?.DATABASE_URL);
    if (!quiz) {
      return { quizStatus: 'missing', error: 'Quiz not found. Has it been seeded?' };
    }

    // Still the mechanism that closes an expired quiz, since nothing else is
    // scheduled. Behind a 2s cache it runs ~30x/minute, which is ample.
    quiz = await dbService.maybeAutoFinish(quiz, c.env?.DATABASE_URL);

    const deadlineIso = quiz.opens_at
      ? new Date(new Date(quiz.opens_at).getTime() + quiz.duration_ms).toISOString()
      : null;

    return {
      quizStatus: quiz.status,
      quizId: quiz.id,
      title: quiz.title,
      durationMs: quiz.duration_ms,
      graceMs: quiz.grace_ms,
      opensAt: quiz.opens_at || null,
      deadlineIso,
      questionsVersion: questionsVersion(quiz),
    };
  });
});

/**
 * The question set: canonical order, no answer keys, identical for everyone.
 *
 * Unauthenticated on purpose — a per-request bearer token would land in the
 * cache key and defeat the sharing entirely. Clients only request this once
 * they have seen `active` from the status endpoint, and the `v` parameter
 * (questionsVersion) makes unlock mint a fresh cache key, so a payload cached
 * before unlock can never be served after it.
 */
app.get('/api/quiz/:quizId/questions', async (c) => {
  const quizId = c.req.param('quizId');

  return cachedJson(c, 300, async () => {
    const quiz = await dbService.getQuiz(quizId, c.env?.DATABASE_URL);
    if (!quiz) {
      return { error: 'Quiz not found', questions: [] };
    }

    // Nothing is served before the host unlocks, so dropping the bearer token
    // does not hand the question set out early. Safe to cache alongside the
    // gate because unlock changes questionsVersion, and therefore the cache
    // key — a payload cached while locked can never be served after unlock.
    if (quiz.status === 'locked') {
      return { error: 'Quiz is locked', questions: [] };
    }

    const questions = await dbService.getPublicQuestions(quizId, c.env?.DATABASE_URL);

    return {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        durationMs: quiz.duration_ms,
        graceMs: quiz.grace_ms,
      },
      questions,
    };
  });
});

const submitSchema = z.object({
  answers: z.record(z.string()),
  autoSubmitted: z.boolean().optional().default(false),
});

app.post('/api/submit', async (c) => {
  const participant = await getAuthenticatedParticipant(c);
  if (!participant) {
    return c.json({ error: 'Unauthorized session' }, 401);
  }

  const quiz = await dbService.getQuiz(participant.quiz_id, c.env?.DATABASE_URL);
  if (!quiz) {
    return c.json({ error: 'Quiz not found' }, 404);
  }

  try {
    const body = await c.req.json();
    const parsed = submitSchema.parse(body);

    const nowMs = Date.now();
    const quizStartTimeMs = new Date(quiz.opens_at || participant.started_at).getTime();
    const elapsedMs = Math.max(0, nowMs - quizStartTimeMs);

    // A late paper is always accepted rather than rejected — dropping answers
    // on the floor is worse than recording them. Integrity is preserved by
    // storing the TRUE elapsed time: the leaderboard sorts by elapsed ascending
    // within a score, so stalling past the deadline can only cost you rank.
    // (Previously this 410'd past duration + grace, which is why a host
    // force-ending after the timer expired graded everyone 0.)
    const wasLate = elapsedMs > quiz.duration_ms;

    const internalQuestions = await getInternalQuestionsCached(participant.quiz_id, c.env?.DATABASE_URL);
    let score = 0;
    let correctCount = 0;
    let answeredCount = 0;

    for (const q of internalQuestions) {
      const userKey = parsed.answers[q.id];
      if (userKey) {
        answeredCount++;
        if (userKey === q.correct_key) {
          correctCount++;
          score += q.points;
        }
      }
    }

    const { submission, alreadySubmitted } = await dbService.createSubmission({
      participant_id: participant.id,
      answers: parsed.answers,
      score,
      correct_count: correctCount,
      answered_count: answeredCount,
      elapsed_ms: elapsedMs,
      auto_submitted: parsed.autoSubmitted,
      was_late: wasLate,
    }, c.env?.DATABASE_URL);

    leaderboardCache = null;

    return c.json({
      score: submission.score,
      correctCount: submission.correct_count,
      answeredCount: submission.answered_count,
      elapsedMs: submission.elapsed_ms,
      wasLate: submission.was_late,
      alreadySubmitted,
      submittedAt: submission.submitted_at,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid submission format', details: err.errors }, 400);
    }
    console.error('Error processing submission:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/api/leaderboard/:quizId', async (c) => {
  const quizId = c.req.param('quizId');
  const now = Date.now();

  if (leaderboardCache && leaderboardCache.quizId === quizId && (now - leaderboardCache.timestamp) < CACHE_TTL_MS) {
    return c.json({ leaderboard: leaderboardCache.data, cached: true });
  }

  const leaderboard = await dbService.getLeaderboard(quizId, 100, c.env?.DATABASE_URL);
  leaderboardCache = { quizId, timestamp: now, data: leaderboard };

  return c.json({ leaderboard, cached: false });
});

app.post('/api/admin/seed', async (c) => {
  if (!verifyAdminSecret(c)) {
    return c.json({ error: 'Unauthorized Admin' }, 403);
  }

  try {
    // Also runs the schema migration; this is the only path that does.
    await seedArlecchinoQuiz(c.env?.DATABASE_URL);
    leaderboardCache = null;
    internalQuestionsCache = null;
    return c.json({ status: 'ok', message: 'Database migrated and seeded successfully.' });
  } catch (err: any) {
    console.error('Error seeding database:', err);
    return c.json({ error: 'Failed to seed database', details: String(err?.message || err) }, 500);
  }
});

app.post('/api/admin/quiz/status', async (c) => {
  if (!verifyAdminSecret(c)) {
    return c.json({ error: 'Unauthorized Admin' }, 403);
  }

  try {
    const body = await c.req.json();
    const { quizId, status } = body;

    if (!['locked', 'active', 'finished'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    await dbService.setQuizStatus(quizId, status, c.env?.DATABASE_URL);
    leaderboardCache = null;

    return c.json({ status: 'ok', quizStatus: status });
  } catch (err: any) {
    console.error('Error setting quiz status:', err);
    return c.json({ error: 'Failed to update quiz status', details: String(err?.message || err) }, 500);
  }
});

app.post('/api/admin/quiz/reset', async (c) => {
  if (!verifyAdminSecret(c)) {
    return c.json({ error: 'Unauthorized Admin' }, 403);
  }

  try {
    const body = await c.req.json();
    const { quizId } = body;

    await dbService.resetQuizData(quizId, c.env?.DATABASE_URL);
    leaderboardCache = null;
    internalQuestionsCache = null;

    return c.json({ status: 'ok', message: 'Quiz submissions and participant sessions reset to 0.' });
  } catch (err: any) {
    console.error('Error resetting quiz:', err);
    return c.json({ error: 'Failed to reset quiz data', details: String(err?.message || err) }, 500);
  }
});

app.get('/api/admin/stats/:quizId', async (c) => {
  if (!verifyAdminSecret(c)) {
    return c.json({ error: 'Unauthorized Admin' }, 403);
  }

  const quizId = c.req.param('quizId');

  // The admin dashboard polls this every 3s, which is what drives the quiz to
  // close itself once the timer has fully run out.
  const quiz = await dbService.getQuiz(quizId, c.env?.DATABASE_URL);
  if (quiz) {
    await dbService.maybeAutoFinish(quiz, c.env?.DATABASE_URL);
  }

  const stats = await dbService.getAdminStats(quizId, c.env?.DATABASE_URL);
  const leaderboard = await dbService.getLeaderboard(quizId, 10, c.env?.DATABASE_URL);

  return c.json({
    stats,
    topParticipants: leaderboard,
  });
});

app.get('/api/admin/export/:quizId', async (c) => {
  if (!verifyAdminSecret(c)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const quizId = c.req.param('quizId');
  const csv = await dbService.exportSubmissionsCSV(quizId, c.env?.DATABASE_URL);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="leaderboard-${quizId}.csv"`,
    },
  });
});

// Local Node server launcher (ignored by Cloudflare Workers)
if (typeof process !== 'undefined' && process.release?.name === 'node') {
  import('@hono/node-server').then(({ serve }) => {
    import('./seed.js').then(({ seedArlecchinoQuiz }) => {
      seedArlecchinoQuiz().then(() => {
        const port = Number(process.env.PORT) || 3001;
        console.log(`[Hono Server] Running on http://localhost:${port}`);
        serve({
          fetch: app.fetch,
          port,
        });
      });
    });
  });
}

export default app;
