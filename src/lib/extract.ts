import { getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export type Extracted = { pages: string[]; pageCount: number };

export const ACCEPTED_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};

export function mimeFor(fileName: string): string | null {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return ACCEPTED_TYPES[ext] ?? null;
}

type TextItem = { str: string; hasEOL?: boolean; transform?: number[] };

// Rebuild readable lines from pdf.js text items: a new line starts when an item
// says it ends a line or when the baseline moves vertically.
function pageItemsToText(items: TextItem[]): string {
  let out = "";
  let lastY: number | null = null;
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    const y = item.transform ? item.transform[5] : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith("\n")) out += "\n";
    out += item.str;
    if (item.hasEOL) out += "\n";
    if (y !== null) lastY = y;
  }
  return out
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(buffer: Buffer): Promise<Extracted> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(pageItemsToText(content.items as TextItem[]));
  }
  return { pages, pageCount: pdf.numPages };
}

// Fine print on Indian e-stamp paper; its numbered lines would otherwise be
// mistaken for the contract's own clauses.
const STAMP_BOILERPLATE = /authenticity of this stamp|onus of checking the legitimacy|in case of any discrepancy please inform|^\s*statutory alert/i;

// OCR turns stamps, seals and signatures into junk lines like "Sd l= 0 ho [= $1".
// Keep a line only if it reads like words.
function looksLikeText(line: string): boolean {
  const t = line.trim();
  if (!t) return true; // keep paragraph breaks
  const letters = (t.match(/[A-Za-z]/g) ?? []).length;
  const words = (t.match(/[A-Za-z]{3,}/g) ?? []).length;
  if (/^\(?[0-9ivxIVX]{1,4}[.)]?$/.test(t)) return true; // a bare clause number
  return words >= 1 && letters / t.length >= 0.5 && (words >= 2 || t.length <= 40);
}

// Postgres text columns reject NUL characters, which some PDFs contain.
function cleanPage(page: string, fromOcr: boolean): string {
  return page
    .replace(/\u0000/g, "")
    .split("\n")
    .filter((line) => !STAMP_BOILERPLATE.test(line) && (!fromOcr || looksLikeText(line)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<Extracted> {
  const { pages, pageCount } = await extractRaw(buffer, mimeType);
  return { pages: pages.map((p) => cleanPage(p, false)), pageCount };
}

// A page with this little text is treated as a scanned image.
export const SCANNED_PAGE_CHARS = 30;
const MAX_OCR_CHARS = 2_000_000;

// Fills in scanned pages with text recognised in the browser. Pages that
// already have a text layer keep it; OCR only replaces near-empty pages.
export function mergeOcr(pages: string[], ocrPages: unknown): { pages: string[]; usedOcr: boolean } {
  if (!Array.isArray(ocrPages) || ocrPages.length !== pages.length) return { pages, usedOcr: false };
  const total = ocrPages.reduce((n: number, p) => n + (typeof p === "string" ? p.length : 0), 0);
  if (total > MAX_OCR_CHARS) return { pages, usedOcr: false };
  let usedOcr = false;
  const merged = pages.map((page, i) => {
    const ocr = ocrPages[i];
    if (typeof ocr !== "string" || page.replace(/\s/g, "").length >= SCANNED_PAGE_CHARS) return page;
    const cleaned = cleanPage(ocr, true);
    if (!cleaned) return page;
    usedOcr = true;
    return cleaned;
  });
  return { pages: merged, usedOcr };
}

async function extractRaw(buffer: Buffer, mimeType: string): Promise<Extracted> {
  if (mimeType === "application/pdf") return extractPdf(buffer);
  if (mimeType === ACCEPTED_TYPES[".docx"]) {
    const { value } = await mammoth.extractRawText({ buffer });
    return { pages: [value.replace(/\n{3,}/g, "\n\n").trim()], pageCount: 1 };
  }
  return { pages: [buffer.toString("utf8").trim()], pageCount: 1 };
}

export async function docxToHtml(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.convertToHtml({ buffer });
  return value;
}
