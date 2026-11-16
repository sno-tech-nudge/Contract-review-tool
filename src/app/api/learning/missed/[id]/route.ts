import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { logLearning } from "@/lib/learning";

// Close a flagged miss: turned into a rule, or dismissed.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: string; ruleName?: string };
  if (!["open", "rule_created", "dismissed"].includes(body.status ?? "")) return jsonError("Unknown status.");
  const missed = await prisma.missedIssue.update({ where: { id }, data: { status: body.status! } }).catch(() => null);
  if (!missed) return jsonError("Not found.", 404);
  if (body.status === "rule_created") await logLearning("rule_created", `Added the business rule "${(body.ruleName ?? "").slice(0, 120)}" from a flagged miss.`);
  return NextResponse.json({ ok: true });
}
