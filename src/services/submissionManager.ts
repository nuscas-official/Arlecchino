import { API_BASE_URL } from '../config';

export interface SubmissionResult {
  score: number;
  correctCount: number;
  answeredCount: number;
  elapsedMs: number;
  alreadySubmitted: boolean;
  submittedAt: string;
}

const STORAGE_KEY_PREFIX = 'arlecchino_answers_';

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

      // If 410 Gone (deadline passed grace period), don't retry endlessly
      if (res.status === 410) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Submission period has closed.');
      }

      throw new Error(`Server returned status ${res.status}`);
    } catch (err: any) {
      console.warn(`Submission attempt ${attempt} failed:`, err.message);

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
