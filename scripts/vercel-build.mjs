// Build entry point for Vercel: works out the database connection strings from
// whichever names the Postgres integration set, applies migrations, then builds.
// Explains missing configuration in plain words instead of a bare exit code.
import { execSync } from "node:child_process";
import { resolveDatabaseEnv } from "./database-env.mjs";

const env = { ...process.env };
const db = resolveDatabaseEnv(env);

if (!db.url) {
  console.error(`
✖ No database connection string found.

  Add a Postgres database to this Vercel project (Storage tab → Neon, or
  connect Supabase), or set DATABASE_URL yourself under Settings →
  Environment Variables. Then redeploy.

  Looked for: DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL.
`);
  process.exit(1);
}

env.DATABASE_URL = db.url;
env.DIRECT_URL = db.directUrl;
console.log(`Database: runtime connection from ${db.urlFrom}, migrations via ${db.directUrlFrom}.`);

if (!env.BLOB_READ_WRITE_TOKEN) console.warn("⚠ BLOB_READ_WRITE_TOKEN is not set: uploads will fail until a private Blob store is connected.");
if (!env.APP_PASSWORD) console.warn("⚠ APP_PASSWORD is not set: the app will refuse all visitors until it is.");

const run = (cmd) => execSync(cmd, { stdio: "inherit", env });
try {
  run("npx prisma generate");
  run("npx prisma migrate deploy");
} catch {
  console.error(`
✖ Could not apply database migrations.

  Check that the database is reachable and that the direct (non-pooled)
  connection string is correct. It was taken from ${db.directUrlFrom}.
  Neon: DATABASE_URL_UNPOOLED. Supabase: the port 5432 connection string.
`);
  process.exit(1);
}
run("npx next build");
