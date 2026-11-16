import { prisma } from "../db";
import { contractTypeLabel, type Severity, lowerLabel } from "../contracts/types";
import { ruleKeyOf, SEVERITY_ORDER, type Finding } from "../review/types";

// Rule calibration: every check builds a track record per contract type from
// reviewers' "useful" / "not relevant" votes, and future reviews adjust to it.
// Deliberately simple and explainable: each adjustment says why, and a
// person's explicit on/off (RuleOverride) always wins.

export type Votes = { useful: number; notRelevant: number };
export type Effect = "muted" | "downgraded" | "promoted";

export type Calibration = {
  votes: Map<string, Votes>; // `${ruleKey}|${contractType}`, plus `${ruleKey}|*` summed over types
  overrides: Map<string, "on" | "off">; // same keys
};

const ALL = "*";
const key = (ruleKey: string, type: string) => `${ruleKey}|${type}`;

// Laplace-smoothed share of "useful" votes, so one vote can't swing a rule.
export const precision = (v: Votes) => (v.useful + 1) / (v.useful + v.notRelevant + 2);

export const THRESHOLDS = {
  mute: { minNotRelevant: 3, maxPrecision: 0.25 },
  downgrade: { minNotRelevant: 2, maxPrecision: 0.45 },
  promote: { minUseful: 3, minPrecision: 0.8 },
  // fall back to votes across all contract types when a type has few of its own
  typeMinVotes: 2,
  globalMinVotes: 5,
};

export async function loadCalibration(): Promise<Calibration> {
  const [groups, overrides] = await Promise.all([
    prisma.findingFeedback.groupBy({ by: ["ruleKey", "contractType", "verdict"], _count: { _all: true } }),
    prisma.ruleOverride.findMany(),
  ]);
  const votes = new Map<string, Votes>();
  const add = (k: string, verdict: string, n: number) => {
    const v = votes.get(k) ?? { useful: 0, notRelevant: 0 };
    if (verdict === "useful") v.useful += n;
    else v.notRelevant += n;
    votes.set(k, v);
  };
  for (const g of groups) {
    add(key(g.ruleKey, g.contractType), g.verdict, g._count._all);
    add(key(g.ruleKey, ALL), g.verdict, g._count._all);
  }
  return { votes, overrides: new Map(overrides.map((o) => [key(o.ruleKey, o.contractType), o.mode as "on" | "off"])) };
}

export type Decision = { effect: Effect | null; votes: Votes; scope: "type" | "all"; override?: "on" | "off" };

export function decide(cal: Calibration, ruleKey: string, contractType: string): Decision {
  const override = cal.overrides.get(key(ruleKey, contractType)) ?? cal.overrides.get(key(ruleKey, ALL));
  const typeVotes = cal.votes.get(key(ruleKey, contractType)) ?? { useful: 0, notRelevant: 0 };
  const allVotes = cal.votes.get(key(ruleKey, ALL)) ?? { useful: 0, notRelevant: 0 };
  const total = (v: Votes) => v.useful + v.notRelevant;
  const useType = total(typeVotes) >= THRESHOLDS.typeMinVotes || total(allVotes) < THRESHOLDS.globalMinVotes;
  const votes = useType ? typeVotes : allVotes;
  const scope = useType ? "type" : "all";

  if (override === "off") return { effect: "muted", votes, scope, override };
  if (override === "on") return { effect: null, votes, scope, override };

  const p = precision(votes);
  let effect: Effect | null = null;
  if (votes.notRelevant >= THRESHOLDS.mute.minNotRelevant && p <= THRESHOLDS.mute.maxPrecision) effect = "muted";
  else if (votes.notRelevant >= THRESHOLDS.downgrade.minNotRelevant && p <= THRESHOLDS.downgrade.maxPrecision) effect = "downgraded";
  else if (votes.useful >= THRESHOLDS.promote.minUseful && p >= THRESHOLDS.promote.minPrecision) effect = "promoted";
  return { effect, votes, scope };
}

// "*" means every contract type.
export const typePlural = (contractType: string) => (contractType === ALL ? "all contract types" : `${lowerLabel(contractTypeLabel(contractType))}s`);

export function explain(d: Decision, contractType: string): string {
  const where = d.scope === "type" && contractType !== ALL ? `for ${typePlural(contractType)}` : "across all contract types";
  if (d.override === "off") return `Switched off by your team ${d.scope === "type" ? where : ""}`.trim() + ".";
  const total = d.votes.useful + d.votes.notRelevant;
  if (d.effect === "promoted") return `${d.votes.useful} of ${total} reviews marked this useful ${where}.`;
  return `${d.votes.notRelevant} of ${total} reviews marked this not relevant ${where}.`;
}

const shift = (s: Severity, by: number): Severity => {
  const i = SEVERITY_ORDER.indexOf(s);
  return SEVERITY_ORDER[Math.min(SEVERITY_ORDER.length - 1, Math.max(0, i + by))];
};

// Returns adjusted copies of the findings. Passed checks are left alone.
export function applyCalibration(findings: Finding[], contractType: string, cal: Calibration): Finding[] {
  return findings.map((f) => {
    if (f.status === "pass") return f;
    const d = decide(cal, ruleKeyOf(f), contractType);
    if (!d.effect) return f;
    const reason = explain(d, contractType);
    if (d.effect === "muted") return { ...f, learning: { effect: "muted", reason, originalSeverity: f.severity } };
    if (d.effect === "downgraded") {
      const severity = shift(f.severity, 1);
      return severity === f.severity ? f : { ...f, severity, learning: { effect: "downgraded", reason, originalSeverity: f.severity } };
    }
    // promotions stop at "high": only the rule itself can call something critical
    if (f.severity === "critical" || f.severity === "high") return f;
    const severity = shift(f.severity, -1);
    return { ...f, severity, learning: { effect: "promoted", reason, originalSeverity: f.severity } };
  });
}
