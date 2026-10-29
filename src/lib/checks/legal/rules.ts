import type { ContractType, Severity } from "../../contracts/types";
import type { DocText, Located } from "../../text/locate";

// Built-in legal checks for Indian non-profits. Each rule decides whether it
// applies to a contract, then whether the contract satisfies it. Rules look
// for wording, so a "pass" means the contract addresses the point, not that it
// is legally sufficient. These are prompts for a reviewer, not legal advice.

export type LawKey = "FCRA" | "CSR" | "INCOME_TAX" | "GST" | "DPDP" | "STAMP" | "CONTRACT" | "DISPUTES" | "ETHICS" | "SAFEGUARDING";

export const LAWS: Record<LawKey, { label: string; description: string }> = {
  FCRA: { label: "FCRA", description: "Foreign Contribution (Regulation) Act, 2010, as amended in 2020" },
  CSR: { label: "CSR", description: "Companies Act, 2013 s.135 and the Companies (CSR Policy) Rules, 2014" },
  INCOME_TAX: { label: "Income tax", description: "Registration, receipts and TDS under the Income-tax Act" },
  GST: { label: "GST", description: "Central Goods and Services Tax Act, 2017" },
  DPDP: { label: "Data protection", description: "Digital Personal Data Protection Act, 2023 and DPDP Rules, 2025" },
  STAMP: { label: "Stamp duty & execution", description: "Indian Stamp Act, 1899, state stamp acts and valid execution" },
  CONTRACT: { label: "Contract Act", description: "Indian Contract Act, 1872" },
  DISPUTES: { label: "Governing law & disputes", description: "Arbitration and Conciliation Act, 1996 and choice of law" },
  ETHICS: { label: "Anti-corruption & sanctions", description: "Prevention of Corruption Act, 1988 and funder-side requirements" },
  SAFEGUARDING: { label: "Safeguarding & workplace", description: "POCSO Act, 2012 and the POSH Act, 2013" },
};

export type RuleContext = {
  doc: DocText;
  contractType: ContractType;
  foreign: Located | null; // evidence the money itself is foreign (currency, foreign funder, FCRA)
  foreignLink: Located | null; // any foreign connection, e.g. an Indian funder with a foreign parent
  csr: Located | null;
  personalData: Located | null;
  children: Located | null;
  donation: boolean;
  services: boolean; // fees are paid for services
  branding: Located | null;
};

export type RuleOutcome = { status: "pass" | "issue" | "warning"; detail: string; evidence?: Located | null };

export type LegalRule = {
  id: string;
  law: LawKey;
  title: string;
  reference: string;
  severity: Severity;
  recommendation: string;
  appliesWhen: string; // shown on the rules page
  applies: (ctx: RuleContext) => boolean;
  evaluate: (ctx: RuleContext) => RuleOutcome;
};

const pass = (detail: string, evidence?: Located | null): RuleOutcome => ({ status: "pass", detail, evidence });
const issue = (detail: string, evidence?: Located | null): RuleOutcome => ({ status: "issue", detail, evidence });
const warn = (detail: string, evidence?: Located | null): RuleOutcome => ({ status: "warning", detail, evidence });

function requireWording(re: RegExp, found: string, missing: string, missingStatus: "issue" | "warning" = "issue") {
  return (ctx: RuleContext): RuleOutcome => {
    const hit = ctx.doc.find(re);
    if (hit) return pass(found, hit);
    return missingStatus === "issue" ? issue(missing) : warn(missing);
  };
}

function percentagesNear(ctx: RuleContext, words: RegExp): { value: number; at: Located }[] {
  const out: { value: number; at: Located }[] = [];
  const re = new RegExp(`(?:${words.source})[^.%]{0,100}?(\\d{1,2}(?:\\.\\d+)?)\\s?(?:%|per ?cent)`, "gi");
  for (const m of ctx.doc.findAll(re, 10)) out.push({ value: Number(m.match[1]), at: m });
  return out;
}

const GRANTISH: ContractType[] = ["grant", "csr", "partnership", "donation", "mou"];

const INDIAN_PLACES =
  /india|andhra|arunachal|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal|jharkhand|karnataka|kerala|madhya|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil|telangana|tripura|uttar|uttarakhand|bengal|delhi|jammu|ladakh|puducherry|chandigarh/i;

