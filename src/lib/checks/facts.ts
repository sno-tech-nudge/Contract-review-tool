import { formatInr } from "../text/amounts";

// Facts about a contract that rules can depend on, and the conditions that
// excuse a business rule ("not when the contract is below ₹2,00,000", "not
// when the counterparty has fewer than 10 employees"). Value, duration and
// counterparty are read from the contract; a reviewer can correct them and
// add what a contract does not say, such as the counterparty's headcount.
// No database or server imports: the rules page and review panel use it too.

export type ContractFacts = {
  value?: number; // in rupees
  months?: number;
  counterparty?: string;
  employees?: number;
};
export type FactSource = Partial<Record<keyof ContractFacts, "contract" | "reviewer">>;

export const FACT_FIELDS = {
  value: { label: "Contract value", unit: "₹", numeric: true, help: "The largest rupee amount in the contract, unless a reviewer set it" },
  months: { label: "Duration", unit: "months", numeric: true, help: "From the contract's term or period" },
  employees: { label: "Counterparty employees", unit: "people", numeric: true, help: "Not in most contracts: a reviewer adds it on the review" },
  counterparty: { label: "Counterparty", unit: "", numeric: false, help: "The other party, as named in the contract" },
  wording: { label: "Contract wording", unit: "", numeric: false, help: "Any phrase in the contract" },
} as const;
export type ConditionField = keyof typeof FACT_FIELDS;

export type Condition = { field: ConditionField; op: "lt" | "gt" | "contains"; value: string };

const num = (v: string) => Number(String(v).replace(/[,₹\s]/g, ""));
const show = (field: ConditionField, v: number) => (field === "value" ? formatInr(v) : `${v.toLocaleString("en-IN")} ${FACT_FIELDS[field].unit}`);

// "contract value below ₹2 lakh", "counterparty name contains ITC"
export function describeCondition(c: Condition): string {
  const f = FACT_FIELDS[c.field];
  if (c.field === "wording") return `the contract says "${c.value}"`;
  if (c.field === "counterparty") return `the counterparty's name includes "${c.value}"`;
  if (c.field === "employees") return `the counterparty has ${c.op === "lt" ? "fewer" : "more"} than ${num(c.value).toLocaleString("en-IN")} employees`;
  return `${f.label.toLowerCase()} is ${c.op === "lt" ? "below" : "above"} ${show(c.field, num(c.value))}`;
}

export function cleanConditions(raw: unknown): Condition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => c as Partial<Condition>)
    .filter((c): c is Condition => !!c && typeof c.field === "string" && c.field in FACT_FIELDS && typeof c.value === "string" && c.value.trim() !== "")
    .map((c) => {
      const numeric = FACT_FIELDS[c.field].numeric;
      return { field: c.field, op: numeric ? (c.op === "gt" ? "gt" : "lt") : "contains", value: numeric ? String(num(c.value)) : c.value.trim().slice(0, 120) } as Condition;
    })
    .filter((c) => !FACT_FIELDS[c.field].numeric || Number.isFinite(Number(c.value)))
    .slice(0, 10);
}

export function parseConditions(json: string): Condition[] {
  try {
    return cleanConditions(JSON.parse(json));
  } catch {
    return [];
  }
}

export type ExceptionResult = { excused: string | null; unknown: string[] };

// Whether any exception excuses the rule. A condition on a fact nobody knows
// (headcount not entered, no value found) cannot excuse it; it is reported so
// the reviewer can add the fact.
export function evaluateExceptions(conditions: Condition[], facts: ContractFacts, contractText: string): ExceptionResult {
  const unknown: string[] = [];
  const lowerText = contractText.replace(/\s+/g, " ").toLowerCase();
  for (const c of conditions) {
    if (c.field === "wording") {
      if (lowerText.includes(c.value.toLowerCase().replace(/\s+/g, " "))) return { excused: describeCondition(c), unknown };
      continue;
    }
    if (c.field === "counterparty") {
      if (!facts.counterparty) unknown.push(describeCondition(c));
      else if (facts.counterparty.toLowerCase().includes(c.value.toLowerCase())) return { excused: `the counterparty, ${facts.counterparty}, matches "${c.value}"`, unknown };
      continue;
    }
    const actual = facts[c.field];
    if (actual === undefined) {
      unknown.push(describeCondition(c));
      continue;
    }
    const limit = num(c.value);
    if (c.op === "lt" ? actual < limit : actual > limit) {
      if (c.field === "employees") return { excused: `the counterparty has ${actual.toLocaleString("en-IN")} employees, ${c.op === "lt" ? "fewer" : "more"} than ${limit.toLocaleString("en-IN")}`, unknown };
      return { excused: `${FACT_FIELDS[c.field].label.toLowerCase()} is ${show(c.field, actual)}, ${c.op === "lt" ? "below" : "above"} ${show(c.field, limit)}`, unknown };
    }
  }
  return { excused: null, unknown };
}

// "12 months", "two years", "18-month" → months
export function monthsFrom(text: string): number | undefined {
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, eighteen: 18, twenty: 20, "twenty-four": 24, thirty: 30, "thirty-six": 36 };
  const m = /(\d{1,3}|[a-z-]+)\s*(?:\(\d+\))?\s*[- ]?(months?|years?|days?)/i.exec(text);
  if (!m) return undefined;
  const n = /^\d/.test(m[1]) ? Number(m[1]) : words[m[1].toLowerCase()];
  if (!n) return undefined;
  const unit = m[2].toLowerCase();
  return unit.startsWith("year") ? n * 12 : unit.startsWith("day") ? Math.round((n / 30) * 10) / 10 : n;
}
