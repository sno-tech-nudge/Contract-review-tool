import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { learnClauseType } from "@/lib/learning";
import { CLAUSE_TYPE_KEYS, type ClauseType } from "@/lib/contracts/types";

// Correct a clause's type. The correction also trains the clause classifier.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { clauseType?: string };
  if (!CLAUSE_TYPE_KEYS.includes(body.clauseType as ClauseType)) return jsonError("Unknown clause type.");
  const clause = await prisma.clause.findUnique({ where: { id } });
  if (!clause) return jsonError("Clause not found.", 404);
  await prisma.clause.update({ where: { id }, data: { clauseType: body.clauseType } });
  await learnClauseType(id, clause.heading, clause.text, body.clauseType as ClauseType, clause.clauseType);
  return NextResponse.json({ ok: true });
}
