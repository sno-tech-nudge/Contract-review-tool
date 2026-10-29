import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleError, jsonError } from "@/lib/api";
import { ingestFile } from "@/lib/contracts/ingest";
import { readFile } from "@/lib/storage";
import type { ContractType } from "@/lib/contracts/types";

// Files a reviewed contract into the repository so future reviews learn from it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id }, include: { document: true } });
  if (!review) return jsonError("Review not found.", 404);
  const body = (await request.json().catch(() => ({}))) as { isTemplate?: boolean };
  try {
    const d = review.document;
    const doc = await ingestFile(await readFile(d.storageKey), d.fileName, {
      kind: "REPOSITORY",
      title: d.title,
      contractType: review.contractType as ContractType,
      counterparty: d.counterparty,
      isTemplate: Boolean(body.isTemplate),
    });
    return NextResponse.json({ id: doc.id });
  } catch (err) {
    return handleError(err);
  }
}
