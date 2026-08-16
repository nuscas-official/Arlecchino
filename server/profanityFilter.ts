/**
 * Very small, dependency-free profanity filter.
 *
 * This is intentionally simple: it lowercases the input, undoes common
 * leetspeak substitutions, strips everything that isn't a letter (so spaces,
 * dashes, underscores, and punctuation can't be used to sneak a banned word
 * past the check), and then looks for banned words as substrings.
 *
 * It is NOT a robust moderation system — it will have false positives (e.g.
 * "Scunthorpe"-style words) and can be worked around with enough effort.
 * It's meant to catch the obvious/casual cases, not to be bulletproof.
 */

const BANNED_WORDS = [
  // Profanity
  'fuck', 'fucker', 'fkr', 'fker', 'motherfucker', 'shit', 'bitch', 'bastard', 'asshole', 'ass hole', 'dick', 'cock',
  'pussy', 'cunt', 'twat', 'whore', 'slut', 'douche', 'wanker', 'bollock', 'piss', 'shit',
  // Sexual / body parts
  'penis', 'vagina', 'boob', 'tit', 'porn', 'sex', 'anal', 'cum', 'dildo', 'sexual', 'intercourse',
  // Slurs
  'nigger', 'nigga', 'nig', 'nigg', 'nigge', 'nigr', 'niggr', 'niga', 'nggr', 'ngr', 'nga',
  'fag', 'faggot', 'retard', 'spic', 'chink', 'gook',
  'tranny', 'dyke',
  // Hate figures / extremism
  'hitler', 'nazi', 'isis', 'kkk', 'diddy', 'epstein', 'pedo', 'pedophile', 'rape', 'rapist', 'assault'
];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/[^a-z]/g, ''); // drop spaces, punctuation, digits, emoji, etc.
}

export function isProfane(input: string): boolean {
  const normalized = normalize(input);
  if (!normalized) return false;
  return BANNED_WORDS.some((word) => normalized.includes(word));
}