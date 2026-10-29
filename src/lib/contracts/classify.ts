import { CLAUSE_TYPES, CLAUSE_TYPE_KEYS, CONTRACT_TYPES, CONTRACT_TYPE_KEYS, type ClauseType, type ContractType } from "./types";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cache = new Map<string, RegExp>();

function count(text: string, phrase: string, cap = 5): number {
  let re = cache.get(phrase);
  if (!re) {
    // word boundaries only where the phrase starts/ends with a word character
    const pre = /^\w/.test(phrase) ? "\\b" : "";
    const post = /\w$/.test(phrase) ? "(?:\\w{0,4})\\b" : "";
    re = new RegExp(pre + escape(phrase) + post, "gi");
    cache.set(phrase, re);
  }
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(text) && n < cap) n++;
  return n;
}

export type ClauseClassification = { type: ClauseType; types: ClauseType[]; score: number };

export function classifyClause(heading: string, text: string, isPreamble = false): ClauseClassification {
  const h = heading.toLowerCase();
  const body = text.slice(0, 1500).toLowerCase();
  const scored: { type: ClauseType; score: number; headingHit: boolean }[] = [];
  for (const key of CLAUSE_TYPE_KEYS) {
    if (key === "other") continue;
    const def = CLAUSE_TYPES[key];
    let headingHits = 0;
    for (const k of def.heading) headingHits += count(h, k, 1);
    let bodyHits = 0;
    for (const k of def.body) bodyHits += count(body, k, 3);
    const score = headingHits * 5 + bodyHits;
    if (score > 0) scored.push({ type: key, score, headingHit: headingHits > 0 });
  }
  if (isPreamble && /between|hereinafter|whereas/i.test(body)) scored.push({ type: "parties", score: 50, headingHit: true });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score < 2) return { type: "other", types: [], score: 0 };
  const types = scored.filter((s) => s.headingHit || s.score >= Math.max(4, top.score * 0.6)).map((s) => s.type);
  return { type: top.type, types: Array.from(new Set([top.type, ...types])), score: top.score };
}

export type ContractTypeGuess = { type: ContractType; confidence: number };

export function detectContractType(fullText: string): ContractTypeGuess {
  const head = fullText.slice(0, 2000).toLowerCase();
  const all = fullText.toLowerCase();
  const scores = CONTRACT_TYPE_KEYS.filter((k) => k !== "other").map((key) => {
    let score = 0;
    for (const s of CONTRACT_TYPES[key].signals) score += count(head, s, 2) * 3 + count(all, s, 5);
    return { key, score };
  });
  // A CSR agreement is usually also a grant agreement; the CSR signals win.
  const csr = scores.find((s) => s.key === "csr")!;
  if (count(all, "corporate social responsibility", 1) || count(all, "csr", 3) >= 2) csr.score += 15;
  scores.sort((a, b) => b.score - a.score);
  const [first, second] = scores;
  if (!first || first.score < 4) return { type: "other", confidence: 0.3 };
  const confidence = Math.min(0.98, first.score / (first.score + (second?.score ?? 0) + 1));
  return { type: first.key, confidence: Math.round(confidence * 100) / 100 };
}
