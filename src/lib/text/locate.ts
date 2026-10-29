// Helpers for pulling short, human-readable quotes out of contract text and
// mapping them back to a page, so the UI can jump to and highlight them.

export type Located = { quote: string; page: number };
export type Match = Located & { match: RegExpExecArray };

const ABBREVIATIONS = /(?:\b(?:rs|no|nos|co|ltd|pvt|inc|viz|sr|mr|ms|mrs|dr|st|cl|sec|art|vs|etc|e\.g|i\.e))$/i;

export class DocText {
  readonly full: string;
  // Same text with single line breaks turned into spaces (same length, so
  // offsets line up). Patterns run on this so phrases split across PDF lines
  // still match.
  readonly flat: string;
  readonly lower: string;
  private starts: number[] = [];

  constructor(readonly pages: string[]) {
    let offset = 0;
    for (const p of pages) {
      this.starts.push(offset);
      offset += p.length + 2;
    }
    this.full = pages.join("\n\n");
    this.flat = this.full.replace(/([^\n])\n(?!\n)/g, "$1 ");
    this.lower = this.flat.toLowerCase();
  }

  pageAt(offset: number): number {
    let page = 1;
    for (let i = 0; i < this.starts.length; i++) if (offset >= this.starts[i]) page = i + 1;
    return page;
  }

  // A full stop ends a sentence when followed by whitespace and not part of an
  // abbreviation or clause number ("3.1", "Rs. 500").
  private isBoundary(i: number): boolean {
    const ch = this.flat[i];
    if (ch === ";" || (ch === "\n" && this.flat[i + 1] === "\n")) return true;
    if (ch !== ".") return false;
    if (!/\s/.test(this.flat[i + 1] ?? " ")) return false;
    return !ABBREVIATIONS.test(this.flat.slice(Math.max(0, i - 5), i));
  }

  // The sentence around an offset, trimmed to a readable length.
  sentenceAt(index: number, max = 280): Located {
    let start = index;
    while (start > 0 && !this.isBoundary(start - 1) && index - start < max * 0.6) start--;
    let end = index;
    while (end < this.flat.length && !this.isBoundary(end) && end - start < max) end++;
    // A match on a bare heading ("3. NON-COMPETE") is more useful with the
    // sentence that follows it.
    if (end - start < 50 && end < this.flat.length - 1) {
      end++;
      while (end < this.flat.length && /\s/.test(this.flat[end])) end++;
      while (end < this.flat.length && !this.isBoundary(end) && end - start < max) end++;
    }
    const quote = this.flat
      .slice(start, Math.min(end + 1, this.flat.length))
      .replace(/\s+/g, " ")
      .replace(/^[\s,;:)\]]+/, "")
      .trim();
    return { quote, page: this.pageAt(index) };
  }

  // Respects the pattern's own flags, so leave off "i" to match case.
  find(pattern: RegExp): Match | null {
    const re = new RegExp(pattern.source, pattern.flags.replace("g", ""));
    const m = re.exec(this.flat);
    if (!m) return null;
    return { ...this.sentenceAt(m.index), match: m };
  }

  findAll(pattern: RegExp, limit = 20): Match[] {
    const re = new RegExp(pattern.source, "gi");
    const out: Match[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.flat)) && out.length < limit) {
      out.push({ ...this.sentenceAt(m.index), match: m });
      if (m[0].length === 0) re.lastIndex++;
    }
    return out;
  }

  has(pattern: RegExp): boolean {
    return new RegExp(pattern.source, "i").test(this.flat);
  }
}

// Joins lines broken by PDF layout while keeping paragraph breaks.
export function unwrapLines(text: string): string {
  return text.replace(/([^\n])\n(?!\n)/g, "$1 ").replace(/[ \t]{2,}/g, " ").trim();
}

export function excerpt(text: string, max = 280): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max).replace(/\s\S*$/, "") + "…" : clean;
}
