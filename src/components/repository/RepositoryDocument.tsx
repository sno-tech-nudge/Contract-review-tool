"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { CONTRACT_TYPES, CONTRACT_TYPE_KEYS, clauseTypeLabel } from "@/lib/contracts/types";
import { DocumentViewer } from "@/components/viewer/DocumentViewer";
import type { Focus } from "@/components/viewer/match";
import { useToast } from "@/components/Toast";
import { formatDate, formatSize } from "@/components/ui";

type Doc = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  contractType: string;
  counterparty: string;
  tags: string;
  isTemplate: boolean;
  notes: string;
  pageCount: number;
  size: number;
  createdAt: string;
  text: string;
};

export function RepositoryDocument({ doc, clauses }: { doc: Doc; clauses: { id: string; heading: string; text: string; clauseType: string; page: number }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ title: doc.title, contractType: doc.contractType, counterparty: doc.counterparty, tags: doc.tags, isTemplate: doc.isTemplate, notes: doc.notes });
  const [saving, setSaving] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify({ title: doc.title, contractType: doc.contractType, counterparty: doc.counterparty, tags: doc.tags, isTemplate: doc.isTemplate, notes: doc.notes });

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/repository/${doc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) {
      toast("Changes saved");
      router.refresh();
    } else toast("Could not save changes", "error");
  };

  const remove = async () => {
    if (!confirm(`Remove "${doc.title}" from the repository? Future reviews will no longer compare against it.`)) return;
    const res = await fetch(`/api/repository/${doc.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Removed from the repository");
      router.push("/repository");
      router.refresh();
    } else toast("Could not remove this contract", "error");
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="docdetail">
      <DocumentViewer documentId={doc.id} fileName={doc.fileName} mimeType={doc.mimeType} text={doc.text} focus={focus} />

      <section className="side">
        <div className="side__body">
          <Link href="/repository" className="micro" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", marginBottom: "var(--space-3)" }}>
            <ArrowLeft size={13} /> Repository
          </Link>
          <h1 className="side__title" style={{ marginTop: 0 }}>
            {doc.title}
          </h1>
          <div className="side__meta">
            <span className="num">{doc.pageCount} pages</span>·<span className="num">{formatSize(doc.size)}</span>·<span>Added {formatDate(doc.createdAt)}</span>
          </div>

          <div className="block" style={{ marginTop: "var(--space-5)" }}>
            <div className="sechead">
              <h2 style={{ fontSize: "var(--text-base)" }}>Details</h2>
            </div>
            <div className="form-grid">
              <label className="field full">
                <span className="field__label">Title</span>
                <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Contract type</span>
                <select className="select" value={form.contractType} onChange={(e) => set("contractType", e.target.value)}>
                  {CONTRACT_TYPE_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {CONTRACT_TYPES[k].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Counterparty</span>
                <input className="input" value={form.counterparty} placeholder="e.g. Horizon Foundation" onChange={(e) => set("counterparty", e.target.value)} />
              </label>
              <label className="field full">
                <span className="field__label">Tags</span>
                <input className="input" value={form.tags} placeholder="e.g. livelihoods, 2025, signed" onChange={(e) => set("tags", e.target.value)} />
                <span className="field__help">Separate with commas.</span>
              </label>
              <label className="field full">
                <span className="field__label">Notes</span>
                <textarea className="textarea" value={form.notes} placeholder="Context for colleagues, e.g. negotiated positions" onChange={(e) => set("notes", e.target.value)} />
              </label>
              <label className="check full">
                <input type="checkbox" checked={form.isTemplate} onChange={(e) => set("isTemplate", e.target.checked)} />
                Approved template: preferred as the standard when comparing and suggesting wording
              </label>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
              <button className="btn btn--sm" onClick={save} disabled={!dirty || saving}>
                <Save /> {saving ? "Saving…" : "Save changes"}
              </button>
              <button className="btn btn--danger btn--sm" onClick={remove} style={{ marginLeft: "auto" }}>
                <Trash2 /> Remove
              </button>
            </div>
          </div>

          <div className="block">
            <div className="sechead">
              <h2 style={{ fontSize: "var(--text-base)" }}>Indexed clauses</h2>
              <span className="micro num">{clauses.length}</span>
            </div>
            <p className="caption" style={{ marginTop: 0 }}>
              These are what new contracts are compared against. Click one to see it in the document.
            </p>
            <ul className="clausemap clausemap--wide">
              {clauses.map((c, i) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setActive(c.id);
                      setFocus({ quote: c.text.slice(0, 200), page: c.page, nonce: Date.now() });
                    }}
                    style={active === c.id ? { background: "var(--taupe-100)" } : undefined}
                  >
                    <span className="cm-idx">{i + 1}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="cm-name" style={{ display: "block" }}>
                        {c.heading}
                      </span>
                      <span className="cm-type">p.{c.page}</span>
                    </span>
                    <span className="badge badge--neutral" style={{ justifySelf: "end" }}>
                      {clauseTypeLabel(c.clauseType)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
