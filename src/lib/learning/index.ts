import { prisma } from "../db";
import { detectContractType } from "../contracts/classify";
import { clauseTypeLabel, contractTypeLabel, type ClauseType, type ContractType, lowerLabel } from "../contracts/types";
import { NearestExamples } from "./classifier";

// What the tool has learned from people: matchers built from confirmed
// contract and clause types, and a log of every change in behaviour.

export type LearnedModels = { contractType: NearestExamples | null; clauseType: NearestExamples | null };

// A confirmed label is followed only for a close match. Measured on our real
// contracts: same template 0.7+, unrelated contracts at most 0.33.
export const CONTRACT_MATCH = 0.5;
export const CLAUSE_MATCH = 0.6;

// Text used to learn a contract's type: its opening, where the title and
// parties sit, flattened like the keyword classifier sees it.
export const contractSample = (fullText: string) => fullText.replace(/\s+/g, " ").slice(0, 6000);
export const clauseSample = (heading: string, text: string) => `${heading} ${text.slice(0, 1500)}`.replace(/\s+/g, " ");

let cache: { version: string; models: LearnedModels } | null = null;

// Rebuilt whenever the set of examples changes; cheap enough to do per request.
export async function loadLearnedModels(): Promise<LearnedModels> {
  const stats = await prisma.trainingExample.aggregate({ _count: { _all: true }, _max: { createdAt: true } });
  const version = `${stats._count._all}:${stats._max.createdAt?.getTime() ?? 0}`;
  if (cache?.version === version) return cache.models;
  const examples = await prisma.trainingExample.findMany({ select: { kind: true, label: true, text: true } });
  const of = (kind: string) => examples.filter((e) => e.kind === kind);
  const models: LearnedModels = {
    contractType: of("contract_type").length ? new NearestExamples(of("contract_type")) : null,
    clauseType: of("clause_type").length ? new NearestExamples(of("clause_type")) : null,
  };
  cache = { version, models };
  return models;
}

export type TypeGuess = { type: ContractType; confidence: number; learned: boolean };

export function guessContractType(fullText: string, models: LearnedModels): TypeGuess {
  const rules = detectContractType(fullText);
  const match = models.contractType?.nearest(contractSample(fullText)) ?? null;
  if (match && match.similarity >= CONTRACT_MATCH && match.label !== rules.type) {
    return { type: match.label as ContractType, confidence: Math.round(match.similarity * 100) / 100, learned: true };
  }
  return { ...rules, learned: false };
}

// The type people gave a closely matching clause, otherwise null.
export function learnedClauseType(heading: string, text: string, models: LearnedModels): ClauseType | null {
  const match = models.clauseType?.nearest(clauseSample(heading, text)) ?? null;
  return match && match.similarity >= CLAUSE_MATCH ? (match.label as ClauseType) : null;
}

export async function logLearning(kind: string, summary: string) {
  await prisma.learningEvent.create({ data: { kind, summary } });
}

// A person confirmed or corrected a contract's type.
export async function learnContractType(documentId: string, title: string, fullText: string, type: ContractType, previous?: string) {
  await prisma.trainingExample.upsert({
    where: { kind_sourceId: { kind: "contract_type", sourceId: documentId } },
    create: { kind: "contract_type", sourceId: documentId, label: type, text: contractSample(fullText) },
    update: { label: type, text: contractSample(fullText) },
  });
  if (previous && previous !== type) {
    await logLearning("contract_type", `Learned that "${title}" is a ${lowerLabel(contractTypeLabel(type))}, not a ${lowerLabel(contractTypeLabel(previous))}.`);
  }
}

// A person corrected a clause's type.
export async function learnClauseType(clauseId: string, heading: string, text: string, type: ClauseType, previous: string) {
  await prisma.trainingExample.upsert({
    where: { kind_sourceId: { kind: "clause_type", sourceId: clauseId } },
    create: { kind: "clause_type", sourceId: clauseId, label: type, text: clauseSample(heading, text) },
    update: { label: type, text: clauseSample(heading, text) },
  });
  if (previous !== type) {
    await logLearning("clause_type", `Learned that a clause headed "${heading.slice(0, 60)}" is ${lowerLabel(clauseTypeLabel(type))}, not ${lowerLabel(clauseTypeLabel(previous))}.`);
  }
}
