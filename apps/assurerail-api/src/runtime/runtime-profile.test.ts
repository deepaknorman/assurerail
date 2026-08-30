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
  assert.equal(shouldMountDemoEndpoints({ NODE_ENV: "production" }), false);
  assert.throws(() => assertRuntimeEnvironment({ NODE_ENV: "production" }), RuntimeConfigurationError);
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
