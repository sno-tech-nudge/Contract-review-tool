import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { logLearning } from "@/lib/learning";
import { runReview } from "@/lib/review/run";
import { FACT_FIELDS, type ContractFacts } from "@/lib/checks/facts";

export const maxDuration = 60;

// A reviewer corrects or adds facts about the contract (its value, duration,
// counterparty, the counterparty's headcount); the checks then run again so
// rule exceptions that depend on them take effect. null clears a fact.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id }, include: { document: { select: { id: true, title: true, factsJson: true } } } });
  if (!review) return jsonError("Review not found.", 404);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  let facts: ContractFacts = {};
  try {
    facts = JSON.parse(review.document.factsJson) as ContractFacts;
  } catch {
    facts = {};
  }
  const changed: string[] = [];
  for (const key of ["value", "months", "employees"] as const) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === null || raw === "") delete facts[key];
    else {
      const n = Number(String(raw).replace(/[,₹\s]/g, ""));
      if (!Number.isFinite(n) || n < 0) return jsonError(`${FACT_FIELDS[key].label} must be a number.`);
      facts[key] = n;
    }
    changed.push(FACT_FIELDS[key].label.toLowerCase());
  }
  if ("counterparty" in body) {
    const name = String(body.counterparty ?? "").trim().slice(0, 200);
    if (name) facts.counterparty = name;
    else delete facts.counterparty;
    changed.push("counterparty");
  }

  await prisma.document.update({ where: { id: review.document.id }, data: { factsJson: JSON.stringify(facts) } });
  if (changed.length) await logLearning("facts", `Set the ${changed.join(", ")} for "${review.document.title}"; its checks were run again.`);
  await runReview(review.document.id, { reviewId: id });
  return NextResponse.json({ ok: true });
}
