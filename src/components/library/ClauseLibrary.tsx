"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { BookOpen, Copy, Pencil, Plus, Scale, Search, Trash2, Upload } from "lucide-react";
import { CLAUSE_CATEGORIES, CLAUSE_TYPES, CLAUSE_TYPE_KEYS, CONTRACT_TYPES, CONTRACT_TYPE_KEYS, clauseTypeLabel, contractTypeLabel } from "@/lib/contracts/types";
import { CustomClauseCard, CustomClauseEditor, type CustomClauseView } from "./CustomClauses";
import { MODEL_CLAUSES, MODEL_CLAUSE_SOURCE } from "@/lib/checks/model-clauses";
import { sendContract } from "@/lib/upload-client";
import { ContractLoader } from "@/components/ContractLoader";
import { useToast } from "@/components/Toast";

type Clause = {
  id: string;
  heading: string;
  text: string;
  clauseType: string;
  page: number;
  document: { id: string; title: string; isTemplate: boolean; contractType: string };
};

export type Standard = {
  id: string;
  topic: string;
  clauseType: string;
  variant: string;
  label: string;
  title: string;
  text: string;
  validFor: string[];
  jurisdiction: string;
  source: string;
  edited: boolean;
};

const CONTRACT_KINDS = CONTRACT_TYPE_KEYS.filter((k) => k !== "other");

function ClampedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className={`clause-card__text${open ? "" : " clause-card__text--clamp"}`}>{text}</p>
      {text.length > 360 && (
        <div style={{ padding: "0 var(--space-4) var(--space-3)" }}>
          <button className="btn btn--ghost btn--sm" onClick={() => setOpen(!open)}>
            {open ? "Show less" : "Show full clause"}
          </button>
        </div>
      )}
    </>
  );
}

