#!/usr/bin/env node
import { lstatSync, readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";

const file = process.env.ARAIL_DEPLOY_ENV_FILE;
const expectedCommit = process.env.ARAIL_EXPECTED_COMMIT;
const deploymentClass = process.env.ARAIL_DEPLOYMENT_CLASS ?? "DEMO";
const allowedClasses = new Set(["DEMO", "REPLAY", "SHADOW", "SANDBOX", "CONTROLLED_LIVE", "PRODUCTION"]);
const failures = [];

if (!file) failures.push("ARAIL_DEPLOY_ENV_FILE is required");
if (!expectedCommit || !/^[0-9a-f]{40}$/.test(expectedCommit)) failures.push("ARAIL_EXPECTED_COMMIT must be a full Git commit SHA");
if (!allowedClasses.has(deploymentClass)) failures.push("ARAIL_DEPLOYMENT_CLASS must be DEMO, REPLAY, SHADOW, SANDBOX, CONTROLLED_LIVE or PRODUCTION");

const values = new Map();
if (file) {
  try {
    if (!isAbsolute(file)) failures.push("ARAIL_DEPLOY_ENV_FILE must be an absolute path");
    const stat = statSync(file);
    if (!stat.isFile()) failures.push("ARAIL_DEPLOY_ENV_FILE must be a regular file");
    if (lstatSync(file).isSymbolicLink()) failures.push("ARAIL_DEPLOY_ENV_FILE must not be a symbolic link");
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) failures.push("ARAIL_DEPLOY_ENV_FILE must have mode 600");
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/);
      if (!match) {
        failures.push(`malformed environment line for key-only parser: ${line.split("=")[0]}`);
        continue;
      }
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      values.set(match[1], value);
    }
  } catch (error) {
    failures.push(`cannot read ARAIL_DEPLOY_ENV_FILE: ${error.message}`);
  }
}

function requireExact(key, expected) {
  if (values.get(key) !== expected) failures.push(`${key} must equal ${expected}`);
}
function prohibit(key, prohibited) {
  if (values.get(key) === prohibited) failures.push(`${key} must not equal ${prohibited}`);
}
function requirePresent(key) {
  if (!values.get(key)?.trim()) failures.push(`${key} must be present`);
}

requireExact("NODE_ENV", "production");
requireExact("ASSURERAIL_OPERATING_MODE", deploymentClass);
requireExact("ASSURERAIL_BUILD_COMMIT", expectedCommit);
prohibit("ASSURERAIL_CORS_ANY", "true");

const flagAllowed = new Map([
  ["ARAIL_NEUTRAL_TAXONOMY_V1", ["off", "read_only"]],
  ["ARAIL_NEUTRAL_INGRESS_V1", ["off", "shadow", "on"]],
  ["ARAIL_TRANSACTION_CASE_V1", ["off", "shadow", "on"]],
  ["ARAIL_EXTERNAL_ACTION_SAGA_V1", ["off", "shadow", "required"]],
  ["ARAIL_DA_REPLAY_V1", ["off", "allow_list"]],
  ["ARAIL_PTC_REPLAY_V1", ["off", "allow_list"]],
  ["ARAIL_PARTICIPANT_ADMISSION_V1", ["off", "shadow", "enforce"]],
  ["ARAIL_ROUTE_ENTITLEMENT_ENFORCE", ["off", "compare", "enforce"]],
  ["ARAIL_COMPLETION_ACK_V1", ["off", "shadow", "on"]],
  ["ARAIL_LEGACY_ROOM_PROXY_V1", ["off"]],
  ["ARAIL_TOKENISED_DA_V1", ["off", "allow_list", "live"]],
  ["ARAIL_TOKENISED_PTC_V1", ["off", "shadow"]],
  ["ARAIL_PRIMARY_COMMERCIAL_V1", ["off", "shadow"]],
  ["ARAIL_CONVENTIONAL_SECONDARY_V1", ["off", "shadow"]],
  ["ARAIL_VENUE_CONDUCT_V1", ["off", "shadow"]],
  ["ARAIL_DEVELOPER_PORTAL_V1", ["off", "shadow"]],
  ["ARAIL_CUSTOMER_OPERATIONS_V1", ["off", "shadow"]],
  ["ARAIL_HOSTED_ALPHA_V1", ["off", "shadow"]],
  ["ARAIL_INSTITUTIONAL_PRODUCT_V1", ["off", "shadow"]],
  ["ARAIL_DA_PRODUCT_V1", ["off", "shadow"]],
  ["ARAIL_PTC_PRODUCT_V1", ["off", "shadow"]],
  ["ARAIL_LIFECYCLE_PRODUCT_V1", ["off", "shadow"]],
  ["ARAIL_PRIMARY_VENUE_PRODUCT_V1", ["off", "shadow"]],
  ["ARAIL_SECONDARY_PRODUCT_V1", ["off", "shadow"]],
  ["ARAIL_TOKENISED_PRODUCT_V1", ["off", "shadow"]],
  ["ARAIL_ENTERPRISE_INTEGRATION_V1", ["off", "shadow"]],
  ["ARAIL_PRODUCTION_SCALE_V1", ["off", "shadow"]],
  ["ARAIL_INTERNAL_RBAC_V1", ["off", "shadow", "enforce"]],
]);
const productFlags = [...flagAllowed.keys()];
for (const [key, allowed] of flagAllowed) {
  const value = values.get(key);
  if (!value) failures.push(`${key} must be explicit`);
  else if (!allowed.includes(value)) failures.push(`${key} has unsupported value ${value}`);
}

