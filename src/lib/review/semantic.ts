import type { Segment } from "../contracts/segment";
import type { ClauseType } from "../contracts/types";
import { similarity, tryEmbedPassages, type Vector } from "../embeddings";

// The meaning layer of a review: vectors for every clause in the contract,
// the repository and the clause library, and the clause types learned from
// people's corrections.
//
// Thresholds, measured on our real contracts (bge-small, normalised):
// copied library wording 0.93 to 0.98; our own clauses that mean the same as
// a library clause (survival, confidentiality) 0.85 to 0.87; wrong-topic
// pairs 0.82 and below. Scores bunch together, so meaning never overrides
// a clause type on its own: only a person's correction of a near-identical
// clause does.
export const SAME_MEANING = 0.85; // says the same thing in different words
export const SAME_CLAUSE = 0.9; // the same clause, lightly edited

export type Semantic = {
  segments: Vector[];
  repository: Vector[]; // aligned with the repository clauses passed in
  library: Vector[]; // aligned with the library clauses passed in
};

export type ClauseExample = { label: string; text: string; fromPerson: boolean };

const clauseText = (heading: string, text: string) => `${heading} ${text}`;

export async function embedReview(input: {
  segments: Segment[];
  repositoryClauses: { heading: string; text: string }[];
  libraryClauses: { title: string; text: string }[];
}): Promise<Semantic | null> {
  const texts = [
    ...input.segments.map((s) => clauseText(s.heading, s.text)),
    ...input.repositoryClauses.map((c) => clauseText(c.heading, c.text)),
    ...input.libraryClauses.map((l) => clauseText(l.title, l.text)),
  ];
  const vectors = await tryEmbedPassages(texts);
  if (!vectors) return null;
  const a = input.segments.length;
  const b = a + input.repositoryClauses.length;
  return { segments: vectors.slice(0, a), repository: vectors.slice(a, b), library: vectors.slice(b) };
}

// A person's correction of a near-identical clause decides its type; the
// clause library only adds a second type when a clause copies a library
// version. Returns new segments; the input is not changed.
export async function applyLearnedTypes(segments: Segment[], segmentVectors: Vector[], examples: ClauseExample[]): Promise<Segment[]> {
  if (!examples.length) return segments;
  const vectors = await tryEmbedPassages(examples.map((e) => e.text));
  if (!vectors) return segments;
  return segments.map((s, i) => {
    if (s.type === "parties") return s;
    let best = -1;
    let at = -1;
    vectors.forEach((v, j) => {
      const sim = similarity(segmentVectors[i], v);
      if (sim > best) [best, at] = [sim, j];
    });
    if (at < 0 || best < SAME_CLAUSE) return s;
    const ex = examples[at];
    const label = ex.label as ClauseType;
    if (ex.fromPerson && label !== s.type) return { ...s, type: label, types: [label, ...s.types.filter((t) => t !== label)] };
    if (!ex.fromPerson && !s.types.includes(label)) return { ...s, types: [...s.types, label] };
    return s;
  });
}

export function bestMatch(target: Vector, candidates: Vector[], allow: (index: number) => boolean): { index: number; score: number } | null {
  let best: { index: number; score: number } | null = null;
  candidates.forEach((v, i) => {
    if (!allow(i)) return;
    const score = similarity(target, v);
    if (!best || score > best.score) best = { index: i, score };
  });
  return best;
}
