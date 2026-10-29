// Vercel's Postgres integrations use different variable names: Neon sets
// DATABASE_URL + DATABASE_URL_UNPOOLED, Supabase sets POSTGRES_PRISMA_URL +
// POSTGRES_URL_NON_POOLING. This picks the right one for each purpose.
// Shared by the build script and the app (src/lib/db.ts).

const first = (env, names) => {
  const name = names.find((n) => env[n]);
  return name ? { value: env[name], name } : null;
};

// Poolers in transaction mode (Neon "-pooler" hosts, Supabase port 6543) can't
// keep Prisma's prepared statements between requests.
export function withPgbouncer(url) {
  if (!url || /[?&]pgbouncer=/.test(url)) return url;
  if (!/-pooler\.|:6543\//.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "pgbouncer=true";
}

export function resolveDatabaseEnv(env) {
  const pooled = first(env, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"]);
  const direct = first(env, ["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]);
  return {
    url: withPgbouncer(pooled?.value),
    urlFrom: pooled?.name,
    directUrl: direct?.value ?? pooled?.value,
    directUrlFrom: direct?.name ?? pooled?.name,
  };
}
