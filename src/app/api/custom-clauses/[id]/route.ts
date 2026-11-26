import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { logLearning } from "@/lib/learning";
import { cleanCustomClause } from "@/lib/library/custom-input";
import { currentUser } from "@/lib/users";

async function allowed() {
  const me = await currentUser();
  return me?.role !== "member";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await allowed())) return jsonError("Only admins and legal reviewers can change the clause library.", 403);
  const before = await prisma.customClause.findUnique({ where: { id } });
  if (!before) return jsonError("Clause not found.", 404);
  const data = cleanCustomClause({ ...before, ...((await request.json().catch(() => ({}))) as Record<string, unknown>) });
  if (!data.name) return jsonError("Give the clause a name.");
  await prisma.customClause.update({ where: { id }, data });
  if (before.enabled !== data.enabled) await logLearning("library", `${data.enabled ? "Switched on" : "Switched off"} the clause library check for "${data.name}".`);
  else await logLearning("library", `Updated "${data.name}" in the clause library.`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await allowed())) return jsonError("Only admins and legal reviewers can change the clause library.", 403);
  const clause = await prisma.customClause.findUnique({ where: { id } });
  if (!clause) return jsonError("Clause not found.", 404);
  await prisma.customClause.delete({ where: { id } });
  await logLearning("library", `Removed "${clause.name}" from the clause library.`);
  return NextResponse.json({ ok: true });
}
