import { cosine, TfIdf, tokenize, type Vector } from "../text/similarity";

// Learns labels from examples people confirmed, by nearest neighbour: a new
// text takes the label of the confirmed example it closely resembles.
//
// Why not naive Bayes: tested leave-one-out on our real contracts it reached
// 5/8 and reported ~100% certainty even when wrong, so it would override the
// keyword rules on contracts it had no business deciding. Contracts recur by
// template and funder (the same CSR MoU each year, one agreement per event
// partner), and same-template documents score 0.7+ similarity while unrelated
// ones stay below 0.35. So: follow the team's label only on a close match.

export type Match = { label: string; similarity: number };

export class NearestExamples {
  private idf: TfIdf;
  private items: { label: string; vector: Vector }[];
  readonly size: number;
  private counts = new Map<string, number>();

  constructor(examples: { label: string; text: string }[]) {
    const tokens = examples.map((e) => tokenize(e.text));
    this.idf = new TfIdf(tokens);
    this.items = examples.map((e, i) => ({ label: e.label, vector: this.idf.vector(tokens[i]) }));
    for (const e of examples) this.counts.set(e.label, (this.counts.get(e.label) ?? 0) + 1);
    this.size = examples.length;
  }

  labels(): { label: string; examples: number }[] {
    return [...this.counts].map(([label, examples]) => ({ label, examples })).sort((a, b) => b.examples - a.examples);
  }

  nearest(text: string): Match | null {
    if (!this.items.length) return null;
    const v = this.idf.vector(tokenize(text));
    let best: Match | null = null;
    for (const item of this.items) {
      const similarity = cosine(v, item.vector);
      if (!best || similarity > best.similarity) best = { label: item.label, similarity };
    }
    return best;
  }
}
