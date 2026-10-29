import { DocText } from "../text/locate";
import { classifyClause, type ClauseClassification } from "./classify";

export type Segment = {
  position: number;
  heading: string;
  text: string;
  page: number;
  start: number;
} & ClauseClassification;

type Line = { text: string; start: number };

const TOP_NUMBERED = /^(?:(?:article|clause|section)\s+)?(\d{1,2})(?:\.0)?(?:[.):]\s+|\s+(?=[A-Z]{2}))\S/i;
const ROMAN = /^(?:article|clause|section)\s+([ivxlc]{1,6})\b/i;
const SPECIAL = /^(schedule|annexure|annex|appendix|exhibit)\b|^in witness whereof/i;

function isCaps(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, "");
  return line.length >= 4 && line.length <= 80 && letters.length >= 4 && letters === letters.toUpperCase() && !/[,;]$/.test(line);
}

function headingFrom(line: string): string {
  if (/^in witness whereof/i.test(line)) return "Execution";
  const rest = line
    .replace(/^(?:(?:article|clause|section)\s+(?:\d{1,2}|[ivxlc]{1,6})[.):]?|\d{1,2}(?:\.\d{1,2})*[.):]?|[ivxlc]{1,6}[.):])\s*/i, "")
    .replace(/^[-–:]\s*/, "")
    .trim();
  const firstSentence = rest.split(/(?<=\.)\s|:\s/)[0];
  if (firstSentence.length <= 70) return firstSentence.replace(/[.:]$/, "");
  return rest.split(/\s+/).slice(0, 8).join(" ") + "…";
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

// Splits a contract into top-level clauses. Prefers numbered headings
// ("1.", "Article 2", "3 TERMINATION"), falls back to capitalised headings,
// and finally to paragraph chunks for unstructured text.
export function segment(doc: DocText): Segment[] {
  const lines = toLines(doc.full);
  const boundaries: { index: number; heading: string }[] = [];

  let last = 0;
  lines.forEach((line, i) => {
    const m = TOP_NUMBERED.exec(line.text) ?? null;
    if (m) {
      const n = Number(m[1]);
      if (n === last + 1 || (n === 1 && last > 0)) {
        boundaries.push({ index: i, heading: headingFrom(line.text) });
        last = n;
        return;
      }
    }
    if (ROMAN.test(line.text)) {
      boundaries.push({ index: i, heading: headingFrom(line.text) });
      return;
    }
    if (SPECIAL.test(line.text) && line.text.length < 90) boundaries.push({ index: i, heading: headingFrom(line.text) });
  });

  if (boundaries.filter((b) => !SPECIAL.test(lines[b.index].text)).length < 3) {
    boundaries.length = 0;
    lines.forEach((line, i) => {
      if (i > 0 && (isCaps(line.text) || SPECIAL.test(line.text))) boundaries.push({ index: i, heading: line.text.replace(/[.:]$/, "") });
    });
  }

  const raw: { heading: string; start: number; end: number }[] = [];
  if (boundaries.length >= 3) {
    if (boundaries[0].index > 0) raw.push({ heading: "Preamble", start: 0, end: lines[boundaries[0].index].start });
    boundaries.forEach((b, i) => {
      const end = i + 1 < boundaries.length ? lines[boundaries[i + 1].index].start : doc.full.length;
      raw.push({ heading: b.heading, start: lines[b.index].start, end });
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
        raw.push({ heading: headingFrom(text.trim().split("\n")[0] ?? ""), start: chunkStart, end: offset });
        chunkStart = offset;
        chunkLen = 0;
      }
    });
  }

  return raw
    .map((r, i) => {
      const text = doc.full.slice(r.start, r.end).trim();
      const heading = r.heading || text.slice(0, 60);
      return {
        position: i,
        heading,
        text,
        page: doc.pageAt(r.start),
        start: r.start,
        ...classifyClause(heading, text, i === 0 && r.heading === "Preamble"),
      };
    })
    .filter((s) => s.text.length > 20);
}
