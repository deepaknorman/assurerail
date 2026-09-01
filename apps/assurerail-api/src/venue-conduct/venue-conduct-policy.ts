export const CONDUCT_SIGNAL_TYPES = [
  "CONFLICT", "RELATED_PARTY", "FAIR_ACCESS", "ALLOCATION", "COMMUNICATION", "PROHIBITED_ACTION",
] as const;
export type ConductSignalType = (typeof CONDUCT_SIGNAL_TYPES)[number];

export const CONDUCT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const CONDUCT_ALERT_STATUSES = [
  "OPEN", "TRIAGED", "INVESTIGATING", "CLOSED_NO_FINDING", "REMEDIATED", "ESCALATED",
] as const;
export const CONDUCT_CONTROL_TYPES = ["SAFE_PAUSE", "PARTICIPANT_SANCTION"] as const;
export const CONDUCT_CONTROL_SCOPES = [
  "GLOBAL", "ENVIRONMENT", "ROUTE", "COHORT", "INSTITUTION", "CASE", "OPPORTUNITY",
] as const;

export interface ConductEvaluation {
  result: "REVIEW_REQUIRED" | "NO_ALERT";
  evidentialClassification: "REVIEW_REQUIRED" | "NO_INDICATOR_OBSERVED";
  alertCode: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasons: readonly string[];
  autonomousLegalConclusion: false;
}

function booleanFact(facts: Record<string, unknown>, key: string): boolean | null {
  return typeof facts[key] === "boolean" ? facts[key] as boolean : null;
}

/**
 * Deterministic first-line classification. It can only request human review or record that no
 * configured indicator was observed. It cannot decide breach, misconduct, liability or sanction.
 */
export function evaluateConductSignal(type: ConductSignalType, facts: Record<string, unknown>): ConductEvaluation {
  const review = (alertCode: string, severity: ConductEvaluation["severity"], ...reasons: string[]): ConductEvaluation => ({
    result: "REVIEW_REQUIRED", evidentialClassification: "REVIEW_REQUIRED", alertCode, severity,
    reasons, autonomousLegalConclusion: false,
  });
  const clear = (reason: string): ConductEvaluation => ({
    result: "NO_ALERT", evidentialClassification: "NO_INDICATOR_OBSERVED", alertCode: null,
    severity: "LOW", reasons: [reason], autonomousLegalConclusion: false,
  });

  if (type === "CONFLICT") {
    const declared = booleanFact(facts, "conflictDeclared");
    if (declared === null) return review("CONFLICT_FACTS_INCOMPLETE", "HIGH", "conflictDeclared is missing or ambiguous");
    return declared ? review("CONFLICT_DECLARED", "HIGH", "a conflict was declared and requires independent review") : clear("explicit no-conflict declaration recorded");
  }
  if (type === "RELATED_PARTY") {
    const related = booleanFact(facts, "relatedParty");
    if (related === null) return review("RELATED_PARTY_FACTS_INCOMPLETE", "HIGH", "relatedParty is missing or ambiguous");
    return related ? review("RELATED_PARTY_DISCLOSED", "HIGH", "a related-party relationship was disclosed") : clear("explicit non-related-party declaration recorded");
  }
  if (type === "FAIR_ACCESS") {
    const denied = booleanFact(facts, "eligibleParticipantDenied");
    if (denied === null) return review("FAIR_ACCESS_FACTS_INCOMPLETE", "MEDIUM", "eligibleParticipantDenied is missing or ambiguous");
    return denied ? review("FAIR_ACCESS_EXCEPTION", "HIGH", "an apparently eligible participant was denied access") : clear("no fair-access indicator observed");
  }
  if (type === "ALLOCATION") {
    const documented = booleanFact(facts, "allocationBasisDocumented");
    const override = booleanFact(facts, "allocationOverride");
    if (documented === null || override === null) return review("ALLOCATION_FACTS_INCOMPLETE", "MEDIUM", "allocation basis or override fact is ambiguous");
    if (!documented || override) return review("ALLOCATION_REVIEW_REQUIRED", "HIGH", !documented ? "allocation basis is not documented" : "allocation override requires independent review");
    return clear("documented allocation with no override indicator");
  }
  if (type === "COMMUNICATION") {
    const captured = booleanFact(facts, "authorisedChannelCaptured");
    if (captured === null) return review("COMMUNICATION_FACTS_INCOMPLETE", "MEDIUM", "authorisedChannelCaptured is missing or ambiguous");
    return captured ? clear("communication evidence is captured in an authorised channel") : review("OFF_CHANNEL_COMMUNICATION", "HIGH", "communication was not captured in an authorised channel");
  }
  const code = typeof facts.prohibitedActionCode === "string" ? facts.prohibitedActionCode.trim() : "";
  if (!code) return review("PROHIBITED_ACTION_FACTS_INCOMPLETE", "CRITICAL", "prohibitedActionCode is missing");
  return review(`PROHIBITED_ACTION:${code}`, "CRITICAL", "a configured prohibited-action indicator requires immediate human review and safe-pause consideration");
}

const UNSIGNED_INTEGER = /^(0|[1-9][0-9]*)$/;

export function capacityState(observed: string, warning: string, hard: string): "WITHIN" | "WARNING" | "HARD_LIMIT" {
  if (![observed, warning, hard].every((value) => UNSIGNED_INTEGER.test(value))) {
    throw new Error("capacity values must be canonical non-negative integer strings");
  }
  const observedValue = BigInt(observed);
  const warningValue = BigInt(warning);
  const hardValue = BigInt(hard);
  if (warningValue <= 0n || hardValue <= warningValue) throw new Error("capacity thresholds must satisfy 0 < warning < hard");
  if (observedValue >= hardValue) return "HARD_LIMIT";
  if (observedValue >= warningValue) return "WARNING";
  return "WITHIN";
}

export function assertBoundedControlWindow(effectiveFrom: Date, expiresAt: Date, maximumDays = 31): void {
  if (!Number.isFinite(effectiveFrom.getTime()) || !Number.isFinite(expiresAt.getTime())) throw new Error("control dates are invalid");
  if (expiresAt <= effectiveFrom) throw new Error("control expiry must follow effective time");
  if (expiresAt.getTime() - effectiveFrom.getTime() > maximumDays * 86_400_000) throw new Error(`control duration cannot exceed ${maximumDays} days`);
}
