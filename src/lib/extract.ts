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

// Postgres text columns reject NUL characters, which some PDFs contain.
const clean = (pages: string[]) => pages.map((p) => p.replace(/\u0000/g, ""));

export async function extractText(buffer: Buffer, mimeType: string): Promise<Extracted> {
  const { pages, pageCount } = await extractRaw(buffer, mimeType);
  return { pages: clean(pages), pageCount };
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