// One version of a library clause, with where it applies and a way to correct that.
function StandardCard({ s, onCopy, onChanged }: { s: Standard; onCopy: (t: string) => void; onChanged: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [clauseType, setClauseType] = useState(s.clauseType);
  const [validFor, setValidFor] = useState<string[]>(s.validFor);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/library/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clauseType, validFor }) });
    setSaving(false);
    if (!res.ok) return toast("Could not save the change", "error");
    toast("Saved. Reviews use the corrected reading from now on");
    setEditing(false);
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Remove "${s.topic}: ${s.label}" from the clause library?`)) return;
    const res = await fetch(`/api/library/${s.id}`, { method: "DELETE" });
    if (!res.ok) return toast("Could not remove the clause", "error");
    toast("Removed from the clause library");
    onChanged();
  };

  return (
    <article className="clause-card std-card">
      <div className="clause-card__head">
        <div className="clause-card__title">
          <span className="std-card__label">{s.label}</span>
          <div className="std-card__meta">
            <span className={`badge ${s.variant === "standard" ? "badge--brown" : "badge--outline"}`}>{s.variant === "standard" ? "Standard" : "Alternative"}</span>
            {s.jurisdiction === "us" && (
              <span className="badge badge--clay" title="Written for US law. Adapt it before using it in an Indian contract; reviews flag it if it appears in one.">
                US law
              </span>
            )}
            <span className="std-card__for">
              For {s.validFor.length ? s.validFor.map((t) => contractTypeLabel(t)).join(", ") : "any contract"}
            </span>
          </div>
        </div>
        <button className="btn btn--ghost btn--sm btn--icon" onClick={() => setEditing(!editing)} aria-expanded={editing} title="Correct its clause type or where it applies">
          <Pencil />
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => onCopy(s.text)}>
          <Copy /> Copy
        </button>
      </div>
      {editing && (
        <div className="std-edit">
          <label className="field">
            <span className="field__label">Clause type</span>
            <select className="select" value={clauseType} onChange={(e) => setClauseType(e.target.value)}>
              {CLAUSE_TYPE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {CLAUSE_TYPES[k].label}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span className="field__label">Use in</span>
            <div className="chips">
              <button className="chip" aria-pressed={!validFor.length} onClick={() => setValidFor([])}>
                Any contract
              </button>
              {CONTRACT_KINDS.map((k) => (
                <button
                  key={k}
                  className="chip"
                  aria-pressed={validFor.includes(k)}
                  onClick={() => setValidFor((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))}
                >
                  {CONTRACT_TYPES[k].label}
                </button>
              ))}
            </div>
          </div>
          <div className="std-edit__actions">
            <button className="btn btn--sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <span className="side__foot-gap" />
            <button className="btn btn--ghost btn--sm" style={{ color: "var(--clay)" }} onClick={remove}>
              <Trash2 /> Remove
            </button>
          </div>
          <p className="caption" style={{ margin: 0 }}>
            Corrections train the clause classifier and are kept if the file is imported again. Source: {s.source}
          </p>
        </div>
      )}
      <ClampedText text={s.text} />
    </article>
  );
}

export function ClauseLibrary({
  clauses,
  standards,
  customs,
  canEdit,
  directUpload,
}: {
  clauses: Clause[];
  standards: Standard[];
  customs: CustomClauseView[];
  canEdit: boolean;
  directUpload: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<string>(() => (clauses.some((c) => c.clauseType === "termination") || standards.some((s) => s.clauseType === "termination") ? "termination" : clauses[0]?.clauseType ?? "termination"));
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  // "new" or a custom clause being edited replaces the content with the editor
  const [editing, setEditing] = useState<CustomClauseView | "new" | null>(null);
  const selectedCustom = type.startsWith("custom:") ? customs.find((c) => c.id === type.slice(7)) : undefined;

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const cl of clauses) c[cl.clauseType] = (c[cl.clauseType] ?? 0) + 1;
    for (const s of standards) c[s.clauseType] = (c[s.clauseType] ?? 0) + 1;
    return c;
  }, [clauses, standards]);

  const q = query.trim().toLowerCase();
  const shownCustoms = q ? customs.filter((c) => `${c.name} ${c.description} ${c.phrases.join(" ")} ${c.standardText}`.toLowerCase().includes(q)) : selectedCustom ? [selectedCustom] : [];
  const shown = clauses.filter((c) => (q ? (c.text + " " + c.heading + " " + c.document.title).toLowerCase().includes(q) : !selectedCustom && c.clauseType === type));
  const shownStandards = standards.filter((s) => (q ? `${s.topic} ${s.label} ${s.title} ${s.text}`.toLowerCase().includes(q) : !selectedCustom && s.clauseType === type));
  const topics = useMemo(() => {
    const m = new Map<string, Standard[]>();
    for (const s of shownStandards) m.set(s.topic, [...(m.get(s.topic) ?? []), s]);
    return [...m];
  }, [shownStandards]);
  // "Other" only appears when the library holds clauses no clause type fits
  const showOther = CLAUSE_TYPE_KEYS.includes("other") && !!counts.other;
  const pick = (key: string) => {
    setType(key);
    setQuery("");
    setEditing(null);
  };
  const model = MODEL_CLAUSES[type as keyof typeof MODEL_CLAUSES];

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast("Clause copied to clipboard");
  };

  const importFiles = async (list: FileList | File[]) => {
    const files = [...list].filter((f) => /\.pdf$/i.test(f.name));
    if (!files.length) return toast("Clause libraries are imported from PDF files", "error");
    let added = 0;
    let updated = 0;
    const failed: string[] = [];
    setImporting({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      try {
        const res = await sendContract("/api/library", files[i], {}, directUpload);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error);
        added += body.added ?? 0;
        updated += body.updated ?? 0;
      } catch {
        failed.push(files[i].name);
      }
      setImporting({ done: i + 1, total: files.length });
    }
    setImporting(null);
    if (added || updated) toast(`${added} clause${added === 1 ? "" : "s"} added${updated ? `, ${updated} updated` : ""}. Reviews use them from now on`);
    if (failed.length) toast(`Could not import ${failed.join(", ")}: not a clause library export`, "error");
    router.refresh();
  };

  return (
    <main
      className="page"
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
      }}
    >
      <div className="pagehead-row">
        <div>
          <span className="kicker">Clause library</span>
          <h1 className="page-title">Standard wording, by clause</h1>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {canEdit && (
          <button className="btn" onClick={() => setEditing("new")}>
            <Plus /> Add a clause
          </button>
        )}
        <button className="btn btn--secondary" onClick={() => input.current?.click()} disabled={!!importing}>
          {importing ? <ContractLoader size="sm" label="Importing clauses" /> : <Upload />}
          {importing ? `Importing ${importing.done + 1 > importing.total ? importing.total : importing.done + 1} of ${importing.total}…` : "Import clause PDFs"}
        </button>
        </div>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) importFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <p className="lead" style={{ marginBottom: "var(--space-6)" }}>
        The standard wording for every clause, grouped into operational, financial, legal and compliance clauses: approved versions with the kinds of contract each is meant for, how we have drafted them in past contracts,
        and clauses you add yourselves. Reviews check every contract against them.
      </p>

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay__box">
            <Upload />
            <p>Drop clause library PDFs to import them</p>
          </div>
        </div>
      )}

      <div className="library">
        <nav className="folders" aria-label="Clause types">
          <div className="search" style={{ marginBottom: "var(--space-3)" }}>
            <Search />
            <input className="input" placeholder="Search all clauses" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search clauses" />
          </div>
          {CLAUSE_CATEGORIES.map((cat) => (
            <div className="folder-group" key={cat.key}>
              <span className="folder-group__label">{cat.label}</span>
              {cat.types.map((k) => (
                <button key={k} className={`folder${!q && !editing && type === k ? " folder--active" : ""}`} onClick={() => pick(k)}>
                  {CLAUSE_TYPES[k].label}
                  <span className="folder__count">{counts[k] ?? 0}</span>
                </button>
              ))}
              {customs
                .filter((c) => c.category === cat.key)
                .map((c) => (
                  <button key={c.id} className={`folder folder--custom${!q && !editing && type === `custom:${c.id}` ? " folder--active" : ""}${c.enabled ? "" : " folder--off"}`} onClick={() => pick(`custom:${c.id}`)} title="A clause your team added">
                    {c.name}
                    <span className="folder__count">yours</span>
                  </button>
                ))}
            </div>
          ))}
          {showOther && (
            <div className="folder-group">
              <span className="folder-group__label">Other</span>
              <button className={`folder${!q && !editing && type === "other" ? " folder--active" : ""}`} onClick={() => pick("other")}>
                Other
                <span className="folder__count">{counts.other ?? 0}</span>
              </button>
            </div>
          )}
        </nav>

        <section>
          {editing ? (
            <>
              <div className="sechead">
                <h2>{editing === "new" ? "Add a clause to the library" : `Edit ${editing.name}`}</h2>
              </div>
              <p className="caption" style={{ marginTop: 0 }}>
                Define a clause your contracts should contain, such as an operational term. Every review of a matching contract checks for it, flags it when it is missing and offers your standard wording.
              </p>
              <CustomClauseEditor
                initial={editing === "new" ? null : editing}
                onCancel={() => setEditing(null)}
                onSaved={(id) => {
                  setEditing(null);
                  setType(`custom:${id}`);
                  router.refresh();
                }}
              />
            </>
          ) : (
          <>
          <div className="sechead">
            <h2>{q ? `Results for "${query}"` : selectedCustom ? selectedCustom.name : clauseTypeLabel(type)}</h2>
            <span className="micro num">
              {selectedCustom ? "your clause" : `${shownStandards.length} standard · ${shown.length} from contracts`}
            </span>
          </div>

          {shownCustoms.length > 0 && (
            <div className="std-group">
              {q && <span className="kicker">Your clauses</span>}
              {shownCustoms.map((c) => (
                <CustomClauseCard key={c.id} c={c} canEdit={canEdit} onCopy={copy} onEdit={() => setEditing(c)} onChanged={() => router.refresh()} />
              ))}
            </div>
          )}

          {standards.length === 0 && !q && !selectedCustom && (
            <button className="dropzone" style={{ width: "100%", marginBottom: "var(--space-6)" }} onClick={() => input.current?.click()}>
              <span className="dropzone__icon">
                <Scale />
              </span>
              <p className="dropzone__title">Import your clause library</p>
              <p className="dropzone__hint">
                Drop clause library PDFs anywhere on this page, or <u>choose files</u>
              </p>
              <span className="dropzone__meta">PDF exports with a standard clause and alternatives per topic · several files at once</span>
            </button>
          )}

          {topics.length > 0 && (
            <div className="std-group">
              <span className="kicker">Approved clauses</span>
              {topics.map(([topic, versions]) => (
                <div className="std-topic" key={topic}>
                  <h3 className="std-topic__name">
                    {topic}
                    <span className="micro num">
                      {versions.length} version{versions.length === 1 ? "" : "s"}
                    </span>
                  </h3>
                  {versions.map((s) => (
                    <StandardCard key={s.id} s={s} onCopy={copy} onChanged={() => router.refresh()} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {shown.length > 0 && (
            <div className="std-group">
              <span className="kicker">From our contracts</span>
              {shown.map((c) => (
                <article className="clause-card" key={c.id}>
                  <div className="clause-card__head">
                    <div className="clause-card__title">
                      <Link href={`/repository/${c.document.id}`}>{c.document.title}</Link>
                      <div className="clause-card__heading">
                        {c.heading} · {contractTypeLabel(c.document.contractType)} · p.{c.page}
                        {q && ` · ${clauseTypeLabel(c.clauseType)}`}
                      </div>
                    </div>
                    {c.document.isTemplate && <span className="badge badge--brown">Template</span>}
                    <button className="btn btn--ghost btn--sm" onClick={() => copy(c.text)}>
                      <Copy /> Copy
                    </button>
                  </div>
                  <ClampedText text={c.text} />
                </article>
              ))}
            </div>
          )}

          {!q && !selectedCustom && model && (
            <article className="clause-card" style={{ background: "var(--taupe-50)" }}>
              <div className="clause-card__head">
                <div className="clause-card__title">
                  Starter wording
                  <div className="clause-card__heading">{MODEL_CLAUSE_SOURCE}</div>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => copy(model)}>
                  <Copy /> Copy
                </button>
              </div>
              <p className="clause-card__text">{model}</p>
            </article>
          )}

          {shown.length === 0 && shownStandards.length === 0 && shownCustoms.length === 0 && !model && (
            <div className="empty">
              <div className="empty__icon">
                <BookOpen size={22} strokeWidth={1.5} />
              </div>
              <h3>Nothing here yet</h3>
              <p>
                Clauses appear once clause library PDFs are imported, or contracts containing them are added to the <Link href="/repository">repository</Link>.
              </p>
            </div>
          )}
          </>
          )}
        </section>
      </div>
    </main>
  );
}
