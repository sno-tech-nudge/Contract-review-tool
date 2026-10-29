"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDown, FolderPlus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { CONTRACT_TYPES, CONTRACT_TYPE_KEYS, clauseTypeLabel, contractTypeLabel } from "@/lib/contracts/types";
import { riskBand, type CheckKind, type Finding, type ReviewResult } from "@/lib/review/types";
import { DocumentViewer } from "@/components/viewer/DocumentViewer";
import type { Focus } from "@/components/viewer/match";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/components/ui";
import { FindingCard } from "./FindingCard";

type Tab = "overview" | CheckKind;
type Filter = "open" | "issue" | "all";

type Props = {
  review: { id: string; createdAt: string; riskScore: number };
  result: ReviewResult;
  document: { id: string; title: string; fileName: string; mimeType: string; pageCount: number; text: string };
  aiAvailable: boolean;
  lawDescriptions: Record<string, string>;
};

const CHECKS: { key: CheckKind; label: string; index: string; blurb: string }[] = [
  { key: "boilerplate", label: "Boilerplate", index: "/01", blurb: "Clauses and wording compared with the repository" },
  { key: "legal", label: "Legal", index: "/02", blurb: "FCRA, CSR, tax, data protection and more" },
  { key: "business", label: "Business", index: "/03", blurb: "Our own rules" },
];

