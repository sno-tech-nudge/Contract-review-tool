// Kept separate from business.ts so client components can import the labels
// without pulling in the database client.
export const BUSINESS_RULE_KINDS = {
  REQUIRE_PHRASE: { label: "Must mention", help: "Flags the contract if none of these phrases appear. Separate phrases with ;" },
  FORBID_PHRASE: { label: "Must not mention", help: "Flags the contract if any of these phrases appear. Separate phrases with ;" },
  REQUIRE_CLAUSE: { label: "Must include clause", help: "Flags the contract if it has no clause of this type." },
  MAX_DAYS: { label: "Maximum days", help: "Finds \"N days\" in sentences mentioning these words (separate with ;) and flags any above the limit." },
  MAX_AMOUNT: { label: "Amount above", help: "Flags rupee amounts above the limit, e.g. to route large contracts for sign-off." },
} as const;

export type BusinessRuleKind = keyof typeof BUSINESS_RULE_KINDS;
