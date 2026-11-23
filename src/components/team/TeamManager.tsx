"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Link2, Power, ShieldCheck, UserPlus } from "lucide-react";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/components/ui";

type Person = { id: string; name: string; email: string; role: string; active: boolean; status: "active" | "invited" | "expired" | "off"; lastSeenAt: string | null };
type RoleDef = { key: string; label: string; help: string };

const STATUS: Record<Person["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "badge--moss" },
  invited: { label: "Invited", cls: "badge--gold" },
  expired: { label: "Link expired", cls: "badge--neutral" },
  off: { label: "Switched off", cls: "badge--neutral" },
};

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
  return json;
}

function SetupLink({ url, name, onDone }: { url: string; name: string; onDone: () => void }) {
  const toast = useToast();
  return (
    <div className="setup-link" role="status">
      <p className="caption" style={{ margin: 0 }}>
        Send this link to {name}. It works once and lasts seven days; they choose their own password with it. It will not be shown again.
      </p>
      <div className="setup-link__row">
        <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Setup link" />
        <button
          className="btn btn--sm"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            toast("Link copied");
          }}
        >
          <Copy /> Copy
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

export function TeamManager({
  me,
  firstAccount,
  minPassword,
  roles,
  people,
}: {
  me: { id: string; role: string; kind: string };
  firstAccount: boolean;
  minPassword: number;
  roles: RoleDef[];
  people: Person[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", role: "member", password: "" });
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string; name: string } | null>(null);
  const isAdmin = me.role === "admin";

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await send("/api/team", "POST", form);
      if (res.first) {
        toast("Your account is ready. Add the rest of the team below");
        router.refresh();
      } else {
        setLink({ url: res.setupUrl, name: form.name });
        toast(`${form.name} added`);
        router.refresh();
      }
      setForm({ name: "", email: "", role: "member", password: "" });
    } catch (err) {
      toast((err as Error).message, "error");
    }
    setBusy(false);
  };

  const change = async (p: Person, body: Record<string, unknown>, done: string) => {
    try {
      const res = await send(`/api/team/${p.id}`, "PATCH", body);
      if (res.setupUrl) setLink({ url: res.setupUrl, name: p.name });
      toast(done);
      router.refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  if (firstAccount) {
    return (
      <main className="page">
        <span className="kicker">Team</span>
        <h1 className="page-title">Create the first admin account</h1>
        <p className="lead" style={{ marginBottom: "var(--space-6)" }}>
          Everyone will sign in with their own account, so votes, corrections and flagged misses show who made them, and a legal reviewer&apos;s judgement can count for more. Start with yours: you
          will be the first admin and can add the rest of the team. The team password stops working once this account exists.
        </p>
        <form className="card team-form" onSubmit={add}>
          <label className="field">
            <span className="field__label">Your name</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required />
          </label>
          <label className="field">
            <span className="field__label">Work email</span>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" required />
          </label>
          <label className="field">
            <span className="field__label">Your password</span>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" minLength={minPassword} required />
            <span className="field__help">At least {minPassword} characters. Only you will know it.</span>
          </label>
          <button className="btn" type="submit" disabled={busy}>
            <ShieldCheck /> {busy ? "Creating…" : "Create my admin account"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="page">
      <span className="kicker">Team</span>
      <h1 className="page-title">Who can sign in</h1>
      <p className="lead" style={{ marginBottom: "var(--space-6)" }}>
        Each person has their own account. Their votes, corrections and flagged misses are credited to them, and votes from legal reviewers count double when the tool tunes its checks.
      </p>

      {link && <SetupLink url={link.url} name={link.name} onDone={() => setLink(null)} />}

      {isAdmin && (
        <form className="card team-form team-form--row" onSubmit={add}>
          <label className="field">
            <span className="field__label">Name</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="field">
            <span className="field__label">Email</span>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label className="field">
            <span className="field__label">Role</span>
            <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit" disabled={busy}>
            <UserPlus /> {busy ? "Adding…" : "Add and get setup link"}
          </button>
        </form>
      )}

      <div className="table-wrap" style={{ marginTop: "var(--space-6)" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last signed in</th>
              {isAdmin && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className={p.active ? "" : "team-row--off"}>
                <td>
                  {p.name}
                  {p.id === me.id && <span className="faint"> · you</span>}
                  <div className="caption" style={{ margin: 0 }}>{p.email}</div>
                </td>
                <td>
                  {isAdmin ? (
                    <select className="select cm-type-pick" value={p.role} aria-label={`Role for ${p.name}`} onChange={(e) => change(p, { role: e.target.value }, "Role updated")} title={roles.find((r) => r.key === p.role)?.help}>
                      {roles.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    roles.find((r) => r.key === p.role)?.label
                  )}
                </td>
                <td>
                  <span className={`badge ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
                </td>
                <td className="muted num">{p.lastSeenAt ? formatDate(p.lastSeenAt) : "–"}</td>
                {isAdmin && (
                  <td className="team-actions">
                    {p.active && (
                      <button className="btn btn--ghost btn--sm" onClick={() => change(p, { newLink: true }, "New setup link made")} title="Make a new one-time setup link, for a new person or a forgotten password">
                        <Link2 /> New link
                      </button>
                    )}
                    {p.id !== me.id && (
                      <button
                        className="btn btn--ghost btn--sm"
                        style={p.active ? { color: "var(--clay)" } : undefined}
                        onClick={() => change(p, { active: !p.active }, p.active ? `${p.name} can no longer sign in` : `${p.name} can sign in again`)}
                      >
                        <Power /> {p.active ? "Switch off" : "Switch on"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="caption team-roles">
        {roles.map((r) => (
          <li key={r.key}>
            <b>{r.label}</b>: {r.help}
          </li>
        ))}
      </ul>
    </main>
  );
}
