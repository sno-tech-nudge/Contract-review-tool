"use client";

import { useState } from "react";
import { Copy, Pencil, Power, Trash2 } from "lucide-react";
import { CLAUSE_CATEGORIES, CONTRACT_TYPES, CONTRACT_TYPE_KEYS, categoryLabel, contractTypeLabel } from "@/lib/contracts/types";
import { ENTITIES, ENTITY_KEYS, entityLabel } from "@/lib/contracts/entities";
import { SEVERITY_LABEL } from "@/lib/review/types";
import { useToast } from "@/components/Toast";

// Clauses the team adds to the clause library: what they are, how to
// recognise them, the approved wording, and which contracts need them.

export type CustomClauseView = {
  id: string;
  name: string;
  category: string;
  description: string;
  phrases: string[];
  standardText: string;
  contractTypes: string[];
  entities: string[];
  required: boolean;
  severity: string;
  enabled: boolean;
  createdBy: string;
};

const KINDS = CONTRACT_TYPE_KEYS.filter((k) => k !== "other");
const SEVERITIES = ["critical", "high", "medium", "low"] as const;

export const EMPTY_CLAUSE: Omit<CustomClauseView, "id" | "createdBy"> = {
  name: "",
  category: "operational",
  description: "",
  phrases: [],
  standardText: "",
  contractTypes: [],
  entities: [],
  required: true,
  severity: "medium",
  enabled: true,
};

