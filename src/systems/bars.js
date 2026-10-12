// Turns a couplet into words for the speech bubble, marking the rhymes.
//
// Rhymes are the last word of each line by default. To mark them yourself
// (internal rhymes, multi-word rhymes), wrap them in [brackets]; once a
// couplet has any brackets, only bracketed words count. A line wrapped in
// *asterisks* is a stage direction: shown as an action, never a rhyme.
//
//   ["My watch costs more than your portfolio's [peak],",
//    "and your portfolio's [peak] was a Tuesday last [week]."]

const BRACKETS = /[[\]]/g;

/** @returns {{ direction: boolean, words: { text: string, rhyme: boolean }[] }[]} */
export function parseCouplet(couplet) {
  const explicit = couplet.some((line) => line.includes('['));
  return couplet.map((raw) => {
    const line = raw.trim();
    const direction = /^\*.*\*$/.test(line);
    let open = false;
    const words = line.split(/\s+/).filter(Boolean).map((token) => {
      const starts = token.includes('[');
      const rhyme = explicit && !direction && (open || starts);
      if (starts) open = true;
      if (token.includes(']')) open = false;
      return { text: token.replace(BRACKETS, ''), rhyme };
    });
    if (!explicit && !direction && words.length) words[words.length - 1].rhyme = true;
    return { direction, words };
  });
}

/** The couplet as plain text, with rhyme markup removed. */
export const plainCouplet = (couplet) => couplet.map((line) => line.replace(BRACKETS, ''));
