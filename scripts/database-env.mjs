// Vercel's Postgres integrations use different variable names: Neon sets
// DATABASE_URL + DATABASE_URL_UNPOOLED, Supabase sets POSTGRES_PRISMA_URL +
// POSTGRES_URL_NON_POOLING. This picks the right one for each purpose.
// Shared by the build script and the app (src/lib/db.ts).

// Exact names first; then the same names with a prefix, which Vercel's Storage
// dialog allows (e.g. STORAGE_DATABASE_URL).
const candidates = (env, names) => {
  const out = [];
  for (const n of names) if (env[n]) out.push({ value: env[n], name: n });
  for (const n of names) {
    for (const k of Object.keys(env).filter((k) => k.endsWith(`_${n}`) && env[k]).sort()) {
      if (!out.some((c) => c.name === k)) out.push({ value: env[k], name: k });
    }
  }
  return out;
};

const isSupabase = (url) => /\.supabase\.(com|co)$/.test(hostOf(url).replace(/:\d+$/, ""));

// Supabase is the app's database. While an older Neon database is still
// connected to the project (kept as a backup), Supabase wins.
const first = (env, names) => {
  const all = candidates(env, names);
  return all.find((c) => isSupabase(c.value)) ?? all[0] ?? null;
};

// Names only, never values: lets the build log show what is actually set.
export function databaseLikeNames(env) {
  return Object.keys(env)
    .filter((k) => /DATABASE|POSTGRES|^PG|NEON|SUPABASE/i.test(k) && env[k])
    .sort();
}

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
  // the direct URL must point at the same database as the pooled one
  const sameDb = (c) => !pooled || isSupabase(c.value) === isSupabase(pooled.value);
  const direct = candidates(env, ["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]).find(sameDb) ?? null;
  const directValue = direct?.value ?? pooled?.value;
  const directUrl = directFromPooled(directValue);
  return {
    url: withPgbouncer(pooled?.value),
    urlFrom: pooled?.name,
    directUrl,
    directUrlFrom: (direct ?? pooled)?.name && `${(direct ?? pooled).name}${directUrl !== directValue ? " (switched to the direct host)" : ""}`,
  };
}
