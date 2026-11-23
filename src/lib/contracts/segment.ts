import { DocText } from "../text/locate";
import { classifyClause, type ClauseClassification } from "./classify";
import type { ClauseType } from "./types";

// Lets a model trained on people's corrections override the keyword type.
export type ClauseOverride = (heading: string, text: string) => ClauseType | null;

export type Segment = {
  position: number;
  heading: string;
  section?: string; // the article or part a sub-clause sits in
  text: string;
  page: number;
  start: number;
} & ClauseClassification;

// Splits a contract into clauses, following its structure:
//
//   Article / Part / lettered section   →  a section ("ARTICLE IV – TERMINATION", "C. Term")
//   numbered point inside it             →  a clause in that section ("1.", "4.2")
//   Annexure / Schedule / Exhibit        →  its own section; only headed points split it
//   In witness whereof / signed by       →  the execution block
//
// Measured against hand-checked real contracts with `npm run eval`. Lessons
// from them are noted where they shaped a rule.

type Line = { text: string; start: number };

const ARTICLE = /^\W{0,2}(?:article|part)\s*[-–—:.]*\s*([ivxlc]{1,5}|[1Il|]{1,3}|\d{1,2})\b\s*[-–—:.]*\s*(.*)$/i;
const LETTER_SECTION = /^([A-H])[.)]\s+([A-Z][^.]{2,70})$/;
const SPECIAL = /^\W{0,2}(schedule|annexure|annex|appendix|exhibit)\b\s*([A-Z0-9IVX]{0,4})\b\s*[-–—:.]?\s*(.*)$/i;
const WITNESS = /^(?:in witness whereof|agreed and accepted|signed and delivered|signed,? sealed and delivered|for and on behalf of)/i;
// "3.", "3)", "12," (OCR for "12."), "Clause 3" or "3 TERMINATION"
const TOP = /^(?:(?:clause|section)\s+)?(\d{1,2})(?:\.0)?(?:[.),]\s*|\s+(?=[A-Z]{2}))(?=[A-Za-z(“"])(.*)$/i;
const SUB = /^(\d{1,2})\.(\d{1,2})\.?\s+(?=[A-Za-z(“"])(.*)$/;

// A point shorter than this, with no title of its own, stays in the clause
// above it: list items in schedules and process notes are not clauses.
const MIN_UNTITLED = 160;

function isCaps(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, "");
  return line.length >= 4 && line.length <= 80 && letters.length >= 4 && letters === letters.toUpperCase() && !/[,;]$/.test(line);
}

// OCR turns tables and stamps into junk; junk never starts a clause.
// A one-word heading ("2. Term:") is fine; a long line of debris is not.
function readsLikeText(line: string): boolean {
  const letters = (line.match(/[A-Za-z]/g) ?? []).length;
  const words = (line.match(/[A-Za-z]{3,}/g) ?? []).length;
  const chars = line.replace(/\s/g, "").length;
  return (words >= 2 || (words === 1 && line.length <= 40)) && letters / Math.max(1, chars) >= 0.55;
}

const endsSentence = (line: string | undefined) => !line || /[.:;)\]"”]$/.test(line) || line.length <= 40 || isCaps(line);

// The title written at the start of a point: "Force Majeure: …", "Term - …",
// "Anti-Bribery. Grantee …"; otherwise its first few words.
function titleOf(rest: string): { title: string; titled: boolean } {
  const t = rest.replace(/^[-–—:.\s]+/, "").trim();
  const m = /^(.{3,70}?)(?::\s|:$|\s[-–—]\s|\.\s+(?=[A-Z])|\.$)/.exec(t);
  if (m && !/[,;]/.test(m[1]) && m[1].split(/\s+/).length <= 9 && /^[A-Z(“"]/.test(m[1])) return { title: m[1].replace(/[.:]$/, ""), titled: true };
  // a bare line is a title only in capitals or Title Case ("3 TERMINATION",
  // "Project Details"), not the first line of a wrapped sentence
  const words = t.split(/\s+/);
  const capitalised = words.filter((w) => /^[A-Z(&]/.test(w)).length;
  if (t.length <= 70 && /^[A-Z]/.test(t) && !/[.;,]$/.test(t) && words.length <= 9 && (isCaps(t) || capitalised / words.length >= 0.6)) return { title: t, titled: true };
  const first = t.split(/(?<=\.)\s/)[0];
  return { title: first.length <= 70 ? first.replace(/[.:]$/, "") : t.split(/\s+/).slice(0, 8).join(" ") + "…", titled: false };
}

function toLines(full: string): Line[] {
  const lines: Line[] = [];
  let offset = 0;
  for (const raw of full.split("\n")) {
    const text = raw.trim();
    if (text) lines.push({ text, start: offset + raw.indexOf(text) });
    offset += raw.length + 1;
  }
  return lines;
}

type Boundary = { index: number; heading: string; section?: string; titled: boolean; kind: "section" | "point" | "special" | "witness" | "caps" };

function findBoundaries(lines: Line[]): Boundary[] {
  const out: Boundary[] = [];
  const articles = lines.filter((l, i) => {
    const m = ARTICLE.exec(l.text);
    return m && !/^[a-z(]/.test(m[2]) && endsSentence(lines[i - 1]?.text);
  }).length;
  const letters = lines.filter((l) => LETTER_SECTION.test(l.text)).length;
  const sectioned = articles >= 2 || letters >= 2;

  let section: string | undefined;
  let inAnnex = false;
  let last = 0; // last top-level number
  let lastSub = 0;
  let started = !sectioned; // in a sectioned contract, points before the first section are recitals

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].text;
    const prev = lines[i - 1]?.text;

    if (WITNESS.test(text)) {
      out.push({ index: i, heading: "Execution", titled: true, kind: "witness" });
      continue;
    }

    const special = SPECIAL.exec(text);
    if (special && !/^\(?[a-z]/.test(special[3]) && (text.length <= 70 || /^\W{0,2}\w+\s*[A-Z0-9IVX]{0,4}\s*[-–—:]/.test(text)) && endsSentence(prev)) {
      section = text.replace(/\s*[:.]$/, "");
      out.push({ index: i, heading: section, titled: true, kind: "special" });
      inAnnex = true;
      last = 0;
      continue;
    }

    if (sectioned && !inAnnex) {
      const art = ARTICLE.exec(text);
      if (art && !/^[a-z(]/.test(art[2]) && endsSentence(prev)) {
        // the title is often on the next line: "ARTICLE IV" / "Undertakings"
        let title = art[2].replace(/^[-–—:.\s]+/, "").trim();
        const next = lines[i + 1]?.text;
        if (!title && next && next.length <= 80 && !TOP.test(next) && !SUB.test(next) && readsLikeText(next)) title = next;
        section = title ? title.replace(/[.:]$/, "") : text;
        out.push({ index: i, heading: section, titled: true, kind: "section" });
        started = true;
        last = 0;
        lastSub = 0;
        continue;
      }
      const letter = LETTER_SECTION.exec(text);
      if (letter && letters >= 2) {
        section = letter[2].trim();
        out.push({ index: i, heading: section, titled: true, kind: "section" });
        started = true;
        last = 0;
        lastSub = 0;
        continue;
      }
    }
    if (!started || !readsLikeText(text)) continue;

    const sub = SUB.exec(text);
    if (sub && !inAnnex) {
      const [n, m] = [Number(sub[1]), Number(sub[2])];
      if ((n === last || last === 0 || sectioned) && m > lastSub && m <= lastSub + 3) {
        const { title, titled } = titleOf(sub[3]);
        out.push({ index: i, heading: title, section, titled, kind: "point" });
        lastSub = m;
        continue;
      }
    }

    const top = TOP.exec(text);
    if (top) {
      const n = Number(top[1]);
      // numbering gaps happen (OCR drops a "4."); a restart at 1 begins a new list
      if ((n > last && n <= last + 3) || n === 1) {
        const { title, titled } = titleOf(top[2]);
        if (inAnnex && !titled) continue; // table rows and list items in schedules
        if (!sectioned && !inAnnex) section = titled ? title : undefined;
        out.push({ index: i, heading: title, section: sectioned || inAnnex ? section : undefined, titled, kind: "point" });
        last = n;
        lastSub = 0;
        continue;
      }
    }
  }
  return out;
}

// Contracts with no numbering: split on capitalised headings.
function capsBoundaries(lines: Line[]): Boundary[] {
  const out: Boundary[] = [];
  lines.forEach((line, i) => {
    if (i > 0 && (isCaps(line.text) || SPECIAL.test(line.text)) && readsLikeText(line.text)) out.push({ index: i, heading: line.text.replace(/[.:]$/, ""), titled: true, kind: "caps" });
  });
  return out;
}

export function segment(doc: DocText, learned?: ClauseOverride): Segment[] {
  const lines = toLines(doc.full);
  let boundaries = findBoundaries(lines);
  if (boundaries.filter((b) => b.kind === "point" || b.kind === "section").length < 3) boundaries = capsBoundaries(lines);

  type Raw = { heading: string; section?: string; start: number; end: number };
  const raw: Raw[] = [];
  let pendingStart: number | undefined;
  if (boundaries.length >= 3) {
    if (boundaries[0].index > 0) raw.push({ heading: "Preamble", start: 0, end: lines[boundaries[0].index].start });
    boundaries.forEach((b, i) => {
      const end = i + 1 < boundaries.length ? lines[boundaries[i + 1].index].start : doc.full.length;
      const piece: Raw = { heading: b.heading, section: b.section, start: pendingStart ?? lines[b.index].start, end };
      pendingStart = undefined;
      const prev = raw[raw.length - 1];
      const body = doc.full.slice(lines[b.index].start, end).trim();
      // a heading with nothing under it ("ARTICLE III – WARRANTIES" before its
      // first point, an annexure index line) joins the clause that follows
      if (i + 1 < boundaries.length && body.length <= lines[b.index].text.length + 30 && b.kind !== "point") {
        pendingStart = piece.start;
        return;
      }
      // a short untitled point stays with the clause above it
      if (b.kind === "point" && !b.titled && body.length < MIN_UNTITLED && prev && prev.heading !== "Preamble") prev.end = end;
      else raw.push(piece);
    });
  } else {
    // Unstructured: group paragraphs into ~600 character chunks.
    const paras = doc.full.split(/\n\s*\n/);
    let offset = 0;
    let chunkStart = 0;
    let chunkLen = 0;
    paras.forEach((p, i) => {
      chunkLen += p.length;
      offset += p.length + 2;
      if (chunkLen >= 600 || i === paras.length - 1) {
        const text = doc.full.slice(chunkStart, offset);
        raw.push({ heading: titleOf(text.trim().split("\n")[0] ?? "").title, start: chunkStart, end: offset });
        chunkStart = offset;
        chunkLen = 0;
      }
    });
  }

  return raw
    .map((r, i) => {
      const text = doc.full.slice(r.start, r.end).trim();
      const heading = r.heading || text.slice(0, 60);
      // the parties are named at the start, sometimes in a numbered recital
      const isPreamble = r.heading === "Preamble" || (i <= 1 && doc.pageAt(r.start) === 1);
      return {
        heading,
        section: r.section && r.section !== heading ? r.section : undefined,
        text,
        page: doc.pageAt(r.start),
        start: r.start,
        ...withLearned(classifyClause(heading, text, isPreamble), learned?.(heading, text) ?? null),
      };
    })
    .filter((s) => s.text.length > 20)
    .map((s, position) => ({ position, ...s }));
}

function withLearned(c: ClauseClassification, learned: ClauseType | null): ClauseClassification {
  if (!learned || learned === c.type || c.type === "parties") return c;
  return { ...c, type: learned, types: [learned, ...c.types.filter((t) => t !== learned)] };
}
