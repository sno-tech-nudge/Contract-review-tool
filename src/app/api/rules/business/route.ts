import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { parseRule } from "../validate";

export async function POST(request: Request) {
  const parsed = parseRule(await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);
  const rule = await prisma.businessRule.create({ data: parsed.data });
  return NextResponse.json(rule);
}
