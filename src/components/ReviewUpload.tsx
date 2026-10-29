"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, FileUp } from "lucide-react";
import { CONTRACT_TYPES, CONTRACT_TYPE_KEYS } from "@/lib/contracts/types";

const ACCEPT = ".pdf,.docx,.txt";

export function ReviewUpload({ repositoryCount, legalRuleCount }: { repositoryCount: number; legalRuleCount: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [contractType, setContractType] = useState("");

  const steps = [
    "Reading the document",
    repositoryCount ? `Comparing with ${repositoryCount} contract${repositoryCount === 1 ? "" : "s"} in the repository` : "Checking standard clauses",
    `Running ${legalRuleCount} legal checks (FCRA, CSR, tax and more)`,
    "Applying business rules",
  ];

  // The server does all the work in one request; the steps advance on a timer
  // so people can see what is happening.
  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 900);
    return () => clearInterval(t);
  }, [busy, steps.length]);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      if (!/\.(pdf|docx|txt)$/i.test(file.name)) return setError("Please upload a PDF, Word (.docx) or text file.");
      if (file.size > 25 * 1024 * 1024) return setError("Files must be 25 MB or smaller.");
      setBusy(file.name);
      const body = new FormData();
      body.append("file", file);
      if (contractType) body.append("contractType", contractType);
      try {
        const res = await fetch("/api/reviews", { method: "POST", body });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed.");
        setStep(steps.length);
        router.push(`/review/${json.id}`);
      } catch (e) {
        setBusy(null);
        setError(e instanceof Error ? e.message : "Upload failed.");
      }
    },
    [contractType, router, steps.length]
  );

  return (
    <div>
      <div
        className={`dropzone${dragging ? " dropzone--active" : ""}${busy ? " dropzone--busy" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Upload a contract to review"
        onClick={() => !busy && input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !busy) upload(file);
        }}
      >
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        {busy ? (
          <>
            <p className="dropzone__title">Reviewing {busy}</p>
            <ol className="progress-steps">
              {steps.map((s, i) => (
                <li key={s} data-state={i < step ? "done" : i === step ? "active" : "todo"}>
                  <span className="ps-mark">{i < step ? <Check strokeWidth={3} /> : null}</span>
                  {s}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <span className="dropzone__icon">
              <FileUp strokeWidth={1.5} />
            </span>
            <p className="dropzone__title">{dragging ? "Drop to start the review" : "Drop a contract here"}</p>
            <p className="dropzone__hint">
              or <u>choose a file</u> from your computer
            </p>
            <span className="dropzone__meta">PDF, Word or text · up to 25 MB</span>
            {error && (
              <span className="dropzone__error" role="alert">
                <CircleAlert size={16} /> {error}
              </span>
            )}
          </>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2) var(--space-3)", marginTop: "var(--space-3)", flexWrap: "wrap" }}>
        <label className="field__label" htmlFor="ctype" style={{ whiteSpace: "nowrap" }}>
          Contract type
        </label>
        <select id="ctype" className="select" style={{ maxWidth: 260 }} value={contractType} onChange={(e) => setContractType(e.target.value)} disabled={!!busy}>
          <option value="">Detect automatically</option>
          {CONTRACT_TYPE_KEYS.map((k) => (
            <option key={k} value={k}>
              {CONTRACT_TYPES[k].label}
            </option>
          ))}
        </select>
        <span className="caption">You can change it after the review too.</span>
      </div>
    </div>
  );
}
