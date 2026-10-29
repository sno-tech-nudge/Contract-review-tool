// Locating a quote inside rendered text. Both PDF text items and HTML text
// nodes are reduced to letters and digits only, so differences in spacing,
// hyphenation and punctuation between extraction and rendering don't matter.

export type Focus = { quote?: string; page?: number; nonce: number };

export const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Returns the indexes of the pieces that together contain the quote.
export function matchItems(pieces: string[], quote: string): Set<number> {
  const ranges: [number, number][] = [];
  let concat = "";
  for (const p of pieces) {
    const s = squash(p);
    ranges.push([concat.length, concat.length + s.length]);
    concat += s;
  }
  const q = squash(quote);
  const hit = new Set<number>();
  if (q.length < 6) return hit;

  // Try the whole quote, then shorter prefixes and a middle slice, so a
  // truncated or slightly re-worded quote still lands in the right place.
  const probes: [number, number][] = [[0, q.length]];
  for (const len of [160, 90, 50, 28]) if (q.length > len) probes.push([0, len]);
  if (q.length > 60) probes.push([Math.floor(q.length / 2) - 20, Math.floor(q.length / 2) + 20]);

  for (const [from, to] of probes) {
    const probe = q.slice(from, to);
    const at = concat.indexOf(probe);
    if (at < 0) continue;
    const start = at - from;
    const end = Math.min(concat.length, start + q.length);
    ranges.forEach(([a, b], i) => {
      if (b > a && a < end && b > start) hit.add(i);
    });
    return hit;
  }
  return hit;
}
