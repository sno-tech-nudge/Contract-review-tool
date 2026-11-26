// Accuracy test set: runs the review pipeline over real contracts and scores
// it against hand-checked answers. `npm run eval` prints per-contract and
// overall scores, saves them to eval/results/latest.json, and fails if any
// overall score drops below eval/baseline.json. `npm run eval -- --save`
// makes the current scores the new baseline.
//
// The contracts and their answers live in eval/gold/ (git-ignored: they are
// confidential). Each case is eval/gold/cases/<name>.json:
//   file, ocr?           the contract and, for scans, the OCR pages
//   contractType         the correct type
//   sections             top-level headings that must start a clause
//   present / absent     clause types that are / are not in the contract
//   parties, amount      text that must appear in the extracted key terms
//   must / mustNot       finding rule-key prefixes that must / must not appear
//   maxSegments          more clauses than this means the splitter fragmented it

import fs from "node:fs";
import path from "node:path";
import { extractText, mergeOcr } from "../../src/lib/extract";
import { DocText } from "../../src/lib/text/locate";
import { detectContractType } from "../../src/lib/contracts/classify";
import { segment } from "../../src/lib/contracts/segment";
import { runBoilerplateCheck } from "../../src/lib/checks/boilerplate";
import { runLegalCheck } from "../../src/lib/checks/legal";
import { extractKeyTerms } from "../../src/lib/checks/keyterms";
import { BASELINE_EXPECTED, type ClauseType, type ContractType } from "../../src/lib/contracts/types";
import { applyLearnedTypes, embedReview } from "../../src/lib/review/semantic";
import type { LibraryEntry } from "../../src/lib/library";

// The clause library and people's corrections come from the local database
// when it is running, so the test set exercises the same meaning layer as a
// review. Without it (or with --words-only) only word matching is tested.
async function loadLearning(): Promise<{ library: LibraryEntry[]; examples: { label: string; text: string; fromPerson: boolean }[] } | null> {
  if (process.argv.includes("--words-only")) return null;
  try {
    const { loadLibrary } = await import("../../src/lib/library");
    const { clauseExamples } = await import("../../src/lib/learning");
    return { library: await loadLibrary(), examples: await clauseExamples() };
  } catch {
    return null;
  }
}
let learning: Awaited<ReturnType<typeof loadLearning>> = null;

type Case = {
  name: string;
  file: string;
  ocr?: string;
  contractType: ContractType;
  sections: string[];
  present: ClauseType[];
  absent: ClauseType[];
  parties: string[];
  amount: string[];
  must: string[];
  mustNot: string[];
  maxSegments: number;
};

const ROOT = path.resolve(__dirname, "../..");
const GOLD = path.join(ROOT, "eval/gold");
const RESULTS = path.join(ROOT, "eval/results");
const BASELINE = path.join(ROOT, "eval/baseline.json");

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 100);

// A clause made of table cells or OCR debris rather than prose.
function isNoise(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  const words = t.match(/[A-Za-z]{3,}/g) ?? [];
  const letters = (t.match(/[A-Za-z]/g) ?? []).length;
  return words.length < 8 || letters / Math.max(1, t.length) < 0.6;
}

async function readCase(c: Case) {
  const buffer = fs.readFileSync(path.join(GOLD, "files", c.file));
  const ocr = c.ocr ? JSON.parse(fs.readFileSync(path.join(GOLD, "files", c.ocr), "utf8")) : undefined;
  const extracted = await extractText(buffer, "application/pdf");
  const doc = new DocText(mergeOcr(extracted.pages, ocr).pages);
  return { case: c, doc, segments: segment(doc) };
}
type Read = Awaited<ReturnType<typeof readCase>>;

