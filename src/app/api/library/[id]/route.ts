import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { deleteLibraryClause, updateLibraryClause } from "@/lib/library";
import { prisma } from "@/lib/db";

// Correct how a library clause is read: its clause type or the contract types
// it applies to. The correction retrains the clause classifier.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { clauseType?: string; validFor?: unknown };
  if (!(await prisma.libraryClause.findUnique({ where: { id }, select: { id: true } }))) return jsonError("Clause not found.", 404);
  const validFor = Array.isArray(body.validFor) ? body.validFor.map(String) : undefined;
  const clause = await updateLibraryClause(id, { clauseType: body.clauseType, validFor });
  return NextResponse.json({ clauseType: clause.clauseType, validFor: clause.validFor });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await prisma.libraryClause.findUnique({ where: { id }, select: { id: true } }))) return jsonError("Clause not found.", 404);
  await deleteLibraryClause(id);
  return NextResponse.json({ ok: true });
}
