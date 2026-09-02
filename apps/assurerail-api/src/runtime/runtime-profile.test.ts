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
  assert.deepEqual(result.activation, { manifestId: null, manifestDigest: null, capabilityIds: [] });
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
    tokenisedDa: "off",
    tokenisedPtc: "off",
    primaryCommercial: "off",
    conventionalSecondary: "off",
    venueConduct: "off",
    developerPortal: "off",
    customerOperations: "off",
    hostedAlpha: "off",
    institutionalProduct: "off",
    daProduct: "off",
    ptcProduct: "off",
    lifecycleProduct: "off",
    primaryVenueProduct: "off",
    secondaryProduct: "off",
    tokenisedProduct: "off",
    enterpriseIntegration: "off",
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
  assert.match(missingCase.errors.join("\n"), /requires transaction cases/);
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

test("[CONFIG][PR11] tokenised DA requires the durable saga and remains non-live", () => {
  const missingSaga = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_TOKENISED_DA_V1: "allow-list",
  });
  assert.match(missingSaga.errors.join("\n"), /ARAIL_TOKENISED_DA_V1=allow_list requires/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "REPLAY",
    DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE,
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required",
    ARAIL_TOKENISED_DA_V1: "allow-list",
  });
  assert.equal(accepted.errors.length, 0);
  const live = inspectRuntimeEnvironment({
    ...LIVE_ENV,
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required",
    ARAIL_TOKENISED_DA_V1: "allow-list",
  });
  assert.match(live.errors.join("\n"), /ARAIL_TOKENISED_DA_V1 is available only/);
});

test("[CONFIG][PR15] live tokenised DA requires the fully enforced foundation and remains manifest-gated", () => {
  const missingFoundation = inspectRuntimeEnvironment({
    ...LIVE_ENV,
    ARAIL_TOKENISED_DA_V1: "live",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required",
  });
  assert.match(missingFoundation.errors.join("\n"), /requires transaction cases on/);

  const foundation = inspectRuntimeEnvironment({
    ...LIVE_ENV,
    ARAIL_PARTICIPANT_ADMISSION_V1: "enforce",
    ARAIL_NEUTRAL_INGRESS_V1: "on",
    ARAIL_ROUTE_ENTITLEMENT_ENFORCE: "enforce",
    ARAIL_TRANSACTION_CASE_V1: "on",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required",
    ARAIL_TOKENISED_DA_V1: "live",
    ARAIL_INTERNAL_RBAC_V1: "enforce",
  });
  const errors = foundation.errors.join("\n");
  assert.doesNotMatch(errors, /requires transaction cases on|available only in REPLAY or SHADOW/);
  assert.match(errors, /ARAIL_ACTIVATION_MANIFEST_B64 is required/);
});

test("[CONFIG][PR16] tokenised PTC requires its separate PTC replay/saga foundation and remains shadow-only", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_TOKENISED_PTC_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires transaction cases in shadow, required saga and PTC replay allow-list/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "REPLAY", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow", ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required", ARAIL_PTC_REPLAY_V1: "allow-list", ARAIL_TOKENISED_PTC_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_TOKENISED_PTC_V1: "shadow" });
  assert.match(live.errors.join("\n"), /available only in REPLAY or SHADOW/);
});

test("[CONFIG][PR13] primary commercial interaction requires the neutral case foundation and remains shadow-only", () => {
  const missingCase = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    ARAIL_PRIMARY_COMMERCIAL_V1: "shadow",
  });
  assert.match(missingCase.errors.join("\n"), /ARAIL_PRIMARY_COMMERCIAL_V1=shadow requires ARAIL_TRANSACTION_CASE_V1=shadow/);

  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE,
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_PRIMARY_COMMERCIAL_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.primaryCommercial, "shadow");

  for (const operatingMode of ["SANDBOX", "CONTROLLED_LIVE", "PRODUCTION"]) {
    const live = inspectRuntimeEnvironment({
      ...LIVE_ENV,
      ASSURERAIL_OPERATING_MODE: operatingMode,
      ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
      ARAIL_NEUTRAL_INGRESS_V1: "shadow",
      ARAIL_TRANSACTION_CASE_V1: "shadow",
      ARAIL_PRIMARY_COMMERCIAL_V1: "shadow",
    });
    assert.match(live.errors.join("\n"), /ARAIL_PRIMARY_COMMERCIAL_V1 is available only in REPLAY or SHADOW runtime/);
  }
});

