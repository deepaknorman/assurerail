import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const appRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(appRoot, "../..");
const envExample = readFileSync(path.resolve(appRoot, ".env.example"), "utf8");
const compose = readFileSync(path.resolve(repoRoot, "docker-compose.assurerail.yml"), "utf8");

const safeDefaults: Readonly<Record<string, string>> = {
  ARAIL_NEUTRAL_TAXONOMY_V1: "off",
  ARAIL_NEUTRAL_INGRESS_V1: "off",
  ARAIL_TRANSACTION_CASE_V1: "off",
  ARAIL_EXTERNAL_ACTION_SAGA_V1: "off",
  ARAIL_DA_REPLAY_V1: "off",
  ARAIL_PTC_REPLAY_V1: "off",
  ARAIL_DURABLE_RELAY_MODE: "legacy",
  ARAIL_PARTICIPANT_ADMISSION_V1: "off",
  ARAIL_ROUTE_ENTITLEMENT_ENFORCE: "off",
  ARAIL_ROOM_READ_SOURCE: "legacy",
  ARAIL_ROOM_WRITE_SOURCE: "legacy",
  ARAIL_COMPLETION_ACK_V1: "off",
  ARAIL_LEGACY_ROOM_PROXY_V1: "off",
  ARAIL_TOKENISED_DA_V1: "off",
  ARAIL_TOKENISED_PTC_V1: "off",
  ARAIL_PRIMARY_COMMERCIAL_V1: "off",
  ARAIL_CONVENTIONAL_SECONDARY_V1: "off",
  ARAIL_VENUE_CONDUCT_V1: "off",
  ARAIL_DEVELOPER_PORTAL_V1: "off",
  ARAIL_CUSTOMER_OPERATIONS_V1: "off",
  ARAIL_INTERNAL_RBAC_V1: "off",
};

test("[DEPLOYMENT_CONFIG] every governed feature is explicit and fail-closed in example and compose", () => {
  for (const [key, fallback] of Object.entries(safeDefaults)) {
    assert.match(envExample, new RegExp(`^${key}=${fallback}(?:\\s|$)`, "m"), `${key} is absent from .env.example`);
    assert.ok(
      compose.includes(`${key}: ` + "${" + `${key}:-${fallback}}`),
      `${key} is not passed to the API container with its safe default`,
    );
  }
});

test("[DEPLOYMENT_CONFIG] controlled-live credentials remain external to compose defaults", () => {
  for (const key of [
    "ARAIL_ACTIVATION_MANIFEST_B64",
    "ARAIL_ACTIVATION_SIGNATURE_B64",
    "ARAIL_ACTIVATION_PUBLIC_KEY_B64",
  ]) {
    assert.doesNotMatch(compose, new RegExp(`${key}:.*:-`), `${key} must never receive a compose fallback`);
  }
});
