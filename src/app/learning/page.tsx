import { prisma } from "@/lib/db";
import { LEGAL_RULES } from "@/lib/checks/legal/rules";
import { decide, loadCalibration, precision } from "@/lib/learning/calibration";
import { suggestPhrase } from "@/lib/learning/suggest";
import type { ReviewResult } from "@/lib/review/types";
import { LearningDashboard, type RuleRow, type SuggestionRow } from "@/components/learning/LearningDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Learning · Contract review" };

export default async function LearningPage() {
  const [calibration, feedbackRows, overrides, missed, examples, events, recent, repoDocs] = await Promise.all([
    loadCalibration(),
    prisma.findingFeedback.findMany({ select: { ruleKey: true, check: true, title: true, contractType: true, verdict: true }, orderBy: { updatedAt: "desc" } }),
    prisma.ruleOverride.findMany(),
    prisma.missedIssue.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" }, include: { review: { select: { id: true, document: { select: { title: true } } } } } }),
    prisma.trainingExample.groupBy({ by: ["kind", "label"], _count: { _all: true } }),
    prisma.learningEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.review.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { contractType: true, resultJson: true } }),
    prisma.document.findMany({ where: { kind: "REPOSITORY" }, select: { text: true } }),
  ]);

  // One row per check and contract type that has votes or a manual setting.
  const meta = new Map<string, { title: string; check: string }>();
  for (const f of feedbackRows) if (!meta.has(f.ruleKey)) meta.set(f.ruleKey, { title: f.title, check: f.check });
  for (const r of LEGAL_RULES) if (!meta.has(`legal:${r.id}`)) meta.set(`legal:${r.id}`, { title: r.title, check: "legal" });
  const pairs = new Set<string>([...feedbackRows.map((f) => `${f.ruleKey}|${f.contractType}`), ...overrides.map((o) => `${o.ruleKey}|${o.contractType}`)]);
  const rules: RuleRow[] = [...pairs].map((pair) => {
    const [ruleKey, contractType] = pair.split("|");
    const votes = calibration.votes.get(pair) ?? { useful: 0, notRelevant: 0 };
    const d = decide(calibration, ruleKey, contractType);
    return {
      ruleKey,
      contractType,
      title: meta.get(ruleKey)?.title ?? ruleKey,
      check: meta.get(ruleKey)?.check ?? ruleKey.split(":")[0],
      useful: votes.useful,
      notRelevant: votes.notRelevant,
      precision: precision(votes),
      effect: d.effect,
      mode: (overrides.find((o) => o.ruleKey === ruleKey && o.contractType === contractType)?.mode as "on" | "off" | undefined) ?? "auto",
    };
  });
  rules.sort((a, b) => b.useful + b.notRelevant - (a.useful + a.notRelevant));

  // Suggested business rules from flagged misses.
  const corpus = repoDocs.map((d) => d.text.replace(/\s+/g, " ").toLowerCase());
  const suggestions: SuggestionRow[] = missed.map((m) => {
    const phrase = m.quote ? suggestPhrase(m.quote, corpus) : "";
    const seenIn = phrase ? missed.filter((o) => o.quote.toLowerCase().replace(/\s+/g, " ").includes(phrase)).length : 1;
    return {
      id: m.id,
      note: m.note,
      quote: m.quote,
      severity: m.severity,
      contractType: m.contractType,
      phrase,
      seenIn,
      reviewId: m.review?.id ?? null,
      reviewTitle: m.review?.document.title ?? "a deleted review",
      createdAt: m.createdAt.toISOString(),
    };
  });

  // How often the detected contract type was kept, over recent reviews.
  const kept = recent.filter((r) => (JSON.parse(r.resultJson) as ReviewResult).detectedType === r.contractType).length;

  const votes = feedbackRows.length;
  const useful = feedbackRows.filter((f) => f.verdict === "useful").length;
  return (
    <LearningDashboard
      stats={{
        votes,
        usefulShare: votes ? useful / votes : null,
        muted: rules.filter((r) => r.effect === "muted").length,
        lowered: rules.filter((r) => r.effect === "downgraded").length,
        raised: rules.filter((r) => r.effect === "promoted").length,
        typeExamples: examples.filter((e) => e.kind === "contract_type").reduce((n, e) => n + e._count._all, 0),
        clauseExamples: examples.filter((e) => e.kind === "clause_type").reduce((n, e) => n + e._count._all, 0),
        openMisses: missed.length,
        typeAccuracy: recent.length ? { kept, total: recent.length } : null,
      }}
      typeExamples={examples.filter((e) => e.kind === "contract_type").map((e) => ({ label: e.label, count: e._count._all }))}
      rules={rules}
      suggestions={suggestions}
      events={events.map((e) => ({ id: e.id, kind: e.kind, summary: e.summary, createdAt: e.createdAt.toISOString() }))}
    />
  );
}
