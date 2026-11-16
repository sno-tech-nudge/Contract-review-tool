"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap, Lightbulb } from "lucide-react";
import { contractTypeLabel, lowerLabel } from "@/lib/contracts/types";
import { SEVERITY_LABEL, type Severity } from "@/lib/review/types";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/components/ui";

export type RuleRow = {
  ruleKey: string;
  contractType: string;
  title: string;
  check: string;
  useful: number;
  notRelevant: number;
  precision: number;
  effect: "muted" | "downgraded" | "promoted" | null;
  mode: "auto" | "on" | "off";
};

export type SuggestionRow = {
  id: string;
  note: string;
  quote: string;
  severity: string;
  contractType: string;
  phrase: string;
  seenIn: number;
  reviewId: string | null;
  reviewTitle: string;
  createdAt: string;
};

type Stats = {
  votes: number;
  usefulShare: number | null;
  muted: number;
  lowered: number;
  raised: number;
  typeExamples: number;
  clauseExamples: number;
  openMisses: number;
  typeAccuracy: { kept: number; total: number } | null;
};

const CHECK_LABEL: Record<string, string> = { boilerplate: "Boilerplate", legal: "Legal", business: "Business", ai: "AI", biz: "Business", bp: "Boilerplate" };
const EFFECT: Record<string, { label: string; cls: string }> = {
  muted: { label: "Muted", cls: "badge--neutral" },
  downgraded: { label: "Lowered", cls: "badge--gold" },
  promoted: { label: "Raised", cls: "badge--clay" },
};
const typeName = (t: string) => (t === "*" ? "All types" : contractTypeLabel(t));