// onChange gets an updater so quick successive clicks all count
function Chips({ value, options, onChange, anyLabel }: { value: string[]; options: { key: string; label: string }[]; onChange: (update: (v: string[]) => string[]) => void; anyLabel: string }) {
  return (
    <div className="chips">
      <button type="button" className="chip" aria-pressed={!value.length} onClick={() => onChange(() => [])}>
        {anyLabel}
      </button>
      {options.map((o) => (
        <button type="button" key={o.key} className="chip" aria-pressed={value.includes(o.key)} onClick={() => onChange((v) => (v.includes(o.key) ? v.filter((x) => x !== o.key) : [...v, o.key]))}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CustomClauseEditor({ initial, onSaved, onCancel }: { initial: CustomClauseView | null; onSaved: (id: string) => void; onCancel: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({ ...EMPTY_CLAUSE, ...(initial ?? {}), phrasesText: (initial?.phrases ?? []).join("\n") }));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { phrasesText, ...rest } = form;
    const body = { ...rest, phrases: phrasesText.split("\n") };
    const res = await fetch(initial ? `/api/custom-clauses/${initial.id}` : "/api/custom-clauses", {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return toast(json.error ?? "Could not save the clause", "error");
    toast(initial ? "Clause updated. Reviews use it from now on" : "Clause added. Reviews of matching contracts now check for it");
    onSaved(initial?.id ?? json.id);
  };

  return (
    <form className="card custom-editor" onSubmit={save}>
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Clause name</span>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Utilisation certificate" autoFocus required />
        </label>
        <label className="field">
          <span className="field__label">Group</span>
          <select className="select" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CLAUSE_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field full">
          <span className="field__label">What it must cover</span>
          <textarea className="textarea" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. The partner submits a CA-certified utilisation certificate within 30 days of each financial year." />
          <span className="field__help">Shown to reviewers when the clause is missing.</span>
        </label>
        <label className="field full">
          <span className="field__label">How to recognise it</span>
          <textarea className="textarea" rows={3} value={form.phrasesText} onChange={(e) => set("phrasesText", e.target.value)} placeholder={"utilisation certificate\nutilization certificate"} />
          <span className="field__help">Words or phrases that only appear when the clause is there, one per line. A heading with the clause name also counts.</span>
        </label>
        <label className="field full">
          <span className="field__label">Standard wording</span>
          <textarea className="textarea" rows={5} value={form.standardText} onChange={(e) => set("standardText", e.target.value)} placeholder="The approved wording. Offered as the fix when the clause is missing, and contracts are compared with it." />
        </label>
        <div className="field full">
          <span className="field__label">Check it in</span>
          <Chips value={form.contractTypes} onChange={(u) => setForm((f) => ({ ...f, contractTypes: u(f.contractTypes) }))} anyLabel="Every contract type" options={KINDS.map((k) => ({ key: k, label: CONTRACT_TYPES[k].label }))} />
        </div>
        <div className="field full">
          <span className="field__label">For</span>
          <Chips value={form.entities} onChange={(u) => setForm((f) => ({ ...f, entities: u(f.entities) }))} anyLabel="Every entity" options={ENTITY_KEYS.map((k) => ({ key: k, label: ENTITIES[k].label }))} />
        </div>
        <label className="check">
          <input type="checkbox" checked={form.required} onChange={(e) => set("required", e.target.checked)} /> Required: flag contracts that leave it out
        </label>
        {form.required && (
          <label className="field">
            <span className="field__label">When missing</span>
            <select className="select" value={form.severity} onChange={(e) => set("severity", e.target.value)}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="std-edit__actions" style={{ marginTop: "var(--space-4)" }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Add to the clause library"}
        </button>
        <button className="btn btn--ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CustomClauseCard({ c, canEdit, onEdit, onChanged, onCopy }: { c: CustomClauseView; canEdit: boolean; onEdit: () => void; onChanged: () => void; onCopy: (t: string) => void }) {
  const toast = useToast();
  const scope = [c.contractTypes.length ? c.contractTypes.map(contractTypeLabel).join(", ") : "Every contract type", c.entities.length ? c.entities.map(entityLabel).join(", ") : ""].filter(Boolean).join(" · ");

  const toggle = async () => {
    const res = await fetch(`/api/custom-clauses/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !c.enabled }) });
    if (!res.ok) return toast("Could not change the clause", "error");
    toast(c.enabled ? "Switched off: reviews no longer check for it" : "Switched on");
    onChanged();
  };
  const remove = async () => {
    if (!confirm(`Remove "${c.name}" from the clause library?`)) return;
    const res = await fetch(`/api/custom-clauses/${c.id}`, { method: "DELETE" });
    if (!res.ok) return toast("Could not remove the clause", "error");
    toast("Removed from the clause library");
    onChanged();
  };

  return (
    <article className={`clause-card std-card${c.enabled ? "" : " std-card--off"}`}>
      <div className="clause-card__head">
        <div className="clause-card__title">
          <span className="std-card__label">{c.name}</span>
          <div className="std-card__meta">
            <span className="badge badge--brown">Your clause</span>
            <span className={`badge ${c.required ? "badge--clay" : "badge--outline"}`}>{c.required ? `Required · ${SEVERITY_LABEL[c.severity as keyof typeof SEVERITY_LABEL] ?? c.severity} if missing` : "Optional"}</span>
            {!c.enabled && <span className="badge badge--neutral">Switched off</span>}
            <span className="std-card__for">
              {categoryLabel(c.category)} · {scope}
            </span>
          </div>
        </div>
        {canEdit && (
          <>
            <button className="btn btn--ghost btn--sm btn--icon" onClick={onEdit} title="Edit" aria-label="Edit">
              <Pencil />
            </button>
            <button className="btn btn--ghost btn--sm btn--icon" onClick={toggle} title={c.enabled ? "Switch off" : "Switch on"} aria-label={c.enabled ? "Switch off" : "Switch on"}>
              <Power />
            </button>
            <button className="btn btn--ghost btn--sm btn--icon" style={{ color: "var(--clay)" }} onClick={remove} title="Remove" aria-label="Remove">
              <Trash2 />
            </button>
          </>
        )}
        {c.standardText && (
          <button className="btn btn--ghost btn--sm" onClick={() => onCopy(c.standardText)}>
            <Copy /> Copy
          </button>
        )}
      </div>
      <div className="custom-card__body">
        {c.description && <p className="summary">{c.description}</p>}
        <p className="caption" style={{ margin: 0 }}>
          Recognised by {c.phrases.length ? c.phrases.map((p) => `"${p}"`).join(", ") + ", or" : ""} a heading named &quot;{c.name}&quot;
          {c.standardText ? ", or wording close to the standard below" : ""}.{c.createdBy && ` Added by ${c.createdBy}.`}
        </p>
      </div>
      {c.standardText && <p className="clause-card__text">{c.standardText}</p>}
    </article>
  );
}
