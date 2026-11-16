// Turns a flagged miss into a suggested business rule: the most distinctive
// short phrase in the quoted passage, i.e. wording that is rare in the
// repository's standard contracts, flagged whenever it appears again.

const STOP = new Set(
  "a an the and or of to in on for by with at from as is are be been shall will may must this that these any all its it their them they we our you your not no such other which who if but than then there herein hereof hereto hereunder thereof party parties agreement".split(" ")
);

export type RuleSuggestion = { phrase: string; seenIn: number };

function candidates(quote: string): string[] {
  const words = quote.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const w = words.slice(i, i + n);
      if (STOP.has(w[0]) || STOP.has(w[n - 1]) || w.every((x) => STOP.has(x) || /^\d+$/.test(x))) continue;
      out.add(w.join(" "));
    }
  }
  return [...out];
}

// repositoryTexts: lower-cased, whitespace-flattened contract texts.
export function suggestPhrase(quote: string, repositoryTexts: string[]): string {
  const n = repositoryTexts.length || 1;
  let best = "";
  let bestScore = 0;
  for (const c of candidates(quote)) {
    const df = repositoryTexts.filter((t) => t.includes(c)).length;
    // rarer in standard contracts, and a little longer, is more distinctive
    const score = (1 - df / n) * (1 + c.split(" ").length * 0.25);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
