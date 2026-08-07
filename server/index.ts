import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { dbService } from './db.js';
import { seedArlecchinoQuiz } from './seed.js';

const app = new Hono<{ Bindings: { DATABASE_URL?: string; ADMIN_SECRET?: string } }>();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'],
}));

let leaderboardCache: { quizId: string; timestamp: number; data: any[] } | null = null;
const CACHE_TTL_MS = 3000;

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
});

app.post('/api/session/start', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = startSchema.parse(body);

    const quiz = await dbService.getQuiz(parsed.quizId, c.env?.DATABASE_URL);
    if (!quiz) {
      return c.json({ error: 'Quiz not found' }, 404);
    }

    const participant = await dbService.getOrCreateParticipant(quiz.id, parsed.displayName, c.env?.DATABASE_URL);
    const startedAtTime = new Date(quiz.opens_at || participant.started_at).getTime();
    const deadline = new Date(startedAtTime + quiz.duration_ms).toISOString();

    return c.json({
      participantId: participant.id,
      sessionToken: participant.session_token,
      startedAt: participant.started_at,
      deadline,
      durationMs: quiz.duration_ms,
      quizStatus: quiz.status,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: err.errors }, 400);
    }
    console.error('Error starting session:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.get('/api/quiz/:quizId', async (c) => {
  const participant = await getAuthenticatedParticipant(c);
  if (!participant) {
    return c.json({ error: 'Unauthorized session' }, 401);
  }

  const quizId = c.req.param('quizId');
  const quiz = await dbService.getQuiz(quizId, c.env?.DATABASE_URL);
  if (!quiz) {
    return c.json({ error: 'Quiz not found' }, 404);
  }

  if (quiz.status === 'locked') {
    return c.json({
      quizStatus: 'locked',
      message: 'The King of Riddles trial is currently locked by the host.',
    });
  }

  const startedAtTime = new Date(quiz.opens_at || participant.started_at).getTime();
  const deadlineIso = new Date(startedAtTime + quiz.duration_ms).toISOString();

  const questions = await dbService.getPublicQuestionsShuffled(quizId, participant.id, c.env?.DATABASE_URL);

  return c.json({
    quizStatus: quiz.status,
    quiz: {
      id: quiz.id,
      title: quiz.title,
      durationMs: quiz.duration_ms,
      graceMs: quiz.grace_ms,
      opensAt: quiz.opens_at,
      deadlineIso,
    },
    questions,
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
    let elapsedMs = nowMs - quizStartTimeMs;

    const maxAllowedMs = quiz.duration_ms + quiz.grace_ms;
    if (elapsedMs > maxAllowedMs) {
      return c.json({ error: 'Quiz deadline has expired. Submission rejected.' }, 410);
    }

    let wasLate = false;
    if (elapsedMs > quiz.duration_ms) {
      wasLate = true;
      elapsedMs = quiz.duration_ms;
    }

    const internalQuestions = await dbService.getInternalQuestions(participant.quiz_id, c.env?.DATABASE_URL);
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
      elapsed_ms: Math.max(0, elapsedMs),
      auto_submitted: parsed.autoSubmitted,
      was_late: wasLate,
    }, c.env?.DATABASE_URL);

    leaderboardCache = null;

    return c.json({
      score: submission.score,
      correctCount: submission.correct_count,
      answeredCount: submission.answered_count,
      elapsedMs: submission.elapsed_ms,
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
    await seedArlecchinoQuiz(c.env?.DATABASE_URL);
    leaderboardCache = null;
    return c.json({ status: 'ok', message: 'Database seeded successfully.' });
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
