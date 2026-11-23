import Link from "next/link";
import { CircleAlert, Lock } from "lucide-react";
import { MIN_PASSWORD, userForSetupToken } from "@/lib/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set your password · Contract review" };

const ERRORS: Record<string, string> = {
  short: `Use at least ${MIN_PASSWORD} characters.`,
  match: "The two passwords are different.",
  link: "This link has expired or was already used.",
};

// Where a person lands from the one-time link an admin shared with them.
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  const user = await userForSetupToken(token);

  return (
    <main className="login">
      {user ? (
        <form className="login__card" method="post" action="/api/auth/setup">
          <img src="/brand/thenudge-wordmark-brown.png" alt="The/Nudge" className="login__logo" />
          <span className="kicker">Contract review</span>
          <h1 className="login__title">Welcome, {user.name.split(" ")[0]}</h1>
          <p className="caption" style={{ margin: 0 }}>
            Choose a password for {user.email}. Only you will know it.
          </p>
          <input type="hidden" name="token" value={token} />
          <label className="field">
            <span className="field__label">New password</span>
            <span className="search">
              <Lock />
              <input className="input" type="password" name="password" autoComplete="new-password" minLength={MIN_PASSWORD} autoFocus required />
            </span>
            <span className="field__help">At least {MIN_PASSWORD} characters</span>
          </label>
          <label className="field">
            <span className="field__label">Type it again</span>
            <span className="search">
              <Lock />
              <input className="input" type="password" name="confirm" autoComplete="new-password" minLength={MIN_PASSWORD} required />
            </span>
          </label>
          {error && (
            <span className="dropzone__error" role="alert">
              <CircleAlert size={16} /> {ERRORS[error] ?? "Something went wrong. Try again."}
            </span>
          )}
          <button className="btn" type="submit">
            Set password and sign in
          </button>
        </form>
      ) : (
        <div className="login__card">
          <img src="/brand/thenudge-wordmark-brown.png" alt="The/Nudge" className="login__logo" />
          <span className="kicker">Contract review</span>
          <h1 className="login__title">This link no longer works</h1>
          <p className="caption" style={{ margin: 0 }}>
            Setup links last seven days and work once. Ask an admin for a new one, or <Link href="/login">sign in</Link> if you already set your password.
          </p>
        </div>
      )}
    </main>
  );
}
