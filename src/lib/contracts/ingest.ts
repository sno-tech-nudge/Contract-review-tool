import { prisma } from "../db";
import { extractText, mergeOcr, mimeFor } from "../extract";
import { deleteFile, saveFile } from "../storage";
import { DocText } from "../text/locate";
import { segment } from "./segment";
import { clauseExamples, guessContractType, learnContractType, learnedClauseType, loadLearnedModels } from "../learning";
import { applyLearnedTypes } from "../review/semantic";
import { tryEmbedPassages } from "../embeddings";
import type { ContractType } from "./types";
import { detectEntity, isEntity } from "./entities";

export type IngestOptions = {
  kind: "REPOSITORY" | "REVIEW";
  title?: string;
  contractType?: ContractType | "";
  entity?: string; // nudge | delta | spark; detected when not given
  counterparty?: string;
  tags?: string;
  isTemplate?: boolean;
  storageKey?: string; // set when the file is already in storage (direct browser upload)
  ocrPages?: unknown; // per-page text recognised in the browser for scanned pages
  learnType?: boolean; // false when contractType is a carried-over guess, not a person's choice
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

  const models = await loadLearnedModels();
  const detected = guessContractType(doc.full, models);
  // types people confirmed for near-identical clauses, by meaning when the
  // model is available (it also caches the vectors later reviews compare against)
  let segments = segment(doc, (h, t) => learnedClauseType(h, t, models));
  const vectors = await tryEmbedPassages(segments.map((s) => `${s.heading} ${s.text}`));
  if (vectors) segments = await applyLearnedTypes(segments, vectors, await clauseExamples());
  const storageKey = opts.storageKey ?? (await saveFile(buffer, fileName, mimeType));

  const created = await prisma.document.create({
    data: {
      kind: opts.kind,
      title: opts.title?.trim() || titleFromFileName(fileName),
      fileName,
      mimeType,
      size: buffer.length,
      storageKey,
      contractType: opts.contractType || detected.type,
      entity: isEntity(opts.entity) ? opts.entity : detectEntity(doc.full),
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

  // A type chosen by a person (a folder, a picker) is a confirmed example to learn from.
  if (opts.contractType && opts.learnType !== false) await learnContractType(created.id, created.title, doc.full, opts.contractType, detected.type);
  return created;
}
