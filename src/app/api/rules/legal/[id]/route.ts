import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { LEGAL_RULES } from "@/lib/checks/legal/rules";

// Switch a built-in legal rule on or off.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!LEGAL_RULES.some((r) => r.id === id)) return jsonError("Unknown rule.", 404);
  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") return jsonError("Missing enabled flag.");
  await prisma.legalRuleSetting.upsert({ where: { ruleId: id }, create: { ruleId: id, enabled: body.enabled }, update: { enabled: body.enabled } });
  return NextResponse.json({ ok: true });
}
