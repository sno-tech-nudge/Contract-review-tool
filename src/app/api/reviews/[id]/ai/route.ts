import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { aiEnabled, aiModel, aiReview } from "@/lib/ai/claude";
import { sortFindings } from "@/lib/review/run";
import { riskScore, type ReviewResult } from "@/lib/review/types";
import { DocText } from "@/lib/text/locate";

export const runtime = "nodejs";
export const maxDuration = 300;

function friendly(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "The AI service is busy. Try again in a minute.";
  if (err instanceof Anthropic.APIError) return `The AI service returned an error (${err.status}).`;
  return err instanceof Error ? err.message : "The AI review failed.";
}

// Adds Claude's summary, key terms and extra risks to an existing review.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!aiEnabled()) return jsonError("AI review is not configured.", 400);
  const review = await prisma.review.findUnique({ where: { id }, include: { document: true } });
  if (!review) return jsonError("Review not found.", 404);
  const result = JSON.parse(review.resultJson) as ReviewResult;

  try {
    const doc = new DocText(JSON.parse(review.document.pagesJson) as string[]);
    const ai = await aiReview({ title: review.document.title, contractType: result.contractType, text: doc.full, findings: result.findings });
    // place each quoted passage on its page
    const pageOf = (quote?: string) => {
      if (!quote) return undefined;
      const probe = quote.replace(/\s+/g, " ").toLowerCase().slice(0, 50);
      const i = doc.pages.findIndex((p) => p.replace(/\s+/g, " ").toLowerCase().includes(probe));
      return i >= 0 ? i + 1 : undefined;
    };
    result.summary = ai.summary;
    result.summarySource = "ai";
    result.keyTerms = ai.keyTerms.map((k) => ({ ...k, page: pageOf(k.quote) }));
    result.findings = sortFindings([...result.findings.filter((f) => f.check !== "ai"), ...ai.findings.map((f) => ({ ...f, page: pageOf(f.quote) }))]);
    result.ai = { status: "done", model: aiModel() };
  } catch (err) {
    console.error(err);
    result.ai = { status: "failed", model: aiModel(), error: friendly(err) };
  }

  await prisma.review.update({ where: { id }, data: { resultJson: JSON.stringify(result), riskScore: riskScore(result.findings) } });
  return NextResponse.json({ status: result.ai.status, error: result.ai.error });
}
