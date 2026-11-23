import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { logLearning } from "@/lib/learning";
import { contractTypeLabel, lowerLabel } from "@/lib/contracts/types";
import { currentUser } from "@/lib/users";

const SEVERITIES = ["critical", "high", "medium", "low"];

// Something a reviewer spotted that the checks did not.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id }, include: { document: { select: { title: true } } } });
  if (!review) return jsonError("Review not found.", 404);
  const body = (await request.json().catch(() => ({}))) as { quote?: string; note?: string; severity?: string; page?: number };
  const quote = (body.quote ?? "").replace(/\s+/g, " ").trim().slice(0, 2000);
  const note = (body.note ?? "").trim().slice(0, 1000);
  if (!note) return jsonError("Describe what was missed.");
  const me = await currentUser();
  const missed = await prisma.missedIssue.create({
    data: {
      ...(me?.kind === "person" ? { userId: me.id, userName: me.name } : {}),
      reviewId: id,
      contractType: review.contractType,
      quote,
      note,
      severity: SEVERITIES.includes(body.severity ?? "") ? body.severity! : "medium",
      page: Number.isInteger(body.page) ? body.page : null,
    },
  });
  await logLearning("missed", `Flagged a miss in "${review.document.title}" (${lowerLabel(contractTypeLabel(review.contractType))}): ${note.slice(0, 120)}`);
  return NextResponse.json(missed);
}
