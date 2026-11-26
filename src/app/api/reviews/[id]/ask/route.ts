import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { answer, buildContext, type AskTurn } from "@/lib/ai/ask";
import { loadCustomClauses } from "@/lib/library/custom";
import type { ReviewResult } from "@/lib/review/types";

export const runtime = "nodejs";
export const maxDuration = 120;

// Answers a question about one reviewed contract, streamed as one JSON event
// per line: the clause/finding references first, then the answer text.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { question?: string; history?: AskTurn[] };
  const question = String(body.question ?? "").trim().slice(0, 2000);
  if (!question) return jsonError("Ask a question.");
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t) => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .map((t) => ({ role: t.role, content: t.content.slice(0, 8000) }));

  const review = await prisma.review.findUnique({ where: { id }, include: { document: { select: { title: true, pagesJson: true } } } });
  if (!review || review.status !== "COMPLETE") return jsonError("This review is not ready yet.", 404);
  const [rules, customs] = await Promise.all([prisma.businessRule.findMany(), loadCustomClauses()]);

  const context = await buildContext({
    title: review.document.title,
    pagesJson: review.document.pagesJson,
    result: JSON.parse(review.resultJson) as ReviewResult,
    riskScore: review.riskScore,
    rules,
    customs,
    question,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const event of answer(context, question, history)) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
