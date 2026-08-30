import assert from "node:assert/strict";
import test from "node:test";
import { inspectPersistenceFlags } from "./feature-flags";

test("[PR02][FLAGS] persistence paths default to inert/legacy-compatible values", () => {
  assert.deepEqual(inspectPersistenceFlags({}), {
    neutralIngress: "off",
    durableRelay: "legacy",
    participantAdmission: "off",
    routeEntitlement: "off",
    transactionCase: "off",
    roomReadSource: "legacy",
    roomWriteSource: "legacy",
    errors: [],
  });
});

test("[PR02][FLAGS] only the explicit shadow and durable modes are accepted", () => {
  assert.deepEqual(inspectPersistenceFlags({
    ARAIL_NEUTRAL_INGRESS_V1: "SHADOW",
    ARAIL_DURABLE_RELAY_MODE: "DURABLE",
    ARAIL_PARTICIPANT_ADMISSION_V1: "SHADOW",
    ARAIL_ROUTE_ENTITLEMENT_ENFORCE: "COMPARE",
    ARAIL_TRANSACTION_CASE_V1: "SHADOW",
    ARAIL_ROOM_READ_SOURCE: "COMPARE",
    ARAIL_ROOM_WRITE_SOURCE: "LEGACY",
  }), {
    neutralIngress: "shadow",
    durableRelay: "durable",
    participantAdmission: "shadow",
    routeEntitlement: "compare",
    transactionCase: "shadow",
    roomReadSource: "compare",
    roomWriteSource: "legacy",
    errors: [],
  });
  const rejected = inspectPersistenceFlags({
    ARAIL_NEUTRAL_INGRESS_V1: "true",
    ARAIL_DURABLE_RELAY_MODE: "enabled",
    ARAIL_PARTICIPANT_ADMISSION_V1: "enabled",
    ARAIL_ROUTE_ENTITLEMENT_ENFORCE: "on",
    ARAIL_TRANSACTION_CASE_V1: "enabled",
    ARAIL_ROOM_READ_SOURCE: "direct",
    ARAIL_ROOM_WRITE_SOURCE: "rail",
  });
  assert.equal(rejected.neutralIngress, "off");
  assert.equal(rejected.durableRelay, "legacy");
  assert.equal(rejected.participantAdmission, "off");
  assert.equal(rejected.routeEntitlement, "off");
  assert.equal(rejected.transactionCase, "off");
  assert.equal(rejected.roomReadSource, "legacy");
  assert.equal(rejected.roomWriteSource, "legacy");
  assert.equal(rejected.errors.length, 7);
});
