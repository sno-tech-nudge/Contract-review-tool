"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw, Sparkles } from "lucide-react";
import type { AskEvent, Ref } from "@/lib/ai/ask";

// Ask questions about the contract under review. Answers cite clauses [C3],
// findings [F2] and rules [R1]; clicking a citation shows the passage.

type Turn = { role: "user" | "assistant"; content: string; refs?: Ref[]; sources?: string[]; error?: string; pending?: boolean };

const SUGGESTIONS = [
  "Summarise this contract",
  "Summarise the flags and what to do about them",
  "Is there a termination clause? What does it say?",
  "Does this contract meet our business rules and required clauses?",
  "Explain the most serious flag",
  "What are the payment terms?",
];

function Cite({ id, refs, onLocate }: { id: string; refs: Ref[]; onLocate: (r: Ref) => void }) {
  const ref = refs.find((r) => r.id === id);
  if (!ref) return <span className="cite cite--missing">{id}</span>;
  if (ref.kind === "rule")
    return (
      <Link href="/rules?tab=business" className="cite" title={ref.title}>
        {id}
      </Link>
    );
  return (
    <button className="cite" onClick={() => onLocate(ref)} title={`${ref.title}${ref.page ? ` · p.${ref.page}` : ""}. Show in contract`}>
      {id}
    </button>
  );
}

// Light formatting: paragraphs, bullet lists, **bold** and citations.
function Rich({ text, refs, onLocate }: { text: string; refs: Ref[]; onLocate: (r: Ref) => void }) {
  const inline = (line: string, key: string) =>
    line.split(/(\*\*[^*]+\*\*|\[(?:[CFR]\d+)(?:\s*,\s*[CFR]\d+)*\])/g).map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>;
      const ids = /^\[([CFR]\d+(?:\s*,\s*[CFR]\d+)*)\]$/.exec(part);
      if (ids)
        return (
          <Fragment key={`${key}-${i}`}>
            {ids[1].split(/\s*,\s*/).map((id) => (
              <Cite key={id} id={id} refs={refs} onLocate={onLocate} />
            ))}
          </Fragment>
        );
      return <Fragment key={`${key}-${i}`}>{part}</Fragment>;
    });

  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`ul-${blocks.length}`}>{list.map((l, i) => <li key={i}>{inline(l, `li-${blocks.length}-${i}`)}</li>)}</ul>);
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) list.push(bullet[1]);
    else {
      flush();
      if (line.trim()) blocks.push(<p key={`p-${blocks.length}`}>{inline(line.replace(/^#+\s*/, ""), `p-${blocks.length}`)}</p>);
    }
  }
  flush();
  return <div className="ask-answer">{blocks}</div>;
}

export function AskPanel({ reviewId, aiOn, onLocate }: { reviewId: string; aiOn: boolean; onLocate: (r: { quote?: string; page?: number }) => void }) {
  const storageKey = `ask:${reviewId}`;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // the conversation survives switching tabs and reloading, for this browser tab
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) setTurns(JSON.parse(saved) as Turn[]);
    } catch {
      // storage unavailable
    }
  }, [storageKey]);
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(turns.filter((t) => !t.pending)));
    } catch {
      // not essential
    }
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, storageKey]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setDraft("");
    setBusy(true);
    const history = turns.filter((t) => !t.error && !t.pending).map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, { role: "user", content: q }, { role: "assistant", content: "", pending: true }]);
    const update = (patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) =>
      setTurns((all) => all.map((t, i) => (i === all.length - 1 ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));

    try {
      const res = await fetch(`/api/reviews/${reviewId}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, history }) });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Could not get an answer.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AskEvent;
          if (event.type === "refs") update({ refs: event.refs, sources: event.sources });
          else if (event.type === "text") update((t) => ({ content: t.content + event.text }));
          else if (event.type === "error") update({ error: event.message });
        }
      }
    } catch (err) {
      update({ error: err instanceof Error ? err.message : "Could not get an answer." });
    }
    update({ pending: false });
    setBusy(false);
  };

  return (
    <div className="ask">
      {turns.length === 0 ? (
        <div className="ask-intro">
          <span className="ask-intro__icon" aria-hidden>
            <Sparkles size={18} />
          </span>
          <p className="summary">
            Ask anything about this contract: whether a clause is there, what a flag means, whether it meets your business rules and required clauses. Answers cite the clause or finding they come
            from.
          </p>
          {!aiOn && <p className="caption">AI answers are off until an admin adds an Anthropic API key. Questions still show the most relevant clauses and findings.</p>}
          <div className="ask-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ask-thread">
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div className="ask-q" key={i}>
                {t.content}
              </div>
            ) : (
              <div className="ask-a" key={i}>
                {t.content ? <Rich text={t.content} refs={t.refs ?? []} onLocate={(r) => onLocate({ quote: r.quote, page: r.page })} /> : t.pending ? <span className="ask-typing">Reading the contract…</span> : null}
                {t.error && <p className="dropzone__error">{t.error}</p>}
                {!t.pending && t.sources && t.sources.length > 0 && (
                  <div className="ask-sources">
                    <span className="micro">Most related clauses</span>
                    {t.sources.map((id) => {
                      const ref = t.refs?.find((r) => r.id === id);
                      return ref ? (
                        <button key={id} className="ask-source" onClick={() => onLocate({ quote: ref.quote, page: ref.page })} title={ref.quote}>
                          <b>{id}</b> {ref.title}
                          {ref.page ? ` · p.${ref.page}` : ""}
                        </button>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )
          )}
          <div ref={endRef} />
        </div>
      )}

      <form
        className="ask-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <textarea
          className="textarea"
          rows={2}
          value={draft}
          placeholder="Ask about this contract, e.g. Is there a refund clause?"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(draft);
            }
          }}
          disabled={busy}
          aria-label="Your question"
        />
        <div className="ask-input__actions">
          {turns.length > 0 && (
            <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => setTurns([])} disabled={busy} title="Start a new conversation" aria-label="Start a new conversation">
              <RotateCcw />
            </button>
          )}
          <button className="btn btn--sm btn--icon" type="submit" disabled={busy || !draft.trim()} aria-label="Ask">
            <ArrowUp />
          </button>
        </div>
      </form>
    </div>
  );
}
