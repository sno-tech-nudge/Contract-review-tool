import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { aiEnabled } from "@/lib/ai/claude";
import { LAWS } from "@/lib/checks/legal/rules";
import type { ReviewResult } from "@/lib/review/types";
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";
import { ReviewProgress } from "@/components/review/ReviewProgress";
import type { FindingFeedbackState } from "@/components/review/FindingCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id }, select: { document: { select: { title: true } } } });
  return { title: review ? `${review.document.title} · Contract review` : "Review not found" };
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      document: true,
      feedback: { select: { findingId: true, verdict: true, reason: true } },
      missed: { where: { status: { not: "dismissed" } }, orderBy: { createdAt: "asc" }, select: { id: true, quote: true, note: true, severity: true, page: true } },
    },
  });
  if (!review) notFound();
  const d = review.document;
  if (review.status !== "COMPLETE") {
    return <ReviewProgress id={review.id} title={d.title} initial={{ status: review.status, stage: review.stage, error: review.error, createdAt: review.createdAt.toISOString() }} />;
  }
  const lawDescriptions = Object.fromEntries(Object.values(LAWS).map((l) => [l.label, l.description]));
  const feedback = Object.fromEntries(review.feedback.map((f) => [f.findingId, { verdict: f.verdict, reason: f.reason } as FindingFeedbackState]));

  return (
    <ReviewWorkspace
      review={{ id: review.id, createdAt: review.createdAt.toISOString(), riskScore: review.riskScore }}
      result={JSON.parse(review.resultJson) as ReviewResult}
      document={{ id: d.id, title: d.title, fileName: d.fileName, mimeType: d.mimeType, pageCount: d.pageCount, scanned: d.textSource === "ocr", text: d.mimeType === "text/plain" ? d.text : "" }}
      aiAvailable={aiEnabled()}
      lawDescriptions={lawDescriptions}
      feedback={feedback}
      missed={review.missed}
    />
  );
}
