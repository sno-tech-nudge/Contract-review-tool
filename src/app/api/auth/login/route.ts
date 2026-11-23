import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authEnabled, teamPasswordMatches } from "@/lib/auth";
import { accountCount, signIn, verifyPassword } from "@/lib/users";

// Only same-site relative paths are allowed as the post-login destination.
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

// Sign in with an account (email and password), or with the team password
// while no account exists yet.
export async function POST(request: Request) {
  const form = await request.formData();
  const next = safeNext(form.get("next"));
  if (!authEnabled()) return NextResponse.redirect(new URL(next, request.url), 303);

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  let user: { id: string; name: string; role: string } | null = null;
  if (email) {
    const found = await prisma.user.findUnique({ where: { email } });
    if (found?.active && found.passwordHash && (await verifyPassword(password, found.passwordHash))) user = found;
  } else if ((await accountCount()) === 0 && (await teamPasswordMatches(password))) {
    user = { id: "team", name: "Team", role: "admin" };
  }

  if (!user) {
    // a short pause makes guessing slower
    await new Promise((r) => setTimeout(r, 800));
    const back = new URL("/login", request.url);
    back.searchParams.set("error", "1");
    if (next !== "/") back.searchParams.set("next", next);
    return NextResponse.redirect(back, 303);
  }

  const res = NextResponse.redirect(new URL(user.id === "team" ? "/team" : next, request.url), 303);
  await signIn(res, user);
  return res;
}
