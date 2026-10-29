"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { BUSINESS_RULE_KINDS, type BusinessRuleKind } from "@/lib/checks/business-kinds";
import { CLAUSE_TYPES, CLAUSE_TYPE_KEYS, CONTRACT_TYPES, CONTRACT_TYPE_KEYS, clauseTypeLabel, contractTypeLabel, type Severity } from "@/lib/contracts/types";
import { SEVERITY_LABEL } from "@/lib/review/types";
import { SeverityBadge } from "@/components/ui";
import { useToast } from "@/components/Toast";

type LegalRow = { id: string; law: string; title: string; reference: string; severity: Severity; appliesWhen: string; enabled: boolean };
type BusinessRow = {
  id: string;
  name: string;
  description: string;
  kind: string;
  pattern: string;
  threshold: number | null;
  severity: string;
  appliesTo: string[];
  guidance: string;
  enabled: boolean;
};

type Draft = Omit<BusinessRow, "id"> & { id?: string };

const EMPTY: Draft = { name: "", description: "", kind: "REQUIRE_PHRASE", pattern: "", threshold: null, severity: "medium", appliesTo: [], guidance: "", enabled: true };

function describeRule(r: BusinessRow): string {
  const list = r.pattern.split(";").map((p) => p.trim()).filter(Boolean);
  switch (r.kind as BusinessRuleKind) {
    case "REQUIRE_PHRASE":
      return `Must mention: ${list.map((p) => `"${p}"`).join(" or ")}`;
    case "FORBID_PHRASE":
      return `Must not mention: ${list.map((p) => `"${p}"`).join(", ")}`;
    case "REQUIRE_CLAUSE":
      return `Must include a ${clauseTypeLabel(r.pattern).toLowerCase()} clause`;
    case "MAX_DAYS":
      return `No more than ${r.threshold} days${list.length ? ` where the sentence mentions ${list.slice(0, 4).join(", ")}${list.length > 4 ? "…" : ""}` : ""}`;
    case "MAX_AMOUNT":
      return `Flag amounts above ₹${(r.threshold ?? 0).toLocaleString("en-IN")}`;
    default:
      return r.kind;
  }
}

