import { API_BASE_URL } from '../config';

export interface QuizStatus {
  quizStatus: 'locked' | 'active' | 'finished' | 'missing';
  quizId?: string;
  title?: string;
  durationMs?: number;
  graceMs?: number;
  opensAt?: string | null;
  deadlineIso?: string | null;
  questionsVersion?: string;
}

/**
 * The status poll: ~60 bytes, one database read, and edge-cached so the origin
 * sees roughly one hit every couple of seconds no matter how many people are
 * polling. Replaces polling /api/quiz/:id, which shipped the whole 50-question
 * payload to answer a single-field question.
 *
 * Unauthenticated — it exposes nothing participant-specific, and a bearer token
 * in the cache key would give every client its own cache entry, which defeats
 * the point.
 */
export async function fetchQuizStatus(quizId: string): Promise<QuizStatus | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/quiz/${quizId}/status`);
    if (!res.ok) return null;
    return (await res.json()) as QuizStatus;
  } catch (err) {
    console.error('Quiz status fetch failed:', err);
    return null;
  }
}

/**
 * Poll interval with jitter. 200 clients that all started within the same few
 * seconds would otherwise stay in lockstep forever, arriving as a spike every
 * interval rather than as a spread. Force-end is a UX notification, not a
 * correctness mechanism — the server already grades everyone outstanding when
 * the host ends the quiz — so a few extra seconds of latency costs nothing.
 */
export function jitteredInterval(baseMs = 5000, spreadMs = 2000): number {
  return baseMs + Math.random() * spreadMs;
}

/**
 * setInterval cannot vary its delay, so this reschedules itself each tick to
 * keep the jitter. Returns a cancel function.
 */
export function pollWithJitter(fn: () => void | Promise<void>, baseMs = 5000, spreadMs = 2000) {
  let timer: ReturnType<typeof setTimeout>;
  let cancelled = false;

  const tick = async () => {
    if (cancelled) return;
    try {
      await fn();
    } finally {
      if (!cancelled) timer = setTimeout(tick, jitteredInterval(baseMs, spreadMs));
    }
  };

  timer = setTimeout(tick, jitteredInterval(baseMs, spreadMs));

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
