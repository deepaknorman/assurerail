import assert from "node:assert/strict";
import test from "node:test";
import { inspectPersistenceFlags } from "./feature-flags";

test("[PR02][FLAGS] persistence paths default to inert/legacy-compatible values", () => {
  assert.deepEqual(inspectPersistenceFlags({}), {
    neutralIngress: "off",
    durableRelay: "legacy",
    participantAdmission: "off",
    routeEntitlement: "off",
    errors: [],
  });
});

test("[PR02][FLAGS] only the explicit shadow and durable modes are accepted", () => {
  assert.deepEqual(inspectPersistenceFlags({
    ARAIL_NEUTRAL_INGRESS_V1: "SHADOW",
    ARAIL_DURABLE_RELAY_MODE: "DURABLE",
    ARAIL_PARTICIPANT_ADMISSION_V1: "SHADOW",
    ARAIL_ROUTE_ENTITLEMENT_ENFORCE: "COMPARE",
  }), {
    neutralIngress: "shadow",
    durableRelay: "durable",
    participantAdmission: "shadow",
    routeEntitlement: "compare",
    errors: [],
  });
  const rejected = inspectPersistenceFlags({
    ARAIL_NEUTRAL_INGRESS_V1: "true",
    ARAIL_DURABLE_RELAY_MODE: "enabled",
    ARAIL_PARTICIPANT_ADMISSION_V1: "enabled",
    ARAIL_ROUTE_ENTITLEMENT_ENFORCE: "on",
  });
  assert.equal(rejected.neutralIngress, "off");
  assert.equal(rejected.durableRelay, "legacy");
  assert.equal(rejected.participantAdmission, "off");
  assert.equal(rejected.routeEntitlement, "off");
  assert.equal(rejected.errors.length, 4);
});
