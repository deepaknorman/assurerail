import assert from "node:assert/strict";
import test from "node:test";
import { deriveSecondaryProductJourney, REQUIRED_SECONDARY_EVIDENCE } from "./secondary-product";

test("[AR27][JOURNEY] DA readiness is derived from nine retained evidence types", () => {
  const result = deriveSecondaryProductJourney({ route: "DA", dossierStatus: "COLLECTING",
    evidenceTypes: REQUIRED_SECONDARY_EVIDENCE.DA, matchedLegCount: 0, requiredLegCount: 0,
    openBreakCount: 0, approvedRepairCount: 0, canOperateCase: true, canOperateRoute: true, canViewEvidence: true });
  assert.equal(result.requiredEvidence.length, 9);
  assert.deepEqual(result.missingEvidence, []);
  assert.equal(result.capabilities.canGovernDossier, true);
  assert.equal(result.stages.find((item) => item.code === "TITLE_CHAIN")?.state, "COMPLETE");
  assert.equal(result.stages.some((item) => item.code === "TRUSTEE_CONTROL"), false);
});

test("[AR27][PTC] trustee control remains a distinct required stage and external gate", () => {
  const evidence = REQUIRED_SECONDARY_EVIDENCE.PTC.filter((type) => type !== "TRUSTEE_TRANSACTION_CONTROL");
  const result = deriveSecondaryProductJourney({ route: "PTC", dossierStatus: "COLLECTING", evidenceTypes: evidence,
    matchedLegCount: 0, requiredLegCount: 0, openBreakCount: 0, approvedRepairCount: 0,
    canOperateCase: true, canOperateRoute: true, canViewEvidence: true });
  assert.deepEqual(result.missingEvidence, ["TRUSTEE_TRANSACTION_CONTROL"]);
  assert.equal(result.stages.find((item) => item.code === "TRUSTEE_CONTROL")?.state, "ACTION_REQUIRED");
  assert.ok(result.openExternalGates.some((item) => item.code === "TRUSTEE_AND_RECORDKEEPER_ACCEPTANCE"));
});

test("[AR27][RECONCILIATION] open breaks require append-only repair and prevent reconciled state", () => {
  const result = deriveSecondaryProductJourney({ route: "DA", dossierStatus: "BREAK_OPEN",
    evidenceTypes: REQUIRED_SECONDARY_EVIDENCE.DA, matchedLegCount: 0, requiredLegCount: 9,
    openBreakCount: 1, approvedRepairCount: 0, canOperateCase: false, canOperateRoute: false, canViewEvidence: true });
  assert.equal(result.stages.find((item) => item.code === "REGISTER_RECONCILIATION")?.state, "ACTION_REQUIRED");
  assert.equal(result.stages.find((item) => item.code === "BREAK_REPAIR")?.state, "ACTION_REQUIRED");
  assert.equal(result.capabilities.canGovernDossier, false);
});
