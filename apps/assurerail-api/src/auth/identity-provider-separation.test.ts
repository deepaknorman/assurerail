import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const appRoot = path.resolve(__dirname, "../..");
const read = (relative: string) => readFileSync(path.resolve(appRoot, relative), "utf8");

test("[SEP01][BOUNDARY] identity assurance has no product-specific endpoint, header or default provider", () => {
  const provider = read("src/auth/identity-assurance-provider.service.ts");
  const binding = read("src/auth/identity-binding.service.ts");
  const config = read("src/config.ts");
  const combined = `${provider}\n${binding}\n${config}`.toLowerCase();
  assert.doesNotMatch(combined, /assurelocker|digikyc|x-digikyc-status-secret/);
  assert.match(provider, /IDENTITY_PROVIDER_KEY/);
  assert.match(provider, /\/v1\/identity-assurance\/status|identityProviderStatusPath/);
  assert.doesNotMatch(binding, /input\.provider|provider\?:/);
});

test("[SEP01][AUTHORITY] identity binding explicitly grants neither admission nor Rail authority", () => {
  const controller = read("src/auth/auth.controller.ts");
  const binding = read("src/auth/identity-binding.service.ts");
  assert.match(controller, /grantsAdmission: false/);
  assert.match(binding, /neither participant admission nor institutional\/transaction authority/);
});
