import { CLAUSE_CATEGORIES } from "../contracts/types";
import { CONTRACT_TYPE_KEYS } from "../contracts/types";
import { ENTITY_KEYS } from "../contracts/entities";
import { SEVERITIES } from "./custom";

// Cleans what the clause editor sends before it is saved.
export function cleanCustomClause(body: Record<string, unknown>) {
  const list = (v: unknown, allowed: readonly string[]) => (Array.isArray(v) ? v.map(String).filter((x) => allowed.includes(x)) : []);
  const phrases = (Array.isArray(body.phrases) ? body.phrases : String(body.phrases ?? "").split(/\n|;/))
    .map((p) => String(p).replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 3)
    .slice(0, 20);
  const name = String(body.name ?? "").trim().slice(0, 80);
  const category = CLAUSE_CATEGORIES.some((c) => c.key === body.category) ? String(body.category) : "operational";
  return {
    name,
    category,
    description: String(body.description ?? "").trim().slice(0, 600),
    phrases: phrases.join(";"),
    standardText: String(body.standardText ?? "").trim().slice(0, 8000),
    contractTypes: list(body.contractTypes, CONTRACT_TYPE_KEYS).join(";"),
    entities: list(body.entities, ENTITY_KEYS).join(";"),
    required: body.required !== false,
    severity: (SEVERITIES as string[]).includes(String(body.severity)) ? String(body.severity) : "medium",
    enabled: body.enabled !== false,
  };
}
