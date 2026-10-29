import type { ClauseType } from "../contracts/types";

// Starter wording offered when a clause is missing and the repository has no
// example of it yet. Deliberately plain and balanced; legal should review
// before use. Repository clauses always take priority over these.
export const MODEL_CLAUSE_SOURCE = "Starter clause library (review with legal before use)";

export const MODEL_CLAUSES: Partial<Record<ClauseType, string>> = {
  term: "This Agreement shall come into force on the Effective Date and, unless terminated earlier in accordance with its terms, shall remain in force until [end date] or until both Parties have fulfilled their obligations under it, whichever is later.",
  termination:
    "Either Party may terminate this Agreement by giving the other Party not less than thirty (30) days' written notice. Either Party may terminate this Agreement with immediate effect by written notice if the other Party commits a material breach that is not remedied within thirty (30) days of receiving written notice of the breach. On termination, the Grantee shall be entitled to retain funds already spent or irrevocably committed in accordance with the approved budget up to the date of termination.",
  governing_law: "This Agreement shall be governed by and construed in accordance with the laws of India. Subject to the dispute resolution clause, the courts at [city] shall have exclusive jurisdiction.",
  dispute_resolution:
    "The Parties shall first attempt to resolve any dispute arising out of or in connection with this Agreement amicably through good-faith discussions between their senior representatives within thirty (30) days. Failing such resolution, the dispute shall be referred to arbitration by a sole arbitrator appointed by mutual consent under the Arbitration and Conciliation Act, 1996. The seat and venue of arbitration shall be [city], India, and the proceedings shall be conducted in English.",
  confidentiality:
    "Each Party shall keep confidential all non-public information received from the other Party in connection with this Agreement and shall use it only for the purposes of this Agreement. This obligation does not apply to information that is or becomes public through no fault of the receiving Party, or that must be disclosed by law, regulation or order of a competent authority. These obligations shall survive for three (3) years after the expiry or termination of this Agreement.",
  indemnity:
    "Each Party shall indemnify the other Party against direct losses arising from its own breach of this Agreement, wilful misconduct or gross negligence. Neither Party shall be liable for indirect, consequential or special losses.",
  liability: "Except in the case of fraud, wilful misconduct or breach of confidentiality, the aggregate liability of either Party under this Agreement shall not exceed the total amount paid or payable under this Agreement.",
  force_majeure:
    "Neither Party shall be liable for any delay or failure to perform its obligations caused by events beyond its reasonable control, including natural disasters, epidemics, war, civil unrest or acts of government. The affected Party shall notify the other Party promptly, and the Parties shall agree in good faith on revised timelines. If the event continues for more than ninety (90) days, either Party may terminate this Agreement by written notice.",
  fund_use: "The Grantee shall utilise the Grant solely for the Project and in accordance with the approved budget. Reallocation between budget lines exceeding ten percent (10%) of a line shall require the prior written approval of the Grantor, which shall not be unreasonably withheld.",
  reporting: "The Grantee shall submit a narrative progress report and a financial report every [six months], and a final report together with a utilisation certificate within sixty (60) days of the end of the Project.",
  audit: "The Grantee shall maintain proper books of account and records relating to the Grant for at least eight (8) years and shall make them available for inspection or audit by the Grantor or its appointed auditors on reasonable prior notice.",
  refund: "Any portion of the Grant that remains unspent at the end of the Project, or that is not used in accordance with this Agreement, shall be returned to the Grantor within thirty (30) days of a written request, unless the Parties agree in writing to its use for another purpose consistent with the Project.",
  ip: "Each Party retains ownership of its pre-existing intellectual property. Intellectual property created under this Agreement shall be owned by [Party], which grants the other Party a non-exclusive, royalty-free licence to use it for non-commercial, charitable purposes.",
  branding: "Neither Party shall use the name, logo or trademarks of the other Party in any publicity, communication or material without the other Party's prior written consent.",
  data_protection:
    "Each Party shall process personal data received under this Agreement only for the purposes of this Agreement and in compliance with the Digital Personal Data Protection Act, 2023 and the rules made under it, including obtaining valid consent where required, implementing reasonable security safeguards, and notifying the other Party without undue delay of any personal data breach.",
  anti_bribery: "Each Party shall comply with all applicable anti-bribery and anti-corruption laws, including the Prevention of Corruption Act, 1988, and shall not offer, give or accept any bribe or improper payment in connection with this Agreement.",
  compliance: "Each Party shall comply with all laws applicable to it in performing this Agreement, including, where applicable, the Foreign Contribution (Regulation) Act, 2010, the Companies Act, 2013 and the Income-tax Act.",
  notices: "All notices under this Agreement shall be in writing and delivered by hand, registered post or email to the addresses set out above, and shall be deemed received on delivery, or for email, on the next working day after sending.",
  assignment: "Neither Party may assign or transfer its rights or obligations under this Agreement without the prior written consent of the other Party.",
  amendment: "No amendment to this Agreement shall be effective unless made in writing and signed by the authorised representatives of both Parties.",
  entire_agreement: "This Agreement, together with its schedules, constitutes the entire agreement between the Parties regarding its subject matter and supersedes all prior discussions and understandings.",
  severability: "If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.",
  warranties: "Each Party represents that it is duly registered and validly existing under the laws of India, has full power and authority to enter into this Agreement, and that the person signing on its behalf is duly authorised to do so.",
  safeguarding: "The Grantee shall maintain and enforce a safeguarding and child protection policy consistent with applicable law, including the Protection of Children from Sexual Offences Act, 2012, and shall report any safeguarding incident connected with the Project to the Grantor within forty-eight (48) hours.",
  taxes: "All amounts are [inclusive/exclusive] of applicable GST. Each Party shall bear its own taxes, and any tax deducted at source shall be supported by the relevant certificate issued within the statutory time.",
  signatures: "IN WITNESS WHEREOF, the Parties have caused this Agreement to be executed by their duly authorised representatives on the date first written above.",
};
