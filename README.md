# Contract review

An internal tool for The/Nudge to review contracts before signing. Upload or drag in a contract and it is checked three ways:

1. **Boilerplate**: compared clause by clause with the contracts in our repository. Flags missing clauses, wording that departs from our standard, unfamiliar clauses and one-sided terms, and offers the standard wording to copy.
2. **Legal**: 34 built-in checks for Indian non-profits across FCRA, CSR (Companies Act s.135 and CSR Rules), income tax, GST, the DPDP Act, stamp duty and execution, the Contract Act, governing law and disputes, anti-corruption and safeguarding.
3. **Business**: our own rules (payment terms, renewals, approval limits, required wording), configured from the Rules page.

The contract is shown as a PDF on the left and the review on the right. Clicking any finding or key term scrolls the document to the passage and highlights it.

## Parts

| Page | What it does |
| --- | --- |
| **Review** (`/`) | Drop a contract to review; list of recent reviews |
| **Review workspace** (`/review/[id]`) | Document viewer + risk score, summary, key terms, and findings by check. Change the contract type to re-check, export a printable report, or file the contract into the repository |
| **Repository** (`/repository`) | The knowledge base and document store. Drag in many files at once, sort into folders by contract type, mark approved templates, search contents |
| **Clause library** (`/library`) | Every indexed clause by topic, ready to copy |
| **Rules** (`/rules`) | Switch built-in legal checks on or off; add and edit business rules |

## Running locally

Requires Node 20+.

```bash
npm install
cp .env.example .env
npx prisma db push
npm run dev
```

Open http://localhost:3000.

Optional: set `ANTHROPIC_API_KEY` in `.env` to have Claude add a plain-language summary, key terms and any risks the rules missed. Without it, every rule-based check still runs.

## How it works

- `src/lib/extract.ts` pulls text per page from PDF (pdf.js), Word (mammoth) and text files.
- `src/lib/contracts/` splits a contract into clauses (`segment.ts`) and classifies each clause and the contract type by keyword signals (`classify.ts`, `types.ts`).
- `src/lib/checks/boilerplate.ts` compares clauses with the repository using TF-IDF similarity. Expected clauses are learned from the repository once it holds two or more contracts of a type; until then a standard checklist is used.
- `src/lib/checks/legal/rules.ts` holds the legal rules. Each rule says when it applies and what wording satisfies it, with the statutory reference.
- `src/lib/checks/business.ts` runs the configurable business rules.
- `src/lib/review/run.ts` runs everything and stores the result. `src/lib/ai/claude.ts` adds the optional AI review.

Checks look for wording, so a pass means a contract addresses a point, not that it is legally sufficient. The tool prepares a contract for legal review; it does not replace it.

## Storage

Local development uses SQLite (`prisma/dev.db`) and stores uploaded files under `storage/`. Both are git-ignored. For a hosted deployment, switch the Prisma provider to `postgresql` and replace the three functions in `src/lib/storage.ts` with a bucket (for example Supabase Storage).
