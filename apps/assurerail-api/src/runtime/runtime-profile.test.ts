import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRuntimeEnvironment,
  inspectRuntimeEnvironment,
  RuntimeConfigurationError,
  shouldMountDemoEndpoints,
} from "./runtime-profile";

const FIREBASE_ADMIN_FIXTURE = Buffer.from(JSON.stringify({
  project_id: "assurerail-test",
  client_email: "assurerail-test@example.invalid",
  private_key: "test-only-key-material",
})).toString("base64");

const LIVE_ENV = {
  NODE_ENV: "production",
  ASSURERAIL_OPERATING_MODE: "PRODUCTION",
  ARAIL_DEMO_ENDPOINTS_ENABLED: "false",
  DATABASE_URL: "postgresql://rail.invalid/rail",
  FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE,
  TAPE_SOURCE: "live",
  HTS_ADAPTER: "live",
  HCS_ANCHOR: "live",
  SETTLEMENT_ADAPTER: "live",
  DIGIKYC_GATE: "live",
  ASSURELOCKER_API_URL: "https://provider.invalid",
  ASSURELOCKER_API_KEY: "test-only-placeholder",
  DIGIKYC_STATUS_SERVICE_SECRET: "test-only-placeholder",
  RECAPTCHA_SITE_KEY: "test-only-placeholder",
  RECAPTCHA_ENFORCE: "true",
  ARAIL_DURABLE_RELAY_MODE: "durable",
  VAULT_ADDR: "https://vault.invalid",
  VAULT_APPROLE_ROLE_ID: "test-only-role-id",
  VAULT_APPROLE_SECRET_ID: "test-only-secret-id",
} as const;

test("[CONFIG][DEMO] development defaults are explicit demo evidence", () => {
  const result = assertRuntimeEnvironment({ NODE_ENV: "development" });
  assert.equal(result.operatingMode, "DEMO");
  assert.equal(result.demoEndpointsEnabled, true);
  assert.equal(result.persistentStoreRequired, false);
  assert.equal(result.authenticatedRuntimeRequired, false);
  assert.deepEqual(result.adapters, {
    tape: "demo",
    hts: "demo",
    hcs: "demo",
    settlement: "demo",
    digiKyc: "demo",
  });
  assert.deepEqual(result.features, {
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
    internalRbac: "off",
  });
  assert.equal(shouldMountDemoEndpoints({ NODE_ENV: "development" }), true);
});

test("[CONFIG][DEMO] an optimised Node process may declare itself DEMO without becoming production evidence", () => {
  const env = {
    NODE_ENV: "production",
    ASSURERAIL_OPERATING_MODE: "DEMO",
    ARAIL_DEMO_ENDPOINTS_ENABLED: "true",
    TAPE_SOURCE: "demo",
    HTS_ADAPTER: "demo",
    HCS_ANCHOR: "demo",
    SETTLEMENT_ADAPTER: "demo",
    DIGIKYC_GATE: "demo",
  };
  const result = assertRuntimeEnvironment(env);
  assert.equal(result.operatingMode, "DEMO");
  assert.equal(result.demoEndpointsEnabled, true);
  assert.equal(shouldMountDemoEndpoints(env), true);
});

test("[CONFIG][PRODUCTION] an undeclared production container fails closed", () => {
  const inspected = inspectRuntimeEnvironment({ NODE_ENV: "production" });
  assert.equal(inspected.profile.operatingMode, "PRODUCTION");
  assert.equal(inspected.profile.demoEndpointsEnabled, false);
  assert.match(inspected.errors.join("\n"), /DATABASE_URL is required/);
  assert.match(inspected.errors.join("\n"), /FIREBASE_ADMIN_CONFIG is required/);
  assert.match(inspected.errors.join("\n"), /requires live adapters/);
  assert.match(inspected.errors.join("\n"), /ARAIL_DURABLE_RELAY_MODE=durable/);
  assert.equal(shouldMountDemoEndpoints({ NODE_ENV: "production" }), false);
  assert.throws(() => assertRuntimeEnvironment({ NODE_ENV: "production" }), RuntimeConfigurationError);
});

test("[CONFIG][PR02] persistence flags reject truthy aliases and shadow mode rejects webhook egress", () => {
  const invalid = inspectRuntimeEnvironment({
    NODE_ENV: "development",
    ARAIL_NEUTRAL_INGRESS_V1: "true",
    ARAIL_DURABLE_RELAY_MODE: "on",
  });
  assert.match(invalid.errors.join("\n"), /ARAIL_NEUTRAL_INGRESS_V1 must be/);
  assert.match(invalid.errors.join("\n"), /ARAIL_DURABLE_RELAY_MODE must be/);

  const shadow = inspectRuntimeEnvironment({
    NODE_ENV: "development",
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    DATABASE_URL: "postgresql:\/\/rail.invalid\/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE,
    ARAIL_DURABLE_RELAY_MODE: "durable",
    VAULT_ADDR: "https:\/\/vault.invalid",
    VAULT_TOKEN: "test-only-placeholder",
  });
  assert.match(shadow.errors.join("\n"), /SHADOW mode forbids durable webhook egress/);
});

