"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { FACT_FIELDS, type ContractFacts as Facts, type FactSource } from "@/lib/checks/facts";
import { formatInr } from "@/lib/text/amounts";
import { useToast } from "@/components/Toast";

// The facts business-rule exceptions depend on: what the contract says, and
// what a reviewer corrected or added. Saving re-runs the checks.

const KEYS = ["value", "months", "counterparty", "employees"] as const;

const shown = (key: (typeof KEYS)[number], v: Facts[typeof key]) =>
  v === undefined ? "" : key === "value" ? formatInr(Number(v)) : key === "counterparty" ? String(v) : `${Number(v).toLocaleString("en-IN")} ${FACT_FIELDS[key].unit}`;

export function ContractFacts({ reviewId, facts, source }: { reviewId: string; facts: Facts; source: FactSource }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => Object.fromEntries(KEYS.map((k) => [k, source[k] === "reviewer" && facts[k] !== undefined ? String(facts[k]) : ""])) as Record<(typeof KEYS)[number], string>);

  const save = async () => {
    setSaving(true);
    // an empty box returns that fact to what the contract says
    const body = Object.fromEntries(KEYS.map((k) => [k, form[k].trim() === "" ? null : form[k]]));
    const res = await fetch(`/api/reviews/${reviewId}/facts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return toast(json.error ?? "Could not save the facts", "error");
    toast("Facts saved and the checks run again");
    setEditing(false);
    router.refresh();
  };

  return (
    <div className="block">
      <div className="block__head">
        <span className="kicker">Contract facts</span>
        {!editing && (
          <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)} title="Correct a fact or add one the contract does not state">
            <Pencil /> Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="facts-form">
          {KEYS.map((k) => (
            <label className="field" key={k}>
              <span className="field__label">
                {FACT_FIELDS[k].label}
                {FACT_FIELDS[k].unit && k !== "value" ? ` (${FACT_FIELDS[k].unit})` : k === "value" ? " (₹)" : ""}
              </span>
              <input
                className="input"
                inputMode={FACT_FIELDS[k].numeric ? "numeric" : undefined}
                value={form[k]}
                placeholder={source[k] === "contract" && facts[k] !== undefined ? `From the contract: ${shown(k, facts[k])}` : "Not known"}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              />
            </label>
          ))}
          <p className="caption" style={{ margin: 0, gridColumn: "1 / -1" }}>
            Leave a box empty to use what the contract says. Business rules with exceptions use these facts.
          </p>
          <div className="std-edit__actions" style={{ gridColumn: "1 / -1" }}>
            <button className="btn btn--sm" onClick={save} disabled={saving}>
              {saving ? "Re-running the checks…" : "Save and re-run"}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="terms">
          {KEYS.map((k) => (
            <div className="term" key={k}>
              <div className="term__label">{FACT_FIELDS[k].label}</div>
              <div className={`term__value${facts[k] === undefined ? " faint" : ""}`}>
                {facts[k] === undefined ? "Not known" : shown(k, facts[k])}
                {source[k] === "reviewer" && <span className="fact-source"> · set by a reviewer</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
