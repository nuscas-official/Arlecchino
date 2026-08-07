import { API_BASE_URL } from '../config';

export interface SubmissionResult {
  score: number;
  correctCount: number;
  answeredCount: number;
  elapsedMs: number;
  wasLate?: boolean;
  alreadySubmitted: boolean;
  submittedAt: string;
}

/** A rejection the server will keep rejecting — retrying it is pointless. */
class TerminalSubmissionError extends Error {
  readonly terminal = true;
}

const STORAGE_KEY_PREFIX = 'arlecchino_answers_';
const SESSION_KEY_PREFIX = 'arlecchino_session_';

export interface StoredSession {
  quizId: string;
  participantId: string;
  sessionToken: string;
  displayName: string;
}

/**
 * The session token is the only thing that identifies a participant — names are
 * not unique. Persisting it means a refresh mid-quiz reclaims the same row
 * instead of silently spawning a second participant under the same name.
 *
 * Deliberately sessionStorage, not localStorage: one tab is one participant.
 * A shared localStorage key would let two people sitting at the same browser
 * overwrite each other's session, which is the exact bug this is fixing.
 * Answers stay in localStorage — they are keyed by participant id, so they
 * cannot collide.
 */
export function saveSession(session: StoredSession) {
  try {
    sessionStorage.setItem(`${SESSION_KEY_PREFIX}${session.quizId}`, JSON.stringify(session));
  } catch (err) {
    console.error('Failed to persist session:', err);
  }
}

export function loadSession(quizId: string): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(`${SESSION_KEY_PREFIX}${quizId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed?.sessionToken && parsed?.participantId ? parsed : null;
  } catch (err) {
    console.error('Failed to read session:', err);
    return null;
  }
}

export function clearSession(quizId: string) {
  try {
    sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${quizId}`);
  } catch (err) {
    console.error('Failed to clear session:', err);
  }
}

export function saveAnswersToDisk(participantId: string, answers: Record<string, string>) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${participantId}`;
    localStorage.setItem(key, JSON.stringify(answers));
  } catch (err) {
    console.error('Failed to write answers to localStorage:', err);
  }
}

export function loadAnswersFromDisk(participantId: string): Record<string, string> {
  try {
    const key = `${STORAGE_KEY_PREFIX}${participantId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Failed to read answers from localStorage:', err);
    return {};
  }
}

export function clearAnswersFromDisk(participantId: string) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${participantId}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.error('Failed to clear answers from localStorage:', err);
  }
}

/**
 * Submit answers to API with exponential backoff retry.
 * Delays: 1s, 2s, 4s, 8s, 16s, 32s (total ~63s total attempt time).
 */
export async function submitQuizWithRetry(
  sessionToken: string,
  participantId: string,
  answers: Record<string, string>,
  autoSubmitted: boolean,
  onStatusUpdate?: (statusMessage: string) => void
): Promise<SubmissionResult> {
  const maxAttempts = 6;
  let attempt = 0;
  let delayMs = 1000;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      if (onStatusUpdate && attempt > 1) {
        onStatusUpdate(`Retrying submission (Attempt ${attempt}/${maxAttempts})...`);
      }

      const res = await fetch(`${API_BASE_URL}/api/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ answers, autoSubmitted }),
      });

      if (res.ok) {
        const data = (await res.json()) as SubmissionResult;
        // CRITICAL: Only clear localStorage on successful 2xx response!
        clearAnswersFromDisk(participantId);
        return data;
      }

      // 4xx means the server has made up its mind (bad token, closed window).
      // The old code threw here but the throw landed in the catch below, so it
      // still burned all six attempts before surfacing anything to the user.
      if (res.status >= 400 && res.status < 500) {
        const errData = await res.json().catch(() => ({}));
        throw new TerminalSubmissionError(errData.error || `Submission rejected (status ${res.status}).`);
      }

      throw new Error(`Server returned status ${res.status}`);
    } catch (err: any) {
      console.warn(`Submission attempt ${attempt} failed:`, err.message);

      if (err instanceof TerminalSubmissionError) {
        throw err;
      }

      if (attempt >= maxAttempts) {
        throw new Error(`Failed to submit after ${maxAttempts} attempts: ${err.message}. Your answers remain safely stored in your browser.`);
      }

      // Wait exponential backoff delay before next attempt
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }

  throw new Error('Submission retries exhausted.');
}
