import { decide, explain, loadCalibration, typePlural, type Decision } from "./calibration";
import { logLearning } from ".";

// Records a learning event when a change (a vote, an override) shifts how a
// rule behaves for a contract type. Call with the decision from before.
export async function noteRuleChange(ruleKey: string, title: string, contractType: string, before: Decision): Promise<Decision> {
  const after = decide(await loadCalibration(), ruleKey, contractType);
  if (after.effect === before.effect) return after;
  const forType = after.scope === "type" ? ` for ${typePlural(contractType)}` : "";
  const why = explain(after, contractType);
  const summary =
    after.effect === "muted"
      ? `Muted "${title}"${forType}. ${why}`
      : after.effect === "downgraded"
        ? `Lowered the severity of "${title}"${forType}. ${why}`
        : after.effect === "promoted"
          ? `Raised the severity of "${title}"${forType}. ${why}`
          : `"${title}" is back to normal${forType}.`;
  await logLearning("rule", summary);
  return after;
}

export async function decisionNow(ruleKey: string, contractType: string): Promise<Decision> {
  return decide(await loadCalibration(), ruleKey, contractType);
}
