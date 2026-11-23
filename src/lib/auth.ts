// Sign-in for the hosted app. When APP_PASSWORD is set, every page and API
// route needs a signed session cookie; when it is not set (local development)
// the app is open. Uses Web Crypto only, so it also runs in middleware.
//
// People sign in with their own account. The team password (APP_PASSWORD)
// works only until the first account exists, so the team can create it.

export const SESSION_COOKIE = "cr_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days for a person
export const TEAM_SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours for the team password

export type Role = "admin" | "legal" | "member";
// "team" is the shared-password session used before any account exists
export type Session = { userId: string; name: string; role: Role; expires: number };

export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

const encoder = new TextEncoder();
const secret = () => process.env.AUTH_SECRET || `contract-review:${process.env.APP_PASSWORD ?? ""}`;

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))));
}

function sameString(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length && i < b.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(s: Omit<Session, "expires">, maxAgeSeconds: number): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ ...s, expires: Date.now() + maxAgeSeconds * 1000 })));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !sameString(sig, await hmac(payload))) return null;
  try {
    const s = JSON.parse(fromBase64Url(payload)) as Session;
    return s.expires > Date.now() ? s : null;
  } catch {
    return null;
  }
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function teamPasswordMatches(candidate: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(candidate), sha256(process.env.APP_PASSWORD ?? "")]);
  return sameString(a, b);
}

export { sha256 };
