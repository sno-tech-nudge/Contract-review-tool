"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, RefreshCw, Trash2 } from "lucide-react";
import { ContractLoader } from "@/components/ContractLoader";
import { useToast } from "@/components/Toast";

// Shown while a review's checks run in the background. Polls the review and
// swaps in the results as soon as they are ready.

type Status = { status: string; stage: string; error: string; createdAt: string };

// keep in step with REVIEW_STAGES in src/lib/review/run.ts
const STAGES = [
  "Reading the contract",
  "Splitting it into clauses",
  "Comparing wording with the repository and clause library",
  "Checking the law",
  "Checking business rules",
  "Scoring the risk",
];
const STALLED_AFTER_MS = 3 * 60 * 1000;

export function ReviewProgress({ id, title, initial }: { id: string; title: string; initial: Status }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state.status !== "PROCESSING") return;
    const t = setInterval(async () => {
      setNow(Date.now());
      const res = await fetch(`/api/reviews/${id}`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const next = (await res.json()) as Status;
      setState(next);
      if (next.status === "COMPLETE") router.refresh();
    }, 1200);
    return () => clearInterval(t);
  }, [id, router, state.status]);

  const rerun = async () => {
    setBusy(true);
    setState((s) => ({ ...s, status: "PROCESSING", stage: STAGES[0], error: "", createdAt: new Date().toISOString() }));
    const res = await fetch(`/api/reviews/${id}/rerun`, { method: "POST" }).catch(() => null);
    setBusy(false);
    if (res?.ok) router.refresh();
    else {
      setState((s) => ({ ...s, status: "FAILED", error: "The checks could not finish on this contract. If it keeps failing, the file may be damaged." }));
      toast("The checks could not finish", "error");
    }
  };

  const remove = async () => {
    if (!confirm(`Delete the review of "${title}"?`)) return;
    const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/");
  };

  const failed = state.status === "FAILED";
  const stalled = state.status === "PROCESSING" && now - new Date(state.createdAt).getTime() > STALLED_AFTER_MS;
  const current = Math.max(0, STAGES.indexOf(state.stage));

  return (
    <main className="page progress-page">
      <div className="progress-card">
        <span className="kicker">Reviewing</span>
        <h1 className="progress-card__title">{title}</h1>

        {failed ? (
          <p className="progress-card__error">
            <CircleAlert size={18} /> {state.error || "The checks could not finish on this contract."}
          </p>
        ) : (
          <ContractLoader size="lg" label={state.stage || "Working on the contract"} />
        )}

        <ol className="progress-steps">
          {STAGES.map((s, i) => {
            const done = !failed && i < current;
            const active = !failed && i === current;
            return (
              <li key={s} className={done ? "is-done" : active ? "is-active" : ""} aria-current={active ? "step" : undefined}>
                <span className="progress-steps__mark" aria-hidden>
                  {done ? <CircleCheck size={16} /> : <span />}
                </span>
                {s}
              </li>
            );
          })}
        </ol>

        {(failed || stalled) && (
          <div className="progress-card__actions">
            {stalled && <p className="caption">This is taking longer than usual. You can run the checks again.</p>}
            <button className="btn" onClick={rerun} disabled={busy}>
              <RefreshCw /> Run the checks again
            </button>
            <button className="btn btn--ghost" style={{ color: "var(--clay)" }} onClick={remove} disabled={busy}>
              <Trash2 /> Delete
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
