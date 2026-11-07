export function withPgbouncer(url: string | undefined): string | undefined;
export function directFromPooled(url: string | undefined): string | undefined;
export function hostOf(url: string): string;
export function databaseLikeNames(env: Record<string, string | undefined>): string[];
export function resolveDatabaseEnv(env: Record<string, string | undefined>): {
  url: string | undefined;
  urlFrom: string | undefined;
  directUrl: string | undefined;
  directUrlFrom: string | undefined;
};
