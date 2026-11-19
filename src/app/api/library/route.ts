import { NextResponse } from "next/server";
import { handleError, jsonError, readContractUpload } from "@/lib/api";
import { IngestError } from "@/lib/contracts/ingest";
import { importLibrary } from "@/lib/library";
import { parseClauseLibrary } from "@/lib/library/parse";
import { deleteFile } from "@/lib/storage";

export const maxDuration = 60;

// Import one clause-library PDF (standard and alternative clauses per topic).
export async function POST(request: Request) {
  let storageKey: string | undefined;
  try {
    const upload = await readContractUpload(request);
    storageKey = upload.storageKey;
    if (!/\.pdf$/i.test(upload.name)) throw new IngestError("Clause libraries are imported from PDF exports.");
    const topics = await parseClauseLibrary(upload.buffer);
    if (!topics.length) {
      return jsonError(`"${upload.name}" does not look like a clause library export: it has no "Standard Clause" or "Alternative Clauses" sections.`, 422);
    }
    const result = await importLibrary(topics, upload.name);
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  } finally {
    // the wording now lives in the database; the uploaded copy is not needed
    if (storageKey) await deleteFile(storageKey).catch(() => undefined);
  }
}