export function LearningDashboard({ stats, typeExamples, rules, suggestions, events }: { stats: Stats; typeExamples: { label: string; count: number }[]; rules: RuleRow[]; suggestions: SuggestionRow[]; events: { id: string; kind: string; summary: string; createdAt: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const setMode = async (r: RuleRow, mode: "auto" | "on" | "off") => {
    setBusy(r.ruleKey + r.contractType);
    const res = await fetch("/api/learning/rules", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruleKey: r.ruleKey, contractType: r.contractType, mode, title: r.title }) });
    setBusy(null);
    if (!res.ok) return toast("Could not update the check", "error");
    toast(mode === "auto" ? "Back to learning from feedback" : mode === "on" ? "Kept on, whatever the feedback" : "Switched off for this contract type");
    router.refresh();
  };

  const dismiss = async (s: SuggestionRow) => {
    const res = await fetch(`/api/learning/missed/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "dismissed" }) });
    if (res.ok) {
      toast("Dismissed");
      router.refresh();
    }
  };

  return (
    <main className="page">
      <span className="kicker">Learning</span>
      <h1 className="page-title">What the tool has learned</h1>
      <p className="lead" style={{ marginBottom: "var(--space-6)" }}>
        Every review teaches it something. Votes on findings tune which checks matter for each kind of contract, corrections train type and clause detection, and flagged misses become new rules. Every change is listed here and can be undone.
      </p>

      <div className="repo-stats learn-stats">
        <div className="repo-stat">
          <div className="repo-stat__value">{stats.votes}</div>
          <div className="repo-stat__label">
            Votes on findings{stats.usefulShare !== null ? ` · ${Math.round(stats.usefulShare * 100)}% useful` : ""}
          </div>
        </div>
        <div className="repo-stat">
          <div className="repo-stat__value">{stats.muted + stats.lowered + stats.raised}</div>
          <div className="repo-stat__label">
            Checks adjusted · {stats.muted} muted, {stats.lowered} lowered, {stats.raised} raised
          </div>
        </div>
        <div className="repo-stat">
          <div className="repo-stat__value">{stats.typeExamples + stats.clauseExamples}</div>
          <div className="repo-stat__label">
            Corrections learned · {stats.typeExamples} contract type{stats.typeExamples === 1 ? "" : "s"}, {stats.clauseExamples} clause{stats.clauseExamples === 1 ? "" : "s"}
          </div>
        </div>
        <div className="repo-stat">
          <div className="repo-stat__value">{stats.openMisses}</div>
          <div className="repo-stat__label">Flagged misses waiting</div>
        </div>
      </div>

      {stats.typeAccuracy && (
        <p className="caption" style={{ marginTop: "calc(-1 * var(--space-3))", marginBottom: "var(--space-6)" }}>
          Contract type was detected correctly in {stats.typeAccuracy.kept} of the last {stats.typeAccuracy.total} reviews
          {typeExamples.length > 0 && <> · learning from {typeExamples.map((t) => `${t.count} ${lowerLabel(contractTypeLabel(t.label))}${t.count === 1 ? "" : "s"}`).join(", ")}</>}.
        </p>
      )}

      <section style={{ marginBottom: "var(--space-8)" }}>
        <div className="sechead">
          <h2>Suggested rules from flagged misses</h2>
          <span className="micro num">{suggestions.length}</span>
        </div>
        {suggestions.length === 0 ? (
          <p className="caption">Nothing waiting. When a reviewer uses &quot;Flag a miss&quot; on a review, it appears here as a possible new business rule.</p>
        ) : (
          suggestions.map((s) => (
            <article className="clause-card" key={s.id}>
              <div className="clause-card__head">
                <Lightbulb size={16} color="var(--brown-600)" />
                <div className="clause-card__title">
                  {s.note}
                  <div className="clause-card__heading">
                    {SEVERITY_LABEL[s.severity as Severity] ?? s.severity} · {contractTypeLabel(s.contractType)} ·{" "}
                    {s.reviewId ? <Link href={`/review/${s.reviewId}`}>{s.reviewTitle}</Link> : s.reviewTitle} · {formatDate(s.createdAt)}
                    {s.seenIn > 1 && <strong style={{ fontWeight: 500 }}> · seen in {s.seenIn} flagged contracts</strong>}
                  </div>
                </div>
                <Link className="btn btn--sm" href={`/rules?tab=business&fromMissed=${s.id}`}>
                  Create rule
                </Link>
                <button className="btn btn--ghost btn--sm" onClick={() => dismiss(s)}>
                  Dismiss
                </button>
              </div>
              {s.quote && <p className="clause-card__text">“{s.quote}”</p>}
              {s.phrase && (
                <p className="caption" style={{ padding: "0 var(--space-4) var(--space-3)", margin: 0 }}>
                  Suggested rule: flag {lowerLabel(contractTypeLabel(s.contractType))}s that mention &quot;{s.phrase}&quot;.
                </p>
              )}
            </article>
          ))
        )}
      </section>

      <section style={{ marginBottom: "var(--space-8)" }}>
        <div className="sechead">
          <h2>Check track record</h2>
          <span className="micro">By contract type</span>
        </div>
        {rules.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">
              <GraduationCap size={22} strokeWidth={1.5} />
            </div>
            <h3>No feedback yet</h3>
            <p>Open a review, expand a finding and choose Useful or Not relevant. After a few votes, checks start adjusting to your team.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Contract type</th>
                  <th>Useful</th>
                  <th>Not relevant</th>
                  <th>Usefulness</th>
                  <th>Now</th>
                  <th>Control</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.ruleKey + r.contractType}>
                    <td>
                      {r.title}
                      <div className="micro">{CHECK_LABEL[r.check] ?? r.check}</div>
                    </td>
                    <td className="muted">{typeName(r.contractType)}</td>
                    <td className="num">{r.useful}</td>
                    <td className="num">{r.notRelevant}</td>
                    <td>
                      <span className="simbar" style={{ alignItems: "flex-start" }}>
                        {r.useful + r.notRelevant ? `${Math.round(r.precision * 100)}%` : "—"}
                        <i>
                          <b style={{ width: `${Math.round(r.precision * 100)}%` }} />
                        </i>
                      </span>
                    </td>
                    <td>{r.effect ? <span className={`badge ${EFFECT[r.effect].cls}`}>{EFFECT[r.effect].label}</span> : <span className="faint">Normal</span>}</td>
                    <td>
                      <select className="select" style={{ width: "auto", fontSize: "var(--text-xs)" }} value={r.mode} disabled={busy === r.ruleKey + r.contractType} onChange={(e) => setMode(r, e.target.value as "auto" | "on" | "off")} aria-label={`Control for ${r.title}`}>
                        <option value="auto">Learn from feedback</option>
                        <option value="on">Always keep on</option>
                        <option value="off">Switch off</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="caption">
          A check is lowered after 2 &quot;not relevant&quot; votes and muted after 3, when most votes for that contract type agree. It is raised after 3 &quot;useful&quot; votes. With few votes for a type, votes across all types are used. Muted checks still appear, collapsed, at the bottom of each review.
        </p>
      </section>

      <section>
        <div className="sechead">
          <h2>Recent learning</h2>
        </div>
        {events.length === 0 ? (
          <p className="caption">Changes in behaviour will be listed here as the team uses the tool.</p>
        ) : (
          <ol className="timeline">
            {events.map((e) => (
              <li key={e.id}>
                <span className="micro num">{formatDate(e.createdAt)}</span>
                <span>{e.summary}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
