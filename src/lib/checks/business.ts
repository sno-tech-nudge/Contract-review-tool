import type { BusinessRule } from "@prisma/client";
import { prisma } from "../db";
import type { Segment } from "../contracts/segment";
import { clauseTypeLabel, type ContractType, type Severity } from "../contracts/types";
import { findAmounts, formatInr } from "../text/amounts";
import type { DocText } from "../text/locate";
import type { Finding } from "../review/types";
import type { BusinessRuleKind } from "./business-kinds";

export { BUSINESS_RULE_KINDS, type BusinessRuleKind } from "./business-kinds";

// Organisation-specific checks. Each rule is one of a few simple kinds so that
// non-lawyers can add and tune them from the rules page.

const phrases = (p: string) => p.split(";").map((s) => s.trim().toLowerCase()).filter(Boolean);

function ruleApplies(rule: BusinessRule, contractType: ContractType): boolean {
  const types = rule.appliesTo.split(";").filter(Boolean);
  return types.length === 0 || types.includes(contractType);
}

export function runBusinessCheck(doc: DocText, segments: Segment[], contractType: ContractType, rules: BusinessRule[]): { findings: Finding[]; rulesRun: number } {
  const findings: Finding[] = [];
  let rulesRun = 0;
  for (const rule of rules) {
    if (!rule.enabled || !ruleApplies(rule, contractType)) continue;
    rulesRun++;
    const base = {
      id: `biz-${rule.id}`,
      check: "business" as const,
      category: "Business rule",
      title: rule.name,
      severity: rule.severity as Severity,
      recommendation: rule.guidance || undefined,
    };
    const ok = (detail: string, quote?: string, page?: number): Finding => ({ ...base, status: "pass", severity: "info", detail, quote, page, recommendation: undefined });
    const flag = (detail: string, quote?: string, page?: number): Finding => ({ ...base, status: "issue", detail, quote, page });

    switch (rule.kind as BusinessRuleKind) {
      case "REQUIRE_PHRASE": {
        const hit = phrases(rule.pattern).map((p) => doc.find(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))).find(Boolean);
        findings.push(hit ? ok("Required wording is present.", hit.quote, hit.page) : flag(rule.description || `None of these appear: ${rule.pattern}`));
        break;
      }
      case "FORBID_PHRASE": {
        const hit = phrases(rule.pattern).map((p) => doc.find(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))).find(Boolean);
        findings.push(hit ? flag(rule.description || `Contains "${hit.match[0]}".`, hit.quote, hit.page) : ok("None of the restricted wording appears."));
        break;
      }
      case "REQUIRE_CLAUSE": {
        const seg = segments.find((s) => s.types.includes(rule.pattern as Segment["type"]));
        findings.push(seg ? ok(`${clauseTypeLabel(rule.pattern)} clause found.`, seg.text.slice(0, 200), seg.page) : flag(rule.description || `No ${clauseTypeLabel(rule.pattern).toLowerCase()} clause.`));
        break;
      }
      case "MAX_DAYS": {
        const limit = rule.threshold ?? 0;
        const words = phrases(rule.pattern);
        const over = doc
          .findAll(/(\d{1,3})\s*(?:\([a-z\s-]+\)\s*)?(?:calendar |working |business )?days/i, 100)
          .filter((m) => Number(m.match[1]) > limit && (words.length === 0 || words.some((w) => m.quote.toLowerCase().includes(w))));
        findings.push(
          over.length
            ? flag(`${over[0].match[1]} days, above the ${limit}-day limit.${rule.description ? " " + rule.description : ""}`, over[0].quote, over[0].page)
            : ok(`No timelines above ${limit} days.`)
        );
        break;
      }
      case "MAX_AMOUNT": {
        const limit = rule.threshold ?? 0;
        const over = findAmounts(doc).filter((a) => a.currency === "INR" && a.value > limit).sort((a, b) => b.value - a.value);
        findings.push(
          over.length
            ? flag(`${over[0].display} is above ${formatInr(limit)}.${rule.description ? " " + rule.description : ""}`, over[0].at.quote, over[0].at.page)
            : ok(`No amounts above ${formatInr(limit)}.`)
        );
        break;
      }
    }
  }
  return { findings, rulesRun };
}

// A few example rules so the business tab is not empty on day one. They are
// clearly labelled as examples and can be edited or deleted.
const STARTER_RULES = [
  {
    name: "Payment within 45 days",
    description: "Example rule: payments and disbursements should not take longer than 45 days.",
    kind: "MAX_DAYS",
    pattern: "payment;payable;paid;invoice;disburse;release;instalment;tranche",
    threshold: 45,
    severity: "medium",
    guidance: "Negotiate payment or disbursement within 45 days of invoice or milestone.",
  },
  {
    name: "No automatic renewal",
    description: "Example rule: contracts should not renew without a fresh decision.",
    kind: "FORBID_PHRASE",
    pattern: "auto-renew;automatically renew;automatic renewal;deemed to be renewed;renew automatically",
    threshold: null,
    severity: "medium",
    guidance: "Replace automatic renewal with renewal by mutual written agreement.",
  },
  {
    name: "Large contracts need leadership sign-off",
    description: "Example rule: route contracts above ₹50 lakh to leadership before signing.",
    kind: "MAX_AMOUNT",
    pattern: "",
    threshold: 5000000,
    severity: "low",
    guidance: "Share with leadership for approval before execution.",
  },
];

export async function ensureStarterRules() {
  const seeded = await prisma.meta.findUnique({ where: { key: "starter-business-rules" } });
  if (seeded) return;
  await prisma.$transaction([
    ...STARTER_RULES.map((r) => prisma.businessRule.create({ data: r })),
    prisma.meta.create({ data: { key: "starter-business-rules", value: new Date().toISOString() } }),
  ]);
}
