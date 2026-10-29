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
npm run db:local
```

`db:local` starts a local Postgres and prints its TCP URL (`postgres://postgres:postgres@localhost:51214/...`). Put that URL in `.env` as both `DATABASE_URL` and `DIRECT_URL`, adding `&connection_limit=1&pgbouncer=true` to the end. Then, in a second terminal:

```bash
npx prisma migrate deploy
npm run dev
```

Open http://localhost:3000. Locally there is no sign-in (leave `APP_PASSWORD` empty) and files are stored under `storage/`.

Optional: set `ANTHROPIC_API_KEY` in `.env` to have Claude add a plain-language summary, key terms and any risks the rules missed. Without it, every rule-based check still runs.

## Deploying to Vercel

The app is ready for Vercel: Postgres for data, a private Vercel Blob store for the contract files, and a shared team password.

1. **Import the project.** In Vercel, choose *Add New → Project* and import `sno-tech-nudge/Contract-review-tool`. Leave the build settings as detected; the `vercel-build` script generates the Prisma client, applies database migrations and builds the app.
2. **Add a Postgres database.** Under the project's *Storage* tab, create a Neon Postgres database (or connect Supabase) in the Mumbai region (`ap-south-1`), next to the app (`vercel.json`), and connect it to the project. Nothing else to set: the build reads whichever variable names the integration creates (Neon: `DATABASE_URL` + `DATABASE_URL_UNPOOLED`; Supabase: `POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING`). To use another Postgres, set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) yourself.
3. **Add file storage.** Under *Storage*, create a **Blob** store with **private** access and connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`. Contracts upload from the browser straight to the store, so files up to 25 MB work despite Vercel's 4.5 MB request limit.
4. **Set the remaining environment variables** (*Settings → Environment Variables*):
   - `APP_PASSWORD`: the team password. Until it is set, the deployed app refuses every visitor, so contracts are never exposed.
   - `AUTH_SECRET`: any long random string.
   - `ANTHROPIC_API_KEY` (optional) for the AI review.
5. **Deploy.** Redeploy after adding variables so the build picks them up. If something is missing, the build log says what (look for lines starting with ✖ or ⚠). Every later push to `main` deploys automatically.

Changing `APP_PASSWORD` or `AUTH_SECRET` signs everyone out. To change the database schema, edit `prisma/schema.prisma`, run `npm run db:migrate` locally to create a migration, and commit it: the next deploy applies it.

## How it works

- `src/lib/extract.ts` pulls text per page from PDF (pdf.js), Word (mammoth) and text files.
- `src/lib/contracts/` splits a contract into clauses (`segment.ts`) and classifies each clause and the contract type by keyword signals (`classify.ts`, `types.ts`).
- `src/lib/checks/boilerplate.ts` compares clauses with the repository using TF-IDF similarity. Expected clauses are learned from the repository once it holds two or more contracts of a type; until then a standard checklist is used.
- `src/lib/checks/legal/rules.ts` holds the legal rules. Each rule says when it applies and what wording satisfies it, with the statutory reference.
- `src/lib/checks/business.ts` runs the configurable business rules.
- `src/lib/review/run.ts` runs everything and stores the result. `src/lib/ai/claude.ts` adds the optional AI review.

Checks look for wording, so a pass means a contract addresses a point, not that it is legally sufficient. The tool prepares a contract for legal review; it does not replace it.

## Storage

Data lives in Postgres (Prisma, migrations in `prisma/migrations`). Contract files go to a private Vercel Blob store when `BLOB_READ_WRITE_TOKEN` is set, otherwise to `storage/` on disk (git-ignored). Files are always served through `/api/files/[id]`, behind the sign-in, never from a public URL.
