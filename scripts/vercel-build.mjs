// Build entry point for Vercel: works out the database connection strings from
// whichever names the Postgres integration set, applies migrations, then builds.
// Explains missing configuration in plain words instead of a bare exit code.
import { execSync } from "node:child_process";
import { databaseLikeNames, hostOf, resolveDatabaseEnv } from "./database-env.mjs";

const env = { ...process.env };
const db = resolveDatabaseEnv(env);

if (!db.url) {
  const seen = databaseLikeNames(env);
  console.error(`
✖ No database connection string found for this ${env.VERCEL_ENV ?? "build"} deployment.

  Add a Postgres database to this Vercel project (Storage tab → Neon, or
  connect Supabase), or set DATABASE_URL yourself under Settings →
  Environment Variables. Make sure it is enabled for the Production
  environment, then redeploy.

  Looked for: DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL (with or without a prefix).
  Database-related variables visible to this build: ${seen.length ? seen.join(", ") : "none"}.
`);
  process.exit(1);
}

env.DATABASE_URL = db.url;
env.DIRECT_URL = db.directUrl;
console.log(`Database: app connects to ${hostOf(db.url)} (from ${db.urlFrom}); migrations use ${hostOf(db.directUrl)} (from ${db.directUrlFrom}).`);

if (!env.BLOB_READ_WRITE_TOKEN) console.warn("⚠ BLOB_READ_WRITE_TOKEN is not set: uploads will fail until a private Blob store is connected.");
if (!env.APP_PASSWORD) console.warn("⚠ APP_PASSWORD is not set: the app will refuse all visitors until it is.");

const run = (cmd) => execSync(cmd, { stdio: "inherit", env });
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

run("npx prisma generate");

// Serverless databases (Neon) can take a few seconds to wake up, so retry.
for (let attempt = 1; ; attempt++) {
  try {
    run("npx prisma migrate deploy");
    break;
  } catch {
    if (attempt < 3) {
      console.warn(`⚠ Migration attempt ${attempt} failed; retrying in ${attempt * 5}s…`);
      pause(attempt * 5000);
      continue;
    }
    console.error(`
✖ Could not apply database migrations (Prisma's error is above).

  Migrations connect to ${hostOf(db.directUrl)}, taken from ${db.directUrlFrom}.
  Check that the database exists and is reachable, and that its variables
  are enabled for this environment (Settings → Environment Variables).
`);
    process.exit(1);
  }
}

run("npx next build");
