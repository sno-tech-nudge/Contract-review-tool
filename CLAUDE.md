# Contract review tool: project notes

This project is the contract review tool, not the^delta prize admin tool described in the parent folder's CLAUDE.md. None of that file's database, Vercel or roster details apply here.

- Repo: https://github.com/sno-tech-nudge/Contract-review-tool, branch `main`. Commit and push only when asked.
- Stack: Next.js 15 App Router, TypeScript, React 19, Prisma 6 on Postgres, files in a private Vercel Blob store (or `storage/` on disk locally). pdf.js (react-pdf in the browser, unpdf on the server), mammoth for .docx, optional Claude via `@anthropic-ai/sdk`.
- Deploys to Vercel (see README "Deploying to Vercel"). `vercel-build` runs `scripts/vercel-build.mjs`: it resolves the database URLs from whichever names the Neon/Supabase integration set (`scripts/database-env.mjs`, also used by `src/lib/db.ts`), then `prisma generate`, `prisma migrate deploy`, `next build`. Functions are pinned to Mumbai (`vercel.json`). On Vercel without `APP_PASSWORD` the middleware returns 503 for everything (fail closed).
- Local database: `npm run db:local` (Prisma's local Postgres). Its URLs need `&connection_limit=1&pgbouncer=true`, otherwise restarts hit "prepared statement already exists".
- Dev server runs on Turbopack (`npm run dev`). Webpack dev mode breaks pdfjs-dist v5 ("Object.defineProperty called on non-object"); the production webpack build (`npm run build`) is fine.
- `npm run lint` is `tsc --noEmit` and must pass before a change is done. For UI changes, check them in the browser preview (`.claude/launch.json` has dev and prod configs).
- Schema changes: edit `prisma/schema.prisma`, run `npm run db:migrate` to create a migration, commit it. On Windows, stop the dev server before `prisma generate` (the engine DLL is locked) and restart it after.

## Hosting constraints (Vercel)

- Request and response bodies over 4.5 MB fail in functions, so uploads go browser → Blob directly (`src/lib/upload-client.ts` + `/api/upload`); ingest routes then receive only the blob pathname (`readContractUpload` in `src/lib/api.ts`). Keep this path for any new upload.
- Files are streamed to the browser through `/api/files/[id]` (never buffered, never public URLs).
- The filesystem is read-only on Vercel: anything written must go through `src/lib/storage.ts`.
- Sign-in: `APP_PASSWORD` turns on the shared-password gate in `src/middleware.ts`; the session cookie is a hash of the password and `AUTH_SECRET`. Every new page and API route is protected automatically by the middleware matcher.
- Postgres rejects NUL bytes in text; `extract.ts` strips them.

## Design

Follows The/Nudge design system ("Proof System"): brown `#693d30` text on warm paper `#f6f2ec`, Montserrat Light with Lato italic captions, hairline rules, small radii (2 to 6px), wide-tracked uppercase kickers, `/01` index markers. Status colours are the brand accents only: clay for issues, gold for checks, moss for passes, at badge or marker scale. Tokens live in `src/styles/` (copied from the design system zip) and the app styles in `src/app/globals.css`. Use the existing classes (`btn`, `badge`, `card`, `field`, `tabs`, `finding`, …) rather than new one-off styles. UK spelling, sentence case, "The/Nudge" with the slash, no emoji.

## Where things are

- `src/lib/contracts/`: clause segmentation, clause and contract-type classification, ingestion.
- `src/lib/checks/`: `boilerplate.ts` (repository comparison, one-sided terms), `legal/rules.ts` (all legal rules with references), `business.ts` + `business-kinds.ts` (configurable rules), `keyterms.ts`, `model-clauses.ts` (starter wording used before the repository has examples).
- `src/lib/review/`: result types, risk score, `run.ts` orchestration.
- `src/components/viewer/`: PDF and HTML viewers; `match.ts` finds a quote in rendered text for highlighting.
- `src/components/review/ReviewWorkspace.tsx`: the right-hand review panel.

## Conventions

- Every finding should carry a `quote` copied from the contract where possible: the viewer uses it to scroll to and highlight the passage.
- Legal rule references must be accurate. The Income-tax Act, 2025 replaced the 1961 Act from 1 April 2026; rules cite 1961 section numbers with that note rather than guessing new numbers.
- Business rules are data (the `BusinessRule` table), not code. New rule kinds go in `business-kinds.ts` and `runBusinessCheck`.
