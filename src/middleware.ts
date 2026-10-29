import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, SESSION_COOKIE, sessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && cookie === (await sessionToken())) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // everything except static assets
  matcher: ["/((?!_next/static|_next/image|brand/|fonts/|favicon.ico).*)"],
};
