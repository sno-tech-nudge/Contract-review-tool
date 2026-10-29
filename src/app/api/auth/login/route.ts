import { NextResponse } from "next/server";
import { authEnabled, passwordMatches, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/auth";

// Only same-site relative paths are allowed as the post-login destination.
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const next = safeNext(form.get("next"));
  if (!authEnabled()) return NextResponse.redirect(new URL(next, request.url), 303);

  if (!(await passwordMatches(String(form.get("password") ?? "")))) {
    // a short pause makes guessing slower
    await new Promise((r) => setTimeout(r, 800));
    const back = new URL("/login", request.url);
    back.searchParams.set("error", "1");
    if (next !== "/") back.searchParams.set("next", next);
    return NextResponse.redirect(back, 303);
  }

  const res = NextResponse.redirect(new URL(next, request.url), 303);
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