test("[CONFIG][PR02] controlled-live and production reject static Vault token authentication", () => {
  const staticToken = inspectRuntimeEnvironment({
    ...LIVE_ENV,
    VAULT_APPROLE_ROLE_ID: undefined,
    VAULT_APPROLE_SECRET_ID: undefined,
    VAULT_TOKEN: "test-only-static-token",
  });
  assert.match(staticToken.errors.join("\n"), /VAULT_TOKEN is not accepted for live operation/);
});

test("[CONFIG][PRODUCTION] database and auth do not make demo adapters or demo routes production-safe", () => {
  const env = {
    NODE_ENV: "production",
    ASSURERAIL_OPERATING_MODE: "PRODUCTION",
    ARAIL_DEMO_ENDPOINTS_ENABLED: "true",
    DATABASE_URL: "postgresql://rail.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE,
  };
  const inspected = inspectRuntimeEnvironment(env);
  const errors = inspected.errors.join("\n");
  assert.match(errors, /ARAIL_DEMO_ENDPOINTS_ENABLED=true is forbidden/);
  assert.match(errors, /requires live adapters/);
  assert.equal(shouldMountDemoEndpoints(env), false);
});

test("[CONFIG][SHADOW] every non-demo mode requires persistent authenticated operation", () => {
  const inspected = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    ARAIL_DEMO_ENDPOINTS_ENABLED: "false",
  });
  assert.match(inspected.errors.join("\n"), /DATABASE_URL is required in SHADOW mode/);
  assert.match(inspected.errors.join("\n"), /FIREBASE_ADMIN_CONFIG is required in SHADOW mode/);
  assert.equal(inspected.profile.liveExternalActionsRequired, false);
  assert.equal(shouldMountDemoEndpoints({ ASSURERAIL_OPERATING_MODE: "SHADOW" }), false);
});

test("[CONFIG][PR06] neutral transaction cases cannot be mislabeled demo, live or production", () => {
  for (const operatingMode of ["DEMO", "SANDBOX", "CONTROLLED_LIVE", "PRODUCTION"]) {
    const inspected = inspectRuntimeEnvironment({
      ...LIVE_ENV,
      ASSURERAIL_OPERATING_MODE: operatingMode,
      ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
      ARAIL_NEUTRAL_INGRESS_V1: "shadow",
      ARAIL_TRANSACTION_CASE_V1: "shadow",
    });
    assert.match(inspected.errors.join("\n"), /available only in REPLAY or SHADOW runtime/);
  }
});

test("[CONFIG][PR07] room compare reads require the complete shadow foundation", () => {
  const missingCase = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    ARAIL_ROOM_READ_SOURCE: "compare",
  });
  assert.match(missingCase.errors.join("\n"), /requires ARAIL_TRANSACTION_CASE_V1=shadow/);
});

test("[CONFIG][PR08] Rail room cutover requires write capability, case allocation remains a database gate", () => {
  const readWithoutWrite = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_ROOM_READ_SOURCE: "rail",
  });
  assert.match(readWithoutWrite.errors.join("\n"), /ARAIL_ROOM_WRITE_SOURCE=rail/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE,
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_ROOM_READ_SOURCE: "rail",
    ARAIL_ROOM_WRITE_SOURCE: "rail",
  });
  assert.equal(accepted.errors.length, 0);
});

test("[CONFIG][PR08] completion egress cannot be disguised as shadow", () => {
  const inspected = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_COMPLETION_ACK_V1: "on",
  });
  assert.match(inspected.errors.join("\n"), /forbidden in SHADOW/);
});

test("[CONFIG][PR09] DA replay requires the durable saga and remains non-live", () => {
  const missingSaga = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_DA_REPLAY_V1: "allow-list",
  });
  assert.match(missingSaga.errors.join("\n"), /ARAIL_EXTERNAL_ACTION_SAGA_V1=required/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "REPLAY",
    DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE,
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required",
    ARAIL_DA_REPLAY_V1: "allow-list",
  });
  assert.equal(accepted.errors.length, 0);
  const live = inspectRuntimeEnvironment({
    ...LIVE_ENV,
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required",
    ARAIL_DA_REPLAY_V1: "allow-list",
  });
  assert.match(live.errors.join("\n"), /observe-only and available only in REPLAY or SHADOW/);
  assert.match(live.errors.join("\n"), /ARAIL_DA_REPLAY_V1 is available only/);
});

