export function withPgbouncer(url: string | undefined): string | undefined;
export function resolveDatabaseEnv(env: Record<string, string | undefined>): {
  url: string | undefined;
  urlFrom: string | undefined;
  directUrl: string | undefined;
  directUrlFrom: string | undefined;
};
