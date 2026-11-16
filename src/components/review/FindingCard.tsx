"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Copy, GraduationCap, Lightbulb, LocateFixed, ThumbsDown, ThumbsUp } from "lucide-react";
import { SEVERITY_LABEL, type Finding } from "@/lib/review/types";
import { SeverityBadge, StatusIcon, STATUS_LABEL } from "@/components/ui";
import { useToast } from "@/components/Toast";

export type FeedbackVerdict = "useful" | "not_relevant";
export type FindingFeedbackState = { verdict: FeedbackVerdict; reason: string };

export const NOT_RELEVANT_REASONS: { value: string; label: string }[] = [
  { value: "not_applicable", label: "Doesn't apply to this kind of contract" },
  { value: "handled_elsewhere", label: "Already handled elsewhere" },
  { value: "misread", label: "The check misread the contract" },
  { value: "too_minor", label: "Too minor to matter" },
  { value: "other", label: "Another reason" },
];

type Props = {
  finding: Finding;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onLocate: (f: Finding) => void;
  showCheck?: boolean;
  feedback?: FindingFeedbackState;
  onFeedback?: (verdict: FeedbackVerdict | null, reason?: string) => void;
};

const CHECK_LABEL = { boilerplate: "Boilerplate", legal: "Legal", business: "Business", ai: "AI" } as const;
const EFFECT_LABEL = { muted: "Muted", downgraded: "Lowered", promoted: "Raised" } as const;

export function FindingCard({ finding: f, active, open, onToggle, onLocate, showCheck, feedback, onFeedback }: Props) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const learned = f.learning;

  return (
    <article className={`finding${open ? " finding--open" : ""}${active ? " finding--active" : ""}${learned?.effect === "muted" ? " finding--muted" : ""}`} data-status={f.status} id={`finding-${f.id}`}>
      <button
        className="finding__head"
        aria-expanded={open}
        onClick={() => {
          onToggle();
          if (!open && f.quote) onLocate(f);
        }}
      >
        <StatusIcon status={f.status} className="finding__icon" />
        <span className="finding__main">
          <span className="finding__title">{f.title}</span>
          <span className="finding__sub">
            {f.status !== "pass" ? <SeverityBadge severity={f.severity} /> : <span className="badge badge--label badge--moss">{STATUS_LABEL.pass}</span>}
            {showCheck && <span className="badge badge--outline">{CHECK_LABEL[f.check]}</span>}
            {learned && (
              <span className="badge badge--outline" title={learned.reason}>
                <GraduationCap /> {EFFECT_LABEL[learned.effect]} by feedback
              </span>
            )}
            {feedback && (
              <span className="micro" title="Your team's vote on this finding">
                {feedback.verdict === "useful" ? "Marked useful" : "Marked not relevant"}
              </span>
            )}
            {f.page ? <span className="micro num">p.{f.page}</span> : null}
          </span>
        </span>
        <ChevronDown className="finding__chev" aria-hidden />
      </button>

      {open && (
        <div className="finding__body">
          {learned && (
            <div className="learned">
              <GraduationCap aria-hidden />
              <span>
                {learned.effect === "muted"
                  ? "Muted for this kind of contract. "
                  : `${learned.effect === "downgraded" ? "Lowered" : "Raised"} from ${SEVERITY_LABEL[learned.originalSeverity]}. `}
                {learned.reason} <Link href="/learning">Change on the Learning page</Link>
              </span>
            </div>
          )}

          <p className="finding__detail">{f.detail}</p>

          {f.quote && (
            <button className="quote" onClick={() => onLocate(f)} title="Show in the contract">
              “{f.quote}”
              <span className="quote__go">
                <LocateFixed /> Show in contract{f.page ? ` · page ${f.page}` : ""}
              </span>
            </button>
          )}

          {f.recommendation && (
            <div className="reco">
              <Lightbulb aria-hidden />
              <span>{f.recommendation}</span>
            </div>
          )}

          {f.suggestion && (
            <div className="suggest">
              <div className="suggest__head">
                <span>
                  Standard wording from{" "}
                  {f.suggestion.documentId ? <Link href={`/repository/${f.suggestion.documentId}`}>{f.suggestion.source}</Link> : f.suggestion.source}
                </span>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(f.suggestion!.text);
                    setCopied(true);
                    toast("Clause copied to clipboard");
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  <Copy /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="suggest__text">{f.suggestion.text}</p>
            </div>
          )}

          {f.reference && <div className="finding__ref">{f.reference}</div>}

          {onFeedback && f.status !== "pass" && (
            <div className="feedback">
              <span className="feedback__q">Was this useful?</span>
              <button
                className={`chipbtn${feedback?.verdict === "useful" ? " chipbtn--on" : ""}`}
                aria-pressed={feedback?.verdict === "useful"}
                onClick={() => onFeedback(feedback?.verdict === "useful" ? null : "useful")}
              >
                <ThumbsUp /> Useful
              </button>
              <button
                className={`chipbtn${feedback?.verdict === "not_relevant" ? " chipbtn--on" : ""}`}
                aria-pressed={feedback?.verdict === "not_relevant"}
                onClick={() => onFeedback(feedback?.verdict === "not_relevant" ? null : "not_relevant", "")}
              >
                <ThumbsDown /> Not relevant
              </button>
              {feedback?.verdict === "not_relevant" && (
                <select className="select feedback__why" value={feedback.reason} onChange={(e) => onFeedback("not_relevant", e.target.value)} aria-label="Why is it not relevant?">
                  <option value="">Why? (optional)</option>
                  {NOT_RELEVANT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