// Each contract is reviewed with the other contracts as its repository, as
// it would be in use.
async function runCase(r: Read, others: Read[]) {
  const { case: c, doc } = r;
  const repository = others.map((o) => ({
    id: o.case.file,
    title: o.case.name,
    contractType: o.case.contractType,
    isTemplate: false,
    text: o.doc.full,
    clauses: o.segments.map((s) => ({ heading: s.heading, text: s.text, clauseType: s.type })),
  }));

  const type = detectContractType(doc.full).type;
  let segments = r.segments;
  const semantic = learning ? await embedReview({ segments, repositoryClauses: repository.flatMap((d) => d.clauses), libraryClauses: learning.library }) : null;
  if (semantic && learning) segments = await applyLearnedTypes(segments, semantic.segments, learning.examples);
  const boilerplate = runBoilerplateCheck({ doc, segments, contractType: c.contractType, repository, library: learning?.library ?? [], semantic });
  const legal = runLegalCheck(doc, c.contractType, new Set());
  const keyTerms = extractKeyTerms(doc);
  const findings = [...boilerplate.findings, ...legal.findings];

  // sections: each gold heading starts some clause
  const headings = segments.map((s) => norm(`${s.section ?? ""} ${s.heading}`));
  const sectionsFound = c.sections.filter((h) => headings.some((x) => x.includes(norm(h))));

  // clause types: does some clause carry each type that is there, and none that is not?
  const detected = new Set(segments.flatMap((s) => s.types));
  const typeHits = c.present.filter((t) => detected.has(t));
  const typeWrong = c.absent.filter((t) => detected.has(t));

  // missing-clause findings, scored only on types the answers cover
  const expected = new Set(BASELINE_EXPECTED[c.contractType]);
  const flagged = new Set(findings.map((f) => f.ruleKey ?? "").filter((k) => k.startsWith("bp:missing:")).map((k) => k.slice("bp:missing:".length)));
  const falseMissing = c.present.filter((t) => expected.has(t) && flagged.has(t));
  const rightMissing = c.absent.filter((t) => expected.has(t) && flagged.has(t));
  const missedMissing = c.absent.filter((t) => expected.has(t) && !flagged.has(t));

  const termText = norm(keyTerms.map((k) => `${k.label} ${k.value}`).join(" | "));
  const partiesFound = c.parties.filter((p) => termText.includes(norm(p)));
  const amountFound = !c.amount.length || c.amount.some((a) => keyTerms.some((k) => k.value.replace(/\s/g, "").includes(a)));

  // only raised findings count; a check that passed is not an alarm
  const keys = findings.filter((f) => f.status !== "pass").map((f) => f.ruleKey ?? "");
  const mustMissing = c.must.filter((p) => !keys.some((k) => k.startsWith(p)));
  const forbidden = c.mustNot.flatMap((p) => keys.filter((k) => k.startsWith(p)));

  const noise = segments.filter((s) => isNoise(s.text)).length;
  const wordingWarnings = findings.filter((f) => f.status === "warning" && (f.ruleKey ?? "").startsWith("bp:wording")).length;
  return {
    name: c.name,
    type: { got: type, want: c.contractType, ok: type === c.contractType },
    sections: { found: sectionsFound.length, of: c.sections.length, missing: c.sections.filter((h) => !sectionsFound.includes(h)) },
    segments: { count: segments.length, max: c.maxSegments, noise },
    clauseTypes: { hits: typeHits.length, of: c.present.length, missed: c.present.filter((t) => !detected.has(t)), wrong: typeWrong },
    missingFindings: { falseAlarms: falseMissing, correct: rightMissing.length, missed: missedMissing },
    keyTerms: { parties: partiesFound.length, of: c.parties.length, amount: amountFound },
    findings: { mustMissing, forbidden },
    wordingWarnings,
  };
}

type Result = Awaited<ReturnType<typeof runCase>>;

function summarise(results: Result[]) {
  const sum = (f: (r: Result) => number) => results.reduce((n, r) => n + f(r), 0);
  const flaggedRight = sum((r) => r.missingFindings.correct);
  const flaggedWrong = sum((r) => r.missingFindings.falseAlarms.length);
  return {
    contractType: pct(sum((r) => +r.type.ok), results.length),
    sections: pct(sum((r) => r.sections.found), sum((r) => r.sections.of)),
    clauseTypeRecall: pct(sum((r) => r.clauseTypes.hits), sum((r) => r.clauseTypes.of)),
    clauseTypeWrong: sum((r) => r.clauseTypes.wrong.length),
    missingClausePrecision: pct(flaggedRight, flaggedRight + flaggedWrong),
    missingClauseRecall: pct(flaggedRight, flaggedRight + sum((r) => r.missingFindings.missed.length)),
    noiseClauses: pct(sum((r) => r.segments.noise), sum((r) => r.segments.count)),
    fragmented: sum((r) => +(r.segments.count > r.segments.max)),
    parties: pct(sum((r) => r.keyTerms.parties), sum((r) => r.keyTerms.of)),
    amounts: pct(sum((r) => +r.keyTerms.amount), results.length),
    forbiddenFindings: sum((r) => r.findings.forbidden.length),
    requiredFindingsMissing: sum((r) => r.findings.mustMissing.length),
    wordingWarnings: sum((r) => r.wordingWarnings),
  };
}

