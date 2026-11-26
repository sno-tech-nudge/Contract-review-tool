import { parseConditions } from "@/lib/checks/facts";
import { prisma } from "@/lib/db";
import { ensureStarterRules } from "@/lib/checks/business";
import { LAWS, LEGAL_RULES } from "@/lib/checks/legal/rules";
import { RulesManager } from "@/components/rules/RulesManager";
import { suggestPhrase } from "@/lib/learning/suggest";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rules · Contract review" };

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ tab?: string; fromMissed?: string }> }) {
  const { tab, fromMissed } = await searchParams;
  // "Create rule" on a flagged miss opens the editor pre-filled from it.
  const missed = fromMissed ? await prisma.missedIssue.findUnique({ where: { id: fromMissed }, include: { review: { select: { document: { select: { title: true } } } } } }) : null;
  let prefill = null;
  if (missed) {
    const corpus = (await prisma.document.findMany({ where: { kind: "REPOSITORY" }, select: { text: true } })).map((d) => d.text.replace(/\s+/g, " ").toLowerCase());
    prefill = {
      missedId: missed.id,
      name: missed.note.slice(0, 120),
      description: `From a miss flagged in "${missed.review?.document.title ?? "a review"}".`,
      kind: "FORBID_PHRASE",
      pattern: missed.quote ? suggestPhrase(missed.quote, corpus) : "",
      threshold: null,
      severity: missed.severity,
      appliesTo: [missed.contractType],
      entities: [],
      exceptions: [],
      guidance: "",
      enabled: true,
    };
  }
  await ensureStarterRules();
  const [settings, business] = await Promise.all([prisma.legalRuleSetting.findMany(), prisma.businessRule.findMany({ orderBy: { createdAt: "asc" } })]);
  const off = new Set(settings.filter((s) => !s.enabled).map((s) => s.ruleId));

  return (
    <RulesManager
      initialTab={tab === "business" || prefill ? "business" : "legal"}
      prefill={prefill}
      laws={Object.entries(LAWS).map(([key, l]) => ({ key, ...l }))}
      legal={LEGAL_RULES.map((r) => ({ id: r.id, law: r.law, title: r.title, reference: r.reference, severity: r.severity, appliesWhen: r.appliesWhen, enabled: !off.has(r.id) }))}
      business={business.map((b) => ({
        ...b,
        appliesTo: b.appliesTo.split(";").filter(Boolean),
        entities: b.entities.split(";").filter(Boolean),
        exceptions: parseConditions(b.exceptions),
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      }))}
    />
  );
}
