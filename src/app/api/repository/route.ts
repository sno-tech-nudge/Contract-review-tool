import { NextResponse } from "next/server";
import { handleError, MAX_UPLOAD_BYTES } from "@/lib/api";
import { ingestFile, IngestError } from "@/lib/contracts/ingest";
import { CONTRACT_TYPE_KEYS, type ContractType } from "@/lib/contracts/types";

export const runtime = "nodejs";

// Adds one file to the repository. The client uploads files one at a time so
// each can show its own progress and error.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") throw new IngestError("Attach a file.");
    if (file.size > MAX_UPLOAD_BYTES) throw new IngestError("Files must be 25 MB or smaller.");
    const requested = String(form.get("contractType") ?? "") as ContractType;
    const doc = await ingestFile(Buffer.from(await file.arrayBuffer()), file.name, {
      kind: "REPOSITORY",
      contractType: CONTRACT_TYPE_KEYS.includes(requested) ? requested : undefined,
      isTemplate: form.get("isTemplate") === "true",
    });
    return NextResponse.json({ id: doc.id, title: doc.title, contractType: doc.contractType, pageCount: doc.pageCount });
  } catch (err) {
    return handleError(err);
  }
}
