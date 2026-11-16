import { prisma } from "../db";
import { extractText, mergeOcr, mimeFor } from "../extract";
import { deleteFile, saveFile } from "../storage";
import { DocText } from "../text/locate";
import { detectContractType } from "./classify";
import { segment } from "./segment";
import type { ContractType } from "./types";

export type IngestOptions = {
  kind: "REPOSITORY" | "REVIEW";
  title?: string;
  contractType?: ContractType | "";
  counterparty?: string;
  tags?: string;
  isTemplate?: boolean;
  storageKey?: string; // set when the file is already in storage (direct browser upload)
  ocrPages?: unknown; // per-page text recognised in the browser for scanned pages
};

export class IngestError extends Error {}

export function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function ingestFile(buffer: Buffer, fileName: string, opts: IngestOptions) {
  try {
    return await ingest(buffer, fileName, opts);
  } catch (err) {
    // don't leave an orphaned upload behind when the file can't be used
    if (opts.storageKey) await deleteFile(opts.storageKey).catch(() => {});
    throw err;
  }
}

async function ingest(buffer: Buffer, fileName: string, opts: IngestOptions) {
  const mimeType = mimeFor(fileName);
  if (!mimeType) throw new IngestError("Only PDF, Word (.docx) and plain text files are supported.");

  const extracted = await extractText(buffer, mimeType);
  const { pages, usedOcr } = mergeOcr(extracted.pages, opts.ocrPages);
  const pageCount = extracted.pageCount;
  const doc = new DocText(pages);
  if (doc.full.replace(/\s/g, "").length < 50) {
    throw new IngestError("No readable text found. If this is a scanned PDF, upload it again here and let the text recognition finish.");
  }

  const detected = detectContractType(doc.full);
  const segments = segment(doc);
  const storageKey = opts.storageKey ?? (await saveFile(buffer, fileName, mimeType));

  return prisma.document.create({
    data: {
      kind: opts.kind,
      title: opts.title?.trim() || titleFromFileName(fileName),
      fileName,
      mimeType,
      size: buffer.length,
      storageKey,
      contractType: opts.contractType || detected.type,
      counterparty: opts.counterparty ?? "",
      tags: opts.tags ?? "",
      isTemplate: opts.isTemplate ?? false,
      pageCount,
      textSource: usedOcr ? "ocr" : "pdf",
      text: doc.full,
      pagesJson: JSON.stringify(pages),
      clauses: {
        create: segments.map((s) => ({
          position: s.position,
          heading: s.heading.slice(0, 200),
          text: s.text,
          clauseType: s.type,
          page: s.page,
        })),
      },
    },
  });
}
