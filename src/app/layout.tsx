import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NavLinks } from "@/components/NavLinks";
import { ToastProvider } from "@/components/Toast";
import { aiEnabled } from "@/lib/ai/claude";
import { authEnabled } from "@/lib/auth";
import { currentUser } from "@/lib/users";
import { LogOut, Users } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contract review · The/Nudge",
  description: "Review contracts against our repository, Indian non-profit law and our own business rules.",
  icons: { icon: "/brand/thenudge-slash-brown.png" },
};

const PUBLIC_PAGES = ["/login", "/setup"];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "";
  const isPublic = PUBLIC_PAGES.includes(path);
  const user = isPublic ? null : await currentUser();
  // the middleware checks the cookie's signature; this also catches accounts
  // that were switched off and team-password sessions once accounts exist
  if (authEnabled() && !isPublic && !user) redirect(`/login${path && path !== "/" ? `?next=${encodeURIComponent(path)}` : ""}`);

  return (
    <html lang="en-GB">
      <body>
        <ToastProvider>
          <header className="nav">
            <Link href="/" className="nav__brand" aria-label="Contract review home">
              <img src="/brand/thenudge-wordmark-brown.png" alt="The/Nudge" />
              <span className="nav__product">Contract review</span>
            </Link>
            <NavLinks />
            <div className="nav__end">
              <span className={`badge ${aiEnabled() ? "badge--moss" : "badge--neutral"}`} title={aiEnabled() ? "Claude adds a summary and extra risks to every review" : "Set ANTHROPIC_API_KEY to add AI review"}>
                <span className="dot" aria-hidden />
                {aiEnabled() ? "AI review on" : "Rule checks only"}
              </span>
              {user && user.role === "admin" && (
                <Link href="/team" className="btn btn--ghost btn--icon" aria-label="Team" title="Team and sign-in">
                  <Users />
                </Link>
              )}
              {user?.kind === "person" && (
                <span className="nav__user" title={user.email}>
                  {user.name.split(" ")[0]}
                </span>
              )}
              {authEnabled() && user && (
                <form method="post" action="/api/auth/logout">
                  <button className="btn btn--ghost btn--icon" type="submit" aria-label="Sign out" title="Sign out">
                    <LogOut />
                  </button>
                </form>
              )}
            </div>
          </header>
          {user?.kind === "team" && path !== "/team" && (
            <div className="notice-bar" role="status">
              You are signed in with the team password. <Link href="/team">Create your own admin account</Link> so everyone can sign in as themselves.
            </div>
          )}
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
