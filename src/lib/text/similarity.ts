// Lightweight TF-IDF + cosine similarity. Good enough to tell "same template,
// lightly edited" (0.6+) from "same topic, different drafting" (0.2 to 0.5).

const STOPWORDS = new Set(
  "a an the and or of to in on for by with at from as is are be been being shall will may must this that these those such any all each other its it his her their them they he she we our us you your not no nor than then there here herein hereof hereto hereunder thereof thereto under upon into onto over within without between per via so if but also which who whom whose what when where while do does did done has have had having can could would should".split(" ")
);

export function normalise(text: string): string {
  return text.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}

// Very light stemming so "terminate", "terminated" and "termination" meet.
function stem(word: string): string {
  return word.replace(/(ations?|ing|ed|es|s|ly|ment|ments)$/, "").slice(0, 12);
}

export function tokenize(text: string): string[] {
  return normalise(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map(stem);
}

export type Vector = Map<string, number>;

export class TfIdf {
  private df = new Map<string, number>();
  private docs = 0;

  constructor(corpus: string[][]) {
    for (const tokens of corpus) this.add(tokens);
  }

  add(tokens: string[]) {
    this.docs++;
    for (const t of new Set(tokens)) this.df.set(t, (this.df.get(t) ?? 0) + 1);
  }

  vector(tokens: string[]): Vector {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const v: Vector = new Map();
    for (const [t, f] of tf) {
      const idf = Math.log((1 + this.docs) / (1 + (this.df.get(t) ?? 0))) + 1;
      v.set(t, (1 + Math.log(f)) * idf);
    }
    return v;
  }
}

export function cosine(a: Vector, b: Vector): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [, x] of a) na += x * x;
  for (const [, y] of b) nb += y * y;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [t, x] of small) {
    const y = large.get(t);
    if (y) dot += x * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
