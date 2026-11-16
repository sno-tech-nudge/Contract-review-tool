import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { decisionNow, noteRuleChange } from "@/lib/learning/events";
import { CONTRACT_TYPE_KEYS, type ContractType } from "@/lib/contracts/types";

// Keep a rule on or off for a contract type regardless of feedback, or hand it
// back to automatic learning ("auto").
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { ruleKey?: string; contractType?: string; mode?: string; title?: string };
  const ruleKey = (body.ruleKey ?? "").slice(0, 200);
  const contractType = body.contractType === "*" ? "*" : CONTRACT_TYPE_KEYS.includes(body.contractType as ContractType) ? body.contractType! : null;
  if (!ruleKey || !contractType) return jsonError("Missing rule or contract type.");
  if (!["on", "off", "auto"].includes(body.mode ?? "")) return jsonError("Mode must be on, off or auto.");

  const before = await decisionNow(ruleKey, contractType);
  if (body.mode === "auto") {
    await prisma.ruleOverride.deleteMany({ where: { ruleKey, contractType } });
  } else {
    await prisma.ruleOverride.upsert({
      where: { ruleKey_contractType: { ruleKey, contractType } },
      create: { ruleKey, contractType, mode: body.mode! },
      update: { mode: body.mode! },
    });
  }
  const after = await noteRuleChange(ruleKey, (body.title ?? ruleKey).slice(0, 200), contractType, before);
  return NextResponse.json({ ok: true, effect: after.effect });
}
