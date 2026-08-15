import React from 'react';

/**
 * Renders a small subset of markdown-style emphasis in riddle prompts and
 * option labels: **bold**, *italic*, __underline__ (not standard markdown —
 * markdown has no underline; repurposed here since this isn't a full
 * markdown renderer, just three inline styles authors can reach for).
 *
 * Deliberately not a markdown library: text always comes from riddles.ts,
 * never from a participant, so there's nothing to sanitize. This just splits
 * the string into React text nodes and wraps matches — no HTML parsing, no
 * dangerouslySetInnerHTML, so there's no injection surface to worry about
 * even if that assumption ever changes.
 *
 * No nested emphasis (e.g. bold-inside-italic) — first match wins per
 * segment, which covers everything a quiz prompt needs.
 */

const EMPHASIS_PATTERN = /(\*\*.+?\*\*|__.+?__|\*.+?\*)/g;

export const RichText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(EMPHASIS_PATTERN).filter((part) => part.length > 0);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('__') && part.endsWith('__')) {
          return <u key={i}>{part.slice(2, -2)}</u>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
};
