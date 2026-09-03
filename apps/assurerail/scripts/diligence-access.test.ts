import test from "node:test";
import assert from "node:assert/strict";
import { diligenceCredentialsConfigured, verifyDiligenceAuthorization } from "../src/lib/diligence-access.ts";

const username = "investor-review";
const password = "a-strong-example-password";
const basic = (value: string) => `Basic ${Buffer.from(value, "utf8").toString("base64")}`;

test("fails closed when credentials are absent or too short", () => {
  assert.equal(diligenceCredentialsConfigured(undefined, undefined), false);
  assert.equal(diligenceCredentialsConfigured("user", "short"), false);
  assert.equal(verifyDiligenceAuthorization(basic(`${username}:${password}`), username, undefined), false);
});

test("accepts only the exact configured username and password", () => {
  assert.equal(verifyDiligenceAuthorization(basic(`${username}:${password}`), username, password), true);
  assert.equal(verifyDiligenceAuthorization(basic(`${username}:wrong-password-value`), username, password), false);
  assert.equal(verifyDiligenceAuthorization(basic(`wrong-user:${password}`), username, password), false);
});

test("rejects malformed and non-Basic authorization", () => {
  assert.equal(verifyDiligenceAuthorization(null, username, password), false);
  assert.equal(verifyDiligenceAuthorization("Bearer token", username, password), false);
  assert.equal(verifyDiligenceAuthorization("Basic !!!", username, password), false);
  assert.equal(verifyDiligenceAuthorization(basic("missing-separator"), username, password), false);
});
