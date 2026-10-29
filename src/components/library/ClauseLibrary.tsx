"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Copy, Search } from "lucide-react";
import { CLAUSE_TYPES, CLAUSE_TYPE_KEYS, clauseTypeLabel, contractTypeLabel } from "@/lib/contracts/types";
import { MODEL_CLAUSES, MODEL_CLAUSE_SOURCE } from "@/lib/checks/model-clauses";
import { useToast } from "@/components/Toast";

type Clause = {
  id: string;
  heading: string;
  text: string;
  clauseType: string;
  page: number;
  document: { id: string; title: string; isTemplate: boolean; contractType: string };
};

export function ClauseLibrary({ clauses }: { clauses: Clause[] }) {
  const toast = useToast();
  const [type, setType] = useState<string>(() => (clauses.some((c) => c.clauseType === "termination") ? "termination" : clauses[0]?.clauseType ?? "termination"));
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const cl of clauses) c[cl.clauseType] = (c[cl.clauseType] ?? 0) + 1;
    return c;
  }, [clauses]);

  const q = query.trim().toLowerCase();
  const shown = clauses.filter((c) => (q ? (c.text + " " + c.heading + " " + c.document.title).toLowerCase().includes(q) : c.clauseType === type));
  const types = CLAUSE_TYPE_KEYS.filter((k) => k !== "other");
  const model = MODEL_CLAUSES[type as keyof typeof MODEL_CLAUSES];

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast("Clause copied to clipboard");
  };

  return (
    <main className="page">
      <span className="kicker">Clause library</span>
      <h1 className="page-title">Standard wording, by clause</h1>
      <p className="lead" style={{ marginBottom: "var(--space-6)" }}>
        Every clause indexed from the repository, grouped by topic. Use it to find how we have drafted a clause before, and copy it into a draft.
      </p>

      <div className="library">
        <nav className="folders" aria-label="Clause types">
          <div className="search" style={{ marginBottom: "var(--space-3)" }}>
            <Search />
            <input className="input" placeholder="Search all clauses" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search clauses" />
          </div>
          {types.map((k) => (
            <button
              key={k}
              className={`folder${!q && type === k ? " folder--active" : ""}`}
              onClick={() => {
                setType(k);
                setQuery("");
              }}
            >
              {CLAUSE_TYPES[k].label}
              <span className="folder__count">{counts[k] ?? 0}</span>
            </button>
          ))}
        </nav>

        <section>
          <div className="sechead">
            <h2>{q ? `Results for "${query}"` : clauseTypeLabel(type)}</h2>
            <span className="micro num">
              {shown.length} clause{shown.length === 1 ? "" : "s"}
            </span>
          </div>

          {shown.map((c) => {
            const open = expanded.has(c.id);
            return (
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
                <p className={`clause-card__text${open ? "" : " clause-card__text--clamp"}`}>{c.text}</p>
                {c.text.length > 360 && (
                  <div style={{ padding: "0 var(--space-4) var(--space-3)" }}>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() =>
                        setExpanded((s) => {
                          const n = new Set(s);
                          if (n.has(c.id)) n.delete(c.id);
                          else n.add(c.id);
                          return n;
                        })
                      }
                    >
                      {open ? "Show less" : "Show full clause"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}

          {!q && model && (
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

          {shown.length === 0 && !model && (
            <div className="empty">
              <div className="empty__icon">
                <BookOpen size={22} strokeWidth={1.5} />
              </div>
              <h3>Nothing here yet</h3>
              <p>
                Clauses appear once contracts containing them are added to the <Link href="/repository">repository</Link>.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