export const LEGAL_RULES: LegalRule[] = [
  // ───────────── FCRA ─────────────
  {
    id: "fcra-registration",
    law: "FCRA",
    title: "FCRA registration number",
    reference: "FCRA 2010, s.11: foreign contribution may only be accepted with registration or prior permission",
    severity: "high",
    appliesWhen: "Foreign funding signals (foreign currency, overseas funder, FCRA)",
    applies: (c) => !!c.foreign,
    recommendation: "Record the recipient's FCRA registration number (or prior permission reference) and its validity in the parties or representations clause.",
    evaluate: requireWording(/fcra (?:registration|reg\.?|no\.?|number)|registration (?:number|no\.?) under (?:the )?(?:fcra|foreign contribution)|prior permission under|registered under (?:the )?foreign contribution/i,
      "The FCRA registration or prior permission is referenced.",
      "The contract shows signs of foreign funding but does not state the recipient's FCRA registration or prior permission."),
  },
  {
    id: "fcra-account",
    law: "FCRA",
    title: "Payment into the FCRA account at SBI, New Delhi",
    reference: "FCRA 2010, s.17 (as amended 2020): foreign contribution must first be received in the designated FCRA account at SBI, New Delhi Main Branch",
    severity: "critical",
    appliesWhen: "Foreign funding signals",
    applies: (c) => !!c.foreign,
    recommendation: "Specify that all payments will be made only to the recipient's designated FCRA account at State Bank of India, New Delhi Main Branch, and include those bank details.",
    evaluate: requireWording(/new delhi main branch|\bndmb\b|fcra (?:designated )?(?:bank )?account|designated fcra account|state bank of india[^.]{0,60}(?:new delhi|fcra)/i,
      "Payment into the designated FCRA account is specified.",
      "Foreign funds must be received only in the designated FCRA account at SBI, New Delhi Main Branch, and the contract does not say so."),
  },
  {
    id: "fcra-no-transfer",
    law: "FCRA",
    title: "Onward transfer of foreign funds",
    reference: "FCRA 2010, s.7 (as amended 2020): foreign contribution cannot be transferred to any other person or organisation",
    severity: "critical",
    appliesWhen: "Foreign funding signals",
    applies: (c) => !!c.foreign,
    recommendation: "Remove sub-granting or re-granting of these funds. Partners can be engaged only as vendors paid for services at fair value, not as recipients of the grant.",
    evaluate: (c) => {
      const hit = c.doc.find(/sub-?grant|re-?grant|on-?grant|pass[- ]through|transfer (?:any (?:part|portion) of )?(?:the )?(?:grant|funds?|contribution)[^.]{0,40}to (?:any )?(?:other|third|partner|implementing)|disburse[^.]{0,60}to (?:its )?(?:implementing )?partners?/i);
      return hit
        ? issue("The contract appears to allow foreign funds to be passed on to another organisation, which s.7 prohibits.", hit)
        : pass("No onward transfer of funds is contemplated.");
    },
  },
  {
    id: "fcra-admin-cap",
    law: "FCRA",
    title: "Administrative costs within 20%",
    reference: "FCRA 2010, s.8(1)(b): administrative expenses from foreign contribution are capped at 20% of the contribution received in the year",
    severity: "high",
    appliesWhen: "Foreign funding signals",
    applies: (c) => !!c.foreign,
    recommendation: "Keep administrative and overhead costs funded by this grant at or below 20%, and say so in the budget clause.",
    evaluate: (c) => {
      const found = percentagesNear(c, /administrative|admin|overheads?|indirect cost/);
      const over = found.find((f) => f.value > 20);
      if (over) return issue(`An administrative or overhead share of ${over.value}% is mentioned, above the 20% limit.`, over.at);
      if (found.length) return pass(`Administrative share of ${found[0].value}% is within the limit.`, found[0].at);
      return warn("No administrative or overhead percentage is stated. Confirm the budget keeps these costs within 20%.");
    },
  },
  {
    id: "fcra-utilisation",
    law: "FCRA",
    title: "Use of funds limited to the purpose",
    reference: "FCRA 2010, s.8(1)(a): foreign contribution must be used only for the purpose for which it was received",
    severity: "medium",
    appliesWhen: "Foreign funding signals",
    applies: (c) => !!c.foreign,
    recommendation: "State that the funds will be used solely for the project and the purposes for which the recipient is registered under FCRA.",
    evaluate: requireWording(/(?:utili[sz]e|use|apply|spend)[^.]{0,80}(?:solely|only|exclusively)[^.]{0,40}(?:for|towards)|purpose for which[^.]{0,40}(?:received|granted|registered)/i,
      "Funds are restricted to the stated purpose.",
      "The contract does not restrict how the funds may be used.", "warning"),
  },
  {
    id: "fcra-foreign-source-csr",
    law: "FCRA",
    title: "Funder may count as a foreign source",
    reference: "FCRA 2010, s.2(1)(j)(vi): a company with more than half its share capital held by foreigners is a foreign source",
    severity: "high",
    appliesWhen: "CSR or corporate funding with signs of a foreign parent",
    applies: (c) => !!c.csr || c.contractType === "csr",
    recommendation: "Confirm the funder's foreign shareholding. If more than 50%, treat the money as foreign contribution and apply every FCRA requirement.",
    evaluate: (c) => {
      const hit = c.doc.find(/subsidiary of|parent company|foreign (?:holding|shareholding|company)|incorporated (?:in|under the laws of) (?!india)[a-z]+|group compan(?:y|ies) (?:outside|abroad)/i) ?? c.foreignLink;
      return hit
        ? warn("The funder may be part of a foreign group. If foreigners hold more than 50% of its shares, CSR money from it counts as foreign contribution.", hit)
        : pass("Nothing suggests the corporate funder is foreign-owned.");
    },
  },

  // ───────────── CSR ─────────────
  {
    id: "csr-registration",
    law: "CSR",
    title: "CSR-1 registration number",
    reference: "Companies (CSR Policy) Rules, 2014, Rule 4(2): implementing agencies must register with the MCA using Form CSR-1",
    severity: "high",
    appliesWhen: "CSR agreements",
    applies: (c) => !!c.csr,
    recommendation: "Add the implementing agency's CSR registration number (CSR0000XXXX) in the parties or representations clause.",
    evaluate: requireWording(/csr-?1|csr0\d{6,}|csr registration|registration number[^.]{0,40}(?:csr|ministry of corporate affairs)|registered with the (?:ministry of corporate affairs|central government)[^.]{0,40}csr/i,
      "CSR-1 registration is referenced.",
      "The implementing agency's CSR-1 registration number is not mentioned."),
  },
  {
    id: "csr-schedule-vii",
    law: "CSR",
    title: "Schedule VII activity",
    reference: "Companies Act, 2013, Schedule VII and s.135: CSR spend must fall within the listed activities",
    severity: "medium",
    appliesWhen: "CSR agreements",
    applies: (c) => !!c.csr,
    recommendation: "Name the Schedule VII item(s) the project falls under, e.g. \"item (ii): promoting education and livelihood enhancement\".",
    evaluate: requireWording(/schedule vii|schedule 7|schedule seven/i, "Schedule VII is referenced.", "The project is not tied to a Schedule VII activity.", "warning"),
  },
  {
    id: "csr-12a-80g",
    law: "CSR",
    title: "12A and 80G registrations",
    reference: "CSR Rules, Rule 4(1)(b)-(c): a trust, society or section 8 company implementing CSR must hold 12A and 80G registration",
    severity: "medium",
    appliesWhen: "CSR agreements",
    applies: (c) => !!c.csr,
    recommendation: "Represent that the implementing agency holds valid registrations under section 12A/12AB and 80G of the Income-tax Act, with registration numbers.",
    evaluate: requireWording(/12a|12ab|80g/i, "12A/12AB and 80G registrations are referenced.", "The agency's 12A and 80G registrations are not mentioned."),
  },
  {
    id: "csr-utilisation-certificate",
    law: "CSR",
    title: "Utilisation certificate",
    reference: "CSR Rules, Rule 4(5): the company's CFO must certify that funds were used for the approved purpose, so the agency must provide utilisation evidence",
    severity: "medium",
    appliesWhen: "CSR agreements",
    applies: (c) => !!c.csr,
    recommendation: "Commit to a utilisation certificate (signed by a chartered accountant or authorised signatory) each financial year and at project close.",
    evaluate: requireWording(/utili[sz]ation certificate|\buc\b|certificate of utili[sz]ation|certified by (?:a |the )?(?:chartered accountant|statutory auditor|chief financial officer|cfo)/i,
      "A utilisation certificate is required.",
      "No utilisation certificate is required, which the company will need for its CFO certification."),
  },
  {
    id: "csr-unspent",
    law: "CSR",
    title: "Unspent CSR funds",
    reference: "Companies Act, 2013, s.135(5)-(6): unspent amounts on ongoing projects move to an Unspent CSR Account within 30 days of the financial year end",
    severity: "medium",
    appliesWhen: "CSR agreements",
    applies: (c) => !!c.csr,
    recommendation: "Say what happens to funds unspent at the end of each financial year: carried forward for the ongoing project or returned, with timelines that let the company meet its 30-day transfer deadline.",
    evaluate: requireWording(/unspent|unutili[sz]ed|balance (?:funds|amount)[^.]{0,40}(?:return|refund|carr)/i,
      "Unspent funds are addressed.", "The contract does not say how unspent funds are handled.", "warning"),
  },
  {
    id: "csr-admin-overheads",
    law: "CSR",
    title: "Administrative overheads within 5%",
    reference: "CSR Rules, Rule 7(1): administrative overheads cannot exceed 5% of the company's total CSR expenditure for the year",
    severity: "high",
    appliesWhen: "CSR agreements",
    applies: (c) => !!c.csr,
    recommendation: "Keep administrative overheads charged to the CSR grant at or below 5%, or confirm the company has headroom in its overall cap.",
    evaluate: (c) => {
      const found = percentagesNear(c, /administrative|admin|overheads?|indirect cost/);
      const over = found.find((f) => f.value > 5);
      if (over) return issue(`An overhead share of ${over.value}% is mentioned. CSR caps administrative overheads at 5% of the company's CSR spend.`, over.at);
      if (found.length) return pass(`Overheads of ${found[0].value}% are within the cap.`, found[0].at);
      return warn("No overhead percentage is stated. Check the budget keeps administrative costs within the 5% CSR cap.");
    },
  },
  {
    id: "csr-impact-assessment",
    law: "CSR",
    title: "Impact assessment",
    reference: "CSR Rules, Rule 8(3): companies with a CSR obligation of ₹10 crore or more must assess the impact of projects of ₹1 crore or more",
    severity: "low",
    appliesWhen: "CSR agreements",
    applies: (c) => !!c.csr,
    recommendation: "If the project is ₹1 crore or more, agree who commissions and pays for the impact assessment (up to 5% of project outlay or ₹50 lakh can be booked as CSR).",
    evaluate: requireWording(/impact assessment|impact evaluation|third[- ]party evaluation/i, "Impact assessment is covered.", "Impact assessment is not mentioned. It is required for larger projects.", "warning"),
  },
  {
    id: "csr-capital-assets",
    law: "CSR",
    title: "Ownership of capital assets",
    reference: "CSR Rules, Rule 7(4): capital assets created from CSR must be held by the implementing entity, beneficiaries or a public authority",
    severity: "medium",
    appliesWhen: "CSR agreements that fund equipment, construction or other assets",
    applies: (c) => !!c.csr && c.doc.has(/capital asset|equipment|construction|building|infrastructure|vehicle|furniture|computers?\b/i),
    recommendation: "Say who will own assets bought or built with the grant, in line with Rule 7(4).",
    evaluate: requireWording(/(?:ownership|title|vest|held by|belong)[^.]{0,120}assets?|assets?[^.]{0,120}(?:ownership|title|vest|held by|belong)/i,
      "Ownership of assets is addressed.", "The grant funds assets but does not say who will own them.", "warning"),
  },
  {
    id: "csr-excluded-activities",
    law: "CSR",
    title: "Activities that do not count as CSR",
    reference: "CSR Rules, Rule 2(1)(d): activities benefiting only the company's employees, political contributions and marketing do not count as CSR",
    severity: "high",
    appliesWhen: "CSR agreements",
    applies: (c) => !!c.csr,
    recommendation: "Remove activities that benefit only the company's employees, political contributions or brand promotion from the CSR scope.",
    evaluate: (c) => {
      const hit = c.doc.find(/(?:only|exclusively|solely) (?:for|benefit(?:ing)?) (?:the )?(?:company'?s? )?employees|political (?:party|contribution|campaign)|(?:marketing|promotion) of (?:the )?company'?s? (?:products|services|brand)/i);
      return hit ? issue("The scope may include an activity that cannot be counted as CSR.", hit) : pass("No excluded activities found.");
    },
  },

  // ───────────── Income tax ─────────────
  {
    id: "it-pan",
    law: "INCOME_TAX",
    title: "PAN details",
    reference: "Income-tax Act: PAN is needed for receipts, TDS credit and donor reporting",
    severity: "low",
    appliesWhen: "Every contract involving payment",
    applies: (c) => c.contractType !== "nda",
    recommendation: "Include each party's PAN in the parties clause or a schedule.",
    evaluate: requireWording(/\bpan\b|permanent account number/i, "PAN is included.", "Neither party's PAN appears in the contract.", "warning"),
  },
  {
    id: "it-registration",
    law: "INCOME_TAX",
    title: "Tax-exempt status and donor receipts",
    reference: "Income-tax Act (1961 Act s.12A/12AB and s.80G, Form 10BE; carried into the Income-tax Act, 2025 from 1 April 2026)",
    severity: "low",
    appliesWhen: "Grants, CSR and donations",
    applies: (c) => GRANTISH.includes(c.contractType) || c.donation,
    recommendation: "State the recipient's 12A/12AB and 80G registration numbers and when the donation receipt (Form 10BE or its successor) will be issued.",
    evaluate: requireWording(/12a|12ab|80g|10be|tax[- ]exempt|exempt under section/i, "Tax registration is referenced.", "The recipient's tax-exempt registration and receipt process are not mentioned.", "warning"),
  },
  {
    id: "it-tds",
    law: "INCOME_TAX",
    title: "TDS on fees",
    reference: "Income-tax Act: tax deduction at source on professional and contract fees (1961 Act s.194J/194C; renumbered under the Income-tax Act, 2025)",
    severity: "medium",
    appliesWhen: "Service and consultancy contracts",
    applies: (c) => c.services,
    recommendation: "State that fees are subject to TDS at the applicable rate and that TDS certificates will be issued.",
    evaluate: requireWording(/\btds\b|tax deducted at source|deduct(?:ion of)? tax|withholding tax|194j|194c/i,
      "TDS is addressed.", "Fees are payable but TDS is not mentioned.", "warning"),
  },

  // ───────────── GST ─────────────
  {
    id: "gst-services",
    law: "GST",
    title: "GST on fees",
    reference: "CGST Act, 2017: whether fees include or exclude GST, and who issues the tax invoice",
    severity: "medium",
    appliesWhen: "Service and consultancy contracts",
    applies: (c) => c.services,
    recommendation: "Say whether fees are inclusive or exclusive of GST and require a valid tax invoice with the supplier's GSTIN.",
    evaluate: requireWording(/\bgst\b|goods and services tax|\bigst\b|\bcgst\b|gstin/i, "GST treatment is stated.", "The contract does not say how GST applies to the fees.", "warning"),
  },
  {
    id: "gst-sponsorship",
    law: "GST",
    title: "Funder branding and GST",
    reference: "CGST Act, 2017: a grant with no return benefit is not a supply, but sponsorship (branding or publicity for the funder) is taxable",
    severity: "medium",
    appliesWhen: "Grants, CSR and donations that give the funder branding or publicity",
    applies: (c) => GRANTISH.includes(c.contractType) && !!c.branding,
    recommendation: "Keep funder acknowledgement modest and non-commercial, or clarify the GST position if the funder receives advertising or sponsorship benefits.",
    evaluate: (c) => {
      const hit = c.doc.find(/(?:display|prominent|feature|promot|advertis)[^.]{0,80}(?:logo|brand|name)[^.]{0,40}(?:funder|donor|company|grantor)|sponsor(?:ship)?/i);
      return hit
        ? warn("The funder receives visible branding or sponsorship. If this goes beyond acknowledgement, GST may apply to the payment.", hit)
        : pass("Branding is limited to acknowledgement.", c.branding);
    },
  },

  // ───────────── Data protection ─────────────
  {
    id: "dpdp-clause",
    law: "DPDP",
    title: "Data protection terms",
    reference: "Digital Personal Data Protection Act, 2023, s.8: data fiduciaries must protect personal data and bind their processors by contract",
    severity: "high",
    appliesWhen: "Contracts that involve personal data (beneficiaries, staff, surveys)",
    applies: (c) => !!c.personalData,
    recommendation: "Add a data protection clause covering purpose limitation, security safeguards, breach notification, retention and deletion under the DPDP Act.",
    evaluate: requireWording(/data protection|digital personal data protection|\bdpdp\b|privacy polic|protect(?:ion of)? (?:the )?personal data/i,
      "Data protection is addressed.", "The contract involves personal data but has no data protection terms."),
  },
  {
    id: "dpdp-consent",
    law: "DPDP",
    title: "Consent for personal data",
    reference: "DPDP Act, 2023, s.6: processing needs free, specific, informed consent with a clear notice (s.5)",
    severity: "medium",
    appliesWhen: "Contracts that involve personal data",
    applies: (c) => !!c.personalData,
    recommendation: "Require informed consent (with a notice in a language the person understands) before collecting beneficiary data, and parental consent for children.",
    evaluate: requireWording(/consent/i, "Consent is addressed.", "Consent for collecting personal data is not mentioned.", "warning"),
  },
  {
    id: "dpdp-breach",
    law: "DPDP",
    title: "Data breach notification",
    reference: "DPDP Act, 2023, s.8(6) and DPDP Rules, 2025: personal data breaches must be reported to the Board and affected people",
    severity: "medium",
    appliesWhen: "Contracts that involve personal data",
    applies: (c) => !!c.personalData,
    recommendation: "Require each party to notify the other of a personal data breach within a short window (e.g. 24 to 72 hours) so statutory reporting can happen in time.",
    evaluate: requireWording(/breach[^.]{0,40}(?:data|personal|security)|(?:data|security) breach|unauthori[sz]ed (?:access|disclosure)|security incident/i,
      "Breach notification is covered.", "There is no obligation to report a data breach.", "warning"),
  },
  {
    id: "dpdp-transfer",
    law: "DPDP",
    title: "Personal data leaving India",
    reference: "DPDP Act, 2023, s.16: transfers outside India may be restricted by government notification",
    severity: "low",
    appliesWhen: "Contracts that involve personal data and a foreign party",
    applies: (c) => !!c.personalData && !!c.foreignLink,
    recommendation: "Say where personal data will be stored and whether it may leave India, and limit sharing with the foreign party to anonymised or aggregate data where possible.",
    evaluate: requireWording(/(?:outside|out of) india|cross-?border|stored in india|locali[sz]ation|anonymi[sz]ed|aggregate(?:d)? data/i,
      "Location of and transfers of personal data are addressed.", "The contract does not say whether personal data can be transferred abroad.", "warning"),
  },

  // ───────────── Stamp & execution ─────────────
  {
    id: "stamp-duty",
    law: "STAMP",
    title: "Stamp duty",
    reference: "Indian Stamp Act, 1899, s.35 and state stamp acts: an unstamped agreement is not admissible in evidence until duty and penalty are paid",
    severity: "low",
    appliesWhen: "Every contract",
    applies: () => true,
    recommendation: "Execute the agreement on stamp paper or e-stamp of the right value for the state of execution, and say which party bears the duty.",
    evaluate: requireWording(/stamp duty|stamp paper|e-?stamp|duly stamped|non-judicial/i, "Stamping is addressed.", "Stamp duty is not mentioned.", "warning"),
  },
  {
    id: "execution-authority",
    law: "STAMP",
    title: "Signing authority",
    reference: "Indian Contract Act, 1872 and the entities' constitutions: signatories need authority (e.g. board resolution) to bind the organisation",
    severity: "medium",
    appliesWhen: "Every contract",
    applies: () => true,
    recommendation: "Add an execution block with each signatory's name and designation, and a representation that they are duly authorised.",
    evaluate: requireWording(/authori[sz]ed signator|duly authori[sz]ed|board resolution|in witness whereof|signed (?:for and )?on behalf of/i,
      "Execution by authorised signatories is provided for.", "There is no execution block or statement of signing authority.", "warning"),
  },

  // ───────────── Contract Act ─────────────
  {
    id: "contract-restraint",
    law: "CONTRACT",
    title: "Restraint on future work",
    reference: "Indian Contract Act, 1872, s.27: agreements in restraint of a lawful profession or trade are void",
    severity: "medium",
    appliesWhen: "When non-compete or exclusivity wording appears",
    applies: (c) => c.doc.has(/non-?compete|shall not (?:engage|work|be employed|provide (?:similar )?services) (?:with|for) any|on an exclusive basis|exclusivity|exclusive (?:partner|funding|arrangement|engagement|rights)/i),
    recommendation: "Remove post-term non-compete restrictions; keep only confidentiality and non-solicitation of staff, limited in time.",
    evaluate: (c) => {
      const hit = c.doc.find(/non-?compete|shall not (?:engage|work|be employed|provide (?:similar )?services) (?:with|for) any|on an exclusive basis|exclusivity|exclusive (?:partner|funding|arrangement|engagement|rights)/i);
      return warn("The contract restricts a party from working with others. Post-contract restraints are generally void in India and exclusivity can limit fundraising.", hit);
    },
  },
  {
    id: "contract-penalty",
    law: "CONTRACT",
    title: "Penalties and liquidated damages",
    reference: "Indian Contract Act, 1872, s.74: only reasonable compensation is recoverable, whatever penalty the contract names",
    severity: "low",
    appliesWhen: "When penalty or liquidated damages wording appears",
    applies: (c) => c.doc.has(/penalt(?:y|ies)|liquidated damages/i),
    recommendation: "Check the amount is a genuine pre-estimate of loss and capped, and that delays caused by the other party or force majeure are excluded.",
    evaluate: (c) => warn("The contract provides for penalties or liquidated damages.", c.doc.find(/penalt(?:y|ies)|liquidated damages/i)),
  },

  // ───────────── Governing law & disputes ─────────────
  {
    id: "law-governing",
    law: "DISPUTES",
    title: "Governing law",
    reference: "Choice of law: an Indian non-profit should contract under Indian law where possible, since FCRA, CSR and tax obligations are Indian",
    severity: "high",
    appliesWhen: "Every contract",
    applies: () => true,
    recommendation: "Make the contract governed by the laws of India.",
    evaluate: (c) => {
      const india = c.doc.find(/(?:governed by|construed in accordance with|subject to)[^.]{0,60}laws? of (?:the republic of )?india|indian law/i);
      if (india) return pass("The contract is governed by Indian law.", india);
      const foreign = c.doc.find(/(?:governed by|construed in accordance with)[^.]{0,60}laws? of (?:the )?(?:state of )?([a-z ]{3,40})/i);
      if (foreign && INDIAN_PLACES.test(foreign.match[1])) return pass("The contract is governed by Indian law.", foreign);
      if (foreign) return issue("The contract is governed by a foreign law, which makes enforcing or defending it in India harder and costlier.", foreign);
      return issue("No governing law is stated.");
    },
  },
  {
    id: "law-dispute-forum",
    law: "DISPUTES",
    title: "Dispute forum",
    reference: "Arbitration and Conciliation Act, 1996: the seat decides which courts supervise the arbitration",
    severity: "medium",
    appliesWhen: "Every contract",
    applies: () => true,
    recommendation: "Provide for amicable resolution first, then arbitration seated in an Indian city (or the courts of that city).",
    evaluate: (c) => {
      const foreignSeat = c.doc.find(/(?:seat|venue|place) of (?:the )?arbitration[^.]{0,60}(?:london|singapore|new york|geneva|paris|hong kong|washington|stockholm|dubai)|(?:courts?|tribunals?) (?:of|at|in) (?:london|singapore|new york|england|geneva|washington|the united states)/i);
      if (foreignSeat) return issue("Disputes would be resolved outside India.", foreignSeat);
      const forum = c.doc.find(/arbitrat|jurisdiction of (?:the )?courts?|courts? (?:at|of|in) [a-z]+/i);
      if (forum) return pass("A dispute forum is set out.", forum);
      return warn("The contract does not say how or where disputes will be resolved.");
    },
  },

  // ───────────── Ethics ─────────────
  {
    id: "ethics-anti-bribery",
    law: "ETHICS",
    title: "Anti-bribery commitment",
    reference: "Prevention of Corruption Act, 1988; foreign funders often also require compliance with the US FCPA or UK Bribery Act",
    severity: "low",
    appliesWhen: "Every contract except NDAs",
    applies: (c) => c.contractType !== "nda",
    recommendation: "Add a mutual anti-bribery and anti-corruption clause.",
    evaluate: requireWording(/brib|corrupt|kickback|fcpa|improper payment/i, "Anti-bribery wording is present.", "There is no anti-bribery commitment.", "warning"),
  },
  {
    id: "ethics-sanctions",
    law: "ETHICS",
    title: "Anti-terrorism and sanctions screening",
    reference: "Funder-side rules (e.g. US OFAC, UN sanctions lists): certifications often require screening of partners and beneficiaries",
    severity: "medium",
    appliesWhen: "When terrorism or sanctions wording appears",
    applies: (c) => c.doc.has(/terroris|sanction(?:s|ed) list|\bofac\b|\bsdn\b|designated person/i),
    recommendation: "Make sure screening obligations are practical: limit them to partners and vendors, not every beneficiary, and to lists you can actually check.",
    evaluate: (c) => warn("The contract asks for anti-terrorism or sanctions certification. Check the screening duties are realistic for your programmes.", c.doc.find(/terroris|sanction(?:s|ed) list|\bofac\b|\bsdn\b|designated person/i)),
  },

  // ───────────── Safeguarding & workplace ─────────────
  {
    id: "safeguarding-children",
    law: "SAFEGUARDING",
    title: "Safeguarding children",
    reference: "Protection of Children from Sexual Offences Act, 2012 (incl. mandatory reporting, s.19) and Juvenile Justice Act, 2015",
    severity: "medium",
    appliesWhen: "Programmes involving children or adolescents",
    applies: (c) => !!c.children,
    recommendation: "Require a safeguarding policy, background checks for people working with children, and prompt reporting of incidents.",
    evaluate: requireWording(/safeguard|child protection|pocso|protection of children/i, "Safeguarding is covered.", "The work involves children but there are no safeguarding terms.", "warning"),
  },
  {
    id: "posh",
    law: "SAFEGUARDING",
    title: "POSH policy",
    reference: "Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013",
    severity: "low",
    appliesWhen: "Employment, fellowship and consultancy contracts",
    applies: (c) => c.contractType === "employment" || c.contractType === "consultancy",
    recommendation: "Reference the organisation's POSH policy and Internal Committee.",
    evaluate: requireWording(/sexual harassment|\bposh\b|internal (?:complaints )?committee/i, "POSH is referenced.", "The POSH policy is not referenced.", "warning"),
  },
];

// Signals used to decide which rules apply.
export function buildContext(doc: DocText, contractType: ContractType): RuleContext {
  const foreignMoney = doc.find(
    /foreign contribution|\bfcra\b|\busd\b|us\$|\beur\b|€|\bgbp\b|£|\bchf\b|incorporated (?:in|under the laws of) (?:the )?(?:state of )?(?!india)[a-z]+|delaware|501\(c\)\(3\)/i
  );
  return {
    doc,
    contractType,
    foreign: foreignMoney,
    foreignLink: foreignMoney ?? doc.find(/united states of america|\busa\b|u\.s\.a|united kingdom|switzerland|netherlands|germany|singapore|overseas|subsidiary of|parent company|foreign (?:holding|shareholding)/i),
    csr: contractType === "csr" ? doc.find(/corporate social responsibility|\bcsr\b|section 135/i) ?? { quote: "", page: 1 } : doc.find(/corporate social responsibility|section 135|schedule vii/i),
    personalData: doc.find(/personal data|personal information|beneficiar(?:y|ies)'? (?:data|details|information|records)|aadhaar|phone numbers?|mobile numbers?|household (?:survey|data)|health (?:data|records)|biometric|personally identifiable|\bpii\b|data principal/i),
    children: doc.find(/\bchild(?:ren)?\b|\bminors?\b|adolescents?|students?|school ?children|\bgirls?\b|anganwadi/i),
    donation: contractType === "donation" || doc.has(/\bdonation\b|\bdonor\b/i),
    services: contractType === "service" || contractType === "consultancy" || doc.has(/professional fees|service fees|consultancy fees|invoice/i),
    branding: doc.find(/logo|branding|publicity|acknowledg(?:e|ement)|press release|use of (?:the )?name/i),
  };
}
