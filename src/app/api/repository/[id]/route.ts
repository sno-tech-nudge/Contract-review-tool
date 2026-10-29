import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { deleteFile } from "@/lib/storage";
import { CONTRACT_TYPE_KEYS, type ContractType } from "@/lib/contracts/types";

type Patch = { title?: string; contractType?: string; counterparty?: string; tags?: string; isTemplate?: boolean; notes?: string };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Patch;
  const data: Patch = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 200);
  if (CONTRACT_TYPE_KEYS.includes(body.contractType as ContractType)) data.contractType = body.contractType;
  if (typeof body.counterparty === "string") data.counterparty = body.counterparty.trim().slice(0, 200);
  if (typeof body.tags === "string") data.tags = body.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean).join(";");
  if (typeof body.isTemplate === "boolean") data.isTemplate = body.isTemplate;
  if (typeof body.notes === "string") data.notes = body.notes.slice(0, 5000);
  const doc = await prisma.document.updateMany({ where: { id, kind: "REPOSITORY" }, data });
  if (!doc.count) return jsonError("Contract not found.", 404);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id, kind: "REPOSITORY" } });
  if (!doc) return jsonError("Contract not found.", 404);
  await prisma.document.delete({ where: { id } });
  await deleteFile(doc.storageKey);
  return NextResponse.json({ ok: true });
}
