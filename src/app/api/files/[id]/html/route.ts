import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { docxToHtml, ACCEPTED_TYPES } from "@/lib/extract";
import { readFile } from "@/lib/storage";

export const runtime = "nodejs";

// Word documents are shown as HTML in the viewer.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id }, select: { storageKey: true, mimeType: true } });
  if (!doc) return jsonError("File not found.", 404);
  if (doc.mimeType !== ACCEPTED_TYPES[".docx"]) return jsonError("Not a Word document.");
  return NextResponse.json({ html: await docxToHtml(await readFile(doc.storageKey)) });
}
