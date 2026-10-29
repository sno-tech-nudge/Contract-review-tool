import { NextResponse } from "next/server";
import { IngestError } from "./contracts/ingest";
import { keyForUploadedBlob, readFile } from "./storage";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof IngestError) return jsonError(err.message, 422);
  console.error(err);
  const message = err instanceof Error && /storage is not configured/i.test(err.message) ? err.message : "Something went wrong while processing the file. Please try again.";
  return jsonError(message, 500);
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type ContractUpload = { buffer: Buffer; name: string; storageKey?: string; fields: Record<string, string> };

// Contracts arrive either as a multipart form (local development) or, on
// Vercel, as JSON naming a file the browser already uploaded to Blob storage.
// Direct uploads avoid the 4.5 MB request limit on Vercel functions.
export async function readContractUpload(request: Request): Promise<ContractUpload> {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const pathname = String(body.blobPathname ?? "");
    const name = String(body.fileName ?? "").slice(0, 255);
    if (!pathname || !name) throw new IngestError("Attach a file.");
    const storageKey = keyForUploadedBlob(pathname);
    const buffer = await readFile(storageKey);
    if (buffer.length > MAX_UPLOAD_BYTES) throw new IngestError("Files must be 25 MB or smaller.");
    const fields = Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === "string" || typeof v === "boolean").map(([k, v]) => [k, String(v)]));
    return { buffer, name, storageKey, fields };
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") throw new IngestError("Attach a file.");
  if (file.size > MAX_UPLOAD_BYTES) throw new IngestError("Files must be 25 MB or smaller.");
  const fields: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") fields[k] = v;
  });
  return { buffer: Buffer.from(await file.arrayBuffer()), name: file.name, fields };
}
