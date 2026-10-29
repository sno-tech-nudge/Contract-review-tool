// Canonical value lists for contract types and clause types, with the keyword
// signals used to classify them. Labels are what the UI shows.

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const CONTRACT_TYPES = {
  grant: {
    label: "Grant agreement",
    signals: ["grant agreement", "grantee", "grantor", "grant amount", "disbursement", "tranche", "grant period"],
  },
  csr: {
    label: "CSR agreement",
    signals: ["corporate social responsibility", "csr", "section 135", "schedule vii", "implementing agency", "csr committee"],
  },
  mou: {
    label: "MoU",
    signals: ["memorandum of understanding", "mou", "non-binding", "collaborate", "intent of the parties"],
  },
  partnership: {
    label: "Partnership / sub-grant",
    signals: ["partnership agreement", "collaboration agreement", "implementation partner", "implementing partner", "consortium", "sub-grant", "partner organisation"],
  },
  service: {
    label: "Service / vendor agreement",
    signals: ["service agreement", "services agreement", "service provider", "vendor", "statement of work", "purchase order", "deliverables", "invoice"],
  },
  consultancy: {
    label: "Consultancy agreement",
    signals: ["consultant", "consultancy", "professional fees", "independent contractor", "terms of reference", "retainer"],
  },
  nda: {
    label: "NDA",
    signals: ["non-disclosure", "confidentiality agreement", "disclosing party", "receiving party", "confidential information"],
  },
  employment: {
    label: "Employment / fellowship",
    signals: ["employment", "employee", "fellowship", "fellow", "appointment", "salary", "probation", "stipend", "designation"],
  },
  donation: {
    label: "Donation / gift",
    signals: ["donation", "donor", "gift deed", "corpus", "80g", "contribution towards"],
  },
  lease: {
    label: "Lease / licence",
    signals: ["lease", "leave and licence", "leave and license", "licensor", "licensee", "lessor", "lessee", "premises", "rent", "security deposit"],
  },
  other: { label: "Other", signals: [] as string[] },
} as const;

export type ContractType = keyof typeof CONTRACT_TYPES;
export const CONTRACT_TYPE_KEYS = Object.keys(CONTRACT_TYPES) as ContractType[];

export function contractTypeLabel(key: string): string {
  return (CONTRACT_TYPES as Record<string, { label: string }>)[key]?.label ?? "Other";
}

type ClauseDef = {
  label: string;
  heading: string[]; // strong signals when they appear in the clause heading
  body: string[]; // weaker signals counted in the clause text
  importance: Severity; // how serious it is when an expected clause is missing
};

