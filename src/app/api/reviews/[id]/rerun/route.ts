import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { CONTRACT_TYPE_KEYS, type ContractType } from "@/lib/contracts/types";
import { runReview } from "@/lib/review/run";

// Re-run the checks, optionally with a corrected contract type.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return jsonError("Review not found.", 404);
  const body = (await request.json().catch(() => ({}))) as { contractType?: string };
  const contractType = CONTRACT_TYPE_KEYS.includes(body.contractType as ContractType) ? (body.contractType as ContractType) : undefined;
  await runReview(review.documentId, { contractType, reviewId: id });
  return NextResponse.json({ ok: true });
}
