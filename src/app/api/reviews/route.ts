import { NextResponse } from "next/server";
import { fileFromForm, handleError, jsonError } from "@/lib/api";
import { ingestFile } from "@/lib/contracts/ingest";
import { CONTRACT_TYPE_KEYS, type ContractType } from "@/lib/contracts/types";
import { runReview } from "@/lib/review/run";

export const runtime = "nodejs";

// Upload a contract and run every check on it.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = await fileFromForm(form);
    if (!file) return jsonError("Attach a contract to review.");
    const requested = String(form.get("contractType") ?? "") as ContractType;
    const contractType = CONTRACT_TYPE_KEYS.includes(requested) ? requested : undefined;
    const doc = await ingestFile(file.buffer, file.name, { kind: "REVIEW", contractType });
    const review = await runReview(doc.id);
    return NextResponse.json({ id: review.id });
  } catch (err) {
    return handleError(err);
  }
}
