import { getDocumentProxy } from "unpdf";

// Reads a clause-library export: PDFs where each topic (large heading) has a
// "Standard Clause" and/or "Alternative Clauses" section, and every version
// starts with a short label in its own font naming when it applies
// ("Employment Agreement", "Mutual", "[PARTY B] liable for guests"), followed
// by the clause title and wording. Structure is read from font and size,
// because plain text loses where one version ends and the next begins.

export type ParsedVariant = { variant: "standard" | "alternative"; label: string; title: string; text: string };
export type ParsedTopic = { topic: string; variants: ParsedVariant[] };

type Line = { font: string; size: number; x: number; text: string };

const SECTION = /^(Standard Clause|Alternative Clauses)$/i;

async function readLines(buffer: Buffer): Promise<Line[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const lines: Line[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    let line: (Line & { y: number }) | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5]);
      if (line && Math.abs(line.y - y) < 2) {
        line.text += item.str;
        continue;
      }
      if (line) lines.push(line);
      line = { y, font: item.fontName, size: Math.round(Math.abs(item.transform[0])), x: Math.round(item.transform[4]), text: item.str };
    }
    if (line) lines.push(line);
  }
  return lines.filter((l) => l.text.trim());
}

export async function parseClauseLibrary(buffer: Buffer): Promise<ParsedTopic[]> {
  const lines = await readLines(buffer);
  const topicSize = Math.max(...lines.map((l) => l.size));
  if (!lines.some((l) => SECTION.test(l.text.trim()))) return [];

  const style = (l: Line) => `${l.font}|${l.size}`;
  // the label font is whatever directly follows a section marker
  const labelStyles = new Set<string>();
  lines.forEach((l, i) => {
    if (SECTION.test(l.text.trim()) && lines[i + 1]) labelStyles.add(style(lines[i + 1]));
  });
  const headingFont = lines.find((l) => l.size === topicSize)?.font;
  const margin = Math.min(...lines.map((l) => l.x));

  const topics: ParsedTopic[] = [];
  let topic: ParsedTopic | null = null;
  let section: ParsedVariant["variant"] | null = null;
  let current: (ParsedVariant & { body: string[] }) | null = null;

  for (const l of lines) {
    const t = l.text.trim();
    if (l.size === topicSize) {
      topic = { topic: t, variants: [] };
      topics.push(topic);
      section = null;
      current = null;
      continue;
    }
    if (SECTION.test(t)) {
      section = /^standard/i.test(t) ? "standard" : "alternative";
      current = null;
      continue;
    }
    if (!topic || !section) continue;
    if (labelStyles.has(style(l))) {
      // a long label wraps onto a second line before any wording starts
      if (current && !current.title && !current.body.length) current.label += ` ${t}`;
      else {
        current = { variant: section, label: t, title: "", text: "", body: [] };
        topic.variants.push(current);
      }
      continue;
    }
    if (!current) continue;
    if (l.size === 14 && !current.title && !current.body.length) {
      current.title = t;
      continue;
    }
    const isSubheading = l.font === headingFont && l.size > 11 && l.size < topicSize;
    const startsItem = /^(?:\d{1,2}[.)]|\([a-z0-9]{1,4}\)|[a-z][.)])\s/i.test(t);
    const last = current.body[current.body.length - 1];
    // a wrapped line continues the paragraph or list item above it
    if (!isSubheading && !startsItem && last !== undefined && !last.startsWith("\n")) {
      current.body[current.body.length - 1] = `${last} ${t}`;
      continue;
    }
    const indent = "  ".repeat(Math.max(0, Math.round((l.x - margin) / 18)));
    current.body.push(isSubheading ? `\n${t}` : indent + t);
  }

  return topics
    .map((tp) => ({
      topic: tp.topic,
      variants: tp.variants
        .map((v) => {
          const { body, ...rest } = v as ParsedVariant & { body: string[] };
          return { ...rest, label: rest.label.replace(/\s+/g, " ").trim(), text: body.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
        })
        .filter((v) => v.text),
    }))
    .filter((tp) => tp.variants.length);
}

// Placeholders like #PARTY A# read better as [Party A] wherever wording is shown.
export function displayClauseText(text: string): string {
  return text.replace(/#([^#\n]{1,60})#/g, (_, name: string) => `[${name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}]`);
}
