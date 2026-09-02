import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTION_SCALE_BOUNDARY,
  blockerCount,
  classifyOpenGateCodes,
  deriveProductionScaleState,
  requiredGateCodes,
  type ProductionScaleBlockers,
} from "./production-scale-policy";

const clear: ProductionScaleBlockers = {
  criticalOpsFindings: 0,
  opsKillSwitchEngaged: 0,
  opsSweepMissingOrStale: 0,
  openSettlementBreaks: 0,
  openTokenBreaks: 0,
  openLifecycleBreaks: 0,
  openSecondaryBreaks: 0,
  openRoomParityBreaks: 0,
  deadLetterMessages: 0,
  hardCapacityObservations: 0,
  activeCapacityBudgetsMissing: 0,
  capacityObservationMissingOrStale: 0,
  overdueCriticalSupport: 0,
  internalCoverageErrors: [],
};

test("[AR30][GATES] production is a strict superset of controlled-live evidence", () => {
  const controlled = requiredGateCodes("CONTROLLED_LIVE");
  const production = requiredGateCodes("PRODUCTION");
  assert.equal(controlled.length, 9);
  assert.equal(production.length, 12);
  for (const code of controlled) assert.ok(production.includes(code));
  const open = classifyOpenGateCodes(production);
  assert.ok(open.external.includes("INDEPENDENT_SECURITY_REVIEW"));
  assert.ok(open.external.includes("CONTROLLED_PILOT_ACCEPTANCE"));
  assert.ok(open.internal.includes("BACKUP_RESTORE_RECONCILIATION"));
  assert.ok(open.internal.includes("CAPACITY_AND_COVERAGE_ACCEPTANCE"));
});

test("[AR30][STATE] open external evidence, operations and signed activation remain distinct", () => {
  assert.equal(
    deriveProductionScaleState({
      openGateCodes: ["INDEPENDENT_SECURITY_REVIEW"],
      blockers: clear,
      activationPresent: false,
      activationCurrent: false,
    }),
    "OPEN_EXTERNAL_GATES"
  );
  assert.equal(
    deriveProductionScaleState({
      openGateCodes: [],
      blockers: { ...clear, deadLetterMessages: 1 },
      activationPresent: false,
      activationCurrent: false,
    }),
    "OPERATIONAL_BLOCK"
  );
  assert.equal(
    deriveProductionScaleState({
      openGateCodes: [],
      blockers: clear,
      activationPresent: false,
      activationCurrent: false,
    }),
    "AWAITING_SIGNED_ACTIVATION"
  );
  assert.equal(
    deriveProductionScaleState({
      openGateCodes: [],
      blockers: clear,
      activationPresent: true,
      activationCurrent: true,
    }),
    "ACTIVATED"
  );
  assert.equal(
    deriveProductionScaleState({
      openGateCodes: [],
      blockers: { ...clear, criticalOpsFindings: 1 },
      activationPresent: true,
      activationCurrent: true,
    }),
    "SAFE_PAUSED"
  );
  assert.equal(blockerCount(clear), 0);
  assert.equal(blockerCount({ ...clear, opsSweepMissingOrStale: 1 }), 1);
  assert.equal(blockerCount({ ...clear, opsKillSwitchEngaged: 1 }), 1);
  assert.equal(
    blockerCount({ ...clear, capacityObservationMissingOrStale: 1 }),
    1
  );
  assert.equal(blockerCount({ ...clear, activeCapacityBudgetsMissing: 1 }), 1);
});

test("[AR30][BOUNDARY] assessment and review cannot create production truth", () => {
  assert.equal(PRODUCTION_SCALE_BOUNDARY.assessmentIsActivation, false);
  assert.equal(PRODUCTION_SCALE_BOUNDARY.reviewClosesReadinessGate, false);
  assert.equal(
    PRODUCTION_SCALE_BOUNDARY.syntheticExternalEvidenceAccepted,
    false
  );
  assert.equal(PRODUCTION_SCALE_BOUNDARY.liveCapabilityAdded, false);
  assert.equal(PRODUCTION_SCALE_BOUNDARY.externalActionDispatched, false);
});
