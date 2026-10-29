import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { riskBand, SEVERITY_LABEL, type FindingStatus, type Severity } from "@/lib/review/types";

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: "badge--clay-solid",
  high: "badge--clay",
  medium: "badge--gold",
  low: "badge--outline",
  info: "badge--neutral",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`badge badge--label ${SEVERITY_CLASS[severity]}`}>{SEVERITY_LABEL[severity]}</span>;
}

export const STATUS_LABEL: Record<FindingStatus, string> = { issue: "Issue", warning: "Check", pass: "Passed" };

export function StatusIcon({ status, className = "" }: { status: FindingStatus; className?: string }) {
  const props = { className, strokeWidth: 1.75, "aria-label": STATUS_LABEL[status] };
  if (status === "issue") return <CircleAlert {...props} />;
  if (status === "warning") return <TriangleAlert {...props} />;
  return <CircleCheck {...props} />;
}

const TONE_VAR = { moss: "var(--moss)", gold: "var(--gold)", clay: "var(--clay)" } as const;

export function RiskPill({ score }: { score: number }) {
  const band = riskBand(score);
  return (
    <span className="risk-pill" title={band.label}>
      <span className="bar" aria-hidden>
        <i style={{ width: `${Math.max(4, score)}%`, background: TONE_VAR[band.tone] }} />
      </span>
      <span>{score}</span>
      <span className={`badge badge--${band.tone}`}>{band.label}</span>
    </span>
  );
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function extOf(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf(".") + 1).toUpperCase();
}
