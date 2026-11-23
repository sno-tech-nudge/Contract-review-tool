import { prisma } from "../db";
import { classifyClause, detectContractType } from "../contracts/classify";
import { NearestExamples } from "./classifier";
import { CLAUSE_MATCH, CONTRACT_MATCH } from "./index";

// How accurate the tool is on the team's own data, measured live so it works
// in production where the offline test set (npm run eval) cannot go.
//
// Type detection is scored leave-one-out: each contract or clause a person
// labelled is classified by a model trained on all the others, then compared
// with the person's label. "Rules alone" is the same without what was learned,
// so the gap between the two is what learning has added.

export type TypeAccuracy = { tested: number; learned: number; rulesOnly: number } | null;
export type CheckPrecision = { check: string; useful: number; notRelevant: number; precision: number };
export type Accuracy = { contractType: TypeAccuracy; clauseType: TypeAccuracy; checks: CheckPrecision[] };

const MAX_TESTS = 300;

function leaveOneOut(
  examples: { label: string; text: string; sourceId: string }[],
  isTest: (e: { sourceId: string }) => boolean,
  threshold: number,
  rules: (text: string) => string
): TypeAccuracy {
  const tests = examples.map((e, i) => ({ e, i })).filter(({ e }) => isTest(e)).slice(0, MAX_TESTS);
  if (tests.length < 2) return null;
  let learned = 0;
  let rulesOnly = 0;
  for (const { e, i } of tests) {
    const others = examples.filter((_, j) => j !== i);
    const match = new NearestExamples(others).nearest(e.text);
    const byRules = rules(e.text);
    const guess = match && match.similarity >= threshold ? match.label : byRules;
    if (guess === e.label) learned++;
    if (byRules === e.label) rulesOnly++;
  }
  return { tested: tests.length, learned: learned / tests.length, rulesOnly: rulesOnly / tests.length };
}

export async function measureAccuracy(): Promise<Accuracy> {
  const [examples, feedback] = await Promise.all([
    prisma.trainingExample.findMany({ select: { kind: true, label: true, text: true, sourceId: true } }),
    prisma.findingFeedback.groupBy({ by: ["check", "verdict"], _count: { _all: true } }),
  ]);

  const contracts = examples.filter((e) => e.kind === "contract_type");
  const clauses = examples.filter((e) => e.kind === "clause_type");

  const checks = new Map<string, CheckPrecision>();
  for (const row of feedback) {
    const c = checks.get(row.check) ?? { check: row.check, useful: 0, notRelevant: 0, precision: 0 };
    if (row.verdict === "useful") c.useful += row._count._all;
    else c.notRelevant += row._count._all;
    checks.set(row.check, c);
  }
  for (const c of checks.values()) c.precision = c.useful / Math.max(1, c.useful + c.notRelevant);

  return {
    contractType: leaveOneOut(contracts, () => true, CONTRACT_MATCH, (text) => detectContractType(text).type),
    // tested on clauses people corrected; clause-library wording only helps train
    clauseType: leaveOneOut(clauses, (e) => !e.sourceId.startsWith("library:"), CLAUSE_MATCH, (text) => classifyClause("", text).type),
    checks: [...checks.values()].sort((a, b) => b.useful + b.notRelevant - (a.useful + a.notRelevant)),
  };
}