export const CLAUSE_TYPES = {
  parties: { label: "Parties & recitals", heading: ["parties", "recitals", "whereas", "background"], body: ["hereinafter referred to as", "by and between", "whereas"], importance: "high" },
  definitions: { label: "Definitions", heading: ["definition", "interpretation"], body: ["shall mean", "means", "shall have the meaning"], importance: "low" },
  scope: { label: "Scope & deliverables", heading: ["scope", "services", "deliverable", "project", "purpose", "objective", "roles and responsibilities", "obligations of", "programme", "program", "activities"], body: ["deliverable", "scope of work", "shall undertake", "shall implement", "activities", "milestone"], importance: "high" },
  term: { label: "Term & duration", heading: ["term", "duration", "validity", "commencement", "effective date", "period"], body: ["shall remain in force", "shall commence", "effective date", "period of"], importance: "high" },
  payment: { label: "Payment & disbursement", heading: ["payment", "fees", "consideration", "disbursement", "grant amount", "remuneration", "compensation", "budget", "funding", "rent"], body: ["invoice", "tranche", "disburse", "inr", "rs.", "₹", "payable", "instalment", "installment"], importance: "high" },
  fund_use: { label: "Use of funds", heading: ["use of funds", "utilisation", "utilization", "application of funds", "budget reallocation"], body: ["utilise", "utilize", "utilisation", "utilization", "solely for", "budget line", "reallocation"], importance: "medium" },
  reporting: { label: "Reporting & monitoring", heading: ["report", "monitoring", "evaluation", "review meetings"], body: ["progress report", "narrative report", "financial report", "utilisation certificate", "utilization certificate", "monitoring", "quarterly report"], importance: "medium" },
  audit: { label: "Audit & records", heading: ["audit", "records", "books of account", "inspection"], body: ["audit", "books of account", "inspect", "chartered accountant", "maintain records"], importance: "medium" },
  refund: { label: "Unspent funds & refund", heading: ["refund", "unspent", "unutilised", "unutilized", "return of funds"], body: ["unspent", "unutilised", "unutilized", "refund", "return the balance"], importance: "medium" },
  taxes: { label: "Taxes", heading: ["tax", "gst", "tds"], body: ["gst", "goods and services tax", "tax deducted", "tds", "withholding", "income tax"], importance: "medium" },
  confidentiality: { label: "Confidentiality", heading: ["confidential", "non-disclosure"], body: ["confidential information", "shall not disclose", "keep confidential"], importance: "high" },
  ip: { label: "Intellectual property", heading: ["intellectual property", "ownership of", "copyright", "license", "licence", "proprietary rights"], body: ["intellectual property", "copyright", "trademark", "work product", "ownership", "royalty-free"], importance: "medium" },
  data_protection: { label: "Data protection", heading: ["data protection", "privacy", "personal data", "data security"], body: ["personal data", "data protection", "privacy", "data principal", "consent"], importance: "medium" },
  indemnity: { label: "Indemnity", heading: ["indemn"], body: ["indemnify", "indemnification", "hold harmless", "defend"], importance: "high" },
  liability: { label: "Limitation of liability", heading: ["limitation of liability", "liability"], body: ["in no event", "aggregate liability", "consequential", "indirect damages", "liability shall not exceed"], importance: "medium" },
  warranties: { label: "Representations & warranties", heading: ["representation", "warrant", "undertaking", "covenant"], body: ["represents and warrants", "warrants that", "duly incorporated", "duly registered", "has full power"], importance: "medium" },
  termination: { label: "Termination", heading: ["termination", "terminate", "suspension", "exit"], body: ["terminate", "termination", "material breach", "notice of termination"], importance: "high" },
  force_majeure: { label: "Force majeure", heading: ["force majeure"], body: ["force majeure", "act of god", "beyond the reasonable control", "pandemic", "epidemic"], importance: "medium" },
  dispute_resolution: { label: "Dispute resolution", heading: ["dispute", "arbitration", "conciliation", "mediation"], body: ["arbitration", "arbitral", "amicably", "mediation", "arbitrator"], importance: "high" },
  governing_law: { label: "Governing law & jurisdiction", heading: ["governing law", "jurisdiction", "applicable law"], body: ["governed by", "laws of india", "exclusive jurisdiction", "courts at", "courts of"], importance: "high" },
  notices: { label: "Notices", heading: ["notice"], body: ["notices shall", "addressed to", "registered post", "by email", "deemed to have been received"], importance: "low" },
  assignment: { label: "Assignment & subcontracting", heading: ["assignment", "assign", "subcontract", "sub-contract", "transfer"], body: ["shall not assign", "assign or transfer", "subcontract", "sub-contract"], importance: "medium" },
  amendment: { label: "Amendment", heading: ["amendment", "modification", "variation"], body: ["amended", "modified", "in writing and signed by"], importance: "low" },
  entire_agreement: { label: "Entire agreement", heading: ["entire agreement", "whole agreement"], body: ["entire agreement", "supersedes all prior"], importance: "low" },
  severability: { label: "Severability", heading: ["severab"], body: ["invalid or unenforceable", "severed", "severable"], importance: "low" },
  waiver: { label: "Waiver", heading: ["waiver"], body: ["no waiver", "shall not constitute a waiver", "failure to exercise"], importance: "low" },
  anti_bribery: { label: "Anti-bribery & ethics", heading: ["anti-bribery", "anti bribery", "corruption", "ethics", "code of conduct", "integrity"], body: ["bribe", "corrupt", "kickback", "facilitation payment", "prevention of corruption"], importance: "medium" },
  compliance: { label: "Compliance with laws", heading: ["compliance", "statutory", "applicable laws", "regulatory", "anti-terrorism", "sanctions"], body: ["comply with all applicable", "applicable laws", "statutory requirements", "fcra", "licences and approvals"], importance: "medium" },
  branding: { label: "Branding & publicity", heading: ["branding", "publicity", "use of name", "communication", "logo", "media"], body: ["logo", "brand", "publicity", "press release", "use of name", "acknowledge"], importance: "low" },
  insurance: { label: "Insurance", heading: ["insurance"], body: ["insurance", "insured", "policy of insurance"], importance: "low" },
  non_solicitation: { label: "Non-solicitation & non-compete", heading: ["non-solicit", "non solicit", "non-compete", "non compete", "restrictive covenant"], body: ["solicit", "non-compete", "shall not engage"], importance: "low" },
  safeguarding: { label: "Safeguarding", heading: ["safeguard", "child protection", "protection of children", "vulnerable"], body: ["safeguarding", "child protection", "pocso", "vulnerable adults", "sexual exploitation"], importance: "medium" },
  conflict_of_interest: { label: "Conflict of interest", heading: ["conflict of interest"], body: ["conflict of interest", "conflicting interest"], importance: "low" },
  relationship: { label: "Relationship of parties", heading: ["relationship", "independent contractor", "no partnership", "no agency"], body: ["independent contractor", "nothing in this agreement shall constitute", "partnership or joint venture", "agent of"], importance: "low" },
  signatures: { label: "Execution & signatures", heading: ["in witness", "signature", "execution", "executed", "counterparts", "signed"], body: ["in witness whereof", "authorised signatory", "authorized signatory", "signed by", "counterparts"], importance: "medium" },
  other: { label: "Other", heading: [], body: [], importance: "info" },
} satisfies Record<string, ClauseDef>;

