"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Flag, FolderPlus, GraduationCap, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { CONTRACT_TYPES, CONTRACT_TYPE_KEYS, clauseTypeLabel, contractTypeLabel, lowerLabel } from "@/lib/contracts/types";
import { isMuted, riskBand, SEVERITY_LABEL, type CheckKind, type Finding, type ReviewResult, type Severity } from "@/lib/review/types";
import { DocumentViewer } from "@/components/viewer/DocumentViewer";
import type { Focus } from "@/components/viewer/match";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/components/ui";
import { FindingCard, type FeedbackVerdict, type FindingFeedbackState } from "./FindingCard";
import { ContractLoader } from "@/components/ContractLoader";
import { SplitPane } from "@/components/SplitPane";
import { ContractFacts } from "@/components/review/ContractFacts";
import { AskPanel } from "@/components/review/AskPanel";
import { ENTITIES, ENTITY_KEYS, entityLabel } from "@/lib/contracts/entities";

type Tab = "overview" | CheckKind | "ask";
type Filter = "open" | "issue" | "all";

type Props = {
  review: { id: string; createdAt: string; riskScore: number };
  result: ReviewResult;
  document: { id: string; title: string; fileName: string; mimeType: string; pageCount: number; scanned: boolean; text: string };
  aiAvailable: boolean;
  lawDescriptions: Record<string, string>;
  feedback: Record<string, FindingFeedbackState>;
  missed: MissedItem[];
};

export type MissedItem = { id: string; quote: string; note: string; severity: string; page: number | null };

const CHECKS: { key: CheckKind; label: string; index: string; blurb: string }[] = [
  { key: "boilerplate", label: "Boilerplate", index: "/01", blurb: "Clauses and wording compared with the repository" },
  { key: "legal", label: "Legal", index: "/02", blurb: "FCRA, CSR, tax, data protection and more" },
  { key: "business", label: "Business", index: "/03", blurb: "Our own rules" },
];

