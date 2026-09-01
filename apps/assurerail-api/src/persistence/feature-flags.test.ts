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
    completionAcknowledgement: "off",
    legacyRoomProxy: "off",
    externalActionSaga: "off",
    daReplay: "off",
    ptcReplay: "off",
    tokenisedDa: "off",
    tokenisedPtc: "off",
    primaryCommercial: "off",
    conventionalSecondary: "off",
    internalRbac: "off",
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
    ARAIL_ROOM_WRITE_SOURCE: "RAIL",
    ARAIL_COMPLETION_ACK_V1: "SHADOW",
    ARAIL_LEGACY_ROOM_PROXY_V1: "SHADOW",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "REQUIRED",
    ARAIL_DA_REPLAY_V1: "ALLOW-LIST",
    ARAIL_PTC_REPLAY_V1: "ALLOW-LIST",
    ARAIL_TOKENISED_DA_V1: "ALLOW-LIST",
    ARAIL_TOKENISED_PTC_V1: "SHADOW",
    ARAIL_PRIMARY_COMMERCIAL_V1: "SHADOW",
    ARAIL_CONVENTIONAL_SECONDARY_V1: "SHADOW",
    ARAIL_INTERNAL_RBAC_V1: "SHADOW",
  }), {
    neutralIngress: "shadow",
    durableRelay: "durable",
    participantAdmission: "shadow",
    routeEntitlement: "compare",
    transactionCase: "shadow",
    roomReadSource: "compare",
    roomWriteSource: "rail",
    completionAcknowledgement: "shadow",
    legacyRoomProxy: "shadow",
    externalActionSaga: "required",
    daReplay: "allow_list",
    ptcReplay: "allow_list",
    tokenisedDa: "allow_list",
    tokenisedPtc: "shadow",
    primaryCommercial: "shadow",
    conventionalSecondary: "shadow",
    internalRbac: "shadow",
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
    ARAIL_COMPLETION_ACK_V1: "enabled",
    ARAIL_LEGACY_ROOM_PROXY_V1: "on",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "enabled",
    ARAIL_DA_REPLAY_V1: "enabled",
    ARAIL_PTC_REPLAY_V1: "enabled",
    ARAIL_TOKENISED_DA_V1: "enabled",
    ARAIL_TOKENISED_PTC_V1: "enabled",
    ARAIL_PRIMARY_COMMERCIAL_V1: "enabled",
    ARAIL_CONVENTIONAL_SECONDARY_V1: "enabled",
    ARAIL_INTERNAL_RBAC_V1: "enabled",
  });
  assert.equal(rejected.neutralIngress, "off");
  assert.equal(rejected.durableRelay, "legacy");
  assert.equal(rejected.participantAdmission, "off");
  assert.equal(rejected.routeEntitlement, "off");
  assert.equal(rejected.transactionCase, "off");
  assert.equal(rejected.roomReadSource, "legacy");
  assert.equal(rejected.roomWriteSource, "rail");
  assert.equal(rejected.completionAcknowledgement, "off");
  assert.equal(rejected.legacyRoomProxy, "off");
  assert.equal(rejected.externalActionSaga, "off");
  assert.equal(rejected.daReplay, "off");
  assert.equal(rejected.ptcReplay, "off");
  assert.equal(rejected.tokenisedDa, "off");
  assert.equal(rejected.tokenisedPtc, "off");
  assert.equal(rejected.primaryCommercial, "off");
  assert.equal(rejected.conventionalSecondary, "off");
  assert.equal(rejected.internalRbac, "off");
  assert.equal(rejected.errors.length, 16);
});
