export const CASE_STATUSES = [
  "DRAFT",
  "INTAKE_OPEN",
  "EVIDENCE_LOCKED",
  "REVIEW_PENDING",
  "APPROVED_FOR_EXECUTION",
  "EXECUTION_PENDING",
  "COMPLETION_PENDING",
  "COMPLETED",
  "BLOCKED",
  "CANCELLED",
  "FAILED",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

const TRANSITIONS: Readonly<Record<CaseStatus, readonly CaseStatus[]>> = {
  DRAFT: ["INTAKE_OPEN", "BLOCKED", "CANCELLED"],
  INTAKE_OPEN: ["EVIDENCE_LOCKED", "BLOCKED", "CANCELLED"],
  EVIDENCE_LOCKED: ["REVIEW_PENDING", "BLOCKED", "CANCELLED"],
  REVIEW_PENDING: ["APPROVED_FOR_EXECUTION", "BLOCKED", "CANCELLED"],
  APPROVED_FOR_EXECUTION: ["EXECUTION_PENDING", "BLOCKED", "CANCELLED"],
  EXECUTION_PENDING: ["COMPLETION_PENDING", "BLOCKED", "FAILED"],
  COMPLETION_PENDING: ["COMPLETED", "BLOCKED", "FAILED"],
  BLOCKED: ["INTAKE_OPEN", "EVIDENCE_LOCKED", "REVIEW_PENDING", "APPROVED_FOR_EXECUTION", "EXECUTION_PENDING", "COMPLETION_PENDING", "CANCELLED", "FAILED"],
  COMPLETED: [], CANCELLED: [], FAILED: [],
};

export interface CaseGuardFacts {
  readonly activePartyCount: number;
  readonly functionAssignmentCount: number;
  readonly prohibitedFunctionCount: number;
  readonly evidenceCount: number;
  readonly unavailableEvidenceCount: number;
  readonly openPrecedentConditionCount: number;
  readonly approvedCaseDecisionCount: number;
  readonly externalSagaReady: boolean;
  readonly completionReconciled: boolean;
  readonly cancellationApproved: boolean;
  readonly blockReasonPresent: boolean;
  readonly recoveryTarget?: CaseStatus | null;
}

export interface CaseGuardDecision {
  readonly allowed: boolean;
  readonly code: string;
  readonly checks: readonly { code: string; passed: boolean; observed: string }[];
}

export interface ReplayTransition {
  readonly id: unknown;
  readonly fromStatus: unknown;
  readonly toStatus: unknown;
  readonly expectedVersion: unknown;
  readonly resultingVersion: unknown;
}

export interface CaseReplayResult {
  readonly replayStatus: string;
  readonly previousResultingVersion: number;
  readonly failures: readonly string[];
}

/** Replays only the state spine; non-transition mutations may legitimately create aggregate gaps. */
export function replayCaseTransitions(transitions: readonly ReplayTransition[], expectedStatus: string): CaseReplayResult {
  let replayStatus = "DRAFT";
  let previousResultingVersion = 0;
  const failures: string[] = [];
  for (const item of transitions) {
    const expectedVersion = Number(item.expectedVersion);
    const resultingVersion = Number(item.resultingVersion);
    if (item.fromStatus !== replayStatus
      || !Number.isSafeInteger(expectedVersion)
      || !Number.isSafeInteger(resultingVersion)
      || resultingVersion !== expectedVersion + 1
      || expectedVersion <= previousResultingVersion) {
      failures.push(String(item.id));
    }
    replayStatus = String(item.toStatus);
    previousResultingVersion = resultingVersion;
  }
  if (replayStatus !== expectedStatus) failures.push("TERMINAL_STATUS_MISMATCH");
  return { replayStatus, previousResultingVersion, failures };
}

function decision(code: string, checks: CaseGuardDecision["checks"]): CaseGuardDecision {
  return { allowed: checks.every((check) => check.passed), code, checks };
}

function continuingEvidence(facts: CaseGuardFacts): CaseGuardDecision["checks"] {
  return [
    { code: "EVIDENCE_PRESENT", passed: facts.evidenceCount > 0, observed: String(facts.evidenceCount) },
    { code: "EVIDENCE_REMAINS_AVAILABLE", passed: facts.unavailableEvidenceCount === 0, observed: String(facts.unavailableEvidenceCount) },
  ];
}

/** Common state spine only. Route packs add facts; labels never manufacture those facts. */
export function evaluateCaseTransition(from: CaseStatus, to: CaseStatus, facts: CaseGuardFacts): CaseGuardDecision {
  if (!CASE_STATUSES.includes(from) || !CASE_STATUSES.includes(to)) return { allowed: false, code: "UNKNOWN_CASE_STATE", checks: [] };
  if (!TRANSITIONS[from].includes(to)) return { allowed: false, code: "ILLEGAL_CASE_TRANSITION", checks: [] };
  if (to === "BLOCKED") return decision("BLOCK_RECORDED", [{ code: "BLOCK_REASON_PRESENT", passed: facts.blockReasonPresent, observed: String(facts.blockReasonPresent) }]);
  if (to === "CANCELLED") return decision("CANCELLATION_GUARD", [{ code: "CANCELLATION_APPROVED", passed: facts.cancellationApproved, observed: String(facts.cancellationApproved) }]);
  if (to === "FAILED") return decision("FAILURE_RECORDED", [{ code: "BLOCK_REASON_PRESENT", passed: facts.blockReasonPresent, observed: String(facts.blockReasonPresent) }]);
  const recoveryChecks: CaseGuardDecision["checks"] = from === "BLOCKED"
    ? [{ code: "RECOVERY_TARGET_MATCHES", passed: facts.recoveryTarget === to, observed: String(facts.recoveryTarget ?? "missing") }]
    : [];
  if (to === "INTAKE_OPEN") return decision("INTAKE_OPEN_GUARD", [
    ...recoveryChecks,
    { code: "TWO_ACTIVE_PARTIES", passed: facts.activePartyCount >= 2, observed: String(facts.activePartyCount) },
  ]);
  if (to === "EVIDENCE_LOCKED") return decision("EVIDENCE_LOCK_GUARD", [
    ...recoveryChecks,
    { code: "EVIDENCE_PRESENT", passed: facts.evidenceCount > 0, observed: String(facts.evidenceCount) },
    { code: "EVIDENCE_AVAILABLE", passed: facts.unavailableEvidenceCount === 0, observed: String(facts.unavailableEvidenceCount) },
  ]);
  if (to === "REVIEW_PENDING") return decision("REVIEW_GUARD", [
    ...recoveryChecks,
    ...continuingEvidence(facts),
    { code: "FUNCTIONS_ASSIGNED", passed: facts.functionAssignmentCount > 0, observed: String(facts.functionAssignmentCount) },
    { code: "NO_PROHIBITED_REQUIRED_FUNCTION", passed: facts.prohibitedFunctionCount === 0, observed: String(facts.prohibitedFunctionCount) },
  ]);
  if (to === "APPROVED_FOR_EXECUTION") return decision("EXECUTION_APPROVAL_GUARD", [
    ...recoveryChecks,
    ...continuingEvidence(facts),
    { code: "PRECEDENT_CONDITIONS_RESOLVED", passed: facts.openPrecedentConditionCount === 0, observed: String(facts.openPrecedentConditionCount) },
    { code: "INDEPENDENT_CASE_DECISION_APPROVED", passed: facts.approvedCaseDecisionCount > 0, observed: String(facts.approvedCaseDecisionCount) },
  ]);
  if (to === "EXECUTION_PENDING") return decision("SAGA_HANDOFF_GUARD", [
    ...recoveryChecks,
    ...continuingEvidence(facts),
    { code: "EXTERNAL_SAGA_READY", passed: facts.externalSagaReady, observed: String(facts.externalSagaReady) },
  ]);
  if (to === "COMPLETION_PENDING") return decision("COMPLETION_OBSERVED_GUARD", [
    ...recoveryChecks,
    ...continuingEvidence(facts),
    { code: "EXTERNAL_SAGA_READY", passed: facts.externalSagaReady, observed: String(facts.externalSagaReady) },
  ]);
  if (to === "COMPLETED") return decision("COMPLETION_RECONCILIATION_GUARD", [
    ...continuingEvidence(facts),
    { code: "COMPLETION_RECONCILED", passed: facts.completionReconciled, observed: String(facts.completionReconciled) },
  ]);
  return { allowed: false, code: "UNIMPLEMENTED_CASE_TRANSITION", checks: [] };
}
