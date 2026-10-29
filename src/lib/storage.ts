import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { del, get, put } from "@vercel/blob";

// Uploaded contracts live in a private Vercel Blob store when one is
// connected (BLOB_READ_WRITE_TOKEN), and on local disk otherwise. Keys for
// blob files carry a "blob:" prefix so both kinds can coexist.

const BLOB_PREFIX = "blob:";
const root = path.resolve(process.cwd(), process.env.STORAGE_DIR || "storage");

export function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// Browser uploads go straight to Blob under this folder (see /api/upload).
export const UPLOAD_PREFIX = "uploads/";

function resolveDiskKey(key: string) {
  const full = path.resolve(root, key);
  if (!full.startsWith(root)) throw new Error("invalid storage key");
  return full;
}

function assertWritableDisk() {
  // Vercel's filesystem is read-only and not shared between requests.
  if (process.env.VERCEL) throw new Error("File storage is not configured. Connect a Vercel Blob store to this project (BLOB_READ_WRITE_TOKEN).");
}

export async function saveFile(buffer: Buffer, originalName: string, contentType?: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const name = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}${ext}`;
  if (blobEnabled()) {
    const blob = await put(`contracts/${name}`, buffer, { access: "private", addRandomSuffix: false, contentType });
    return BLOB_PREFIX + blob.pathname;
  }
  assertWritableDisk();
  const full = resolveDiskKey(name);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return name;
}

// Key for a file the browser has already uploaded to Blob.
export function keyForUploadedBlob(pathname: string): string {
  if (!blobEnabled() || !pathname.startsWith(UPLOAD_PREFIX) || pathname.includes("..")) throw new Error("invalid upload");
  return BLOB_PREFIX + pathname;
}

async function openBlob(key: string) {
  const result = await get(key.slice(BLOB_PREFIX.length), { access: "private" });
  if (!result || result.statusCode !== 200) throw new Error("File not found in storage.");
  return result;
}

// A stream of the file, for sending to the browser without buffering it.
export async function streamFile(key: string): Promise<ReadableStream<Uint8Array>> {
  if (key.startsWith(BLOB_PREFIX)) return (await openBlob(key)).stream;
  const buffer = await fs.readFile(resolveDiskKey(key));
  return new Response(new Uint8Array(buffer)).body!;
}

export async function readFile(key: string): Promise<Buffer> {
  if (key.startsWith(BLOB_PREFIX)) {
    const { stream } = await openBlob(key);
    return Buffer.from(await new Response(stream).arrayBuffer());
  }
  return fs.readFile(resolveDiskKey(key));
}

export async function deleteFile(key: string): Promise<void> {
  if (key.startsWith(BLOB_PREFIX)) return del(key.slice(BLOB_PREFIX.length));
  await fs.rm(resolveDiskKey(key), { force: true });
}