test("[CONFIG][PR14] conventional secondary replay requires the durable case/saga foundation and remains non-live", () => {
  const missingSaga = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW",
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_CONVENTIONAL_SECONDARY_V1: "shadow",
  });
  assert.match(missingSaga.errors.join("\n"), /ARAIL_CONVENTIONAL_SECONDARY_V1=shadow requires/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "REPLAY",
    DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE,
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required",
    ARAIL_CONVENTIONAL_SECONDARY_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.conventionalSecondary, "shadow");
  const live = inspectRuntimeEnvironment({
    ...LIVE_ENV,
    ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required",
    ARAIL_CONVENTIONAL_SECONDARY_V1: "shadow",
  });
  assert.match(live.errors.join("\n"), /ARAIL_CONVENTIONAL_SECONDARY_V1 is available only in REPLAY or SHADOW runtime/);
});

test("[CONFIG][PR17] venue conduct requires the commercial/internal shadow foundation and remains non-live", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_VENUE_CONDUCT_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires primary commercial and transaction cases in shadow plus internal RBAC/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow", ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_PRIMARY_COMMERCIAL_V1: "shadow", ARAIL_INTERNAL_RBAC_V1: "enforce", ARAIL_VENUE_CONDUCT_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.venueConduct, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_VENUE_CONDUCT_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_VENUE_CONDUCT_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][PR19] developer portal requires shadow admission, ingress and relay and remains non-live", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_DEVELOPER_PORTAL_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires participant admission, neutral ingress and durable relay in shadow/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow", ARAIL_DURABLE_RELAY_MODE: "shadow", ARAIL_DEVELOPER_PORTAL_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.developerPortal, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_DEVELOPER_PORTAL_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_DEVELOPER_PORTAL_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][PR20] customer operations require the governed integration foundation and remain non-live", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_CUSTOMER_OPERATIONS_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires participant admission and developer portal in shadow plus internal RBAC/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow", ARAIL_DURABLE_RELAY_MODE: "shadow",
    ARAIL_DEVELOPER_PORTAL_V1: "shadow", ARAIL_INTERNAL_RBAC_V1: "shadow",
    ARAIL_CUSTOMER_OPERATIONS_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.customerOperations, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_CUSTOMER_OPERATIONS_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_CUSTOMER_OPERATIONS_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][AR21] hosted alpha requires admission and case foundations and remains non-live", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_HOSTED_ALPHA_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires participant admission and transaction cases/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_NEUTRAL_INGRESS_V1: "shadow", ARAIL_TRANSACTION_CASE_V1: "shadow",
    ARAIL_HOSTED_ALPHA_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.hostedAlpha, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_HOSTED_ALPHA_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_HOSTED_ALPHA_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][AR22] institutional product requires the governed shadow foundation and remains non-live", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_INSTITUTIONAL_PRODUCT_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires hosted alpha, participant admission and developer portal in shadow plus internal RBAC/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_DURABLE_RELAY_MODE: "shadow", ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow", ARAIL_DEVELOPER_PORTAL_V1: "shadow",
    ARAIL_INTERNAL_RBAC_V1: "shadow", ARAIL_HOSTED_ALPHA_V1: "shadow",
    ARAIL_INSTITUTIONAL_PRODUCT_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.institutionalProduct, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_INSTITUTIONAL_PRODUCT_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_INSTITUTIONAL_PRODUCT_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][AR23] conventional DA product requires the complete non-mutating product foundation", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_DA_PRODUCT_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires institutional product shadow, DA replay allow-list, required saga and Rail\/compare rooms/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_DURABLE_RELAY_MODE: "shadow", ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow", ARAIL_ROOM_READ_SOURCE: "compare",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required", ARAIL_DA_REPLAY_V1: "allow-list",
    ARAIL_DEVELOPER_PORTAL_V1: "shadow", ARAIL_INTERNAL_RBAC_V1: "shadow",
    ARAIL_HOSTED_ALPHA_V1: "shadow", ARAIL_INSTITUTIONAL_PRODUCT_V1: "shadow",
    ARAIL_DA_PRODUCT_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.daProduct, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_DA_PRODUCT_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_DA_PRODUCT_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][AR24] conventional PTC product requires the complete non-mutating product foundation", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_PTC_PRODUCT_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires institutional product shadow, PTC replay allow-list, required saga and Rail\/compare rooms/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_DURABLE_RELAY_MODE: "shadow", ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow", ARAIL_ROOM_READ_SOURCE: "compare",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required", ARAIL_PTC_REPLAY_V1: "allow-list",
    ARAIL_DEVELOPER_PORTAL_V1: "shadow", ARAIL_INTERNAL_RBAC_V1: "shadow",
    ARAIL_HOSTED_ALPHA_V1: "shadow", ARAIL_INSTITUTIONAL_PRODUCT_V1: "shadow",
    ARAIL_PTC_PRODUCT_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.ptcProduct, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_PTC_PRODUCT_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_PTC_PRODUCT_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][AR25] lifecycle product requires a governed DA or PTC shadow product", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_LIFECYCLE_PRODUCT_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires institutional product shadow, required saga and at least one DA\/PTC product in shadow/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_DURABLE_RELAY_MODE: "shadow", ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow", ARAIL_ROOM_READ_SOURCE: "compare",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required", ARAIL_DA_REPLAY_V1: "allow-list",
    ARAIL_DEVELOPER_PORTAL_V1: "shadow", ARAIL_INTERNAL_RBAC_V1: "shadow",
    ARAIL_HOSTED_ALPHA_V1: "shadow", ARAIL_INSTITUTIONAL_PRODUCT_V1: "shadow",
    ARAIL_DA_PRODUCT_V1: "shadow", ARAIL_LIFECYCLE_PRODUCT_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.lifecycleProduct, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_LIFECYCLE_PRODUCT_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_LIFECYCLE_PRODUCT_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][AR26] primary venue product requires governed commercial, conduct and route products", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_PRIMARY_VENUE_PRODUCT_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires institutional product, primary commercial and venue conduct in shadow, internal RBAC, and at least one DA\/PTC product in shadow/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_DURABLE_RELAY_MODE: "shadow", ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow", ARAIL_ROOM_READ_SOURCE: "compare",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required", ARAIL_DA_REPLAY_V1: "allow-list",
    ARAIL_PRIMARY_COMMERCIAL_V1: "shadow", ARAIL_VENUE_CONDUCT_V1: "shadow",
    ARAIL_DEVELOPER_PORTAL_V1: "shadow", ARAIL_INTERNAL_RBAC_V1: "shadow",
    ARAIL_HOSTED_ALPHA_V1: "shadow", ARAIL_INSTITUTIONAL_PRODUCT_V1: "shadow",
    ARAIL_DA_PRODUCT_V1: "shadow", ARAIL_PRIMARY_VENUE_PRODUCT_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.primaryVenueProduct, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_PRIMARY_VENUE_PRODUCT_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_PRIMARY_VENUE_PRODUCT_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][AR27] secondary product requires the governed conventional-secondary foundation", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_SECONDARY_PRODUCT_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires institutional product and conventional secondary in shadow, required saga, internal RBAC, and at least one DA\/PTC product in shadow/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_DURABLE_RELAY_MODE: "shadow", ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow", ARAIL_ROOM_READ_SOURCE: "compare",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required", ARAIL_DA_REPLAY_V1: "allow-list",
    ARAIL_CONVENTIONAL_SECONDARY_V1: "shadow", ARAIL_DEVELOPER_PORTAL_V1: "shadow",
    ARAIL_INTERNAL_RBAC_V1: "shadow", ARAIL_HOSTED_ALPHA_V1: "shadow",
    ARAIL_INSTITUTIONAL_PRODUCT_V1: "shadow", ARAIL_DA_PRODUCT_V1: "shadow",
    ARAIL_SECONDARY_PRODUCT_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.secondaryProduct, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_SECONDARY_PRODUCT_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_SECONDARY_PRODUCT_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][AR28] tokenised product requires both governed routes, lifecycle and token mirror foundations", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_TOKENISED_PRODUCT_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires institutional, DA, PTC and lifecycle products in shadow; tokenised DA allow-list; tokenised PTC shadow; required saga; and internal RBAC/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_DURABLE_RELAY_MODE: "shadow", ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow", ARAIL_ROOM_READ_SOURCE: "compare",
    ARAIL_EXTERNAL_ACTION_SAGA_V1: "required", ARAIL_DA_REPLAY_V1: "allow-list",
    ARAIL_PTC_REPLAY_V1: "allow-list", ARAIL_TOKENISED_DA_V1: "allow-list",
    ARAIL_TOKENISED_PTC_V1: "shadow", ARAIL_DEVELOPER_PORTAL_V1: "shadow",
    ARAIL_INTERNAL_RBAC_V1: "shadow", ARAIL_HOSTED_ALPHA_V1: "shadow",
    ARAIL_INSTITUTIONAL_PRODUCT_V1: "shadow", ARAIL_DA_PRODUCT_V1: "shadow",
    ARAIL_PTC_PRODUCT_V1: "shadow", ARAIL_LIFECYCLE_PRODUCT_V1: "shadow",
    ARAIL_TOKENISED_PRODUCT_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.tokenisedProduct, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_TOKENISED_PRODUCT_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_TOKENISED_PRODUCT_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][AR29] enterprise integration requires the institutional, developer and operations foundations", () => {
  const missing = inspectRuntimeEnvironment({ ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_ENTERPRISE_INTEGRATION_V1: "shadow" });
  assert.match(missing.errors.join("\n"), /requires institutional product, developer portal, customer operations and durable relay in shadow plus internal RBAC/);
  const accepted = inspectRuntimeEnvironment({
    ASSURERAIL_OPERATING_MODE: "SHADOW", DATABASE_URL: "postgresql://example.invalid/rail",
    FIREBASE_ADMIN_CONFIG: FIREBASE_ADMIN_FIXTURE, ARAIL_NEUTRAL_INGRESS_V1: "shadow",
    ARAIL_DURABLE_RELAY_MODE: "shadow", ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
    ARAIL_TRANSACTION_CASE_V1: "shadow", ARAIL_DEVELOPER_PORTAL_V1: "shadow",
    ARAIL_INTERNAL_RBAC_V1: "shadow", ARAIL_HOSTED_ALPHA_V1: "shadow",
    ARAIL_INSTITUTIONAL_PRODUCT_V1: "shadow", ARAIL_CUSTOMER_OPERATIONS_V1: "shadow",
    ARAIL_ENTERPRISE_INTEGRATION_V1: "shadow",
  });
  assert.equal(accepted.errors.length, 0);
  assert.equal(accepted.profile.features.enterpriseIntegration, "shadow");
  const live = inspectRuntimeEnvironment({ ...LIVE_ENV, ARAIL_ENTERPRISE_INTEGRATION_V1: "shadow" });
  assert.match(live.errors.join("\n"), /ARAIL_ENTERPRISE_INTEGRATION_V1 is available only in REPLAY or SHADOW/);
});

