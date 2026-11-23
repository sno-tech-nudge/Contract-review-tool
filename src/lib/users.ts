import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import { authEnabled, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE, sha256, TEAM_SESSION_MAX_AGE, verifySessionToken, type Role } from "./auth";

// Accounts on the server side: password hashing, who is signed in, and the
// one-time links people use to set their own password.

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const MIN_PASSWORD = 10;
export const ROLES: { key: Role; label: string; help: string }[] = [
  { key: "admin", label: "Admin", help: "Manages the team, rules and settings" },
  { key: "legal", label: "Legal reviewer", help: "Their votes count double when the tool tunes its checks" },
  { key: "member", label: "Member", help: "Reviews contracts and gives feedback" },
];
export const isRole = (r: unknown): r is Role => ROLES.some((x) => x.key === r);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, key] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export type CurrentUser = { id: string; name: string; email: string; role: Role; kind: "person" | "team" | "local" };

const LOCAL: CurrentUser = { id: "local", name: "Local", email: "", role: "admin", kind: "local" };

export const accountCount = () => prisma.user.count({ where: { active: true } });

// Who is making this request. Null means not signed in, or signed in with the
// team password after accounts were set up, or an account that was switched off.
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!authEnabled()) return LOCAL;
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  if (session.userId === "team") return (await accountCount()) === 0 ? { id: "team", name: "Team", email: "", role: "admin", kind: "team" } : null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active || !user.passwordHash) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role as Role, kind: "person" };
});

// The person to credit for an action; safe outside a request (background work).
export async function actingUser(): Promise<CurrentUser | null> {
  try {
    return await currentUser();
  } catch {
    return null;
  }
}

export async function signIn(res: NextResponse, user: { id: string; name: string; role: string }) {
  const team = user.id === "team";
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ userId: user.id, name: user.name, role: user.role as Role }, team ? TEAM_SESSION_MAX_AGE : SESSION_MAX_AGE), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: team ? TEAM_SESSION_MAX_AGE : SESSION_MAX_AGE,
  });
  if (!team) await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
}

const SETUP_DAYS = 7;

// A new link replaces any earlier one; only its hash is stored.
export async function createSetupLink(userId: string, origin: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.user.update({
    where: { id: userId },
    data: { setupHash: await sha256(token), setupExpires: new Date(Date.now() + SETUP_DAYS * 24 * 60 * 60 * 1000) },
  });
  return `${origin}/setup?token=${token}`;
}

export async function userForSetupToken(token: string) {
  if (!token) return null;
  const user = await prisma.user.findFirst({ where: { setupHash: await sha256(token), active: true } });
  return user && user.setupExpires && user.setupExpires > new Date() ? user : null;
}

export const originOf = (request: Request) => {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
};
