import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { CONTRACT_TYPE_KEYS, type ContractType } from "@/lib/contracts/types";
import { runReview } from "@/lib/review/run";
import { isEntity } from "@/lib/contracts/entities";

export const maxDuration = 60;

// Re-run the checks, optionally with a corrected contract type.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return jsonError("Review not found.", 404);
  const body = (await request.json().catch(() => ({}))) as { contractType?: string; entity?: string };
  // a different entity changes which custom clauses apply and whose contracts count most
  if (isEntity(body.entity) || body.entity === "") await prisma.document.update({ where: { id: review.documentId }, data: { entity: body.entity } });
  const contractType = CONTRACT_TYPE_KEYS.includes(body.contractType as ContractType) ? (body.contractType as ContractType) : undefined;
  await runReview(review.documentId, { contractType, reviewId: id });
  return NextResponse.json({ ok: true });
}
