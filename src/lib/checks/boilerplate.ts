import { classifyClause } from "../contracts/classify";
import type { Segment } from "../contracts/segment";
import { BASELINE_EXPECTED, CLAUSE_TYPES, clauseTypeLabel, contractTypeLabel, type ClauseType, type ContractType, type Severity, lowerLabel } from "../contracts/types";
import { cosine, TfIdf, tokenize, type Vector } from "../text/similarity";
import { DocText, excerpt, unwrapLines } from "../text/locate";
import type { ClauseMatch, Finding, ReviewResult } from "../review/types";
import { MODEL_CLAUSES, MODEL_CLAUSE_SOURCE } from "./model-clauses";
import type { LibraryEntry } from "../library";
import { displayClauseText } from "../library/parse";
import { pluralTypeName, splitTypes, usLawReference, validForPhrase } from "../library/interpret";

export type RepoDocument = {
  id: string;
  title: string;
  contractType: string;
  isTemplate: boolean;
  text: string;
  clauses: { heading: string; text: string; clauseType: string }[];
};

type RepoClause = {
  docId: string;
  docTitle: string;
  isTemplate: boolean;
  docType: string;
  heading: string;
  text: string;
  types: ClauseType[];
  vector: Vector;
};

const ALIGNED = 0.55;
const DIFFERENT = 0.25;
// A contract clause counts as a given clause-library version from here up.
// Measured on our contracts: clauses drafted from a library version 0.45+,
// unrelated drafting at most 0.39.
const LIBRARY_MATCH = 0.45;

type LibraryClause = LibraryEntry & { types: ClauseType[]; validTypes: ContractType[]; us: boolean; vector: Vector };

const librarySource = (l: LibraryEntry) => `Clause library: ${l.topic} (${l.label}${l.variant === "standard" ? ", standard" : ""})`;
// written for this kind of contract (or for any), whatever its legal system
const meantFor = (l: LibraryClause, contractType: string) => !l.validTypes.length || l.validTypes.includes(contractType as ContractType);
// safe to offer as wording for this contract
const fits = (l: LibraryClause, contractType: string) => !l.us && meantFor(l, contractType);

// The library version to use for this kind of contract: one written for it,
// else the standard version, else any version that is not limited elsewhere.
function libraryChoice(entries: LibraryClause[], contractType: string): LibraryClause | undefined {
  const usable = entries.filter((l) => fits(l, contractType));
  return (
    usable.find((l) => l.validTypes.includes(contractType as ContractType)) ??
    usable.find((l) => l.variant === "standard") ??
    usable[0]
  );
}

const downgrade: Record<Severity, Severity> = { critical: "high", high: "medium", medium: "low", low: "low", info: "info" };