for (const [key, allowed] of [
  ["ARAIL_DURABLE_RELAY_MODE", new Set(["legacy", "shadow", "durable"])],
  ["ARAIL_ROOM_READ_SOURCE", new Set(["legacy", "compare", "rail"])],
  ["ARAIL_ROOM_WRITE_SOURCE", new Set(["legacy", "rail"])],
]) {
  const value = values.get(key);
  if (!value) failures.push(`${key} must be explicit`);
  else if (!allowed.has(value)) failures.push(`${key} has unsupported value ${value}`);
}

const publicFlags = [
  "NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1", "NEXT_PUBLIC_ASSURERAIL_CUSTOMER_OPERATIONS_V1",
  "NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1", "NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_DA_PRODUCT_V1", "NEXT_PUBLIC_ASSURERAIL_PTC_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_LIFECYCLE_PRODUCT_V1", "NEXT_PUBLIC_ASSURERAIL_PRIMARY_VENUE_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_SECONDARY_PRODUCT_V1", "NEXT_PUBLIC_ASSURERAIL_TOKENISED_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_ENTERPRISE_INTEGRATION_V1", "NEXT_PUBLIC_ASSURERAIL_PRODUCTION_SCALE_V1",
  "NEXT_PUBLIC_ASSURERAIL_GUIDED_JOURNEY_V1", "NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1",
];
for (const key of publicFlags) {
  const value = values.get(key);
  if (!new Set(["off", "shadow", "on"]).has(value)) failures.push(`${key} must be explicit off, shadow or on`);
}

if (deploymentClass === "DEMO") {
  requireExact("ARAIL_DEMO_ENDPOINTS_ENABLED", "true");
  for (const key of productFlags) requireExact(key, "off");
  for (const key of ["TAPE_SOURCE", "HTS_ADAPTER", "HCS_ANCHOR", "SETTLEMENT_ADAPTER", "IDENTITY_ASSURANCE_ADAPTER"]) requireExact(key, "demo");
  requireExact("ARAIL_DURABLE_RELAY_MODE", "legacy");
  requireExact("ARAIL_ROOM_READ_SOURCE", "legacy");
  requireExact("ARAIL_ROOM_WRITE_SOURCE", "legacy");
  for (const key of publicFlags) requireExact(key, "off");
} else {
  requireExact("ARAIL_DEMO_ENDPOINTS_ENABLED", "false");
  requireExact("SEED_ON_BOOT", "false");
  requireExact("REQUIRE_DB", "true");
  requirePresent("DATABASE_URL");
  requirePresent("FIREBASE_ADMIN_CONFIG");
  if (deploymentClass === "REPLAY" || deploymentClass === "SHADOW") {
    for (const key of ["HTS_ADAPTER", "HCS_ANCHOR", "SETTLEMENT_ADAPTER"]) requireExact(key, "demo");
  }
  if (deploymentClass === "CONTROLLED_LIVE" || deploymentClass === "PRODUCTION") {
    for (const key of ["TAPE_SOURCE", "HTS_ADAPTER", "HCS_ANCHOR", "SETTLEMENT_ADAPTER", "IDENTITY_ASSURANCE_ADAPTER"]) prohibit(key, "demo");
  }
}

for (const key of ["ASSURERAIL_INBOUND_ENABLED", "ASSURERAIL_PRIVATE_UI_ENABLED", "ASSURERAIL_DILIGENCE_ENABLED"]) {
  const value = values.get(key);
  if (!new Set(["yes", "no"]).has(value)) failures.push(`${key} must be explicit yes or no`);
}

if (failures.length) {
  console.error("AssureRail effective deployment environment FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error("No values or secrets were printed.");
  process.exit(1);
}

if (process.env.ARAIL_RUNTIME_PROFILE_CHECK === "yes") {
  try {
    const runtime = await import("../apps/assurerail-api/dist/runtime/runtime-profile.js");
    const inspected = runtime.inspectRuntimeEnvironment(Object.fromEntries(values));
    if (inspected.errors.length > 0) {
      console.error(`AssureRail compiled runtime profile rejected the effective environment (${inspected.errors.length} issue(s)); values were suppressed.`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`AssureRail compiled runtime profile could not be checked; values were suppressed (${error.name ?? "Error"}).`);
    process.exit(1);
  }
}
console.log(`AssureRail effective deployment environment PASS — class=${deploymentClass}, commit=${expectedCommit.slice(0, 12)}; values were not printed.`);
