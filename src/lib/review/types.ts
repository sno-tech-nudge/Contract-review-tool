import type { Severity } from "../contracts/types";

export type { Severity };

export type CheckKind = "boilerplate" | "legal" | "business" | "ai";
export type FindingStatus = "issue" | "warning" | "pass";

export type Finding = {
  id: string;
  check: CheckKind;
  category: string; // e.g. "FCRA", "Missing clause", "Termination"
  title: string;
  detail: string;
  severity: Severity;
  status: FindingStatus;
  quote?: string; // text from the contract, used to locate and highlight it
  page?: number;
  recommendation?: string;
  reference?: string; // law or source the finding rests on
  suggestion?: { text: string; source: string; documentId?: string };
  // Identifies the check across reviews, so feedback on it can be learned from.
  ruleKey?: string;
  // Set when past feedback changed this finding (see src/lib/learning/calibration.ts).
  learning?: { effect: "muted" | "downgraded" | "promoted"; reason: string; originalSeverity: Severity };
};

// Findings saved before rule keys existed get one derived from their id.
export function ruleKeyOf(f: Pick<Finding, "id" | "ruleKey" | "check" | "category" | "title">): string {
  if (f.ruleKey) return f.ruleKey;
  if (f.id.startsWith("legal-")) return `legal:${f.id.slice(6)}`;
  if (f.id.startsWith("biz-")) return `biz:${f.id.slice(4)}`;
  return `${f.check}:${(f.category + " " + f.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}`;
}

export const isMuted = (f: Finding) => f.learning?.effect === "muted";

export type KeyTerm = { label: string; value: string; quote?: string; page?: number };

export type ClauseMatch = {
  heading: string;
  section?: string; // the article or part it sits in
  clauseType: string;
  page: number;
  quote: string;
  similarity: number | null; // best match in the repository, null when there was nothing to compare
  matchedDocument?: { id: string; title: string };
  // the clause library version it most resembles, when the resemblance is close
  library?: { topic: string; label: string; variant: string; similarity: number; validFor: string[]; fits: boolean };
};

export type ReviewResult = {
  contractType: string;
  detectedType: string;
  detectedConfidence: number;
  detectedLearned?: boolean; // the type came from the model trained on corrections
  summary: string;
  summarySource: "ai" | "rules";
  keyTerms: KeyTerm[];
  findings: Finding[];
  clauses: ClauseMatch[];
  comparedWith: { id: string; title: string; similarity: number; isTemplate: boolean }[];
  coverage: { expected: number; present: number; basis: "repository" | "baseline"; basisCount: number };
  checksRun: { legalRules: number; businessRules: number; repositoryDocs: number; libraryClauses?: number };
  ai: { status: "off" | "pending" | "done" | "failed"; model?: string; error?: string };
};

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Note",
};

// Issues count fully, warnings half. The total is eased onto 0-100 so a few
// serious problems already read as high risk without everything saturating.
const WEIGHT: Record<Severity, number> = { critical: 25, high: 12, medium: 5, low: 2, info: 0 };

export function riskScore(findings: Finding[]): number {
  let points = 0;
  for (const f of findings) {
    if (isMuted(f)) continue;
    if (f.status === "issue") points += WEIGHT[f.severity];
    else if (f.status === "warning") points += WEIGHT[f.severity] / 2;
  }
  return Math.round(100 * (1 - Math.exp(-points / 80)));
}

export function riskBand(score: number): { label: string; tone: "moss" | "gold" | "clay" } {
  if (score >= 50) return { label: "High risk", tone: "clay" };
  if (score >= 20) return { label: "Needs attention", tone: "gold" };
  return { label: "Low risk", tone: "moss" };
}
