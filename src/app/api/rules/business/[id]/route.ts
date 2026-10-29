import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { parseRule } from "../../validate";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  // toggling enabled on its own
  if (body && Object.keys(body).length === 1 && typeof body.enabled === "boolean") {
    const rule = await prisma.businessRule.update({ where: { id }, data: { enabled: body.enabled } });
    return NextResponse.json(rule);
  }
  const parsed = parseRule(body);
  if (!parsed.ok) return jsonError(parsed.error);
  const rule = await prisma.businessRule.update({ where: { id }, data: parsed.data });
  return NextResponse.json(rule);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.businessRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