export function RulesManager({ initialTab, laws, legal, business }: { initialTab: "legal" | "business"; laws: { key: string; label: string; description: string }[]; legal: LegalRow[]; business: BusinessRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState(initialTab);
  const [legalState, setLegalState] = useState(legal);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleLegal = async (id: string, enabled: boolean) => {
    setLegalState((s) => s.map((r) => (r.id === id ? { ...r, enabled } : r)));
    const res = await fetch(`/api/rules/legal/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    if (!res.ok) toast("Could not update the rule", "error");
  };

  const toggleBusiness = async (r: BusinessRow) => {
    const res = await fetch(`/api/rules/business/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !r.enabled }) });
    if (res.ok) router.refresh();
    else toast("Could not update the rule", "error");
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const { id, ...body } = draft;
    const res = await fetch(id ? `/api/rules/business/${id}` : "/api/rules/business", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return setError(json.error ?? "Could not save the rule");
    setDraft(null);
    toast(id ? "Rule updated" : "Rule added. It applies to the next review, or re-run an existing one.");
    router.refresh();
  };

  const remove = async (r: BusinessRow) => {
    if (!confirm(`Delete the rule "${r.name}"?`)) return;
    const res = await fetch(`/api/rules/business/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Rule deleted");
      router.refresh();
    }
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const kind = draft?.kind as BusinessRuleKind | undefined;

  return (
    <main className="page page--narrow">
      <span className="kicker">Rules</span>
      <h1 className="page-title">What every review checks</h1>
      <p className="lead" style={{ marginBottom: "var(--space-5)" }}>
        Legal checks are built in and cover the main laws for Indian non-profits. Business rules are yours to define, so the tool checks what your team usually checks by hand.
      </p>

      <div className="tabs" role="tablist" style={{ marginBottom: "var(--space-5)" }}>
        <button role="tab" aria-selected={tab === "legal"} className={`tab${tab === "legal" ? " tab--active" : ""}`} onClick={() => setTab("legal")}>
          Legal <span className="tab__count">{legalState.filter((r) => r.enabled).length}</span>
        </button>
        <button role="tab" aria-selected={tab === "business"} className={`tab${tab === "business" ? " tab--active" : ""}`} onClick={() => setTab("business")}>
          Business <span className="tab__count">{business.filter((r) => r.enabled).length}</span>
        </button>
      </div>

      {tab === "legal" && (
        <>
          <p className="caption" style={{ margin: 0 }}>
            Switch off a check if it does not apply to your work. Changes apply to new reviews and re-runs.
          </p>
          {laws.map((law) => {
            const rows = legalState.filter((r) => r.law === law.key);
            if (!rows.length) return null;
            return (
              <section key={law.key}>
                <div className="law-head">
                  <h3>{law.label}</h3>
                  <span>{law.description}</span>
                </div>
                {rows.map((r) => (
                  <div className={`rule-row${r.enabled ? "" : " rule-row--off"}`} key={r.id}>
                    <div>
                      <div className="rule-row__title">
                        {r.title} <SeverityBadge severity={r.severity} />
                      </div>
                      <div className="rule-row__ref">{r.reference}</div>
                      <div className="rule-row__when">Applies to: {r.appliesWhen}</div>
                    </div>
                    <label className="switch" title={r.enabled ? "On" : "Off"}>
                      <input type="checkbox" checked={r.enabled} onChange={(e) => toggleLegal(r.id, e.target.checked)} aria-label={`${r.title} ${r.enabled ? "on" : "off"}`} />
                      <span />
                    </label>
                  </div>
                ))}
              </section>
            );
          })}
        </>
      )}

      {tab === "business" && (
        <>
          <div className="toolbar">
            <p className="caption" style={{ margin: 0 }}>
              The three starter rules are examples. Edit them to match your policies, or delete them.
            </p>
            <button
              className="btn btn--sm"
              onClick={() => {
                setError(null);
                setDraft({ ...EMPTY });
              }}
            >
              <Plus /> New rule
            </button>
          </div>
          {business.length === 0 ? (
            <div className="empty">
              <h3>No business rules yet</h3>
              <p>Add rules for payment terms, approval limits, required wording or anything else you check by hand.</p>
            </div>
          ) : (
            business.map((r) => (
              <div className={`rule-row${r.enabled ? "" : " rule-row--off"}`} key={r.id}>
                <div>
                  <div className="rule-row__title">
                    {r.name} <SeverityBadge severity={r.severity as Severity} />
                    <span className="badge badge--outline">{BUSINESS_RULE_KINDS[r.kind as BusinessRuleKind]?.label ?? r.kind}</span>
                  </div>
                  <div className="rule-row__ref">{describeRule(r)}</div>
                  {r.description && <div className="rule-row__when">{r.description}</div>}
                  <div className="rule-row__when">Applies to: {r.appliesTo.length ? r.appliesTo.map(contractTypeLabel).join(", ") : "all contract types"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                  <button
                    className="btn btn--ghost btn--icon"
                    aria-label={`Edit ${r.name}`}
                    onClick={() => {
                      setError(null);
                      setDraft({ ...r });
                    }}
                  >
                    <Pencil />
                  </button>
                  <button className="btn btn--ghost btn--icon" aria-label={`Delete ${r.name}`} onClick={() => remove(r)}>
                    <Trash2 />
                  </button>
                  <label className="switch" style={{ marginLeft: "var(--space-2)" }}>
                    <input type="checkbox" checked={r.enabled} onChange={() => toggleBusiness(r)} aria-label={`${r.name} ${r.enabled ? "on" : "off"}`} />
                    <span />
                  </label>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {draft && (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setDraft(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rule-title">
            <div className="modal__head">
              <h3 id="rule-title">{draft.id ? "Edit rule" : "New business rule"}</h3>
              <button className="btn btn--ghost btn--icon" onClick={() => setDraft(null)} aria-label="Close">
                <X />
              </button>
            </div>
            <div className="modal__body">
              <label className="field">
                <span className="field__label">Name</span>
                <input className="input" autoFocus value={draft.name} placeholder="e.g. Indemnity must be mutual" onChange={(e) => set("name", e.target.value)} />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Check</span>
                  <select
                    className="select"
                    value={draft.kind}
                    onChange={(e) => {
                      const k = e.target.value as BusinessRuleKind;
                      setDraft((d) => (d ? { ...d, kind: k, pattern: k === "REQUIRE_CLAUSE" ? "termination" : k === "MAX_AMOUNT" ? "" : d.kind === "REQUIRE_CLAUSE" ? "" : d.pattern } : d));
                    }}
                  >
                    {Object.entries(BUSINESS_RULE_KINDS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Severity when it fails</span>
                  <select className="select" value={draft.severity} onChange={(e) => set("severity", e.target.value)}>
                    {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => (
                      <option key={s} value={s}>
                        {SEVERITY_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {kind && <span className="field__help" style={{ marginTop: "-0.5em" }}>{BUSINESS_RULE_KINDS[kind].help}</span>}

              {kind === "REQUIRE_CLAUSE" ? (
                <label className="field">
                  <span className="field__label">Clause type</span>
                  <select className="select" value={draft.pattern} onChange={(e) => set("pattern", e.target.value)}>
                    {CLAUSE_TYPE_KEYS.filter((k) => k !== "other").map((k) => (
                      <option key={k} value={k}>
                        {CLAUSE_TYPES[k].label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : kind !== "MAX_AMOUNT" ? (
                <label className="field">
                  <span className="field__label">{kind === "MAX_DAYS" ? "Only count sentences that mention" : "Phrases"}</span>
                  <input className="input" value={draft.pattern} placeholder={kind === "MAX_DAYS" ? "payment; invoice; disburse" : "mutually indemnify; each party shall indemnify"} onChange={(e) => set("pattern", e.target.value)} />
                </label>
              ) : null}

              {(kind === "MAX_DAYS" || kind === "MAX_AMOUNT") && (
                <label className="field">
                  <span className="field__label">{kind === "MAX_DAYS" ? "Maximum days" : "Amount limit (₹)"}</span>
                  <input className="input" type="number" min={0} value={draft.threshold ?? ""} onChange={(e) => set("threshold", e.target.value === "" ? null : Number(e.target.value))} />
                  {kind === "MAX_AMOUNT" && draft.threshold ? <span className="field__help">₹{draft.threshold.toLocaleString("en-IN")}</span> : null}
                </label>
              )}

              <div className="field">
                <span className="field__label">Applies to</span>
                <div className="chips">
                  <button type="button" className="chip" aria-pressed={draft.appliesTo.length === 0} onClick={() => set("appliesTo", [])}>
                    All types
                  </button>
                  {CONTRACT_TYPE_KEYS.map((k) => (
                    <button
                      type="button"
                      key={k}
                      className="chip"
                      aria-pressed={draft.appliesTo.includes(k)}
                      onClick={() => set("appliesTo", draft.appliesTo.includes(k) ? draft.appliesTo.filter((x) => x !== k) : [...draft.appliesTo, k])}
                    >
                      {CONTRACT_TYPES[k].label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="field">
                <span className="field__label">Why it matters</span>
                <input className="input" value={draft.description} placeholder="Shown with the finding" onChange={(e) => set("description", e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">What to do when it fails</span>
                <input className="input" value={draft.guidance} placeholder="e.g. Ask the funder to make the indemnity mutual" onChange={(e) => set("guidance", e.target.value)} />
              </label>
              {error && (
                <span className="dropzone__error" role="alert">
                  {error}
                </span>
              )}
            </div>
            <div className="modal__foot">
              <button className="btn btn--ghost btn--sm" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="btn btn--sm" onClick={save} disabled={saving}>
                {saving ? "Saving…" : draft.id ? "Save rule" : "Add rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
