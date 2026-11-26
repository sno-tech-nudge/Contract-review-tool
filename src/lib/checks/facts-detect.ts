import { detectEntity } from "../contracts/entities";
import { findAmounts } from "../text/amounts";
import type { DocText } from "../text/locate";
import type { KeyTerm } from "../review/types";
import { findParties } from "./keyterms";
import { monthsFrom, type ContractFacts, type FactSource } from "./facts";

// Reads the facts a contract states, then applies what a reviewer set.
export function contractFacts(doc: DocText, keyTerms: KeyTerm[], reviewerJson: string, storedCounterparty = ""): { facts: ContractFacts; source: FactSource } {
  const facts: ContractFacts = {};
  const source: FactSource = {};

  const inr = findAmounts(doc).filter((a) => a.currency === "INR").sort((a, b) => b.value - a.value)[0];
  if (inr) [facts.value, source.value] = [inr.value, "contract"];

  const term = keyTerms.find((k) => k.label === "Term");
  const months = term ? monthsFrom(term.value) : undefined;
  if (months) [facts.months, source.months] = [months, "contract"];

  // the other party: the first named party that is not one of ours
  const other = storedCounterparty || findParties(doc).map((p) => p.value).find((name) => !detectEntity(name));
  if (other) [facts.counterparty, source.counterparty] = [other, "contract"];

  let reviewer: ContractFacts = {};
  try {
    reviewer = JSON.parse(reviewerJson) as ContractFacts;
  } catch {
    reviewer = {};
  }
  for (const key of ["value", "months", "employees", "counterparty"] as const) {
    const v = reviewer[key];
    if (v === undefined || v === null || v === "") continue;
    (facts as Record<string, unknown>)[key] = v;
    source[key] = "reviewer";
  }
  return { facts, source };
}
