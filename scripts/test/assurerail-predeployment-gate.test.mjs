#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const gate = readFileSync(resolve(root, "scripts/assurerail-predeployment-gate.sh"), "utf8");

test("predeployment gate enumerates the complete ordered control chain", () => {
  const output = execFileSync("bash", ["scripts/assurerail-predeployment-gate.sh", "--list"], { cwd: root, encoding: "utf8" });
  assert.deepEqual(output.trim().split("\n"), [
    "source-integrity", "effective-environment", "reproducible-install", "security-and-sbom",
    "azure-baseline", "complete-code-and-db-rehearsal", "public-private-browser-boundary",
    "container-definition-and-images", "external-evidence-gates", "evidence-receipt",
  ]);
});

test("predeployment gate contains no deployment mutation", () => {
  for (const prohibited of ["prisma migrate deploy", "docker compose up", "pm2 restart", "git push", "az deployment", "kubectl apply"]) {
    assert.equal(gate.includes(prohibited), false, `gate must not contain ${prohibited}`);
  }
});

test("release checks happen before any container image build", () => {
  const imageBuild = gate.indexOf('run "exact effective-environment image build"');
  for (const marker of ["signed annotated release tag", "effective deployment environment", "security scans and SBOM", "complete code, boundary and disposable DB rehearsal", "compiled runtime validation of effective environment", "local public/private/browser boundary"]) {
    const index = gate.indexOf(marker);
    assert.ok(index >= 0, `missing ${marker}`);
    assert.ok(index < imageBuild, `${marker} must precede image build`);
  }
});

test("standalone Strix wrapper does not read an AssureLocker environment", () => {
  const strix = readFileSync(resolve(root, "scripts/assurerail-strix-daily.sh"), "utf8");
  assert.equal(strix.includes("apps/api/.env"), false);
  assert.match(strix, /ARAIL_STRIX_SECRET_FILE/);
  assert.match(strix, /exit 4/);
});

test("daily QA cannot reset the operator checkout or an unmarked shadow directory", () => {
  const daily = readFileSync(resolve(root, "scripts/assurerail-daily-qa.sh"), "utf8");
  assert.equal(daily.includes("git pull"), false);
  assert.match(daily, /\.assurerail-daily-shadow/);
  assert.match(daily, /Refusing unsafe ARAIL_SHADOW_ROOT/);
});

test("a timeboxed Strix scan cannot report PASS", () => {
  const strix = readFileSync(resolve(root, "scripts/assurerail-strix-daily.sh"), "utf8");
  const timebox = strix.slice(strix.indexOf('if [ "$RC" -eq 124 ]'));
  assert.match(timebox, /exit 4/);
  assert.match(timebox, /exit 3/);
  assert.equal(timebox.split("fi", 1)[0].includes("exit 0"), false);
});
