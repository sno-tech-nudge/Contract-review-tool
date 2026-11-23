import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { logLearning } from "@/lib/learning";
import { accountCount, createSetupLink, currentUser, hashPassword, isRole, MIN_PASSWORD, originOf, signIn } from "@/lib/users";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Two uses:
// - before any account exists, whoever signed in with the team password
//   creates the first admin account, with their own password;
// - after that, an admin adds a person and gets a one-time setup link to send them.
export async function POST(request: Request) {
  const me = await currentUser();
  const body = (await request.json().catch(() => ({}))) as { name?: string; email?: string; role?: string; password?: string };
  const name = String(body.name ?? "").trim().slice(0, 80);
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!name) return jsonError("Enter a name.");
  if (!EMAIL.test(email)) return jsonError("Enter a valid email address.");
  if (await prisma.user.findUnique({ where: { email } })) return jsonError("Someone with that email is already on the team.");

  if ((await accountCount()) === 0) {
    if (!me || me.kind === "person") return jsonError("Sign in with the team password first.", 403);
    const password = String(body.password ?? "");
    if (password.length < MIN_PASSWORD) return jsonError(`Use a password of at least ${MIN_PASSWORD} characters.`);
    const user = await prisma.user.create({ data: { name, email, role: "admin", passwordHash: await hashPassword(password) } });
    await logLearning("team", `${name} created the first admin account. From now on everyone signs in with their own account.`);
    const res = NextResponse.json({ ok: true, first: true });
    await signIn(res, user);
    return res;
  }

  if (me?.role !== "admin") return jsonError("Only admins can add people.", 403);
  const role = isRole(body.role) ? body.role : "member";
  const user = await prisma.user.create({ data: { name, email, role } });
  const setupUrl = await createSetupLink(user.id, originOf(request));
  await logLearning("team", `${me.name} added ${name} to the team.`);
  return NextResponse.json({ id: user.id, setupUrl });
}
