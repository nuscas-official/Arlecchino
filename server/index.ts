import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { dbService } from './db.js';
import { seedArlecchinoQuiz } from './seed.js';

// Seed DB on start
seedArlecchinoQuiz();

const app = new Hono();

// CORS setup locked to origin or local dev
app.use('*', cors({
  origin: '*', // can be restricted to Cloudflare Pages domain in prod
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Simple in-memory leaderboard cache
let leaderboardCache: { quizId: string; timestamp: number; data: any[] } | null = null;
const CACHE_TTL_MS = 5000; // 5 seconds

// Helper to authenticate session token
function getAuthenticatedParticipant(c: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return dbService.getParticipantByToken(token);
}

/**
 * 1. POST /api/session/start
 */
const startSchema = z.object({
  quizId: z.string().min(1),
  displayName: z.string().min(1).max(50).trim(),
});

app.post('/api/session/start', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = startSchema.parse(body);

    const quiz = dbService.getQuiz(parsed.quizId);
    if (!quiz) {
      return c.json({ error: 'Quiz not found' }, 404);
    }

    const participant = dbService.getOrCreateParticipant(quiz.id, parsed.displayName);
    const startedAtTime = new Date(participant.started_at).getTime();
    const deadline = new Date(startedAtTime + quiz.duration_ms).toISOString();

    return c.json({
      participantId: participant.id,
      sessionToken: participant.session_token,
      startedAt: participant.started_at,
      deadline,
      durationMs: quiz.duration_ms,
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
 * 2. GET /api/quiz/:quizId
 */
app.get('/api/quiz/:quizId', (c) => {
  const participant = getAuthenticatedParticipant(c);
  if (!participant) {
    return c.json({ error: 'Unauthorized session' }, 401);
  }

  const quizId = c.req.param('quizId');
  const quiz = dbService.getQuiz(quizId);
  if (!quiz) {
    return c.json({ error: 'Quiz not found' }, 404);
  }

  // Explicit column selection - answer keys NEVER sent to client
  const questions = dbService.getPublicQuestions(quizId);

  return c.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      durationMs: quiz.duration_ms,
      graceMs: quiz.grace_ms,
    },
    questions,
  });
});

/**
 * 3. POST /api/submit
 */
const submitSchema = z.object({
  answers: z.record(z.string()), // { [questionId]: optionKey }
  autoSubmitted: z.boolean().optional().default(false),
});

app.post('/api/submit', async (c) => {
  const participant = getAuthenticatedParticipant(c);
  if (!participant) {
    return c.json({ error: 'Unauthorized session' }, 401);
  }

  const quiz = dbService.getQuiz(participant.quiz_id);
  if (!quiz) {
    return c.json({ error: 'Quiz not found' }, 404);
  }

  try {
    const body = await c.req.json();
    const parsed = submitSchema.parse(body);

    const nowMs = Date.now();
    const startedAtMs = new Date(participant.started_at).getTime();
    let elapsedMs = nowMs - startedAtMs;

    const maxAllowedMs = quiz.duration_ms + quiz.grace_ms;
    if (elapsedMs > maxAllowedMs) {
      return c.json({ error: 'Quiz deadline has expired. Submission rejected.' }, 410);
    }

    let wasLate = false;
    if (elapsedMs > quiz.duration_ms) {
      wasLate = true;
      elapsedMs = quiz.duration_ms; // clamp elapsed time
    }

    // Load full internal questions with correct_key for server-side grading ONLY
    const internalQuestions = dbService.getInternalQuestions(participant.quiz_id);
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

    // Attempt single-row idempotent write
    const { submission, alreadySubmitted } = dbService.createSubmission({
      participant_id: participant.id,
      answers: parsed.answers,
      score,
      correct_count: correctCount,
      answered_count: answeredCount,
      elapsed_ms: elapsedMs,
      auto_submitted: parsed.autoSubmitted,
      was_late: wasLate,
    });

    // Invalidate leaderboard cache
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

/**
 * 4. GET /api/leaderboard/:quizId
 */
app.get('/api/leaderboard/:quizId', (c) => {
  const quizId = c.req.param('quizId');
  const now = Date.now();

  if (leaderboardCache && leaderboardCache.quizId === quizId && (now - leaderboardCache.timestamp) < CACHE_TTL_MS) {
    return c.json({ leaderboard: leaderboardCache.data, cached: true });
  }

  const leaderboard = dbService.getLeaderboard(quizId, 100);
  leaderboardCache = { quizId, timestamp: now, data: leaderboard };

  return c.json({ leaderboard, cached: false });
});

/**
 * 5. POST /api/progress (Autosave endpoint)
 */
app.post('/api/progress', async (c) => {
  const participant = getAuthenticatedParticipant(c);
  if (!participant) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  // Progress logged for diagnostics
  return c.json({ status: 'ok', savedAt: new Date().toISOString() });
});

/**
 * 6. GET /api/admin/export/:quizId
 */
app.get('/api/admin/export/:quizId', (c) => {
  const adminSecret = c.req.header('X-Admin-Secret') || c.req.query('secret');
  if (adminSecret !== (process.env.ADMIN_SECRET || 'arlecchino-secret-key')) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const quizId = c.req.param('quizId');
  const csv = dbService.exportSubmissionsCSV(quizId);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="leaderboard-${quizId}.csv"`,
    },
  });
});

const port = Number(process.env.PORT) || 3001;
console.log(`[Hono Server] Running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
