import { prisma } from "../db";
import { segment } from "../contracts/segment";
import { CONTRACT_TYPE_KEYS, type ContractType } from "../contracts/types";
import { runBoilerplateCheck } from "../checks/boilerplate";
import { ensureStarterRules, runBusinessCheck } from "../checks/business";
import { extractKeyTerms, ruleSummary } from "../checks/keyterms";
import { disabledLegalRules, runLegalCheck } from "../checks/legal";
import { DocText } from "../text/locate";
import { aiEnabled, aiModel } from "../ai/claude";
import { guessContractType, learnContractType, learnedClauseType, loadLearnedModels } from "../learning";
import { applyCalibration, loadCalibration } from "../learning/calibration";
import { loadLibrary } from "../library";
import { loadCustomClauses, runCustomClauseCheck } from "../library/custom";
import { isMuted, riskScore, SEVERITY_ORDER, type Finding, type ReviewResult } from "./types";

const STATUS_ORDER = { issue: 0, warning: 1, pass: 2 } as const;

// What a review in progress shows, in order.
export const REVIEW_STAGES = [
  "Reading the contract",
  "Splitting it into clauses",
  "Comparing wording with the repository and clause library",
  "Checking the law",
  "Checking business rules",
  "Scoring the risk",
] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
}

// Runs all three checks on a stored document and saves (or refreshes) its review.
export async function runReview(documentId: string, opts: { contractType?: ContractType; reviewId?: string; onStage?: (stage: ReviewStage) => Promise<unknown> } = {}) {
  const stage = (s: ReviewStage) => opts.onStage?.(s);
  await stage("Reading the contract");
  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  const doc = new DocText(JSON.parse(document.pagesJson) as string[]);
  const models = await loadLearnedModels();
  const detected = guessContractType(doc.full, models);
  const contractType: ContractType =
    opts.contractType && CONTRACT_TYPE_KEYS.includes(opts.contractType)
      ? opts.contractType
      : (document.contractType as ContractType) || detected.type;

  if (contractType !== document.contractType) {
    await prisma.document.update({ where: { id: documentId }, data: { contractType } });
  }
  // Someone picked the type by hand: remember it so detection improves.
  if (opts.contractType && opts.contractType === contractType) {
    await learnContractType(documentId, document.title, doc.full, contractType, detected.type);
  }

  await ensureStarterRules();
  const [repository, disabled, businessRules, calibration, library, customClauses] = await Promise.all([
    prisma.document.findMany({
      where: { kind: "REPOSITORY" },
      select: { id: true, title: true, contractType: true, entity: true, isTemplate: true, text: true, clauses: { select: { heading: true, text: true, clauseType: true } } },
    }),
    disabledLegalRules(),
    prisma.businessRule.findMany({ orderBy: { createdAt: "asc" } }),
    loadCalibration(),
    loadLibrary(),
    loadCustomClauses(),
  ]);

  await stage("Splitting it into clauses");
  const segments = segment(doc, (h, t) => learnedClauseType(h, t, models));
  await stage("Comparing wording with the repository and clause library");
  const boilerplate = runBoilerplateCheck({ doc, segments, contractType, repository, library, entity: document.entity });
  // clauses the team added to the clause library for this kind of contract
  const custom = runCustomClauseCheck({ doc, segments, contractType, entity: document.entity, clauses: customClauses });
  boilerplate.findings.push(...custom.findings);
  boilerplate.coverage = { ...boilerplate.coverage, expected: boilerplate.coverage.expected + custom.expected, present: boilerplate.coverage.present + Math.min(custom.present, custom.expected) };
  await stage("Checking the law");
  const legal = runLegalCheck(doc, contractType, disabled);
  await stage("Checking business rules");
  const business = runBusinessCheck(doc, segments, contractType, businessRules);
  await stage("Scoring the risk");
  const keyTerms = extractKeyTerms(doc);

  // Past feedback mutes, lowers or raises checks for this contract type.
  const findings = sortFindings(applyCalibration([...boilerplate.findings, ...legal.findings, ...business.findings], contractType, calibration));

  // Keep any AI findings from an earlier run of the same review.
  let previousAi: Finding[] = [];
  let previous: ReviewResult | null = null;
  if (opts.reviewId) {
    const existing = await prisma.review.findUnique({ where: { id: opts.reviewId } });
    // a review still being created has no earlier results to keep
    if (existing && existing.status === "COMPLETE") {
      previous = JSON.parse(existing.resultJson) as ReviewResult;
      previousAi = applyCalibration(
        previous.findings.filter((f) => f.check === "ai").map(({ learning, ...f }) => ({ ...f, severity: learning?.originalSeverity ?? f.severity })),
        contractType,
        calibration
      );
    }
  }

  const result: ReviewResult = {
    contractType,
    entity: document.entity,
    detectedType: detected.type,
    detectedConfidence: detected.confidence,
    detectedLearned: detected.learned,
    summary: previous?.summarySource === "ai" ? previous.summary : ruleSummary(contractType, keyTerms, findings.filter((f) => !isMuted(f))),
    summarySource: previous?.summarySource === "ai" ? "ai" : "rules",
    keyTerms: previous?.summarySource === "ai" && previous.keyTerms.length ? previous.keyTerms : keyTerms,
    findings: sortFindings([...findings, ...previousAi]),
    clauses: boilerplate.clauses,
    comparedWith: boilerplate.comparedWith,
    coverage: boilerplate.coverage,
    checksRun: { legalRules: legal.rulesRun, businessRules: business.rulesRun, repositoryDocs: repository.length, libraryClauses: library.length },
    ai: previous?.ai.status === "done" ? previous.ai : aiEnabled() ? { status: "pending", model: aiModel() } : { status: "off" },
  };

  const data = { contractType, riskScore: riskScore(result.findings), resultJson: JSON.stringify(result), status: "COMPLETE", stage: "", error: "" };
  if (opts.reviewId) return prisma.review.update({ where: { id: opts.reviewId }, data });
  return prisma.review.create({ data: { ...data, documentId } });
}
