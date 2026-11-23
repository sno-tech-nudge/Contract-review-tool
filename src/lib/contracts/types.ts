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
    label: "Partnership / collaboration",
    signals: ["partnership agreement", "collaboration agreement", "collaborator", "collaboration", "co-host", "implementation partner", "implementing partner", "designated partner", "consortium", "sub-grant", "partner organisation"],
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

// A label for use mid-sentence: ordinary words lower-cased, acronyms kept
// ("CSR agreement", "MoU", "grant agreement").
export function lowerLabel(label: string): string {
  return label.replace(/\b[A-Z][a-z]+\b/g, (w) => w.toLowerCase());
}

type ClauseDef = {
  label: string;
  heading: string[]; // strong signals when they appear in the clause heading
  body: string[]; // weaker signals counted in the clause text
  strong?: string[]; // phrases that settle it on their own ("entire agreement", "unspent")
  importance: Severity; // how serious it is when an expected clause is missing
};

export const CLAUSE_TYPES = {
  parties: { label: "Parties & recitals", heading: ["parties", "recitals", "whereas", "background"], body: ["hereinafter referred to as", "by and between", "whereas"], importance: "high" },
  definitions: { label: "Definitions", heading: ["definition", "interpretation"], body: ["shall mean", "means", "shall have the meaning"], importance: "low" },
  scope: { label: "Scope & deliverables", heading: ["scope", "services", "deliverable", "project", "purpose", "objective", "roles and responsibilities", "obligations of", "programme", "program", "activities"], body: ["deliverable", "scope of work", "shall undertake", "shall implement", "activities", "milestone"], importance: "high" },
  term: { label: "Term & duration", heading: ["term", "duration", "validity", "commencement", "effective date", "period"], body: ["shall remain in force", "shall commence", "effective date", "period of"], strong: ["shall remain in force", "shall be valid until", "valid till", "effective from the date", "project duration", "duration of this agreement"], importance: "high" },
  payment: { label: "Payment & disbursement", heading: ["payment", "fees", "consideration", "disbursement", "grant amount", "remuneration", "compensation", "budget", "funding", "rent"], body: ["invoice", "tranche", "disburse", "inr", "rs.", "₹", "payable", "instalment", "installment"], strong: ["shall disburse", "shall pay", "disbursement of", "payment schedule", "in instalments", "in installments", "in tranches"], importance: "high" },
  fund_use: { label: "Use of funds", heading: ["use of funds", "utilisation", "utilization", "application of funds", "budget reallocation"], body: ["utilise", "utilize", "utilisation", "utilization", "solely for", "budget line", "reallocation"], strong: ["utilise the funds", "utilize the funds", "utilise the grant", "utilize the grant", "use of the grant", "usage of funds", "utilisation of funds", "utilization of funds"], importance: "medium" },
  reporting: { label: "Reporting & monitoring", heading: ["report", "monitoring", "evaluation", "review meetings"], body: ["progress report", "narrative report", "financial report", "utilisation certificate", "utilization certificate", "monitoring", "quarterly report"], strong: ["progress report", "annual report", "utilisation certificate", "utilization certificate", "quarterly report", "narrative report", "financial report", "completion report", "impact assessment"], importance: "medium" },
  audit: { label: "Audit & records", heading: ["audit", "records", "books of account", "inspection"], body: ["audit", "books of account", "inspect", "chartered accountant", "maintain records"], strong: ["books of account", "statutory audit", "right to audit", "audit rights", "inspection of"], importance: "medium" },
  refund: { label: "Unspent funds & refund", heading: ["refund", "unspent", "unutilised", "unutilized", "return of funds"], body: ["unspent", "unutilised", "unutilized", "refund", "return the balance"], strong: ["unspent", "unutilised", "unutilized", "unused funds", "refund the", "return the balance"], importance: "medium" },
  taxes: { label: "Taxes", heading: ["tax", "gst", "tds"], body: ["gst", "goods and services tax", "tax deducted", "tds", "withholding", "income tax"], strong: ["goods and services tax", "tax deducted at source", "gst"], importance: "medium" },
  confidentiality: { label: "Confidentiality", heading: ["confidential", "non-disclosure", "leftovers", "reverse engineering", "permitted disclosure", "required disclosure"], body: ["confidential information", "shall not disclose", "keep confidential"], strong: ["confidential information", "keep confidential"], importance: "high" },
  ip: { label: "Intellectual property", heading: ["intellectual property", "ownership of", "copyright", "license", "licence", "proprietary rights"], body: ["intellectual property", "copyright", "trademark", "work product", "ownership", "royalty-free"], strong: ["intellectual property", "copyright"], importance: "medium" },
  data_protection: { label: "Data protection", heading: ["data protection", "privacy", "personal data", "data security", "back-up data", "backup data"], body: ["personal data", "data protection", "privacy", "data principal", "consent"], strong: ["personal data", "data protection", "digital personal data"], importance: "medium" },
  indemnity: { label: "Indemnity", heading: ["indemn"], body: ["indemnify", "indemnification", "hold harmless", "defend"], strong: ["indemnif", "hold harmless"], importance: "high" },
  liability: { label: "Limitation of liability", heading: ["limitation of liability", "liability"], body: ["in no event", "aggregate liability", "consequential", "indirect damages", "liability shall not exceed"], strong: ["limitation of liability", "aggregate liability", "shall not be liable", "limits its liability", "liability of"], importance: "medium" },
  remedies: { label: "Remedies & equitable relief", heading: ["equitable relief", "injunctive relief", "specific performance", "remedies"], body: ["injunctive relief", "specific performance", "irreparable harm", "irreparable injury", "remedies are cumulative", "in addition to any other remed"], strong: ["injunctive relief", "specific performance", "irreparable", "event of default", "events of default"], importance: "low" },
  warranties: { label: "Representations & warranties", heading: ["representation", "warrant", "undertaking", "covenant"], body: ["represents and warrants", "warrants that", "duly incorporated", "duly registered", "has full power"], strong: ["represents and warrants", "represent and warrant", "warrants that"], importance: "medium" },
  termination: { label: "Termination", heading: ["termination", "terminate", "suspension", "exit"], body: ["terminate", "termination", "material breach", "notice of termination"], strong: ["terminate this agreement", "may terminate", "terminated by", "termination of this agreement", "right to terminate"], importance: "high" },
  survival: { label: "Survival", heading: ["survival"], body: ["shall survive", "will survive", "survive the termination", "survive termination", "survive expiry", "survive the expiry"], strong: ["shall survive", "will survive"], importance: "low" },
  force_majeure: { label: "Force majeure", heading: ["force majeure"], body: ["force majeure", "act of god", "beyond the reasonable control", "pandemic", "epidemic"], strong: ["force majeure", "act of god"], importance: "medium" },
  dispute_resolution: { label: "Dispute resolution", heading: ["dispute", "arbitration", "conciliation", "mediation"], body: ["arbitration", "arbitral", "amicably", "mediation", "arbitrator"], strong: ["arbitration", "arbitral", "any dispute", "disputes arising", "dispute resolution", "amicably"], importance: "high" },
  governing_law: { label: "Governing law & jurisdiction", heading: ["governing law", "jurisdiction", "applicable law"], body: ["governed by", "laws of india", "exclusive jurisdiction", "courts at", "courts of"], strong: ["governed by", "exclusive jurisdiction", "have jurisdiction", "courts at", "courts in"], importance: "high" },
  notices: { label: "Notices", heading: ["notice"], body: ["notices shall", "addressed to", "registered post", "by email", "deemed to have been received"], strong: ["notices shall", "notices under this", "notice under this", "any notice", "registered post"], importance: "low" },
  assignment: { label: "Assignment & subcontracting", heading: ["assignment", "assign", "subcontract", "sub-contract", "transfer"], body: ["shall not assign", "assign or transfer", "subcontract", "sub-contract"], strong: ["shall not assign", "assign or transfer", "may assign", "may not assign", "sub-contract", "subcontract"], importance: "medium" },
  amendment: { label: "Amendment", heading: ["amendment", "modification", "variation"], body: ["amended", "modified", "in writing and signed by"], strong: ["no amendment", "amended or waived", "amendment to this", "amendments to this", "modification to this", "modifications to this", "written instrument signed", "in writing and signed by"], importance: "low" },
  entire_agreement: { label: "Entire agreement", heading: ["entire agreement", "whole agreement", "no reliance"], body: ["entire agreement", "supersedes all prior", "not relying on", "has not relied"], strong: ["entire agreement", "supersedes all", "whole agreement"], importance: "low" },
  severability: { label: "Severability", heading: ["severab"], body: ["invalid or unenforceable", "severed", "severable"], strong: ["unenforceable", "severab"], importance: "low" },
  waiver: { label: "Waiver", heading: ["waiver"], body: ["no waiver", "shall not constitute a waiver", "failure to exercise"], strong: ["construed as a waiver", "constitute a waiver", "deemed a waiver", "no waiver", "amended or waived"], importance: "low" },
  anti_bribery: { label: "Anti-bribery & ethics", heading: ["anti-bribery", "anti bribery", "corruption", "ethics", "code of conduct", "integrity"], body: ["bribe", "corrupt", "kickback", "facilitation payment", "prevention of corruption"], strong: ["brib", "corrupt"], importance: "medium" },
  compliance: { label: "Compliance with laws", heading: ["compliance", "statutory", "applicable laws", "regulatory", "anti-terrorism", "sanctions", "export control"], body: ["comply with all applicable", "applicable laws", "statutory requirements", "fcra", "licences and approvals"], strong: ["comply with all applicable", "statutory compliance", "all compliances", "applicable laws"], importance: "medium" },
  branding: { label: "Branding & publicity", heading: ["branding", "publicity", "use of name", "communication", "logo", "media"], body: ["logo", "brand", "publicity", "press release", "use of name", "acknowledge"], strong: ["logo", "acknowledge the support", "public announcement", "press release", "publicity"], importance: "low" },
  insurance: { label: "Insurance", heading: ["insurance"], body: ["insurance", "insured", "policy of insurance"], strong: ["insurance policy", "shall insure", "insurance cover"], importance: "low" },
  non_solicitation: { label: "Non-solicitation & non-compete", heading: ["non-solicit", "non solicit", "non-compete", "non compete", "non-competition", "restrictive covenant", "non-disparage"], body: ["solicit", "non-compete", "shall not engage", "disparag"], strong: ["solicit", "non-compete"], importance: "low" },
  safeguarding: { label: "Safeguarding", heading: ["safeguard", "child protection", "protection of children", "vulnerable"], body: ["safeguarding", "child protection", "pocso", "vulnerable adults", "sexual exploitation"], strong: ["child protection", "safeguarding", "pocso", "sexual harassment"], importance: "medium" },
  conflict_of_interest: { label: "Conflict of interest", heading: ["conflict of interest"], body: ["conflict of interest", "conflicting interest"], strong: ["conflict of interest"], importance: "low" },
  relationship: { label: "Relationship of parties", heading: ["relationship", "independent contractor", "no partnership", "no agency"], body: ["independent contractor", "nothing in this agreement shall constitute", "partnership or joint venture", "agent of"], strong: ["principal to principal", "principal-to-principal", "independent contractor", "partnership or joint venture", "master and servant", "employer-employee"], importance: "low" },
  signatures: { label: "Execution & signatures", heading: ["in witness", "signature", "execution", "executed", "counterparts", "signed"], body: ["in witness whereof", "authorised signatory", "authorized signatory", "signed by", "counterparts"], strong: ["in witness whereof", "agreed and accepted", "authorised signatory", "authorized signatory", "signatory name", "signed and delivered"], importance: "medium" },
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
