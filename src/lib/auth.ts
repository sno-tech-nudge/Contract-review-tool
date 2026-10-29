// Shared-password sign-in for the hosted app. When APP_PASSWORD is set, every
// page and API route needs a session cookie; when it is not set (local
// development) the app is open. Uses Web Crypto so it also runs in middleware.

export const SESSION_COOKIE = "cr_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// The cookie value is derived from the password, so changing APP_PASSWORD (or
// AUTH_SECRET) signs everyone out.
export async function sessionToken(): Promise<string> {
  return sha256(`contract-review:${process.env.APP_PASSWORD ?? ""}:${process.env.AUTH_SECRET ?? ""}`);
}

export async function passwordMatches(candidate: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(candidate), sha256(process.env.APP_PASSWORD ?? "")]);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length && i < b.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
