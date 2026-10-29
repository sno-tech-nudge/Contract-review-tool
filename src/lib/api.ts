import { NextResponse } from "next/server";
import { IngestError } from "./contracts/ingest";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof IngestError) return jsonError(err.message, 422);
  console.error(err);
  return jsonError("Something went wrong while processing the file. Please try again.", 500);
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function fileFromForm(form: FormData, field = "file"): Promise<{ buffer: Buffer; name: string } | null> {
  const file = form.get(field);
  if (!file || typeof file === "string") return null;
  if (file.size > MAX_UPLOAD_BYTES) throw new IngestError("Files must be 25 MB or smaller.");
  return { buffer: Buffer.from(await file.arrayBuffer()), name: file.name };
}
