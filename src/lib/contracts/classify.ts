import { CLAUSE_TYPES, CLAUSE_TYPE_KEYS, CONTRACT_TYPES, CONTRACT_TYPE_KEYS, type ClauseType, type ContractType } from "./types";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cache = new Map<string, RegExp>();

function count(text: string, phrase: string, cap = 5): number {
  let re = cache.get(phrase);
  if (!re) {
    // word boundaries only where the phrase starts/ends with a word character
    const pre = /^\w/.test(phrase) ? "\\b" : "";
    // stems take any ending ("indemn" → "indemnifies", "severab" → "severability");
    // short words only a few letters, so "term" does not match "termination"
    const lastWord = /(\w+)$/.exec(phrase)?.[1] ?? "";
    const post = /\w$/.test(phrase) ? (lastWord.length >= 5 ? "(?:\\w{0,12})\\b" : "(?:\\w{0,4})\\b") : "";
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
  const h = heading.replace(/\s+/g, " ").toLowerCase();
  const body = text.slice(0, 1500).replace(/\s+/g, " ").toLowerCase();
  const scored: { type: ClauseType; score: number; headingHit: boolean }[] = [];
  for (const key of CLAUSE_TYPE_KEYS) {
    if (key === "other") continue;
    const def = CLAUSE_TYPES[key];
    let headingHits = 0;
    for (const k of def.heading) headingHits += count(h, k, 1);
    let bodyHits = 0;
    for (const k of def.body) bodyHits += count(body, k, 3);
    let strongHits = 0;
    for (const k of (def as { strong?: readonly string[] }).strong ?? []) strongHits += count(body, k, 1);
    const score = headingHits * 5 + bodyHits + Math.min(2, strongHits) * 3;
    if (score > 0) scored.push({ type: key, score, headingHit: headingHits > 0 || strongHits > 0 });
  }
  if (isPreamble && /between|hereinafter|whereas/i.test(body)) scored.push({ type: "parties", score: 50, headingHit: true });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score < 2) return { type: "other", types: [], score: 0 };
  const types = scored.filter((s) => s.headingHit || s.score >= Math.max(4, top.score * 0.6)).map((s) => s.type);
  return { type: top.type, types: Array.from(new Set([top.type, ...types])), score: top.score };
}

export type ContractTypeGuess = { type: ContractType; confidence: number };

// Phrases that name the kind of document, usually in its title. These decide
// the type far more reliably than how often generic words appear. The opening
// pages are searched because signed copies often start with stamp paper.
const TITLE_PHRASES: Partial<Record<ContractType, string[]>> = {
  csr: ["corporate social responsibility grant agreement", "csr grant agreement", "csr agreement", "csr project agreement", "confirmation of project"],
  grant: ["grant agreement", "financial support agreement", "grant letter", "sanction letter", "letter of grant"],
  partnership: ["collaboration agreement", "partnership agreement", "data sharing agreement", "implementation partner agreement", "implementing partner agreement", "sub-grant agreement", "subgrant agreement", "designated partner", "implementing partner", "confirming party"],
  mou: ["memorandum of understanding", "memorandum of agreement"],
  service: ["service agreement", "services agreement", "vendor agreement", "purchase order", "statement of work", "software license agreement", "software licence agreement", "subscription agreement", "reseller agreement", "catering agreement", "product sales agreement"],
  consultancy: ["consultancy agreement", "consulting agreement", "consultant agreement", "terms of engagement", "independent contractor agreement"],
  nda: ["non-disclosure agreement", "nondisclosure agreement", "confidentiality agreement", "mutual nda"],
  employment: ["employment agreement", "appointment letter", "offer letter", "letter of appointment", "fellowship agreement", "severance agreement"],
  donation: ["donation agreement", "gift deed", "deed of donation"],
  lease: ["lease deed", "lease agreement", "leave and licence agreement", "leave and license agreement", "rent agreement"],
};

// An MoU title says little about substance (CSR projects are often MoUs), so
// it counts for less than the others.
const TITLE_WEIGHT = (type: ContractType) => (type === "mou" ? 20 : 40);
const GENERIC_CAP = 12;

export function detectContractType(fullText: string): ContractTypeGuess {
  // PDF line breaks split phrases across lines, so match on flattened text.
  const all = fullText.replace(/\s+/g, " ").toLowerCase();
  const head = all.slice(0, 6000);
  const scores = CONTRACT_TYPE_KEYS.filter((k) => k !== "other").map((key) => {
    let generic = 0;
    for (const s of CONTRACT_TYPES[key].signals) generic += count(head, s, 2) * 2 + count(all, s, 5);
    let score = Math.min(GENERIC_CAP, generic);
    if (TITLE_PHRASES[key]?.some((p) => count(head, p, 1))) score += TITLE_WEIGHT(key);
    return { key, score };
  });
  // Money given under a company's CSR obligation is a CSR agreement, whatever
  // the document calls itself (MoU, grant agreement, project letter).
  const csrMentions = count(all, "corporate social responsibility", 5) + count(all, "csr", 5) + count(all, "section 135", 2) * 2 + count(all, "schedule vii", 2) * 2;
  if (csrMentions >= 2) scores.find((s) => s.key === "csr")!.score += 35;
  scores.sort((a, b) => b.score - a.score);
  const [first, second] = scores;
  if (!first || first.score < 4) return { type: "other", confidence: 0.3 };
  const confidence = Math.min(0.98, first.score / (first.score + (second?.score ?? 0) + 1));
  return { type: first.key, confidence: Math.round(confidence * 100) / 100 };
}
