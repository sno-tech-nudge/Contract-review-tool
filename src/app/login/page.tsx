import { redirect } from "next/navigation";
import { CircleAlert, Lock } from "lucide-react";
import { authEnabled } from "@/lib/auth";

export const metadata = { title: "Sign in · Contract review" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!authEnabled()) redirect("/");
  const { next, error } = await searchParams;

  return (
    <main className="login">
      <form className="login__card" method="post" action="/api/auth/login">
        <img src="/brand/thenudge-wordmark-brown.png" alt="The/Nudge" className="login__logo" />
        <span className="kicker">Contract review</span>
        <h1 className="login__title">Sign in</h1>
        <p className="caption" style={{ margin: 0 }}>
          This tool holds confidential contracts. Use the team password.
        </p>
        <input type="hidden" name="next" value={next ?? "/"} />
        <label className="field">
          <span className="field__label">Password</span>
          <span className="search">
            <Lock />
            <input className="input" type="password" name="password" autoComplete="current-password" autoFocus required />
          </span>
        </label>
        {error && (
          <span className="dropzone__error" role="alert">
            <CircleAlert size={16} /> That password is not right. Try again.
          </span>
        )}
        <button className="btn" type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
