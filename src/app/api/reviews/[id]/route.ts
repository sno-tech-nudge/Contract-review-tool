import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { jsonError } from "@/lib/api";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id }, include: { document: true } });
  if (!review) return jsonError("Review not found.", 404);
  await prisma.document.delete({ where: { id: review.documentId } });
  await deleteFile(review.document.storageKey);
  return NextResponse.json({ ok: true });
}
