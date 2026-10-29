import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Uploaded files live on local disk for now. Everything goes through these
// three functions so a hosted bucket (e.g. Supabase Storage) can replace them.
const root = path.resolve(process.cwd(), process.env.STORAGE_DIR || "storage");

function resolveKey(key: string) {
  const full = path.resolve(root, key);
  if (!full.startsWith(root)) throw new Error("invalid storage key");
  return full;
}

export async function saveFile(buffer: Buffer, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}${ext}`;
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return key;
}

export async function readFile(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key));
}

export async function deleteFile(key: string): Promise<void> {
  await fs.rm(resolveKey(key), { force: true });
}