// One-sided or unusual terms worth a second look in any contract.
const RISKY_TERMS: { re: RegExp; title: string; detail: string; severity: Severity; recommendation: string }[] = [
  {
    re: /unlimited liability|liability (?:shall be |is )?unlimited/i,
    title: "Unlimited liability",
    detail: "The contract exposes a party to liability with no cap.",
    severity: "high",
    recommendation: "Cap aggregate liability, typically at the contract value, with carve-outs only for fraud and wilful misconduct.",
  },
  {
    re: /indemnif[^.]{0,200}(?:indirect|consequential|loss of profits?|special damages)/i,
    title: "Indemnity extends to indirect or consequential losses",
    detail: "The indemnity appears to cover indirect, consequential or lost-profit losses, which can be open-ended.",
    severity: "medium",
    recommendation: "Limit the indemnity to direct losses caused by the indemnifying party's breach, negligence or misconduct.",
  },
  {
    re: /terminat[^.]{0,120}(?:at any time|without (?:any )?(?:prior )?notice|without (?:assigning|giving|stating) (?:any )?reasons?)/i,
    title: "Termination at will or without notice",
    detail: "One party can end the contract at any time or without notice. Check whether this right is mutual and whether spent or committed funds are protected.",
    severity: "medium",
    recommendation: "Make termination for convenience mutual, require at least 30 days' written notice, and protect costs already incurred or committed.",
  },
  {
    re: /(?:may|reserves? the right to)\s+(?:amend|modify|vary|change)[^.]{0,100}(?:at any time|unilaterally|(?:its|their) sole discretion)/i,
    title: "One party can change the terms alone",
    detail: "The contract lets one party amend terms without the other's agreement.",
    severity: "medium",
    recommendation: "Require amendments to be in writing and signed by both parties.",
  },
  {
    re: /(?:assign|vest|belong)[^.]{0,140}(?:pre-?existing|background) (?:intellectual property|ip)/i,
    title: "Pre-existing intellectual property may be transferred",
    detail: "The IP clause appears to reach intellectual property that existed before this contract.",
    severity: "high",
    recommendation: "Each party should keep its pre-existing IP; only grant a licence to it where needed for the project.",
  },
  {
    re: /refund (?:the )?(?:entire|full|whole|total|all(?: of the)?) (?:grant|amount|funds?|contribution)/i,
    title: "Full refund of funds, including spent amounts",
    detail: "The contract may require the full amount to be returned, not just unspent funds.",
    severity: "high",
    recommendation: "Limit refunds to unspent or misused funds; spent and committed funds used per the budget should not be clawed back.",
  },
  {
    re: /claw-?back/i,
    title: "Clawback right",
    detail: "The contract includes a clawback. Check the triggers and that it is limited to misused or unspent funds.",
    severity: "medium",
    recommendation: "Tie clawback to specific, objective triggers such as proven misuse, with a right to respond first.",
  },
];

function presentInText(doc: DocText, type: ClauseType): boolean {
  const def = CLAUSE_TYPES[type];
  // a sub-heading somewhere: on its own line ("Governing Law"), or inline
  // after a sub-clause number ("18.2 Amendment: any amendment…")
  for (const h of def.heading) {
    const word = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ownLine = new RegExp(`(^|\\n)\\s*(?:\\d{1,2}(?:\\.\\d{1,2})*\\.?\\s*)?${word}[a-z]*\\b[^\\n]{0,40}(\\n|[.:])`, "i");
    const inline = new RegExp(`\\b\\d{1,2}\\.\\d{1,2}\\.?\\s+${word}[a-z]*\\s*[:.\\-–]`, "i");
    if (ownLine.test(doc.full) || inline.test(doc.flat)) return true;
  }
  let hits = 0;
  for (const b of def.body) if (doc.lower.includes(b)) hits++;
  return hits >= 2;
}

function pickSuggestion(type: ClauseType, repoClauses: RepoClause[], library: LibraryClause[], contractType: string, docScores: Map<string, number>) {
  const candidates = repoClauses.filter((c) => c.types[0] === type);
  candidates.sort((a, b) => {
    const rank = (c: RepoClause) => (c.isTemplate ? 2 : 0) + (c.docType === contractType ? 1 : 0) + (docScores.get(c.docId) ?? 0);
    return rank(b) - rank(a);
  });
  const fromRepo = (c: RepoClause) => ({ text: unwrapLines(c.text), source: c.docTitle + (c.isTemplate ? " (approved template)" : ""), documentId: c.docId });
  const fromLibrary = (l: LibraryClause) => ({ text: displayClauseText(l.text), source: librarySource(l) });
  // Only library topics that are the clause itself ("Effect of Termination"
  // for termination), not one aspect of it ("Marking" for confidentiality).
  const whole = library.filter((l) => l.types[0] === type && CLAUSE_TYPES[type].heading.some((h) => l.topic.toLowerCase().includes(h)));
  const lib = libraryChoice(whole, contractType);
  // An approved template wins, then a library version written for this kind
  // of contract, then our own past drafting, the starter wording, and last
  // the library's general version.
  if (candidates[0]?.isTemplate) return fromRepo(candidates[0]);
  if (lib?.validTypes.includes(contractType as ContractType)) return fromLibrary(lib);
  if (candidates[0]) return fromRepo(candidates[0]);
  const model = MODEL_CLAUSES[type];
  if (model) return { text: model, source: MODEL_CLAUSE_SOURCE };
  return lib ? fromLibrary(lib) : undefined;
}

