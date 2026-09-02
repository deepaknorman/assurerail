import { exactMoney, sha256Digest, toCanonicalValue, type CanonicalValue } from "../contracts/v1";

export const LIFECYCLE_EVENT_FUNCTION = {
  COLLECTION_RECEIPT: "SERVICING_AND_COLLECTION_ACCOUNT",
  SERVICER_REPORT: "SERVICING_AND_COLLECTION_ACCOUNT",
  WATERFALL_CALCULATION: "LIFECYCLE_CALCULATION",
  DISTRIBUTION_PAYMENT: "CASH_SETTLEMENT",
  NOTICE_DELIVERY: "DISCLOSURES",
  TRIGGER_TEST: "SURVEILLANCE",
  SUBSTITUTION: "POOL_TRANSFER_AND_ELIGIBILITY",
  REPURCHASE: "POOL_TRANSFER_AND_ELIGIBILITY",
  DEFAULT_EVENT: "DEFAULT_HANDLING",
  MATURITY_REDEMPTION: "AUTHORITATIVE_REGISTER_UPDATE",
} as const;

export type LifecycleEventType = keyof typeof LIFECYCLE_EVENT_FUNCTION;

export interface LifecycleObligationInput {
  obligationKey: string;
  eventType: LifecycleEventType;
  sequence: number;
  accountableInstitutionId: string;
  performerClass: string;
  dueAt: string;
  required?: boolean;
  expected: unknown;
  amount?: { currency: unknown; units: unknown; scale: unknown };
}
export function lifecycleFunction(eventType: unknown): string {
  if (typeof eventType !== "string" || !(eventType in LIFECYCLE_EVENT_FUNCTION)) {
    throw new Error(`eventType must be one of: ${Object.keys(LIFECYCLE_EVENT_FUNCTION).join(", ")}`);
  }
  return LIFECYCLE_EVENT_FUNCTION[eventType as LifecycleEventType];
}

export function normaliseLifecycleObligation(input: LifecycleObligationInput) {
  if (!input.obligationKey?.trim() || input.obligationKey.length > 120) throw new Error("obligationKey is required and must not exceed 120 characters");
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) throw new Error("sequence must be a positive safe integer");
  const dueAt = new Date(input.dueAt);
  if (!Number.isFinite(dueAt.getTime())) throw new Error("dueAt must be an ISO-8601 timestamp");
  const expected = toCanonicalValue(input.expected);
  if (expected === null || Array.isArray(expected) || typeof expected !== "object") throw new Error("expected must be a JSON object");
  const amount = input.amount ? exactMoney(input.amount) : null;
  return {
    obligationKey: input.obligationKey.trim(), eventType: input.eventType,
    sequence: input.sequence, materialFunction: lifecycleFunction(input.eventType),
    accountableInstitutionId: input.accountableInstitutionId?.trim(),
    performerClass: input.performerClass?.trim(), dueAt,
    required: input.required !== false, expected: expected as CanonicalValue,
    expectedDigest: sha256Digest(expected), amount,
  };
}

export function compareLifecycleObservation(expectedDigest: string, observed: unknown) {
  const canonical = toCanonicalValue(observed);
  if (canonical === null || Array.isArray(canonical) || typeof canonical !== "object") throw new Error("observed must be a JSON object");
  const observedDigest = sha256Digest(canonical);
  return {
    observed: canonical,
    observedDigest,
    comparisonResult: observedDigest === expectedDigest ? "MATCHED" as const : "BREAK_OPEN" as const,
    comparison: { expectedDigest, observedDigest, exactCanonicalMatch: observedDigest === expectedDigest },
  };
}

export function deriveLifecyclePlanState(
  obligations: readonly { required: boolean; state: string }[],
  openBreaks: number,
): "ACTIVE" | "BREAK_OPEN" | "RECONCILED" {
  if (openBreaks > 0 || obligations.some((item) => item.state === "BREAK_OPEN")) return "BREAK_OPEN";
  const required = obligations.filter((item) => item.required);
  if (required.length > 0 && required.every((item) => item.state === "RECONCILED")) return "RECONCILED";
  return "ACTIVE";
}
