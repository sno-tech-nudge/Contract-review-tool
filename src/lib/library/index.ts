import { prisma } from "../db";
import { clauseTypeLabel, CLAUSE_TYPE_KEYS, CONTRACT_TYPE_KEYS, lowerLabel, type ClauseType, type ContractType } from "../contracts/types";
import { clauseSample, logLearning } from "../learning";
import { interpretClause, joinTypes, splitTypes, validForPhrase } from "./interpret";
import type { ParsedTopic } from "./parse";

// The standard clause library: the team's approved wording per topic, with a
// standard version and alternatives that say where each one applies. Every
// imported version also trains the clause classifier, so contract clauses
// worded like it are recognised as the same kind of clause.

export type LibraryEntry = {
  id: string;
  topic: string;
  clauseType: string;
  variant: string;
  label: string;
  title: string;
  text: string;
  validFor: string;
  jurisdiction: string;
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const exampleId = (id: string) => `library:${id}`;

// Library clauses typed "other" (share plans and the like) are not used as
// examples: they would teach the classifier to drop real clauses into "other".
async function syncTrainingExample(clause: { id: string; topic: string; title: string; text: string; clauseType: string }) {
  const sourceId = exampleId(clause.id);
  if (clause.clauseType === "other") {
    await prisma.trainingExample.deleteMany({ where: { kind: "clause_type", sourceId } });
    return;
  }
  const text = clauseSample(clause.title || clause.topic, clause.text);
  await prisma.trainingExample.upsert({
    where: { kind_sourceId: { kind: "clause_type", sourceId } },
    create: { kind: "clause_type", sourceId, label: clause.clauseType, text },
    update: { label: clause.clauseType, text },
  });
}

export async function importLibrary(topics: ParsedTopic[], source: string) {
  let added = 0;
  let updated = 0;
  let usLaw = 0;
  const seen = new Set<string>();
  let position = await prisma.libraryClause.count();
  for (const t of topics) {
    for (const v of t.variants) {
      let key = `${slug(t.topic)}|${v.variant}|${slug(v.label)}`;
      for (let n = 2; seen.has(key); n++) key = `${slug(t.topic)}|${v.variant}|${slug(v.label)}-${n}`;
      seen.add(key);
      const read = interpretClause({ topic: t.topic, ...v });
      if (read.jurisdiction) usLaw++;
      const existing = await prisma.libraryClause.findUnique({ where: { key } });
      const wording = { topic: t.topic, variant: v.variant, label: v.label, title: v.title, text: v.text, source, jurisdiction: read.jurisdiction };
      const saved = existing
        ? await prisma.libraryClause.update({
            where: { key },
            // keep a person's corrections over the automatic reading
            data: existing.edited ? wording : { ...wording, clauseType: read.clauseType, validFor: joinTypes(read.validFor) },
          })
        : await prisma.libraryClause.create({ data: { key, ...wording, clauseType: read.clauseType, validFor: joinTypes(read.validFor), position: position++ } });
      if (existing) updated++;
      else added++;
      await syncTrainingExample(saved);
    }
  }
  const total = added + updated;
  if (total) {
    await logLearning(
      "library",
      `Learned ${total} standard clause${total === 1 ? "" : "s"} across ${topics.length} topic${topics.length === 1 ? "" : "s"} from "${source}"` +
        (updated ? ` (${updated} updated)` : "") +
        (usLaw ? `; ${usLaw} rest on US law and are flagged if they appear in a contract` : "") +
        ". Reviews now compare clauses against them and check each version is used in the right kind of contract."
    );
  }
  return { added, updated, topics: topics.length, usLaw };
}

export async function loadLibrary(): Promise<LibraryEntry[]> {
  return prisma.libraryClause.findMany({
    orderBy: [{ position: "asc" }],
    select: { id: true, topic: true, clauseType: true, variant: true, label: true, title: true, text: true, validFor: true, jurisdiction: true },
  });
}

// A person corrected how a version is read: its clause type or where it applies.
export async function updateLibraryClause(id: string, change: { clauseType?: string; validFor?: string[] }) {
  const before = await prisma.libraryClause.findUniqueOrThrow({ where: { id } });
  const data: { clauseType?: ClauseType; validFor?: string; edited: true } = { edited: true };
  if (change.clauseType && (CLAUSE_TYPE_KEYS as string[]).includes(change.clauseType)) data.clauseType = change.clauseType as ClauseType;
  if (change.validFor) data.validFor = joinTypes(change.validFor.filter((t) => (CONTRACT_TYPE_KEYS as string[]).includes(t)));
  const after = await prisma.libraryClause.update({ where: { id }, data });
  await syncTrainingExample(after);

  const name = `"${after.topic}" (${after.label})`;
  if (data.clauseType && data.clauseType !== before.clauseType) {
    await logLearning("library", `Learned that the library clause ${name} is ${lowerLabel(clauseTypeLabel(data.clauseType))}, not ${lowerLabel(clauseTypeLabel(before.clauseType))}.`);
  }
  if (data.validFor !== undefined && data.validFor !== before.validFor) {
    await logLearning("library", `The library clause ${name} now applies to ${validForPhrase(splitTypes(data.validFor))}, previously ${validForPhrase(splitTypes(before.validFor))}.`);
  }
  return after;
}

export async function deleteLibraryClause(id: string) {
  await prisma.trainingExample.deleteMany({ where: { kind: "clause_type", sourceId: exampleId(id) } });
  await prisma.libraryClause.delete({ where: { id } });
}

export const libraryValidFor = (entry: { validFor: string }): ContractType[] => splitTypes(entry.validFor);
