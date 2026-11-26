import { z } from "zod";
import { BUSINESS_RULE_KINDS } from "@/lib/checks/business-kinds";
import { CLAUSE_TYPE_KEYS, CONTRACT_TYPE_KEYS } from "@/lib/contracts/types";
import { ENTITY_KEYS } from "@/lib/contracts/entities";
import { cleanConditions } from "@/lib/checks/facts";

const Rule = z.object({
  name: z.string().trim().min(2, "Give the rule a name.").max(120),
  description: z.string().trim().max(500).default(""),
  kind: z.enum(Object.keys(BUSINESS_RULE_KINDS) as [keyof typeof BUSINESS_RULE_KINDS, ...(keyof typeof BUSINESS_RULE_KINDS)[]]),
  pattern: z.string().trim().max(1000).default(""),
  threshold: z.number().nonnegative().nullable().default(null),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).default("medium"),
  appliesTo: z.array(z.enum(CONTRACT_TYPE_KEYS as [string, ...string[]])).default([]),
  entities: z.array(z.enum(ENTITY_KEYS as [string, ...string[]])).default([]),
  exceptions: z.array(z.unknown()).default([]),
  guidance: z.string().trim().max(500).default(""),
  enabled: z.boolean().default(true),
});

type Parsed = { ok: false; error: string } | { ok: true; data: Omit<z.infer<typeof Rule>, "appliesTo" | "entities" | "exceptions"> & { appliesTo: string; entities: string; exceptions: string } };

export function parseRule(body: unknown): Parsed {
  const r = Rule.safeParse(body);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Check the rule fields." };
  const v = r.data;
  if ((v.kind === "REQUIRE_PHRASE" || v.kind === "FORBID_PHRASE") && !v.pattern) return { ok: false, error: "Add at least one phrase." };
  if (v.kind === "REQUIRE_CLAUSE" && !CLAUSE_TYPE_KEYS.includes(v.pattern as (typeof CLAUSE_TYPE_KEYS)[number])) return { ok: false, error: "Pick a clause type." };
  if ((v.kind === "MAX_DAYS" || v.kind === "MAX_AMOUNT") && v.threshold === null) return { ok: false, error: "Set a limit." };
  return { ok: true, data: { ...v, appliesTo: v.appliesTo.join(";"), entities: v.entities.join(";"), exceptions: JSON.stringify(cleanConditions(v.exceptions)) } };
}
