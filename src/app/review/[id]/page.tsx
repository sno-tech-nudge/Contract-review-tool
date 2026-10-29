import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { aiEnabled } from "@/lib/ai/claude";
import { LAWS } from "@/lib/checks/legal/rules";
import type { ReviewResult } from "@/lib/review/types";
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id }, select: { document: { select: { title: true } } } });
  return { title: review ? `${review.document.title} · Contract review` : "Review not found" };
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id }, include: { document: true } });
  if (!review) notFound();
  const d = review.document;
  const lawDescriptions = Object.fromEntries(Object.values(LAWS).map((l) => [l.label, l.description]));

  return (
    <ReviewWorkspace
      review={{ id: review.id, createdAt: review.createdAt.toISOString(), riskScore: review.riskScore }}
      result={JSON.parse(review.resultJson) as ReviewResult}
      document={{ id: d.id, title: d.title, fileName: d.fileName, mimeType: d.mimeType, pageCount: d.pageCount, text: d.mimeType === "text/plain" ? d.text : "" }}
      aiAvailable={aiEnabled()}
      lawDescriptions={lawDescriptions}
    />
  );
}