export function ReviewWorkspace({ review, result, document: doc, aiAvailable, lawDescriptions }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>("open");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const byCheck = useMemo(() => {
    const m: Record<CheckKind, Finding[]> = { boilerplate: [], legal: [], business: [], ai: [] };
    for (const f of result.findings) m[f.check].push(f);
    return m;
  }, [result.findings]);

  const count = (fs: Finding[], status?: Finding["status"]) => fs.filter((f) => (status ? f.status === status : f.status !== "pass")).length;
  const band = riskBand(review.riskScore);
  const issues = count(result.findings, "issue");
  const warnings = count(result.findings, "warning");
  const passed = count(result.findings, "pass");

  const locate = useCallback((f: { id?: string; quote?: string; page?: number }) => {
    if (f.id) setActiveId(f.id);
    setFocus({ quote: f.quote, page: f.page, nonce: Date.now() });
  }, []);

  const toggle = (id: string) =>
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Run the AI review in the background the first time the page opens.
  const runAi = useCallback(async () => {
    setAiRunning(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/ai`, { method: "POST" });
      const json = await res.json();
      if (json.status === "failed") toast(json.error ?? "AI review failed", "error");
      router.refresh();
    } catch {
      toast("AI review failed", "error");
    } finally {
      setAiRunning(false);
    }
  }, [review.id, router, toast]);

  const started = useRef(false);
  useEffect(() => {
    if (result.ai.status === "pending" && !started.current) {
      started.current = true;
      runAi();
    }
  }, [result.ai.status, runAi]);

  const visibleFindings = useCallback(
    (check: CheckKind) => byCheck[check].filter((f) => (filter === "all" ? true : filter === "issue" ? f.status === "issue" : f.status !== "pass")),
    [byCheck, filter]
  );

  // j / k move through the findings on the current tab and show each one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tab === "overview" || (e.key !== "j" && e.key !== "k")) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select")) return;
      const list = visibleFindings(tab);
      if (!list.length) return;
      const i = list.findIndex((f) => f.id === activeId);
      const next = list[e.key === "j" ? Math.min(list.length - 1, i + 1) : Math.max(0, i - 1)];
      setOpenIds(new Set([next.id]));
      locate(next);
      document.getElementById(`finding-${next.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, activeId, visibleFindings, locate]);

  async function act(kind: "rerun" | "repo" | "delete", contractType?: string) {
    if (kind === "delete" && !confirm("Delete this review and the uploaded file? This cannot be undone.")) return;
    setBusy(kind);
    try {
      if (kind === "rerun") {
        const res = await fetch(`/api/reviews/${review.id}/rerun`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractType }) });
        if (!res.ok) throw new Error();
        toast(contractType ? `Re-checked as ${contractTypeLabel(contractType).toLowerCase()}` : "Checks re-run with the latest repository and rules");
        router.refresh();
      } else if (kind === "repo") {
        const res = await fetch(`/api/reviews/${review.id}/to-repository`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        toast(
          <>
            Added to the repository. <Link href={`/repository/${json.id}`}>Open</Link>
          </>
        );
      } else {
        const res = await fetch(`/api/reviews/${review.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        router.push("/");
      }
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  }

  const tabs: { key: Tab; label: string; n?: number; alert?: boolean }[] = [
    { key: "overview", label: "Overview" },
    ...CHECKS.map((c) => ({ key: c.key as Tab, label: c.label, n: count(byCheck[c.key]), alert: count(byCheck[c.key], "issue") > 0 })),
    ...(aiAvailable || byCheck.ai.length ? [{ key: "ai" as Tab, label: "AI", n: count(byCheck.ai), alert: count(byCheck.ai, "issue") > 0 }] : []),
  ];

  const switchTab = (t: Tab) => {
    setTab(t);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  const renderGroups = (findings: Finding[], describe?: (cat: string) => string | undefined) => {
    const groups = new Map<string, Finding[]>();
    for (const f of findings) groups.set(f.category, [...(groups.get(f.category) ?? []), f]);
    return [...groups].map(([cat, fs]) => (
      <div className="group" key={cat}>
        <div className="group__head">
          <span className="group__name">{cat}</span>
          <span className="badge badge--neutral num">{fs.length}</span>
          {describe?.(cat) && <span className="group__desc">{describe(cat)}</span>}
        </div>
        {fs.map((f) => (
          <FindingCard key={f.id} finding={f} active={activeId === f.id} open={openIds.has(f.id)} onToggle={() => toggle(f.id)} onLocate={locate} />
        ))}
      </div>
    ));
  };

  const filterBar = (check: CheckKind) => (
    <div className="toolbar">
      <div className="seg" role="group" aria-label="Filter findings">
        <button aria-pressed={filter === "open"} onClick={() => setFilter("open")}>
          To review <span className="num">{count(byCheck[check])}</span>
        </button>
        <button aria-pressed={filter === "issue"} onClick={() => setFilter("issue")}>
          Issues <span className="num">{count(byCheck[check], "issue")}</span>
        </button>
        <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          All <span className="num">{byCheck[check].length}</span>
        </button>
      </div>
      <span className="caption">Tip: press j / k to step through</span>
    </div>
  );

  const aiBanner =
    aiRunning || result.ai.status === "pending" ? (
      <div className="ai-banner ai-banner--busy">
        <RefreshCw /> Claude is reading the contract for a summary and any risks the rules missed. This can take a minute.
      </div>
    ) : result.ai.status === "failed" ? (
      <div className="ai-banner">
        <Sparkles /> <span style={{ flex: 1 }}>AI review did not complete: {result.ai.error}</span>
        <button className="btn btn--secondary btn--sm" onClick={runAi}>
          Try again
        </button>
      </div>
    ) : null;

  return (
    <div className="workspace">
      <DocumentViewer documentId={doc.id} fileName={doc.fileName} mimeType={doc.mimeType} text={doc.text} focus={focus} />

      <section className="side" aria-label="Review">
        <div className="side__head">
          <span className="kicker">Review · {formatDate(review.createdAt)}</span>
          <h1 className="side__title">{doc.title}</h1>
          <div className="side__meta">
            <span className="typepick">
              <select
                className="select"
                value={result.contractType}
                disabled={!!busy}
                aria-label="Contract type"
                onChange={(e) => act("rerun", e.target.value)}
                title="Change the contract type to re-run the checks"
              >
                {CONTRACT_TYPE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {CONTRACT_TYPES[k].label}
                  </option>
                ))}
              </select>
            </span>
            {result.contractType === result.detectedType ? <span className="faint">detected</span> : <span className="faint">set manually</span>}
            <span aria-hidden>·</span>
            <span className="num">
              {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span>{result.clauses.length} clauses</span>
          </div>

          <div className="risk" style={{ marginTop: "var(--space-4)" }}>
            <div>
              <div className="risk__score">
                {review.riskScore}
                <small>/100</small>
              </div>
            </div>
            <div>
              <span className={`badge badge--${band.tone}`}>{band.label}</span>
              <div className="risk__meter" aria-hidden>
                <span className="risk__marker" style={{ left: `${review.riskScore}%` }} />
              </div>
              <div className="risk__counts">
                <span style={{ color: "var(--clay)" }}>
                  <span className="dot" /> <b>{issues}</b> issues
                </span>
                <span style={{ color: "var(--tone-warning)" }}>
                  <span className="dot" /> <b>{warnings}</b> to check
                </span>
                <span style={{ color: "var(--moss)" }}>
                  <span className="dot" /> <b>{passed}</b> passed
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="side__tabs">
          <div className="tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? " tab--active" : ""}`} onClick={() => switchTab(t.key)}>
                {t.label}
                {t.n !== undefined && t.n > 0 && <span className={`tab__count${t.alert ? " tab__count--alert" : ""}`}>{t.n}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="side__body" ref={bodyRef}>
          {tab === "overview" && (
            <>
              {aiBanner && <div className="block">{aiBanner}</div>}

              <div className="block">
                <div className="block__head">
                  <span className="kicker">Summary</span>
                  <span className="micro source-tag">{result.summarySource === "ai" ? <><Sparkles size={12} /> Written by Claude</> : "From the automated checks"}</span>
                </div>
                <p className="summary">{result.summary}</p>
              </div>

              {result.keyTerms.length > 0 && (
                <div className="block">
                  <div className="block__head">
                    <span className="kicker">Key terms</span>
                    <span className="caption">Click a value to find it</span>
                  </div>
                  <div className="terms">
                    {result.keyTerms.map((k, i) => (
                      <div className="term" key={k.label + i}>
                        <div className="term__label">{k.label}</div>
                        {k.quote ? (
                          <button className="term__value" onClick={() => locate({ quote: k.quote, page: k.page })}>
                            {k.value}
                          </button>
                        ) : (
                          <div className="term__value">{k.value}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="block">
                <div className="block__head">
                  <span className="kicker">Checks</span>
                </div>
                <div className="checks">
                  {CHECKS.map((c) => (
                    <button key={c.key} className="checktile" onClick={() => switchTab(c.key)}>
                      <div className="checktile__idx">{c.index}</div>
                      <div className="checktile__name">{c.label}</div>
                      <div className="checktile__nums">
                        <span style={{ color: "var(--clay)" }}>
                          <b>{count(byCheck[c.key], "issue")}</b> issues
                        </span>
                        <span>
                          <b>{count(byCheck[c.key], "warning")}</b> to check
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const top = result.findings.filter((f) => f.status === "issue" && (f.severity === "critical" || f.severity === "high")).slice(0, 6);
                return top.length ? (
                  <div className="block">
                    <div className="block__head">
                      <span className="kicker">Start here</span>
                      <span className="caption">Most serious issues first</span>
                    </div>
                    {top.map((f) => (
                      <FindingCard key={f.id} finding={f} showCheck active={activeId === f.id} open={openIds.has(f.id)} onToggle={() => toggle(f.id)} onLocate={locate} />
                    ))}
                  </div>
                ) : null;
              })()}

              {result.comparedWith.length > 0 && (
                <div className="block">
                  <div className="block__head">
                    <span className="kicker">Closest repository contracts</span>
                  </div>
                  <ul className="clausemap">
                    {result.comparedWith.map((c) => (
                      <li key={c.id}>
                        <Link href={`/repository/${c.id}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 92px", gap: "var(--space-3)", padding: "var(--space-2) 0", textDecoration: "none", alignItems: "center" }}>
                          <span className="cm-name">
                            {c.title} {c.isTemplate && <span className="badge badge--brown">Template</span>}
                          </span>
                          <span className="simbar">
                            {Math.round(c.similarity * 100)}% similar
                            <i>
                              <b style={{ width: `${Math.round(c.similarity * 100)}%` }} />
                            </i>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="disclaimer">
                Automated checks look for wording, so a pass means the contract addresses a point, not that it is legally sufficient. Use this to prepare for legal review, not to replace it.
              </p>
            </>
          )}

          {tab === "boilerplate" && (
            <>
              <div className="block">
                <span className="kicker">Clause coverage</span>
                <p className="summary" style={{ marginTop: "var(--space-2)" }}>
                  <b className="num" style={{ fontWeight: 500 }}>
                    {result.coverage.present} of {result.coverage.expected}
                  </b>{" "}
                  expected clauses are present.{" "}
                  <span className="muted">
                    {result.coverage.basis === "repository"
                      ? `Expected clauses are learned from ${result.coverage.basisCount} ${contractTypeLabel(result.contractType).toLowerCase()}s in the repository.`
                      : `Based on a standard checklist${result.checksRun.repositoryDocs ? "" : ". Add contracts to the repository and this check will learn from them"}.`}
                  </span>
                </p>
              </div>
              {filterBar("boilerplate")}
              {visibleFindings("boilerplate").length ? renderGroups(visibleFindings("boilerplate")) : <p className="caption">Nothing to show for this filter.</p>}

              <div className="block" style={{ marginTop: "var(--space-6)" }}>
                <div className="block__head">
                  <span className="kicker">Clause map</span>
                  <span className="caption">Similarity to the closest repository clause</span>
                </div>
                <ul className="clausemap">
                  {result.clauses.map((c, i) => (
                    <li key={i}>
                      <button onClick={() => locate({ quote: c.quote, page: c.page })} title="Show in contract">
                        <span className="cm-idx">{i + 1}</span>
                        <span style={{ minWidth: 0 }}>
                          <span className="cm-name" style={{ display: "block" }}>
                            {c.heading}
                          </span>
                          <span className="cm-type">
                            {clauseTypeLabel(c.clauseType)} · p.{c.page}
                          </span>
                        </span>
                        <span className="simbar">
                          {c.similarity === null ? (
                            <span className="faint">No reference</span>
                          ) : (
                            <>
                              {Math.round(c.similarity * 100)}%
                              <i>
                                <b style={{ width: `${Math.round(c.similarity * 100)}%` }} />
                              </i>
                            </>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {tab === "legal" && (
            <>
              {filterBar("legal")}
              {visibleFindings("legal").length ? (
                renderGroups(visibleFindings("legal"), (cat) => lawDescriptions[cat])
              ) : (
                <p className="caption">Nothing to show for this filter. {result.checksRun.legalRules} legal checks applied to this contract.</p>
              )}
              <p className="disclaimer">
                Legal checks reflect the law as understood in October 2026, including the Income-tax Act, 2025 and DPDP Rules, 2025. They flag points to confirm with counsel and are not legal advice.
              </p>
            </>
          )}

          {tab === "business" && (
            <>
              {result.checksRun.businessRules === 0 ? (
                <div className="empty" style={{ padding: "var(--space-6) 0" }}>
                  <h3>No business rules apply</h3>
                  <p>
                    Add rules for your payment terms, approval limits or anything else you check by hand. <Link href="/rules?tab=business">Manage rules</Link>
                  </p>
                </div>
              ) : (
                <>
                  {filterBar("business")}
                  {visibleFindings("business").length ? renderGroups(visibleFindings("business")) : <p className="caption">Nothing to show for this filter.</p>}
                  <p className="caption" style={{ marginTop: "var(--space-4)" }}>
                    {result.checksRun.businessRules} rule{result.checksRun.businessRules === 1 ? "" : "s"} applied. <Link href="/rules?tab=business">Manage business rules</Link>
                  </p>
                </>
              )}
            </>
          )}

          {tab === "ai" && (
            <>
              {aiBanner && <div className="block">{aiBanner}</div>}
              {!aiAvailable && !byCheck.ai.length && <p className="caption">Set ANTHROPIC_API_KEY on the server to add an AI review.</p>}
              {result.ai.status === "done" && (
                <>
                  <p className="caption" style={{ marginBottom: "var(--space-4)" }}>
                    Risks Claude found that the rule checks did not cover.
                  </p>
                  {byCheck.ai.length ? renderGroups(byCheck.ai) : <p className="caption">No additional risks found.</p>}
                </>
              )}
            </>
          )}
        </div>

        <div className="side__foot">
          <a className="btn btn--sm" href={`/review/${review.id}/report`} target="_blank" rel="noreferrer">
            <FileDown /> Export report
          </a>
          <button className="btn btn--secondary btn--sm" onClick={() => act("repo")} disabled={!!busy}>
            <FolderPlus /> Add to repository
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => act("rerun")} disabled={!!busy} title="Re-run with the latest repository and rules">
            <RefreshCw /> {busy === "rerun" ? "Checking…" : "Re-run"}
          </button>
          <button className="btn btn--ghost btn--sm" style={{ marginLeft: "auto", color: "var(--clay)" }} onClick={() => act("delete")} disabled={!!busy} aria-label="Delete review">
            <Trash2 />
          </button>
        </div>
      </section>
    </div>
  );
}
