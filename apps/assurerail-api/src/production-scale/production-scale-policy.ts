import {
  CONTROLLED_LIVE_GATE_CODES,
  EXTERNAL_GATE_CODES,
  PRODUCTION_ONLY_GATE_CODES,
} from "../runtime/activation-manifest";

export const PRODUCTION_SCALE_TARGETS = [
  "CONTROLLED_LIVE",
  "PRODUCTION",
] as const;
export type ProductionScaleTarget = (typeof PRODUCTION_SCALE_TARGETS)[number];

export const PRODUCTION_SCALE_BOARD_STATES = [
  "OPEN_EXTERNAL_GATES",
  "OPEN_INTERNAL_GATES",
  "OPERATIONAL_BLOCK",
  "AWAITING_SIGNED_ACTIVATION",
  "ACTIVATED",
  "SAFE_PAUSED",
] as const;
export type ProductionScaleBoardState =
  (typeof PRODUCTION_SCALE_BOARD_STATES)[number];

export const PRODUCTION_SCALE_CONTROL_FAMILIES = [
  {
    code: "SECURITY_AND_VULNERABILITY",
    owner: "SECURITY_ADMIN",
    evidence:
      "Independent VAPT/security review and current accepted remediation evidence",
  },
  {
    code: "BACKUP_RESTORE_AND_DR",
    owner: "SYSADMIN",
    evidence:
      "Backup restore, reconciliation, failover and measured RTO/RPO rehearsal",
  },
  {
    code: "INCIDENT_AND_ESCALATION",
    owner: "MANAGER",
    evidence:
      "Named coverage, cyber/provider/customer communications and out-of-hours rehearsal",
  },
  {
    code: "DATA_AND_RECONCILIATION",
    owner: "RECONCILIATION_ANALYST",
    evidence:
      "Open break, audit-chain, integrity and durable-message control results",
  },
  {
    code: "CAPACITY_AND_SERVICE",
    owner: "MANAGER",
    evidence:
      "Current capacity observations, support SLA state and production coverage acceptance",
  },
  {
    code: "ROUTE_CONNECTOR_AND_CUSTOMER",
    owner: "RISK_COMPLIANCE_OFFICER",
    evidence:
      "Exact route, performer, connector, operating-party, pilot and exit acceptance",
  },
  {
    code: "SIGNED_RELEASE_ACTIVATION",
    owner: "SUPERADMIN",
    evidence:
      "Build-bound, environment-bound, cohort-bound, signed and independently approved activation",
  },
] as const;

export function requiredGateCodes(
  target: ProductionScaleTarget
): readonly string[] {
  return target === "PRODUCTION"
    ? [...CONTROLLED_LIVE_GATE_CODES, ...PRODUCTION_ONLY_GATE_CODES]
    : [...CONTROLLED_LIVE_GATE_CODES];
}

export function classifyOpenGateCodes(codes: readonly string[]) {
  return {
    external: codes.filter((code) => EXTERNAL_GATE_CODES.has(code)).sort(),
    internal: codes.filter((code) => !EXTERNAL_GATE_CODES.has(code)).sort(),
  };
}

export interface ProductionScaleBlockers {
  criticalOpsFindings: number;
  opsKillSwitchEngaged: number;
  opsSweepMissingOrStale: number;
  openSettlementBreaks: number;
  openTokenBreaks: number;
  openLifecycleBreaks: number;
  openSecondaryBreaks: number;
  openRoomParityBreaks: number;
  deadLetterMessages: number;
  hardCapacityObservations: number;
  activeCapacityBudgetsMissing: number;
  capacityObservationMissingOrStale: number;
  overdueCriticalSupport: number;
  internalCoverageErrors: readonly string[];
}

export function blockerCount(blockers: ProductionScaleBlockers): number {
  return (
    blockers.criticalOpsFindings +
    blockers.opsKillSwitchEngaged +
    blockers.opsSweepMissingOrStale +
    blockers.openSettlementBreaks +
    blockers.openTokenBreaks +
    blockers.openLifecycleBreaks +
    blockers.openSecondaryBreaks +
    blockers.openRoomParityBreaks +
    blockers.deadLetterMessages +
    blockers.hardCapacityObservations +
    blockers.activeCapacityBudgetsMissing +
    blockers.capacityObservationMissingOrStale +
    blockers.overdueCriticalSupport +
    blockers.internalCoverageErrors.length
  );
}

export function deriveProductionScaleState(input: {
  openGateCodes: readonly string[];
  blockers: ProductionScaleBlockers;
  activationPresent: boolean;
  activationCurrent: boolean;
}): ProductionScaleBoardState {
  if (
    input.activationPresent &&
    (!input.activationCurrent || blockerCount(input.blockers) > 0)
  ) {
    return "SAFE_PAUSED";
  }
  const open = classifyOpenGateCodes(input.openGateCodes);
  if (open.external.length) return "OPEN_EXTERNAL_GATES";
  if (open.internal.length) return "OPEN_INTERNAL_GATES";
  if (blockerCount(input.blockers) > 0) return "OPERATIONAL_BLOCK";
  if (!input.activationPresent) return "AWAITING_SIGNED_ACTIVATION";
  return input.activationCurrent ? "ACTIVATED" : "SAFE_PAUSED";
}

export const PRODUCTION_SCALE_BOUNDARY = Object.freeze({
  assessmentIsActivation: false,
  reviewClosesReadinessGate: false,
  syntheticExternalEvidenceAccepted: false,
  liveCapabilityAdded: false,
  externalActionDispatched: false,
  currentSignedActivationStillRequired: true,
});
