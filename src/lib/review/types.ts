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
};

export type KeyTerm = { label: string; value: string; quote?: string; page?: number };

export type ClauseMatch = {
  heading: string;
  clauseType: string;
  page: number;
  quote: string;
  similarity: number | null; // best match in the repository, null when there was nothing to compare
  matchedDocument?: { id: string; title: string };
};

export type ReviewResult = {
  contractType: string;
  detectedType: string;
  detectedConfidence: number;
  summary: string;
  summarySource: "ai" | "rules";
  keyTerms: KeyTerm[];
  findings: Finding[];
  clauses: ClauseMatch[];
  comparedWith: { id: string; title: string; similarity: number; isTemplate: boolean }[];
  coverage: { expected: number; present: number; basis: "repository" | "baseline"; basisCount: number };
  checksRun: { legalRules: number; businessRules: number; repositoryDocs: number };
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
