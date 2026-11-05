// Vercel's Postgres integrations use different variable names: Neon sets
// DATABASE_URL + DATABASE_URL_UNPOOLED, Supabase sets POSTGRES_PRISMA_URL +
// POSTGRES_URL_NON_POOLING. This picks the right one for each purpose.
// Shared by the build script and the app (src/lib/db.ts).

const first = (env, names) => {
  const name = names.find((n) => env[n]);
  return name ? { value: env[name], name } : null;
};

const isPooled = (url) => /-pooler\.|:6543\//.test(url ?? "");

// Poolers in transaction mode (Neon "-pooler" hosts, Supabase port 6543) can't
// keep Prisma's prepared statements between requests.
export function withPgbouncer(url) {
  if (!url || /[?&]pgbouncer=/.test(url) || !isPooled(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "pgbouncer=true";
}

// Migrations need a direct connection. Neon's direct host is the pooled host
// without "-pooler"; Supabase's pooler accepts direct (session) connections on
// port 5432.
export function directFromPooled(url) {
  if (!url || !isPooled(url)) return url;
  return url
    .replace("-pooler.", ".")
    .replace(":6543/", ":5432/")
    .replace(/([?&])pgbouncer=true(&|$)/, (_, pre, post) => (post ? pre : ""))
    .replace(/\?$/, "");
}

export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "unknown host";
  }
}

export function resolveDatabaseEnv(env) {
  const pooled = first(env, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"]);
  const direct = first(env, ["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]);
  const directValue = direct?.value ?? pooled?.value;
  const directUrl = directFromPooled(directValue);
  return {
    url: withPgbouncer(pooled?.value),
    urlFrom: pooled?.name,
    directUrl,
    directUrlFrom: (direct ?? pooled)?.name && `${(direct ?? pooled).name}${directUrl !== directValue ? " (switched to the direct host)" : ""}`,
  };
}
