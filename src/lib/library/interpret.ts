import { classifyClause } from "../contracts/classify";
import { CLAUSE_TYPE_KEYS, contractTypeLabel, lowerLabel, type ClauseType, type ContractType } from "../contracts/types";

// Works out, for one version of a library clause, which clause type it is,
// which kinds of contract it is meant for, and whether it rests on US law.
// The library names this in each version's label ("Employment Agreement",
// "Software License Agreement", "Mutual") and sometimes in the topic itself
// (event and catering clauses). People can correct both in the clause library.

// Topic names that settle the clause type, checked in order.
const TOPIC_TYPES: [RegExp, ClauseType][] = [
  // share plans, investor rights and similar company-law clauses: no NGO clause type fits them
  [/registration|rule 144|stock|shares|capitali[sz]ation|eligibility for plan|participation|administration|offering period|restrictions on transfer|covenants of the company|security interest|erisa|release of claims|cooperation|older workers|further assurances/i, "other"],
  [/survival/i, "survival"],
  [/equitable relief|remedies|duty to mitigate/i, "remedies"],
  [/arbitration/i, "dispute_resolution"],
  [/definitions|headings/i, "definitions"],
  [/no reliance/i, "entire_agreement"],
  [/limited warranty/i, "warranties"],
  [/securities law|export control|government end user/i, "compliance"],
  [/code of business conduct|ethics/i, "anti_bribery"],
  [/data privacy|data protection|description of data|standard of care|back-up data/i, "data_protection"],
  [/intellectual property|escrow of source|customer restrictions|licen[cs]e grant|infringement|independent development/i, "ip"],
  [/confidential|leftovers|exchange of information|reverse engineering|use of information|required disclosure|permitted disclosure|marking|notification of disclosure|non-disclosure/i, "confidentiality"],
  [/non-competition|non-solicitation|non-disparagement/i, "non_solicitation"],
  [/effect of termination|suspension of|cancellation or termination/i, "termination"],
  [/insurance/i, "insurance"],
  [/liability for/i, "liability"],
  [/non-exclusivity/i, "relationship"],
  [/publications/i, "branding"],
  [/section 409a/i, "taxes"],
  [/fringe benefits|severance benefits|paid vacation|medical benefits|payroll deductions/i, "payment"],
  [/at-will employment/i, "term"],
  [/purpose|support services|software updates|obligations|facilities and equipment|equipment and materials|improvement opportunities|changes to products|product materials|rights and duties|terms of services|free trial|event|menu|dishes|catering|alcohol/i, "scope"],
];

// What a version's label (or its topic) says about where it applies.
const CONTEXTS: [RegExp, ContractType[]][] = [
  [/independent contractor|consult/i, ["consultancy"]],
  // "employment", not "employee": "non-solicitation of employees" suits any contract
  [/employment|executive|severance|retirement|at-will|fringe|vacation|medical benefit|payroll|employee cooperation|stock purchase plan/i, ["employment"]],
  [/non-disclosure agreement|\bnda\b|confidentiality agreement/i, ["nda"]],
  [/data sharing/i, ["partnership", "mou"]],
  [/services agreement|\bsaas\b|software as a service|subscription|software licen|end user licen|product sales|product resale|reseller|distribution|supply|catering|event|menu|guests|dishes|alcohol/i, ["service"]],
  [/lease|licen[cs]e of premises/i, ["lease"]],
  [/grant agreement/i, ["grant", "csr"]],
];

// Clauses that only make sense under US law or US employment and securities
// practice; they have no effect in an Indian-law contract.
const US_LAW =
  /\bERISA\b|older workers benefit|\bOWBPA\b|section 409a|section 280g|rule 144|securities act of 1933|securities exchange act|exchange act of 1934|internal revenue code|\bHIPAA\b|employee stock purchase plan|registration rights|\bat-will\b|\bCOBRA\b|\bFLSA\b|federal (?:law|securities)|federal and state securities|state securities laws|united states securities|american arbitration association|\d+ U\.S\.C\.|united states (?:government|patent)|outside (?:of )?the united states|new york, new york|federal information security|federal, state,? (?:and|or) (?:local|other)/i;

// The US-law reference in a piece of text, if any (e.g. "Section 409A").
export function usLawReference(text: string): string | null {
  return US_LAW.exec(text.replace(/\s+/g, " "))?.[0] ?? null;
}

export type Interpretation = { clauseType: ClauseType; validFor: ContractType[]; jurisdiction: "" | "us" };

export function interpretClause(input: { topic: string; label: string; title: string; text: string }): Interpretation {
  const { topic, label, title, text } = input;
  const byTopic = TOPIC_TYPES.find(([re]) => re.test(topic))?.[1];
  const clauseType = byTopic ?? classifyClause(`${topic} ${title}`, text).type;

  // the label speaks for this version; the topic only when the label does not
  const fromLabel = CONTEXTS.filter(([re]) => re.test(label)).flatMap(([, t]) => t);
  const fromTopic = CONTEXTS.filter(([re]) => re.test(topic)).flatMap(([, t]) => t);
  const validFor = Array.from(new Set(fromLabel.length ? fromLabel : fromTopic));

  const jurisdiction = usLawReference(`${topic} ${label} ${title} ${text}`) ? "us" : "";
  return { clauseType: CLAUSE_TYPE_KEYS.includes(clauseType) ? clauseType : "other", validFor, jurisdiction };
}

export const joinTypes = (types: string[]) => types.filter(Boolean).join(";");
export const splitTypes = (value: string) => value.split(";").filter(Boolean) as ContractType[];

const PLURAL: Record<string, string> = {
  grant: "grant agreements",
  csr: "CSR agreements",
  mou: "MoUs",
  partnership: "partnership and collaboration agreements",
  service: "service and vendor agreements",
  consultancy: "consultancy agreements",
  nda: "NDAs",
  employment: "employment and fellowship agreements",
  donation: "donation agreements",
  lease: "leases and licences",
  other: "other contracts",
};

export const pluralTypeName = (type: string) => PLURAL[type] ?? `${lowerLabel(contractTypeLabel(type))}s`;

// "employment and fellowship agreements or consultancy agreements" for findings.
export function validForPhrase(types: string[]): string {
  if (!types.length) return "any contract";
  const names = types.map(pluralTypeName);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}
