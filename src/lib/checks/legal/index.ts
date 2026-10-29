import { prisma } from "../../db";
import type { ContractType } from "../../contracts/types";
import type { DocText } from "../../text/locate";
import type { Finding } from "../../review/types";
import { buildContext, LAWS, LEGAL_RULES } from "./rules";

export async function disabledLegalRules(): Promise<Set<string>> {
  const rows = await prisma.legalRuleSetting.findMany({ where: { enabled: false } });
  return new Set(rows.map((r) => r.ruleId));
}

export function runLegalCheck(doc: DocText, contractType: ContractType, disabled: Set<string>): { findings: Finding[]; rulesRun: number } {
  const ctx = buildContext(doc, contractType);
  const findings: Finding[] = [];
  let rulesRun = 0;
  for (const rule of LEGAL_RULES) {
    if (disabled.has(rule.id) || !rule.applies(ctx)) continue;
    rulesRun++;
    const outcome = rule.evaluate(ctx);
    const quote = outcome.evidence?.quote || undefined;
    findings.push({
      id: `legal-${rule.id}`,
      check: "legal",
      category: LAWS[rule.law].label,
      title: rule.title,
      detail: outcome.detail,
      // passed rules keep their weight out of the score
      severity: outcome.status === "pass" ? "info" : rule.severity,
      status: outcome.status,
      quote,
      page: quote ? outcome.evidence?.page : undefined,
      reference: rule.reference,
      recommendation: outcome.status === "pass" ? undefined : rule.recommendation,
    });
  }
  return { findings, rulesRun };
}
