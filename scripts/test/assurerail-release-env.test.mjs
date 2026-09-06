#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";

const root = resolve(import.meta.dirname, "../..");
const directory = mkdtempSync(join(tmpdir(), "assurerail-release-env-"));
const sha = "a".repeat(40);
const fixture = readFileSync(resolve(root, "deploy/examples/assurerail-demo.env.example"), "utf8")
  .replace("0".repeat(40), sha);

after(() => rmSync(directory, { recursive: true, force: true }));

function run(file, deploymentClass = "DEMO") {
  return spawnSync("node", ["scripts/check-assurerail-release-env.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ARAIL_DEPLOY_ENV_FILE: file, ARAIL_EXPECTED_COMMIT: sha, ARAIL_DEPLOYMENT_CLASS: deploymentClass },
  });
}

test("accepts a mode-600, exact-commit, fail-closed demo environment without printing values", () => {
  const file = join(directory, "demo.env");
  writeFileSync(file, fixture, { mode: 0o600 });
  const result = run(file);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /class=DEMO/);
  assert.equal(result.stdout.includes("FIREBASE"), false);
});

test("rejects a deployment environment readable by group or other", () => {
  const file = join(directory, "open.env");
  writeFileSync(file, fixture, { mode: 0o644 });
  const result = run(file);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /mode 600/);
});

test("does not let demo configuration masquerade as production", () => {
  const file = join(directory, "production.env");
  writeFileSync(file, fixture, { mode: 0o600 });
  const result = run(file, "PRODUCTION");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ASSURERAIL_OPERATING_MODE must equal PRODUCTION/);
});
