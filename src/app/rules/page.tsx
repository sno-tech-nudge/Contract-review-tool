import { prisma } from "@/lib/db";
import { ensureStarterRules } from "@/lib/checks/business";
import { LAWS, LEGAL_RULES } from "@/lib/checks/legal/rules";
import { RulesManager } from "@/components/rules/RulesManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rules · Contract review" };

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  await ensureStarterRules();
  const [settings, business] = await Promise.all([prisma.legalRuleSetting.findMany(), prisma.businessRule.findMany({ orderBy: { createdAt: "asc" } })]);
  const off = new Set(settings.filter((s) => !s.enabled).map((s) => s.ruleId));

  return (
    <RulesManager
      initialTab={tab === "business" ? "business" : "legal"}
      laws={Object.entries(LAWS).map(([key, l]) => ({ key, ...l }))}
      legal={LEGAL_RULES.map((r) => ({ id: r.id, law: r.law, title: r.title, reference: r.reference, severity: r.severity, appliesWhen: r.appliesWhen, enabled: !off.has(r.id) }))}
      business={business.map((b) => ({ ...b, appliesTo: b.appliesTo.split(";").filter(Boolean), createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString() }))}
    />
  );
}
