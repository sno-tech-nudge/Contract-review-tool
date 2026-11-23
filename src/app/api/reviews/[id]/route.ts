import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { jsonError } from "@/lib/api";

// Progress of a review that is still running.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id }, select: { status: true, stage: true, error: true, createdAt: true } });
  if (!review) return jsonError("Review not found.", 404);
  return NextResponse.json(review);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id }, include: { document: true } });
  if (!review) return jsonError("Review not found.", 404);
  await prisma.document.delete({ where: { id: review.documentId } });
  await deleteFile(review.document.storageKey);
  return NextResponse.json({ ok: true });
}