export function ReviewWorkspace({ review, result, document: doc, aiAvailable, lawDescriptions, feedback: initialFeedback, missed: initialMissed }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>("open");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [missed, setMissed] = useState(initialMissed);
  const [flagging, setFlagging] = useState<{ quote: string; note: string; severity: Severity } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Findings muted by past feedback are kept out of counts and lists, but
  // stay one click away so nobody wonders where a check went.
  const active = useMemo(() => result.findings.filter((f) => !isMuted(f)), [result.findings]);
  const byCheck = useMemo(() => {
    const m: Record<CheckKind, Finding[]> = { boilerplate: [], legal: [], business: [], ai: [] };
    for (const f of active) m[f.check].push(f);
    return m;
  }, [active]);
  const mutedByCheck = useMemo(() => {
    const m: Record<CheckKind, Finding[]> = { boilerplate: [], legal: [], business: [], ai: [] };
    for (const f of result.findings) if (isMuted(f)) m[f.check].push(f);
    return m;
  }, [result.findings]);

  const count = (fs: Finding[], status?: Finding["status"]) => fs.filter((f) => (status ? f.status === status : f.status !== "pass")).length;
  const band = riskBand(review.riskScore);
  const issues = count(active, "issue");
  const warnings = count(active, "warning");
  const passed = count(active, "pass");

  const sendFeedback = useCallback(
    async (f: Finding, verdict: FeedbackVerdict | null, reason = "") => {
      setFeedback((m) => {
        const n = { ...m };
        if (verdict) n[f.id] = { verdict, reason };
        else delete n[f.id];
        return n;
      });
      try {
        const res = await fetch(`/api/reviews/${review.id}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ findingId: f.id, verdict, reason }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        const type = lowerLabel(contractTypeLabel(result.contractType));
        if (json.changed) {
          toast(
            json.effect === "muted"
              ? `Learned: "${f.title}" will be muted in future ${type} reviews.`
              : json.effect === "downgraded"
                ? `Learned: "${f.title}" will be lower priority in future ${type} reviews.`
                : json.effect === "promoted"
                  ? `Learned: "${f.title}" will be higher priority in future ${type} reviews.`
                  : `"${f.title}" is back to normal for ${type}s.`
          );
        } else if (verdict && !reason) {
          toast("Thanks. This feedback trains future reviews.");
        }
      } catch {
        toast("Could not save your feedback", "error");
      }
    },
    [result.contractType, review.id, toast]
  );

  const startFlag = () => {
    // A passage selected in the contract becomes the quote.
    const selected = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    setFlagging({ quote: selected.slice(0, 2000), note: "", severity: "medium" });
  };

  const submitFlag = async () => {
    if (!flagging?.note.trim()) return;
    const res = await fetch(`/api/reviews/${review.id}/missed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(flagging) });
    const json = await res.json();
    if (!res.ok) return toast(json.error ?? "Could not save", "error");
    setMissed((m) => [...m, json]);
    setFlagging(null);
    toast(
      <>
        Thanks. It&apos;s on the <Link href="/learning">Learning page</Link>, ready to become a rule.
      </>
    );
  };

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
      if (tab === "overview" || tab === "ask" || (e.key !== "j" && e.key !== "k")) return;
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

  async function act(kind: "rerun" | "repo" | "delete", contractType?: string, entity?: string) {
    if (kind === "delete" && !confirm("Delete this review and the uploaded file? This cannot be undone.")) return;
    setBusy(kind);
    try {
      if (kind === "rerun") {
        const res = await fetch(`/api/reviews/${review.id}/rerun`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractType, entity }) });
        if (!res.ok) throw new Error();
        toast(
          entity !== undefined
            ? `Re-checked as ${entity ? entityLabel(entity) : "no entity"}`
            : contractType
              ? `Re-checked as ${lowerLabel(contractTypeLabel(contractType))}`
              : "Checks re-run with the latest repository and rules"
        );
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
    { key: "ask" as Tab, label: "Ask" },
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
          <FindingCard
            key={f.id}
            finding={f}
            active={activeId === f.id}
            open={openIds.has(f.id)}
            onToggle={() => toggle(f.id)}
            onLocate={locate}
            feedback={feedback[f.id]}
            onFeedback={(v, r) => sendFeedback(f, v, r)}
          />
        ))}
      </div>
    ));
  };

  const mutedSection = (check: CheckKind) =>
    mutedByCheck[check].length > 0 && (
      <details className="muted-group">
        <summary>
          <GraduationCap size={14} /> {mutedByCheck[check].length} check{mutedByCheck[check].length === 1 ? "" : "s"} muted by your team&apos;s feedback
        </summary>
        {mutedByCheck[check].map((f) => (
          <FindingCard key={f.id} finding={f} active={activeId === f.id} open={openIds.has(f.id)} onToggle={() => toggle(f.id)} onLocate={locate} feedback={feedback[f.id]} onFeedback={(v, r) => sendFeedback(f, v, r)} />
        ))}
      </details>
    );

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
      <SplitPane
        storageKey="contract-review.split"
        left={<DocumentViewer documentId={doc.id} fileName={doc.fileName} mimeType={doc.mimeType} text={doc.text} focus={focus} />}
        right={
      <section className="side" aria-label="Review">
        <header className="side__head">
          <div className="side__titlebar">
            <div className="side__titles">
              <span className="kicker">Review · {formatDate(review.createdAt)}</span>
              <h1 className="side__title" title={doc.title}>
                {doc.title}
              </h1>
            </div>
            <button className={`riskchip riskchip--${band.tone}`} onClick={() => switchTab("overview")} title="Risk score. Open Overview for the breakdown">
              <span className="riskchip__score num">
                {review.riskScore}
                <small>/100</small>
              </span>
              <span className="riskchip__label">{band.label}</span>
              <span className="riskchip__bar" aria-hidden>
                <i style={{ width: `${Math.max(4, review.riskScore)}%` }} />
              </span>
            </button>
          </div>
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
            {result.contractType !== result.detectedType ? (
              <span className="faint">set manually</span>
            ) : result.detectedLearned ? (
              <span className="faint" title="Detected by the model trained on your team's corrections">
                learned from your corrections
              </span>
            ) : (
              <span className="faint">detected</span>
            )}
            <span aria-hidden>·</span>
            <span className="typepick">
              <select
                className="select"
                value={result.entity ?? ""}
                disabled={!!busy}
                aria-label="Entity"
                onChange={(e) => act("rerun", undefined, e.target.value)}
                title="Which of our organisations this contract is for. Changing it re-runs the checks"
              >
                <option value="">Entity not set</option>
                {ENTITY_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {ENTITIES[k].label}
                  </option>
                ))}
              </select>
            </span>
            <span aria-hidden>·</span>
            <span className="num">
              {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span>{result.clauses.length} clauses</span>
            {doc.scanned && (
              <span className="badge badge--gold" title="Text was recognised from a scanned image, so quotes may contain small errors. Clicking a finding opens its page rather than highlighting the words.">
                Scanned · OCR
              </span>
            )}
          </div>
        </header>

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
          {tab === "ask" && <AskPanel reviewId={review.id} aiOn={aiAvailable} onLocate={(r) => locate(r)} />}

          {tab === "overview" && (
            <>
              <div className="risk block">
                <div className="risk__score">
                  {review.riskScore}
                  <small>/100</small>
                </div>
                <div>
                  <span className={`badge badge--${band.tone}`}>{band.label}</span>
                  <div className="risk__meter" aria-hidden>
                    <span className="risk__marker" style={{ left: `${review.riskScore}%` }} />
                  </div>
                  <div className="risk__counts">
                    <button className="risk__count" style={{ color: "var(--clay)" }} onClick={() => { setFilter("issue"); switchTab("legal"); }}>
                      <span className="dot" /> <b>{issues}</b> issues
                    </button>
                    <span style={{ color: "var(--tone-warning)" }}>
                      <span className="dot" /> <b>{warnings}</b> to check
                    </span>
                    <span style={{ color: "var(--moss)" }}>
                      <span className="dot" /> <b>{passed}</b> passed
                    </span>
                  </div>
                </div>
              </div>

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

              {result.facts && <ContractFacts reviewId={review.id} facts={result.facts.values} source={result.facts.source} />}

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
                const top = active.filter((f) => f.status === "issue" && (f.severity === "critical" || f.severity === "high")).slice(0, 6);
                return top.length ? (
                  <div className="block">
                    <div className="block__head">
                      <span className="kicker">Start here</span>
                      <span className="caption">Most serious issues first</span>
                    </div>
                    {top.map((f) => (
                      <FindingCard
                        key={f.id}
                        finding={f}
                        showCheck
                        active={activeId === f.id}
                        open={openIds.has(f.id)}
                        onToggle={() => toggle(f.id)}
                        onLocate={locate}
                        feedback={feedback[f.id]}
                        onFeedback={(v, r) => sendFeedback(f, v, r)}
                      />
                    ))}
                  </div>
                ) : null;
              })()}

              {missed.length > 0 && (
                <div className="block">
                  <div className="block__head">
                    <span className="kicker">Flagged by your team</span>
                    <Link href="/learning" className="caption">
                      Turn into rules
                    </Link>
                  </div>
                  {missed.map((m) => (
                    <div className="missed-item" key={m.id}>
                      <p>
                        <span className={`badge badge--label ${m.severity === "critical" ? "badge--clay-solid" : m.severity === "high" ? "badge--clay" : m.severity === "medium" ? "badge--gold" : "badge--outline"}`}>
                          {SEVERITY_LABEL[m.severity as Severity] ?? m.severity}
                        </span>{" "}
                        {m.note}
                      </p>
                      {m.quote && (
                        <button className="quote" style={{ marginTop: "var(--space-2)" }} onClick={() => locate({ quote: m.quote, page: m.page ?? undefined })}>
                          “{m.quote}”
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

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
                      ? `Expected clauses are learned from ${result.coverage.basisCount} ${lowerLabel(contractTypeLabel(result.contractType))}s in the repository.`
                      : `Based on a standard checklist${result.checksRun.repositoryDocs ? "" : ". Add contracts to the repository and this check will learn from them"}.`}
                  </span>
                </p>
              </div>
              {filterBar("boilerplate")}
              {visibleFindings("boilerplate").length ? renderGroups(visibleFindings("boilerplate")) : <p className="caption">Nothing to show for this filter.</p>}
              {mutedSection("boilerplate")}

              <div className="block" style={{ marginTop: "var(--space-6)" }}>
                <div className="block__head">
                  <span className="kicker">Clause map</span>
                  <span className="caption">Similarity to the closest repository or library clause</span>
                </div>
                <ul className="clausemap">
                  {result.clauses.map((c, i) => (
                    <li key={i}>
                      {c.section && c.section !== result.clauses[i - 1]?.section && <span className="cm-section">{c.section}</span>}
                      <button onClick={() => locate({ quote: c.quote, page: c.page })} title="Show in contract">
                        <span className="cm-idx">{i + 1}</span>
                        <span style={{ minWidth: 0 }}>
                          <span className="cm-name" style={{ display: "block" }}>
                            {c.heading}
                          </span>
                          <span className="cm-type">
                            {clauseTypeLabel(c.clauseType)} · p.{c.page}
                          </span>
                          {c.library && (
                            <span
                              className={`cm-lib${c.library.fits ? "" : " cm-lib--off"}`}
                              title={`Closest clause library version: ${c.library.topic}, "${c.library.label}" (${Math.round(c.library.similarity * 100)}% similar)`}
                            >
                              {c.library.fits ? "Library" : "Check"}: {c.library.label}
                            </span>
                          )}
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
              {mutedSection("legal")}
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
                  {mutedSection("business")}
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
                  {mutedSection("ai")}
                </>
              )}
            </>
          )}
        </div>

        <footer className="side__foot">
          <a className="btn btn--sm" href={`/review/${review.id}/report`} target="_blank" rel="noreferrer" title="Open a printable report">
            <FileDown /> <span className="btn__label">Export report</span>
          </a>
          <button className="btn btn--secondary btn--sm" onClick={startFlag} title="Flag something the checks missed. Select a passage in the contract first to quote it">
            <Flag /> <span className="btn__label">Flag a miss</span>
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => act("repo")} disabled={!!busy} title="File this contract in the repository">
            <FolderPlus /> <span className="btn__label">Add to repository</span>
          </button>
          <span className="side__foot-gap" />
          <button className="btn btn--ghost btn--sm btn--icon" onClick={() => act("rerun")} disabled={!!busy} title="Re-run the checks with the latest repository, rules and learning" aria-label="Re-run the checks">
            {busy === "rerun" ? <ContractLoader size="sm" label="Re-running the checks" /> : <RefreshCw />}
          </button>
          <button className="btn btn--ghost btn--sm btn--icon" style={{ color: "var(--clay)" }} onClick={() => act("delete")} disabled={!!busy} aria-label="Delete review" title="Delete this review">
            <Trash2 />
          </button>
        </footer>
      </section>
        }
      />

      {flagging && (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setFlagging(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="flag-title">
            <div className="modal__head">
              <h3 id="flag-title">Flag something the checks missed</h3>
              <button className="btn btn--ghost btn--icon" onClick={() => setFlagging(null)} aria-label="Close">
                <X />
              </button>
            </div>
            <div className="modal__body">
              <p className="caption" style={{ margin: 0 }}>
                The tool learns from this: recurring misses show up on the Learning page as suggested business rules.
              </p>
              <label className="field">
                <span className="field__label">What&apos;s the problem?</span>
                <input
                  className="input"
                  autoFocus
                  value={flagging.note}
                  placeholder="e.g. Funder can use our beneficiary data for its own marketing"
                  onChange={(e) => setFlagging({ ...flagging, note: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Passage from the contract</span>
                <textarea
                  className="textarea"
                  value={flagging.quote}
                  placeholder="Select text in the contract before clicking Flag a miss, or paste it here"
                  onChange={(e) => setFlagging({ ...flagging, quote: e.target.value })}
                />
              </label>
              <label className="field" style={{ maxWidth: 220 }}>
                <span className="field__label">How serious?</span>
                <select className="select" value={flagging.severity} onChange={(e) => setFlagging({ ...flagging, severity: e.target.value as Severity })}>
                  {(["critical", "high", "medium", "low"] as Severity[]).map((sv) => (
                    <option key={sv} value={sv}>
                      {SEVERITY_LABEL[sv]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal__foot">
              <button className="btn btn--ghost btn--sm" onClick={() => setFlagging(null)}>
                Cancel
              </button>
              <button className="btn btn--sm" onClick={submitFlag} disabled={!flagging.note.trim()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
