"use client";

import { useEffect, useState } from "react";
import { IndianRupee, PenLine, Scale, Search } from "lucide-react";

// Loading animation for contract uploads. Each icon stands for a stage of the
// review: reading the document, comparing clauses, legal checks, business
// rules. Pass `stage` to show the stage actually running; leave it out to
// cycle through them.

export const LOADER_STAGES = [
  { icon: Search, label: "Reading" },
  { icon: PenLine, label: "Clauses" },
  { icon: Scale, label: "Legal" },
  { icon: IndianRupee, label: "Business" },
] as const;

type Props = {
  stage?: number;
  size?: "lg" | "sm";
  showStrip?: boolean;
  label?: string;
};

export function ContractLoader({ stage, size = "lg", showStrip = size === "lg", label = "Working on the contract" }: Props) {
  const [tick, setTick] = useState(0);
  const cycling = stage === undefined;

  useEffect(() => {
    if (!cycling) return;
    const t = setInterval(() => setTick((n) => (n + 1) % LOADER_STAGES.length), size === "lg" ? 1100 : 800);
    return () => clearInterval(t);
  }, [cycling, size]);

  const current = cycling ? tick : Math.max(0, Math.min(LOADER_STAGES.length - 1, stage));

  return (
    <span className={`cloader cloader--${size}`} role="status" aria-live="polite" aria-label={`${label}: ${LOADER_STAGES[current].label.toLowerCase()}`}>
      <span className="cloader__tile" aria-hidden>
        {LOADER_STAGES.map(({ icon: Icon }, i) => (
          <span key={i} className={`cloader__icon${i === current ? " cloader__icon--on" : ""}`}>
            <Icon strokeWidth={1.6} />
          </span>
        ))}
        <span className="cloader__sweep" />
      </span>
      {showStrip && (
        <span className="cloader__strip" aria-hidden>
          {LOADER_STAGES.map(({ icon: Icon, label: l }, i) => (
            <span key={l} className={`cloader__step${i === current ? " cloader__step--on" : ""}${!cycling && i < current ? " cloader__step--done" : ""}`}>
              <Icon strokeWidth={1.75} />
              <span>{l}</span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
