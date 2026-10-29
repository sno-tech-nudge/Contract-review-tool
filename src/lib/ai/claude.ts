import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Finding, KeyTerm } from "../review/types";

// Optional AI layer. The rule-based checks always run; when an Anthropic API
// key is configured, Claude adds a plain-language summary, key terms and any
// risks the rules did not catch.

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
}

const AiReview = z.object({
  summary: z.string().describe("3 to 5 plain sentences: what the contract is, who it binds, the money and timeline, and the most important concerns."),
  key_terms: z
    .array(z.object({ label: z.string(), value: z.string(), quote: z.string().describe("Exact text copied from the contract that supports this value.") }))
    .describe("Parties, value, term, key dates, payment schedule, notice period, governing law, dispute forum."),
  risks: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        severity: z.enum(["critical", "high", "medium", "low"]),
        category: z.string().describe("Short area, e.g. Payment, Liability, FCRA, Reporting burden."),
        quote: z.string().describe("Exact text copied from the contract, under 300 characters."),
        recommendation: z.string(),
      })
    )
    .describe("Risks not already covered by the automated findings. At most 8. Empty if none."),
});

const SYSTEM = `You review contracts for The/Nudge, an Indian non-profit (legal entity: Nudge Lifeskills Foundation) working on livelihoods and poverty alleviation. Contracts are mostly grant, CSR, partnership, MoU, vendor and consultancy agreements.

Review from the non-profit's side. Pay attention to obligations that are hard for a non-profit to meet (reporting burden, refund and clawback triggers, unlimited liability, IP over programme materials, data on beneficiaries), and to Indian regulatory exposure (FCRA, CSR rules, income-tax registrations, GST, DPDP Act, stamp duty).

You will also receive the findings an automated rule engine already produced. Do not repeat them. Add only risks a careful lawyer would raise that those findings miss. Quote the contract exactly so the reviewer can locate the text. Write in plain UK English, without legal jargon where a simpler word works.`;

export async function aiReview(input: { title: string; contractType: string; text: string; findings: Finding[] }): Promise<{ summary: string; keyTerms: KeyTerm[]; findings: Finding[] }> {
  const client = new Anthropic();
  const existing = input.findings
    .filter((f) => f.status !== "pass")
    .map((f) => `- [${f.check}/${f.severity}] ${f.title}: ${f.detail}`)
    .join("\n");

  const response = await client.beta.messages.parse({
    model: aiModel(),
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: zodOutputFormat(AiReview) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Contract title: ${input.title}\nDetected type: ${input.contractType}\n\nAutomated findings already reported:\n${existing || "(none)"}\n\n<contract>\n${input.text}\n</contract>`,
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("The model declined to review this document.");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("The AI review returned an unexpected format.");

  return {
    summary: parsed.summary,
    keyTerms: parsed.key_terms.map((k) => ({ label: k.label, value: k.value, quote: k.quote })),
    findings: parsed.risks.map((r, i) => ({
      id: `ai-${i + 1}`,
      check: "ai",
      category: r.category,
      title: r.title,
      detail: r.detail,
      severity: r.severity,
      status: "issue",
      quote: r.quote,
      recommendation: r.recommendation,
    })),
  };
}