export type ClauseType = keyof typeof CLAUSE_TYPES;
export const CLAUSE_TYPE_KEYS = Object.keys(CLAUSE_TYPES) as ClauseType[];

export function clauseTypeLabel(key: string): string {
  return (CLAUSE_TYPES as Record<string, { label: string }>)[key]?.label ?? "Other";
}

// Clauses a well-drafted contract of each type is expected to contain. Used
// until the repository holds enough contracts of a type to learn this itself.
const COMMON: ClauseType[] = ["parties", "term", "termination", "governing_law", "dispute_resolution", "notices", "entire_agreement", "amendment", "signatures"];

export const BASELINE_EXPECTED: Record<ContractType, ClauseType[]> = {
  grant: [...COMMON, "scope", "payment", "fund_use", "reporting", "audit", "refund", "confidentiality", "ip", "branding", "anti_bribery", "compliance", "indemnity", "force_majeure", "assignment", "warranties"],
  csr: [...COMMON, "scope", "payment", "fund_use", "reporting", "audit", "refund", "confidentiality", "ip", "branding", "anti_bribery", "compliance", "indemnity", "force_majeure", "warranties"],
  partnership: [...COMMON, "scope", "payment", "fund_use", "reporting", "audit", "refund", "confidentiality", "ip", "data_protection", "anti_bribery", "compliance", "indemnity", "safeguarding", "assignment"],
  mou: [...COMMON, "scope", "confidentiality", "ip", "branding"],
  service: [...COMMON, "scope", "payment", "taxes", "confidentiality", "ip", "indemnity", "liability", "warranties", "force_majeure", "assignment", "data_protection"],
  consultancy: [...COMMON, "scope", "payment", "taxes", "confidentiality", "ip", "relationship", "conflict_of_interest", "indemnity"],
  nda: ["parties", "definitions", "confidentiality", "term", "governing_law", "dispute_resolution", "signatures"],
  employment: ["parties", "scope", "term", "payment", "confidentiality", "ip", "termination", "governing_law", "signatures", "anti_bribery"],
  donation: ["parties", "payment", "fund_use", "governing_law", "signatures"],
  lease: [...COMMON, "payment", "insurance", "assignment", "indemnity"],
  other: COMMON,
};
