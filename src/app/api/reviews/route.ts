import { after, NextResponse } from "next/server";
import { handleError, readContractUpload } from "@/lib/api";
import { ingestFile } from "@/lib/contracts/ingest";
import { CONTRACT_TYPE_KEYS, type ContractType } from "@/lib/contracts/types";
import { prisma } from "@/lib/db";
import { runReviewInBackground } from "@/lib/review/background";

export const runtime = "nodejs";
export const maxDuration = 60;

// Upload a contract and start its review. The response returns as soon as the
// file is stored and read; the checks run afterwards and the review page
// shows their progress.
export async function POST(request: Request) {
  try {
    const upload = await readContractUpload(request);
    const requested = (upload.fields.contractType ?? "") as ContractType;
    const contractType = CONTRACT_TYPE_KEYS.includes(requested) ? requested : undefined;
    const doc = await ingestFile(upload.buffer, upload.name, { kind: "REVIEW", contractType, storageKey: upload.storageKey, ocrPages: upload.ocrPages });
    const review = await prisma.review.create({
      data: { documentId: doc.id, contractType: doc.contractType || "other", status: "PROCESSING", stage: "Reading the contract" },
    });
    after(() => runReviewInBackground(doc.id, review.id));
    return NextResponse.json({ id: review.id });
  } catch (err) {
    return handleError(err);
  }
}
