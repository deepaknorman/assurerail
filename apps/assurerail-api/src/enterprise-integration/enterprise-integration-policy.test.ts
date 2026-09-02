import assert from "node:assert/strict";
import test from "node:test";
import {
  ENTERPRISE_CONNECTOR_CLASSES,
  ENTERPRISE_INTEGRATION_BOUNDARY,
  deriveEnterpriseReadiness,
  gatesForConnectorClass,
} from "./enterprise-integration-policy";

test("[AR29][TAXONOMY] all enterprise boundaries have software and external gates", () => {
  assert.equal(ENTERPRISE_CONNECTOR_CLASSES.length, 11);
  for (const connectorClass of ENTERPRISE_CONNECTOR_CLASSES) {
    const gates = gatesForConnectorClass(connectorClass);
    assert.equal(gates[0].code, "SOFTWARE_CONFORMANCE");
    assert.ok(gates.some((gate) => gate.kind === "EXTERNAL_EVIDENCE"));
    assert.equal(new Set(gates.map((gate) => gate.code)).size, gates.length);
  }
});

test("[AR29][GATES] software pass cannot certify a profile", () => {
  const result = deriveEnterpriseReadiness(
    [
      {
        gateCode: "SOFTWARE_CONFORMANCE",
        gateKind: "SOFTWARE_CONFORMANCE",
        status: "SOFTWARE_PASSED",
      },
      {
        gateCode: "CUSTOMER_UAT",
        gateKind: "EXTERNAL_EVIDENCE",
        status: "OPEN",
      },
    ],
    "HEALTHY",
    new Date("2026-09-03T00:00:00Z"),
    new Date("2026-09-03T00:00:00Z")
  );
  assert.equal(result.softwareConformant, true);
  assert.equal(result.externalEvidenceVerified, false);
  assert.equal(result.shadowReady, false);
  assert.equal(ENTERPRISE_INTEGRATION_BOUNDARY.dispatchPermitted, false);
});

test("[AR29][CURRENTNESS] expired evidence reopens readiness and degraded health safe-pauses", () => {
  const result = deriveEnterpriseReadiness(
    [
      {
        gateCode: "SOFTWARE_CONFORMANCE",
        gateKind: "SOFTWARE_CONFORMANCE",
        status: "SOFTWARE_PASSED",
      },
      {
        gateCode: "CUSTOMER_UAT",
        gateKind: "EXTERNAL_EVIDENCE",
        status: "VERIFIED",
        expiresAt: "2026-01-01T00:00:00Z",
      },
    ],
    "DEGRADED",
    new Date("2026-09-03T00:00:00Z"),
    new Date("2026-09-03T00:00:00Z")
  );
  assert.equal(result.shadowReady, false);
  assert.equal(result.safePaused, true);
  assert.equal(result.openGates[0].currentStatus, "EXPIRED");
});
