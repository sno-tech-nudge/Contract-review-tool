import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logLearning } from "@/lib/learning";
import { hashPassword, MIN_PASSWORD, signIn, userForSetupToken } from "@/lib/users";

// A person sets their own password through the one-time link an admin shared.
export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const back = (error: string) => NextResponse.redirect(new URL(`/setup?token=${encodeURIComponent(token)}&error=${error}`, request.url), 303);

  const user = await userForSetupToken(token);
  if (!user) return back("link");
  if (password.length < MIN_PASSWORD) return back("short");
  if (password !== confirm) return back("match");

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), setupHash: "", setupExpires: null } });
  await logLearning("team", `${user.name} set up their account.`);
  const res = NextResponse.redirect(new URL("/", request.url), 303);
  await signIn(res, user);
  return res;
}
