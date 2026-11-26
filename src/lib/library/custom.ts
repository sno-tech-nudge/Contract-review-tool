import { prisma } from "../db";
import type { Segment } from "../contracts/segment";
import { categoryLabel, type Severity } from "../contracts/types";
import { validForPhrase } from "./interpret";
import { entityLabel } from "../contracts/entities";
import { cosine, TfIdf, tokenize } from "../text/similarity";
import type { DocText } from "../text/locate";
import { excerpt } from "../text/locate";
import type { Finding } from "../review/types";

// Clauses the team defines in the clause library (operational terms,
// programme requirements) and the check that looks for them in a contract.

export type CustomClause = {
  id: string;
  name: string;
  category: string;
  description: string;
  phrases: string[];
  standardText: string;
  contractTypes: string[];
  entities: string[];
  required: boolean;
  severity: Severity;
  enabled: boolean;
  createdBy: string;
};

const split = (v: string) => v.split(";").map((x) => x.trim()).filter(Boolean);
export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

export async function loadCustomClauses(): Promise<CustomClause[]> {
  const rows = await prisma.customClause.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  return rows.map((r) => ({
    ...r,
    phrases: split(r.phrases),
    contractTypes: split(r.contractTypes),
    entities: split(r.entities),
    severity: (SEVERITIES as string[]).includes(r.severity) ? (r.severity as Severity) : "medium",
  }));
}

export const appliesTo = (c: CustomClause, contractType: string, entity: string) =>
  c.enabled && (!c.contractTypes.length || c.contractTypes.includes(contractType)) && (!c.entities.length || (!!entity && c.entities.includes(entity)));

// "CSR agreements and grant agreements for the*delta"
export function scopePhrase(c: Pick<CustomClause, "contractTypes" | "entities">): string {
  const types = c.contractTypes.length ? validForPhrase(c.contractTypes) : "every contract";
  return c.entities.length ? `${types}, for ${c.entities.map(entityLabel).join(" and ")}` : types;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Below this the clause is there but worded unlike the team's standard;
// above PRESENT a clause with no tell-tale phrase still counts as found.
const DIFFERENT = 0.3;
const PRESENT = 0.45;

export function runCustomClauseCheck(input: { doc: DocText; segments: Segment[]; contractType: string; entity: string; clauses: CustomClause[] }) {
  const { doc, segments, contractType, entity } = input;
  const clauses = input.clauses.filter((c) => appliesTo(c, contractType, entity));
  const findings: Finding[] = [];
  let present = 0;
  if (!clauses.length) return { findings, expected: 0, present };

  const segTokens = segments.map((s) => tokenize(s.text));
  const idf = new TfIdf([...segTokens, ...clauses.map((c) => tokenize(c.standardText))]);
  const segVectors = segTokens.map((t) => idf.vector(t));

  for (const c of clauses) {
    const source = `Your clause library: ${c.name}`;
    const base = { id: `custom-${c.id}`, ruleKey: `custom:${c.id}`, check: "boilerplate" as const, category: "Your clauses" };
    const standard = c.standardText ? idf.vector(tokenize(c.standardText)) : null;
    const similarityOf = (s: Segment) => (standard ? cosine(segVectors[segments.indexOf(s)], standard) : null);

    // a tell-tale phrase, or a heading with the clause's name
    let where: { quote: string; page: number; segment?: Segment; phrase: string } | null = null;
    for (const p of [...c.phrases, c.name]) {
      const isName = p === c.name;
      const re = isName ? new RegExp(`(?:^|\\n)\\s*(?:\\d{1,2}(?:\\.\\d{1,2})*[.)]?\\s*)?${escape(p).replace(/\s+/g, "\\s+")}\\b`, "i") : new RegExp(escape(p).replace(/\s+/g, "\\s+"), "i");
      const hit = doc.find(re);
      if (hit) {
        const lower = p.toLowerCase();
        where = { quote: hit.quote, page: hit.page, phrase: p, segment: segments.find((s) => s.text.replace(/\s+/g, " ").toLowerCase().includes(lower)) };
        break;
      }
    }
    // no phrase: the closest clause, if it is close to the standard wording
    if (!where && standard) {
      let best: Segment | null = null;
      let bestScore = 0;
      for (const s of segments) {
        const score = similarityOf(s) ?? 0;
        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }
      if (best && bestScore >= PRESENT) where = { quote: excerpt(best.text, 200), page: best.page, segment: best, phrase: "" };
    }

    if (where) {
      if (c.required) present++;
      const sim = where.segment ? similarityOf(where.segment) : null;
      if (sim !== null && sim < DIFFERENT) {
        findings.push({
          ...base, status: "warning", severity: "low",
          title: `${c.name} differs from your standard wording`,
          detail: `The clause is there, but only ${Math.round(sim * 100)}% similar to the wording in your clause library.${c.description ? ` It should cover: ${c.description}` : ""}`,
          quote: excerpt(where.segment!.text, 200), page: where.page,
          recommendation: "Compare it with your standard wording and keep any differences deliberate.",
          suggestion: { text: c.standardText, source },
        });
      } else {
        findings.push({
          ...base, status: "pass", severity: "info",
          title: `${c.name} is included`,
          detail: sim !== null ? `${Math.round(sim * 100)}% similar to your standard wording.` : where.phrase && where.phrase !== c.name ? `Found "${where.phrase}".` : "Found a clause with this heading.",
          quote: where.quote, page: where.page,
        });
      }
      continue;
    }

    findings.push({
      ...base,
      status: c.required ? "issue" : "warning",
      severity: c.required ? c.severity : "low",
      title: c.required ? `No ${c.name} clause` : `Optional clause not found: ${c.name}`,
      detail:
        (c.description ? `${c.description} ` : "") +
        `Your clause library ${c.required ? "requires" : "suggests"} it in ${scopePhrase(c)} (${categoryLabel(c.category).toLowerCase()}).`,
      recommendation: c.standardText ? "Add it using your standard wording." : "Add the clause, or confirm with the counterparty why it is left out.",
      suggestion: c.standardText ? { text: c.standardText, source } : undefined,
    });
  }
  return { findings, expected: clauses.filter((c) => c.required).length, present };
}
