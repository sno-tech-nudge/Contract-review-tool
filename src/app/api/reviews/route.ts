import { NextResponse } from "next/server";
import { handleError, readContractUpload } from "@/lib/api";
import { ingestFile } from "@/lib/contracts/ingest";
import { CONTRACT_TYPE_KEYS, type ContractType } from "@/lib/contracts/types";
import { runReview } from "@/lib/review/run";

export const runtime = "nodejs";
export const maxDuration = 60;

// Upload a contract and run every check on it.
export async function POST(request: Request) {
  try {
    const upload = await readContractUpload(request);
    const requested = (upload.fields.contractType ?? "") as ContractType;
    const contractType = CONTRACT_TYPE_KEYS.includes(requested) ? requested : undefined;
    const doc = await ingestFile(upload.buffer, upload.name, { kind: "REVIEW", contractType, storageKey: upload.storageKey });
    const review = await runReview(doc.id);
    return NextResponse.json({ id: review.id });
  } catch (err) {
    return handleError(err);
  }
}