test("[CONFIG][OP01c] internal RBAC enforcement is an explicit mode and is mandatory for any later live activation", () => {
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
  assert.doesNotMatch(enforce.errors.join("\n"), /reserved but unavailable/);
  const liveWithoutEnforcement = inspectRuntimeEnvironment({
    ...LIVE_ENV,
    ARAIL_INTERNAL_RBAC_V1: "shadow",
  });
  assert.match(liveWithoutEnforcement.errors.join("\n"), /requires ARAIL_INTERNAL_RBAC_V1=enforce/);
  assert.throws(() => assertRuntimeEnvironment({
    NODE_ENV: "development",
    ARAIL_INTERNAL_RBAC_V1: "invalid",
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

test("[CONFIG][PR12][PRODUCTION] credentials and live adapters cannot replace a signed activation record", () => {
  const inspected = inspectRuntimeEnvironment(LIVE_ENV);
  const errors = inspected.errors.join("\n");
  assert.match(errors, /ARAIL_ACTIVATION_MANIFEST_B64 is required/);
  assert.match(errors, /requires ARAIL_INTERNAL_RBAC_V1=enforce/);
  assert.equal(inspected.profile.liveExternalActionsRequired, true);
  assert.equal(shouldMountDemoEndpoints(LIVE_ENV), false);
  assert.throws(() => assertRuntimeEnvironment(LIVE_ENV), RuntimeConfigurationError);
});

test("[CONFIG][PR12][PRODUCTION] a manifest cannot activate a capability absent from this build", async () => {
  const { generateKeyPairSync, sign } = await import("node:crypto");
  const { canonicalSerialize, sha256Digest } = await import("../contracts/v1");
  const { ACTIVATION_APPROVAL_ROLES, CONTROLLED_LIVE_GATE_CODES, PRODUCTION_ONLY_GATE_CODES } = await import("./activation-manifest");
  const now = new Date();
  const acceptedAt = new Date(now.getTime() - 60_000).toISOString();
  const expiresAt = new Date(now.getTime() + 60 * 60_000).toISOString();
  const manifest = {
    schemaVersion: "assurerail.activation.v1",
    manifestId: "activation.runtime-test",
    environment: "runtime-test",
    operatingMode: "PRODUCTION",
    buildCommit: "a".repeat(40),
    issuedAt: now.toISOString(),
    expiresAt,
    capabilities: [{
      id: "capability.not-implemented",
      transactionRoute: "DA",
      representation: "CONVENTIONAL",
      lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
      materialFunction: "TRANSFER_COMPLETION",
      performer: "PARTICIPANT_OWNED",
      cohortRef: "cohort.test",
    }],
    gates: [...CONTROLLED_LIVE_GATE_CODES, ...PRODUCTION_ONLY_GATE_CODES].map((code) => ({
      code,
      scopeKey: "scope.test",
      evidenceClass: [
        "INDEPENDENT_SECURITY_REVIEW",
        "PARTICIPANT_EVIDENCE_EXPORT",
        "ROUTE_LEGAL_PERMISSION",
        "CONNECTOR_CERTIFICATION",
        "OPERATING_ACCEPTANCE",
        "CONTROLLED_PILOT_ACCEPTANCE",
        "CUSTOMER_EXIT_REHEARSAL",
      ].includes(code) ? "EXTERNAL" : "INTERNAL",
      evidenceRef: `evidence.${code.toLowerCase()}`,
      evidenceDigest: sha256Digest({ code }),
      decisionRef: `decision.${code.toLowerCase()}`,
      acceptedAt,
      expiresAt,
    })),
    approvals: ACTIVATION_APPROVAL_ROLES.map((role, index) => ({
      role,
      actorRef: `actor.${index}`,
      approvedAt: acceptedAt,
      evidenceDigest: sha256Digest({ role }),
    })),
  } as const;
  const keys = generateKeyPairSync("ed25519");
  const signature = sign(null, Buffer.from(canonicalSerialize(manifest), "utf8"), keys.privateKey);
  const inspected = inspectRuntimeEnvironment({
    ...LIVE_ENV,
    ARAIL_INTERNAL_RBAC_V1: "enforce",
    ASSURERAIL_ENVIRONMENT: manifest.environment,
    ASSURERAIL_BUILD_COMMIT: manifest.buildCommit,
    ARAIL_ACTIVATION_MANIFEST_B64: Buffer.from(JSON.stringify(manifest)).toString("base64"),
    ARAIL_ACTIVATION_PUBLIC_KEY_B64: keys.publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    ARAIL_ACTIVATION_SIGNATURE_B64: signature.toString("base64"),
  });
  assert.match(inspected.errors.join("\n"), /has no implemented controlled-live command path in this build/);
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
