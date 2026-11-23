import { redirect } from "next/navigation";
import { CircleAlert, Lock, Mail } from "lucide-react";
import { authEnabled } from "@/lib/auth";
import { accountCount } from "@/lib/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Contract review" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!authEnabled()) redirect("/");
  const { next, error } = await searchParams;
  // until the first account exists, the team password lets someone create it
  const accounts = (await accountCount()) > 0;

  return (
    <main className="login">
      <form className="login__card" method="post" action="/api/auth/login">
        <img src="/brand/thenudge-wordmark-brown.png" alt="The/Nudge" className="login__logo" />
        <span className="kicker">Contract review</span>
        <h1 className="login__title">Sign in</h1>
        <p className="caption" style={{ margin: 0 }}>
          {accounts
            ? "This tool holds confidential contracts. Sign in with your own account."
            : "Use the team password once to create the first admin account. After that, everyone signs in with their own."}
        </p>
        <input type="hidden" name="next" value={next ?? "/"} />
        {accounts && (
          <label className="field">
            <span className="field__label">Email</span>
            <span className="search">
              <Mail />
              <input className="input" type="email" name="email" autoComplete="username" autoFocus required />
            </span>
          </label>
        )}
        <label className="field">
          <span className="field__label">{accounts ? "Password" : "Team password"}</span>
          <span className="search">
            <Lock />
            <input className="input" type="password" name="password" autoComplete="current-password" autoFocus={!accounts} required />
          </span>
        </label>
        {error && (
          <span className="dropzone__error" role="alert">
            <CircleAlert size={16} /> {accounts ? "That email and password do not match an active account." : "That password is not right."} Try again.
          </span>
        )}
        <button className="btn" type="submit">
          Sign in
        </button>
        {accounts && <p className="caption" style={{ margin: 0 }}>Forgot your password? Ask an admin for a new setup link.</p>}
      </form>
    </main>
  );
}