export function runBoilerplateCheck(input: {
  doc: DocText;
  segments: Segment[];
  contractType: ContractType;
  repository: RepoDocument[];
  library?: LibraryEntry[];
}): Pick<ReviewResult, "clauses" | "comparedWith" | "coverage"> & { findings: Finding[] } {
  const { doc, segments, contractType, repository, library: libraryEntries = [] } = input;
  const findings: Finding[] = [];
  // Ids and rule keys describe what a finding is about, not its order, so
  // feedback stays attached to the right finding across re-runs and reviews.
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Build a shared vocabulary over the repository and this contract.
  const repoClauses: RepoClause[] = [];
  const tokenised = repository.flatMap((d) =>
    d.clauses.map((c) => ({ d, c, tokens: tokenize(c.text) }))
  );
  const segTokens = segments.map((s) => tokenize(s.text));
  const libTokens = libraryEntries.map((l) => tokenize(`${l.title} ${l.text}`));
  const idf = new TfIdf([...tokenised.map((t) => t.tokens), ...libTokens, ...segTokens]);
  const library: LibraryClause[] = libraryEntries.map((l, i) => ({
    ...l,
    types: [l.clauseType as ClauseType],
    validTypes: splitTypes(l.validFor),
    us: l.jurisdiction === "us",
    vector: idf.vector(libTokens[i]),
  }));
  for (const { d, c, tokens } of tokenised) {
    const classified = classifyClause(c.heading, c.text);
    repoClauses.push({
      docId: d.id,
      docTitle: d.title,
      isTemplate: d.isTemplate,
      docType: d.contractType,
      heading: c.heading,
      text: c.text,
      // the stored type comes first: people may have corrected it
      types: [c.clauseType as ClauseType, ...classified.types.filter((t) => t !== c.clauseType)],
      vector: idf.vector(tokens),
    });
  }

  // Whole-document similarity: which repository contracts is this closest to?
  const docIdf = new TfIdf([...repository.map((d) => tokenize(d.text)), tokenize(doc.full)]);
  const self = docIdf.vector(tokenize(doc.full));
  const comparedWith = repository
    .map((d) => ({ id: d.id, title: d.title, isTemplate: d.isTemplate, similarity: cosine(self, docIdf.vector(tokenize(d.text))) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map((c) => ({ ...c, similarity: Math.round(c.similarity * 100) / 100 }));
  const docScores = new Map(comparedWith.map((c) => [c.id, c.similarity]));

  // ── Coverage: which clauses should be here? ──
  const sameType = repository.filter((d) => d.contractType === contractType);
  let expected: ClauseType[];
  let basis: "repository" | "baseline" = "baseline";
  const typeCounts = new Map<ClauseType, number>();
  if (sameType.length >= 2) {
    basis = "repository";
    for (const d of sameType) {
      const types = new Set(repoClauses.filter((c) => c.docId === d.id).flatMap((c) => c.types));
      for (const t of types) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }
    const learned = [...typeCounts].filter(([t, c]) => t !== "other" && c >= 2 && c / sameType.length >= 0.6).map(([t]) => t);
    const essentials = BASELINE_EXPECTED[contractType].filter((t) => CLAUSE_TYPES[t].importance === "high");
    expected = Array.from(new Set([...learned, ...essentials]));
  } else {
    expected = BASELINE_EXPECTED[contractType];
  }

  const presentTypes = new Set(segments.flatMap((s) => s.types));
  let present = 0;
  for (const type of expected) {
    if (presentTypes.has(type) || presentInText(doc, type)) {
      present++;
      continue;
    }
    const count = typeCounts.get(type);
    findings.push({
      id: `bp-missing-${type}`,
      ruleKey: `bp:missing:${type}`,
      check: "boilerplate",
      category: "Missing clause",
      title: `No ${lowerLabel(clauseTypeLabel(type))} clause`,
      detail:
        basis === "repository" && count
          ? `Found in ${count} of ${sameType.length} ${lowerLabel(contractTypeLabel(contractType))}s in the repository, but not in this contract.`
          : `A standard ${lowerLabel(contractTypeLabel(contractType))} usually includes ${/^[aeiou]/i.test(clauseTypeLabel(type)) ? "an" : "a"} ${lowerLabel(clauseTypeLabel(type))} clause.`,
      severity: CLAUSE_TYPES[type].importance,
      status: "issue",
      recommendation: "Add the clause, or confirm with the counterparty why it has been left out.",
      suggestion: pickSuggestion(type, repoClauses, library, contractType, docScores),
    });
  }

  // ── Clause-by-clause comparison against repository wording ──
  const clauses: ClauseMatch[] = segments.map((s, i) => {
    const vector = idf.vector(segTokens[i]);
    const candidates = repoClauses.filter((c) => s.type !== "other" && c.types.includes(s.type));
    let best: RepoClause | null = null;
    let bestScore = -1;
    for (const c of candidates) {
      const score = cosine(vector, c.vector) + (c.isTemplate ? 0.03 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    // The clause library version this clause was drafted from, if any.
    let lib: LibraryClause | null = null;
    let libScore = 0;
    for (const l of library) {
      if (s.type !== "other" ? !s.types.includes(l.types[0]) : l.types[0] !== "other") continue;
      const score = cosine(vector, l.vector);
      if (score > libScore) {
        libScore = score;
        lib = l;
      }
    }
    if (libScore < LIBRARY_MATCH) lib = null;
    // a close library version is a better reference than looser repository drafting
    const libraryIsReference = !!lib && libScore > bestScore;
    if (libraryIsReference) bestScore = libScore;

    const similarity = best || libraryIsReference ? Math.min(1, Math.round(bestScore * 100) / 100) : null;
    const quote = excerpt(s.text, 200);
    const label = clauseTypeLabel(s.type);
    const importance = CLAUSE_TYPES[s.type].importance;
    const reference = libraryIsReference && lib ? librarySource(lib) : best?.docTitle;
    const referenceSuggestion = libraryIsReference && lib
      ? { text: displayClauseText(lib.text), source: librarySource(lib) }
      : best
        ? { text: unwrapLines(best.text), source: best.docTitle + (best.isTemplate ? " (approved template)" : ""), documentId: best.docId }
        : undefined;

    if (reference && similarity !== null && s.type !== "parties" && s.type !== "signatures") {
      const pct = Math.round(similarity * 100);
      if (similarity >= ALIGNED) {
        findings.push({
          id: `bp-wording-${s.position}`, ruleKey: `bp:wording:${s.type}`, check: "boilerplate", category: label, status: "pass", severity: "info",
          title: `${label} follows standard wording`,
          detail: `${pct}% similar to "${reference}".`,
          quote, page: s.page,
        });
      } else {
        findings.push({
          id: `bp-wording-${s.position}`, ruleKey: `bp:wording:${s.type}`, check: "boilerplate", category: label, status: "warning",
          severity: similarity >= DIFFERENT ? downgrade[importance] : importance === "info" ? "low" : downgrade[importance],
          title: similarity >= DIFFERENT ? `${label} differs from standard wording` : `${label} is drafted unlike anything in the repository`,
          detail: `Closest standard wording is "${reference}" at ${pct}% similarity. Compare the two before accepting this wording.`,
          quote, page: s.page,
          recommendation: "Read this clause against the standard version and keep any departures deliberate.",
          suggestion: referenceSuggestion,
        });
      }
    }

    // ── Is this the right version for this kind of contract? ──
    const usRef = usLawReference(s.text);
    if (usRef) {
      const alt = lib ? libraryChoice(library.filter((l) => l.topic === lib!.topic), contractType) : undefined;
      findings.push({
        id: `lib-us-law-${s.position}`, ruleKey: `lib:us-law:${s.type}`, check: "boilerplate", category: "Clause library", status: "warning", severity: "medium",
        title: `${label} clause relies on US law`,
        detail:
          `It refers to "${usRef}", which only has meaning under US law` +
          (lib ? `, like the clause library's "${lib.topic}" (${lib.label}) it closely follows` : "") +
          `. In a contract under Indian law it may have no effect or the wrong one.`,
        quote: excerpt(s.text, 200), page: s.page,
        recommendation: "Replace it with an Indian-law equivalent, or delete it if it does not apply to this contract.",
        suggestion: alt ? { text: displayClauseText(alt.text), source: librarySource(alt) } : undefined,
      });
    }
    if (lib && !meantFor(lib, contractType)) {
      const alt = libraryChoice(library.filter((l) => l.topic === lib!.topic && l.id !== lib!.id), contractType);
      findings.push({
        id: `lib-context-${s.position}`, ruleKey: `lib:context:${s.type}`, check: "boilerplate", category: "Clause library", status: "warning",
        severity: importance === "high" ? "medium" : "low",
        title: `${lib.topic}: version meant for ${validForPhrase(lib.validTypes)}`,
        detail:
          `This clause follows the clause library's "${lib.label}" version (${Math.round(libScore * 100)}% similar), which is meant for ${validForPhrase(lib.validTypes)}, not ${pluralTypeName(contractType)}.` +
          (alt ? ` For this kind of contract the library uses "${alt.label}".` : " The library has no version for this kind of contract."),
        quote: excerpt(s.text, 200), page: s.page,
        recommendation: alt ? "Check the clause suits this contract, or switch to the library's version for it." : "Check the clause suits this contract before accepting it.",
        suggestion: alt ? { text: displayClauseText(alt.text), source: librarySource(alt) } : undefined,
      });
    }

    if (s.type === "other" && repoClauses.length > 0 && repository.length >= 3 && s.text.length > 200) {
      let top = 0;
      for (const c of repoClauses) top = Math.max(top, cosine(vector, c.vector));
      for (const l of library) top = Math.max(top, cosine(vector, l.vector));
      if (top < 0.2) {
        findings.push({
          id: `bp-unfamiliar-${s.position}`, ruleKey: "bp:unfamiliar", check: "boilerplate", category: "Unfamiliar clause", status: "warning", severity: "low",
          title: `Unfamiliar clause: ${s.heading}`,
          detail: "Nothing similar appears in the repository. Read it carefully: unusual clauses are where unexpected obligations tend to sit.",
          quote, page: s.page,
        });
      }
    }

    return {
      heading: s.heading,
      clauseType: s.type,
      page: s.page,
      quote,
      similarity,
      matchedDocument: best && !libraryIsReference ? { id: best.docId, title: best.docTitle } : undefined,
      library: lib
        ? { topic: lib.topic, label: lib.label, variant: lib.variant, similarity: Math.round(libScore * 100) / 100, validFor: lib.validTypes, fits: meantFor(lib, contractType) && !usRef }
        : undefined,
    };
  });

  // ── One-sided terms ──
  for (const r of RISKY_TERMS) {
    const hit = doc.find(r.re);
    if (!hit) continue;
    findings.push({
      id: `bp-onesided-${slug(r.title)}`, ruleKey: `bp:one-sided:${slug(r.title)}`, check: "boilerplate", category: "One-sided term", status: "issue", severity: r.severity,
      title: r.title, detail: r.detail, quote: hit.quote, page: hit.page, recommendation: r.recommendation,
    });
  }

  return {
    findings,
    clauses,
    comparedWith,
    coverage: { expected: expected.length, present, basis, basisCount: sameType.length },
  };
}