// Scores where higher is better; the rest are counts where lower is better.
const HIGHER = ["contractType", "sections", "clauseTypeRecall", "missingClausePrecision", "missingClauseRecall", "parties", "amounts"];

async function main() {
  const casesDir = path.join(GOLD, "cases");
  if (!fs.existsSync(casesDir)) {
    console.log("No test set found in eval/gold/cases. See the comment at the top of scripts/eval/run.ts.");
    return;
  }
  const only = process.argv.find((a) => a.startsWith("--case="))?.slice(7);
  const cases = fs
    .readdirSync(casesDir)
    .filter((f) => f.endsWith(".json") && (!only || f.startsWith(only)))
    .map((f) => ({ absent: [], present: [], sections: [], parties: [], amount: [], must: [], mustNot: [], maxSegments: 999, ...JSON.parse(fs.readFileSync(path.join(casesDir, f), "utf8")) }) as Case);

  learning = await loadLearning();
  console.log(learning ? `Meaning layer on: ${learning.library.length} library clauses, ${learning.examples.filter((e) => e.fromPerson).length} corrections` : "Word matching only");
  const read: Read[] = [];
  for (const c of cases) read.push(await readCase(c));
  const results: Result[] = [];
  for (const one of read) {
    const r = await runCase(one, read.filter((o) => o !== one));
    results.push(r);
    const flag = (ok: boolean) => (ok ? "ok  " : "FAIL");
    console.log(`\n${r.name}`);
    console.log(`  ${flag(r.type.ok)} contract type: ${r.type.got}${r.type.ok ? "" : ` (want ${r.type.want})`}`);
    console.log(`  ${flag(!r.sections.missing.length)} sections ${r.sections.found}/${r.sections.of}${r.sections.missing.length ? `, missing: ${r.sections.missing.join("; ")}` : ""}`);
    console.log(`  ${flag(r.segments.count <= r.segments.max && r.segments.noise <= 2)} clauses ${r.segments.count} (max ${r.segments.max}), ${r.segments.noise} noise`);
    console.log(`  ${flag(!r.clauseTypes.missed.length && !r.clauseTypes.wrong.length)} clause types ${r.clauseTypes.hits}/${r.clauseTypes.of}${r.clauseTypes.missed.length ? `, not detected: ${r.clauseTypes.missed.join(", ")}` : ""}${r.clauseTypes.wrong.length ? `, wrongly detected: ${r.clauseTypes.wrong.join(", ")}` : ""}`);
    console.log(`  ${flag(!r.missingFindings.falseAlarms.length && !r.missingFindings.missed.length)} missing-clause findings: ${r.missingFindings.correct} right${r.missingFindings.falseAlarms.length ? `, false alarms: ${r.missingFindings.falseAlarms.join(", ")}` : ""}${r.missingFindings.missed.length ? `, not flagged: ${r.missingFindings.missed.join(", ")}` : ""}`);
    console.log(`  ${flag(r.keyTerms.parties === r.keyTerms.of && r.keyTerms.amount)} key terms: parties ${r.keyTerms.parties}/${r.keyTerms.of}, amount ${r.keyTerms.amount ? "found" : "not found"}`);
    if (r.findings.forbidden.length || r.findings.mustMissing.length) console.log(`  FAIL findings: ${[...r.findings.forbidden.map((k) => `unexpected ${k}`), ...r.findings.mustMissing.map((k) => `missing ${k}`)].join(", ")}`);
  }

  const summary = summarise(results);
  console.log("\nOverall");
  const baseline = fs.existsSync(BASELINE) ? (JSON.parse(fs.readFileSync(BASELINE, "utf8")) as typeof summary) : null;
  const worse: string[] = [];
  for (const [k, v] of Object.entries(summary)) {
    const before = baseline?.[k as keyof typeof summary];
    const higher = HIGHER.includes(k);
    const delta = before === undefined ? "" : v === before ? "" : ` (was ${before})`;
    if (before !== undefined && (higher ? v < before : v > before)) worse.push(k);
    console.log(`  ${k.padEnd(24)} ${String(v).padStart(6)}${higher ? "%" : " "}${delta}`);
  }

  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(path.join(RESULTS, "latest.json"), JSON.stringify({ at: new Date().toISOString(), summary, results }, null, 1));
  if (process.argv.includes("--save")) {
    fs.writeFileSync(BASELINE, JSON.stringify(summary, null, 1) + "\n");
    console.log("\nSaved as the new baseline.");
  } else if (worse.length) {
    console.log(`\nWorse than the baseline: ${worse.join(", ")}`);
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode ?? 0));
