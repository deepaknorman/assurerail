import assert from "node:assert/strict";
import test from "node:test";
import {
  demoShowcaseConfigured,
  verifyDemoShowcaseAuthorization,
} from "../src/lib/demo-showcase-access.ts";

const username = "mumbai-demo";
const password = "a-strong-demo-password";
const basic = (value: string) => `Basic ${Buffer.from(value, "utf8").toString("base64")}`;

test("showcase is absent unless explicitly enabled with strong credentials", () => {
  assert.equal(demoShowcaseConfigured(undefined, username, password), false);
  assert.equal(demoShowcaseConfigured("no", username, password), false);
  assert.equal(demoShowcaseConfigured("yes", username, "short"), false);
  assert.equal(demoShowcaseConfigured("yes", username, password), true);
});

test("showcase accepts only its exact configured Basic credential", () => {
  assert.equal(
    verifyDemoShowcaseAuthorization(basic(`${username}:${password}`), "yes", username, password),
    true,
  );
  assert.equal(
    verifyDemoShowcaseAuthorization(basic(`${username}:wrong-password-value`), "yes", username, password),
    false,
  );
  assert.equal(
    verifyDemoShowcaseAuthorization(basic(`${username}:${password}`), "no", username, password),
    false,
  );
  assert.equal(verifyDemoShowcaseAuthorization("Bearer value", "yes", username, password), false);
});