test("[CONFIG][PR10] PTC replay requires the durable saga and remains non-live", () => {
  const missingSaga = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_PTC_REPLAY_V1: "allow-list",
  });
  assert.match(missingSaga.errors.join("\n"), /ARAIL_PTC_REPLAY_V1=allow_list requires/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "REPLAY",
    DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE,
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required",
    ARAIL_PTC_REPLAY_V1: "allow-list",
  });
  assert.equal(accepted.errors.length, 0);
  const live = inspectRuntimeEnvironment({
    ...LIVE_ENV,
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required",
    ARAIL_PTC_REPLAY_V1: "allow-list",
  });
  assert.match(live.errors.join("\n"), /ARAIL_PTC_REPLAY_V1 is available only/);
});

test("[CONFIG][OP01c] internal RBAC enforcement cannot be enabled before cutover evidence exists", () => {
  const shadow = inspectRuntimeEnvironment({
    NODE_ENV: "development",
    ARAIL_INTERNAL_RBAC_V1: "shadow",
  });
  assert.equal(shadow.profile.features.internalRbac, "shadow");
  assert.doesNotMatch(shadow.errors.join("\n"), /OP-01c assignment coverage/);

  const enforce = inspectRuntimeEnvironment({
    NODE_ENV: "development",
    ARAIL_INTERNAL_RBAC_V1: "enforce",
  });
  assert.equal(enforce.profile.features.internalRbac, "enforce");
  assert.match(enforce.errors.join("\n"), /reserved but unavailable until OP-01c assignment coverage/);
  assert.throws(() => assertRuntimeEnvironment({
    NODE_ENV: "development",
    ARAIL_INTERNAL_RBAC_V1: "enforce",
  }), RuntimeConfigurationError);
});

test("[CONFIG][SHADOW] a merely present but malformed Firebase credential is rejected", () => {
  const inspected = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    ARAIL_DEMO_ENDPOINTS_ENABLED: "false",
    DATABASE_URL: "postgresql://rail.invalid/rail",
    FIREBASE_ADMIN_CONFIG: "not-a-service-account",
  });
  assert.match(inspected.errors.join("\n"), /must be valid base64 service-account JSON/);
});

test("[CONFIG][PRODUCTION] a complete non-demo profile passes the PR-00 startup contract", () => {
  const result = assertRuntimeEnvironment(LIVE_ENV);
  assert.equal(result.operatingMode, "PRODUCTION");
  assert.equal(result.demoEndpointsEnabled, false);
  assert.equal(result.liveExternalActionsRequired, true);
  assert.deepEqual(Object.values(result.adapters), ["live", "live", "live", "live", "live"]);
  assert.equal(shouldMountDemoEndpoints(LIVE_ENV), false);
});

test("[CONFIG] invalid modes, adapters and booleans are rejected", () => {
  const inspected = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "customer-pilot",
    ARAIL_DEMO_ENDPOINTS_ENABLED: "sometimes",
    TAPE_SOURCE: "automatic",
    ASSURERAIL_CORS_ANY: "true",
  });
  const errors = inspected.errors.join("\n");
  assert.match(errors, /ASSURERAIL_OPERATING_MODE must be one of/);
  assert.match(errors, /ARAIL_DEMO_ENDPOINTS_ENABLED must be "true" or "false"/);
  assert.match(errors, /TAPE_SOURCE must be "demo" or "live"/);
});

test("[CONFIG][SHADOW] permissive CORS is rejected outside demo mode", () => {
  const inspected = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    ARAIL_DEMO_ENDPOINTS_ENABLED: "false",
    DATABASE_URL: "postgresql://rail.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE,
    ASSURERAIL_CORS_ANY: "true",
  });
  assert.match(inspected.errors.join("\n"), /ASSURERAIL_CORS_ANY=true is forbidden in SHADOW mode/);
});

test("[CONFIG][DEMO] a demo label cannot conceal a live adapter", () => {
  const inspected = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "DEMO",
    HTS_ADAPTER: "live",
  });
  assert.match(inspected.errors.join("\n"), /DEMO mode forbids live adapters: hts/);
});

test("[CONFIG][REPLAY] replay and shadow cannot run mutating live adapters", () => {
  const inspected = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "REPLAY",
    ARAIL_DEMO_ENDPOINTS_ENABLED: "false",
    DATABASE_URL: "postgresql://rail.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE,
    TAPE_SOURCE: "live",
    HTS_ADAPTER: "live",
    HCS_ANCHOR: "live",
    SETTLEMENT_ADAPTER: "live",
  });
  assert.match(inspected.errors.join("\n"), /REPLAY mode forbids live mutating adapters: hts, hcs, settlement/);
});

test("[CONFIG][CONTROLLED_LIVE] live mode requires bot enforcement and HTTPS provider transport", () => {
  const inspected = inspectRuntimeEnvironment({
    ...LIVE_ENV,
    ASSURERAIL_OPERATING_MODE: "CONTROLLED_LIVE",
    RECAPTCHA_ENFORCE: "false",
    ASSURELOCKER_API_URL: "http://provider.invalid",
  });
  const errors = inspected.errors.join("\n");
  assert.match(errors, /RECAPTCHA_ENFORCE=true is required/);
  assert.match(errors, /ASSURELOCKER_API_URL must use https:\/\//);
});
