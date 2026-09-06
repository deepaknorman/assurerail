#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "../..");
const compose = readFileSync(resolve(root, "docker-compose.assurerail.yml"), "utf8");
const webDockerfile = readFileSync(resolve(root, "apps/assurerail/Dockerfile"), "utf8");

const apiRuntimeKeys = [
  "ASSURERAIL_BUILD_COMMIT", "ASSURERAIL_ENVIRONMENT", "ASSURERAIL_CORS_ANY",
  "ASSURERAIL_WEB_ORIGINS", "ASSURERAIL_WEB_URL", "ASSURERAIL_STARTUP_PROBE", "REQUIRE_DB",
  "DATABASE_URL",
  "ARAIL_ACTIVATION_MANIFEST_B64", "ARAIL_ACTIVATION_SIGNATURE_B64",
  "ARAIL_ACTIVATION_PUBLIC_KEY_B64", "FIREBASE_ADMIN_CONFIG", "RECAPTCHA_SITE_KEY",
  "IDENTITY_ASSURANCE_ADAPTER", "IDENTITY_PROVIDER_KEY", "IDENTITY_PROVIDER_API_URL",
  "IDENTITY_PROVIDER_API_KEY", "IDENTITY_PROVIDER_STATUS_PATH", "IDENTITY_PROVIDER_TIMEOUT_MS",
  "ANCHOR_PROVIDER_SUBMIT_PATH", "SETTLEMENT_PROVIDER_TRANSFER_PATH",
  "RECAPTCHA_ENFORCE", "VAULT_ADDR", "VAULT_APPROLE_ROLE_ID", "VAULT_APPROLE_SECRET_ID",
  "ARAIL_OBJECT_STORE_ENDPOINT", "ARAIL_OBJECT_STORE_BUCKET", "ARAIL_OBJECT_STORE_KMS_KEY_ID",
  "ARAIL_CLAMAV_HOST", "ARAIL_CONNECTOR_VAULT_MOUNT", "ARAIL_CONNECTOR_VAULT_PREFIX",
  "VENUE_ADMIN_EMAILS", "WEBAUTHN_RP_ID", "WEBAUTHN_ORIGIN",
];

const publicBuildFlags = [
  "NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1",
  "NEXT_PUBLIC_ASSURERAIL_CUSTOMER_OPERATIONS_V1",
  "NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1",
  "NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_DA_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_PTC_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_LIFECYCLE_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_PRIMARY_VENUE_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_SECONDARY_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_TOKENISED_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_ENTERPRISE_INTEGRATION_V1",
  "NEXT_PUBLIC_ASSURERAIL_PRODUCTION_SCALE_V1",
  "NEXT_PUBLIC_ASSURERAIL_GUIDED_JOURNEY_V1",
  "NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1",
];

test("compose passes security-critical API values from the reviewed effective environment", () => {
  for (const key of apiRuntimeKeys) {
    const interpolation = `${key}: ` + "${" + `${key}`;
    const quotedInterpolation = `${key}: \"` + "${" + `${key}`;
    assert.ok(
      compose.includes(interpolation) || compose.includes(quotedInterpolation),
      `${key} is not explicitly handed to the API container`,
    );
  }

  for (const key of [
    "ARAIL_ACTIVATION_MANIFEST_B64",
    "ARAIL_ACTIVATION_SIGNATURE_B64",
    "ARAIL_ACTIVATION_PUBLIC_KEY_B64",
  ]) {
    assert.doesNotMatch(compose, new RegExp(`${key}:.*:-`), `${key} received a compose fallback`);
  }
});

test("every governed web flag crosses compose and the Docker build boundary", () => {
  for (const key of publicBuildFlags) {
    const interpolation = `${key}: ` + "${" + `${key}:-`;
    assert.ok(compose.includes(interpolation), `${key} is absent from compose build args`);
    assert.match(webDockerfile, new RegExp(`^ARG ${key}=`, "m"), `${key} is absent from Dockerfile ARGs`);
    assert.match(webDockerfile, new RegExp(`^\\s+${key}=\\$${key}`, "m"), `${key} is absent from Dockerfile build ENV`);
  }
});

test("container restarts cannot hide migration or unversioned-image mutation", () => {
  assert.equal(compose.includes("npx prisma migrate deploy &&"), false);
  assert.match(compose, /image: "assurerail-api:\$\{ASSURERAIL_BUILD_COMMIT:-local\}"/);
  assert.match(compose, /image: "assurerail-web:\$\{ASSURERAIL_BUILD_COMMIT:-local\}"/);
});
