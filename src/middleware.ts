import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, SESSION_COOKIE, sessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

const NOT_CONFIGURED = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign-in not set up · Contract review</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f2ec;color:#693d30;font:300 16px/1.6 Montserrat,Helvetica,Arial,sans-serif">
<main style="max-width:460px;padding:32px;background:#fff;border:1px solid rgba(105,61,48,.2);border-top:1.5px solid #693d30;border-radius:4px">
<p style="margin:0 0 8px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#9a6655">Contract review</p>
<h1 style="margin:0 0 12px;font-weight:300;font-size:28px">Sign-in is not set up yet</h1>
<p style="margin:0">This app holds confidential contracts, so it stays closed until a team password is set. In Vercel, add an <b style="font-weight:500">APP_PASSWORD</b> environment variable to this project and redeploy.</p>
</main></body>`;

export async function middleware(request: NextRequest) {
  if (!authEnabled()) {
    // Locally the app is open; a hosted deployment without a password stays closed.
    if (!process.env.VERCEL) return NextResponse.next();
    if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign-in is not set up. Set APP_PASSWORD." }, { status: 503 });
    return new NextResponse(NOT_CONFIGURED, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

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
