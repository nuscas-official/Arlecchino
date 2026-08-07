/**
 * Per-participant question order, applied in the browser.
 *
 * This used to run on the server (getPublicQuestionsShuffled), which made every
 * question response participant-specific and therefore impossible to cache —
 * 200 people meant 200 origin fetches of the same 30 KB at the same moment.
 * Shuffling here lets the server hand out one canonical, edge-cached payload.
 *
 * Nothing is given away by moving it: the client already receives the full
 * question set in a single response, so the order was never a secret. The
 * actual secret, `correct_key`, is never sent to the client and grading happens
 * server-side keyed on question id, so order cannot affect a score.
 *
 * The RNG is seeded from participantId rather than Math.random so that a
 * mid-quiz refresh reproduces the same order instead of reshuffling the paper
 * under someone who is halfway through it.
 */

interface Shufflable {
  id: string;
  position: number;
  options: Array<{ key: string; label: string }>;
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/** Fisher-Yates driven by a caller-advanced seed, so successive calls differ. */
function shuffleInPlace<T>(items: T[], seedRef: { value: number }) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seedRef.value++) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/**
 * Returns a new array in this participant's order, with `position` renumbered
 * 1..n so the "Riddle 07 / 50" label and the grid stay sequential.
 *
 * Option order is randomized too. It previously was not, so neighbours saw
 * identical A/B/C/D — the cheaper half of shoulder-surfing. Answers are
 * submitted by option `key`, never by index, so this is presentation only.
 */
export function shuffleQuestionsForParticipant<T extends Shufflable>(
  questions: T[],
  participantId: string
): T[] {
  const seedRef = { value: stringToSeed(participantId) };

  const shuffled = questions.map((q) => {
    const options = [...q.options];
    shuffleInPlace(options, seedRef);
    return { ...q, options };
  });

  shuffleInPlace(shuffled, seedRef);

  return shuffled.map((q, idx) => ({ ...q, position: idx + 1 }));
}
