import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { decisionNow, noteRuleChange } from "@/lib/learning/events";
import { ruleKeyOf, type ReviewResult } from "@/lib/review/types";
import { currentUser } from "@/lib/users";

const REASONS = ["not_applicable", "handled_elsewhere", "misread", "too_minor", "other"];

// "Useful" / "not relevant" on one finding. verdict null clears the vote.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { findingId?: string; verdict?: string | null; reason?: string };
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return jsonError("Review not found.", 404);
  const finding = (JSON.parse(review.resultJson) as ReviewResult).findings.find((f) => f.id === body.findingId);
  if (!finding) return jsonError("Finding not found.", 404);
  if (body.verdict !== null && body.verdict !== "useful" && body.verdict !== "not_relevant") return jsonError("Unknown verdict.");

  const ruleKey = ruleKeyOf(finding);
  const before = await decisionNow(ruleKey, review.contractType);
  const where = { reviewId_findingId: { reviewId: id, findingId: finding.id } };

  if (body.verdict === null) {
    await prisma.findingFeedback.deleteMany({ where: { reviewId: id, findingId: finding.id } });
  } else {
    const reason = body.verdict === "not_relevant" && REASONS.includes(body.reason ?? "") ? body.reason! : "";
    const me = await currentUser();
    const by = me?.kind === "person" ? { userId: me.id, userName: me.name } : { userId: null, userName: "" };
    // a legal reviewer's judgement carries more weight when checks are tuned
    const weight = me?.kind === "person" && me.role === "legal" ? 2 : 1;
    const data = { verdict: body.verdict, reason, ruleKey, check: finding.check, title: finding.title, contractType: review.contractType, ...by, weight };
    await prisma.findingFeedback.upsert({ where, create: { reviewId: id, findingId: finding.id, ...data }, update: data });
  }

  const after = await noteRuleChange(ruleKey, finding.title, review.contractType, before);
  return NextResponse.json({ ok: true, effect: after.effect, changed: after.effect !== before.effect, votes: after.votes });
}
