import { createHash } from "node:crypto";
import path from "node:path";
import { prisma } from "../db";

// Meaning vectors for text, so "the grant is to be returned if unused" and
// "unspent funds shall be refunded" are recognised as saying the same thing.
// A small open model (BGE small, English) runs inside the app: contract text
// never leaves it. Vectors are normalised, so a dot product is the cosine
// similarity. Each text is embedded once and cached in the database.

export const EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";
export type Vector = Float32Array<ArrayBufferLike>;

// Searches are phrased differently from the passages they look for; BGE
// expects this prefix on the search side only.
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

type Extractor = (texts: string[], options: { pooling: "cls"; normalize: boolean }) => Promise<{ data: Float32Array; dims: number[] }>;
let extractor: Promise<Extractor> | null = null;

function loadExtractor(): Promise<Extractor> {
  extractor ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    // the model is downloaded once per server; only /tmp is writable on Vercel
    env.cacheDir = process.env.VERCEL ? "/tmp/transformers-cache" : path.join(process.cwd(), ".cache", "transformers");
    env.allowLocalModels = false;
    return (await pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" })) as unknown as Extractor;
  })().catch((err) => {
    extractor = null; // let the next call try again
    throw err;
  });
  return extractor;
}

const normalise = (v: Float32Array) => {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
};

// The model reads ~512 tokens; longer clauses are read in overlapping windows
// and averaged, so the end of a long clause still counts.
function windows(text: string): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 1400) return [flat || " "];
  const out: string[] = [];
  for (let i = 0; i < flat.length && out.length < 4; i += 1100) out.push(flat.slice(i, i + 1400));
  return out;
}

const hashOf = (kind: "passage" | "query", text: string) => createHash("sha256").update(`${EMBEDDING_MODEL}|${kind}|${text.replace(/\s+/g, " ").trim()}`).digest("hex");

async function compute(texts: string[]): Promise<Vector[]> {
  const run = await loadExtractor();
  const pieces = texts.map(windows);
  const flat = pieces.flat();
  const vectors: Float32Array[] = [];
  for (let i = 0; i < flat.length; i += 16) {
    const out = await run(flat.slice(i, i + 16), { pooling: "cls", normalize: true });
    const dim = out.dims[out.dims.length - 1];
    for (let j = 0; j < out.dims[0]; j++) vectors.push(out.data.slice(j * dim, (j + 1) * dim));
  }
  let k = 0;
  return pieces.map((p) => {
    const parts = vectors.slice(k, (k += p.length));
    if (parts.length === 1) return parts[0];
    const sum = new Float32Array(parts[0].length);
    for (const v of parts) for (let d = 0; d < v.length; d++) sum[d] += v[d];
    return normalise(sum);
  });
}

async function embedCached(texts: string[], kind: "passage" | "query"): Promise<Vector[]> {
  if (!texts.length) return [];
  const prepared = texts.map((t) => (kind === "query" ? QUERY_PREFIX + t : t));
  const hashes = prepared.map((t) => hashOf(kind, t));
  const unique = [...new Set(hashes)];
  const found = await prisma.embedding.findMany({ where: { hash: { in: unique } } });
  const byHash = new Map<string, Vector>(found.map((e) => [e.hash, new Float32Array(Uint8Array.from(e.vector).buffer)]));
  const missing = unique.filter((h) => !byHash.has(h));
  if (missing.length) {
    const texts = missing.map((h) => prepared[hashes.indexOf(h)]);
    const vectors = await compute(texts);
    missing.forEach((h, i) => byHash.set(h, vectors[i]));
    const rows = missing.map((h, i) => ({ hash: h, model: EMBEDDING_MODEL, vector: Uint8Array.from(new Uint8Array(vectors[i].buffer, vectors[i].byteOffset, vectors[i].byteLength)) }));
    // in modest batches: one huge insert can overwhelm a small database
    for (let i = 0; i < rows.length; i += 50) await prisma.embedding.createMany({ data: rows.slice(i, i + 50), skipDuplicates: true });
  }
  return hashes.map((h) => byHash.get(h)!);
}

// Clauses and other passages to compare or search.
export const embedPassages = (texts: string[]) => embedCached(texts, "passage");
// A question or search phrase looking for passages.
export const embedQuery = async (text: string) => (await embedCached([text], "query"))[0];

export function similarity(a: Vector, b: Vector): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// Embeddings are a refinement: if the model cannot load (offline, out of
// memory) the checks fall back to word matching instead of failing.
export async function tryEmbedPassages(texts: string[]): Promise<Vector[] | null> {
  try {
    return await embedPassages(texts);
  } catch (err) {
    console.error("Embeddings unavailable, falling back to word matching:", err);
    return null;
  }
}
