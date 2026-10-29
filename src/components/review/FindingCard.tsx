"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Copy, Lightbulb, LocateFixed } from "lucide-react";
import type { Finding } from "@/lib/review/types";
import { SeverityBadge, StatusIcon, STATUS_LABEL } from "@/components/ui";
import { useToast } from "@/components/Toast";

type Props = {
  finding: Finding;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onLocate: (f: Finding) => void;
  showCheck?: boolean;
};

const CHECK_LABEL = { boilerplate: "Boilerplate", legal: "Legal", business: "Business", ai: "AI" } as const;

export function FindingCard({ finding: f, active, open, onToggle, onLocate, showCheck }: Props) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  return (
    <article className={`finding${open ? " finding--open" : ""}${active ? " finding--active" : ""}`} data-status={f.status} id={`finding-${f.id}`}>
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
            {f.page ? <span className="micro num">p.{f.page}</span> : null}
          </span>
        </span>
        <ChevronDown className="finding__chev" aria-hidden />
      </button>

      {open && (
        <div className="finding__body">
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
        </div>
      )}
    </article>
  );
}
