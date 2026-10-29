import { prisma } from "../db";
import { extractText, mimeFor } from "../extract";
import { saveFile } from "../storage";
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
  const mimeType = mimeFor(fileName);
  if (!mimeType) throw new IngestError("Only PDF, Word (.docx) and plain text files are supported.");

  const { pages, pageCount } = await extractText(buffer, mimeType);
  const doc = new DocText(pages);
  if (doc.full.replace(/\s/g, "").length < 50) {
    throw new IngestError("No readable text found. If this is a scanned PDF, run it through OCR first.");
  }

  const detected = detectContractType(doc.full);
  const segments = segment(doc);
  const storageKey = await saveFile(buffer, fileName);

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
