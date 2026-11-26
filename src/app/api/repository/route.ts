import { NextResponse } from "next/server";
import { handleError, readContractUpload } from "@/lib/api";
import { ingestFile } from "@/lib/contracts/ingest";
import { CONTRACT_TYPE_KEYS, type ContractType } from "@/lib/contracts/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Adds one file to the repository. The client uploads files one at a time so
// each can show its own progress and error.
export async function POST(request: Request) {
  try {
    const upload = await readContractUpload(request);
    const requested = (upload.fields.contractType ?? "") as ContractType;
    const doc = await ingestFile(upload.buffer, upload.name, {
      kind: "REPOSITORY",
      contractType: CONTRACT_TYPE_KEYS.includes(requested) ? requested : undefined,
      isTemplate: upload.fields.isTemplate === "true",
      entity: upload.fields.entity,
      storageKey: upload.storageKey,
      ocrPages: upload.ocrPages,
    });
    return NextResponse.json({ id: doc.id, title: doc.title, contractType: doc.contractType, entity: doc.entity, pageCount: doc.pageCount });
  } catch (err) {
    return handleError(err);
  }
}
