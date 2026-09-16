#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(process.env.ARAIL_REPO_ROOT || scriptRoot);
const evidenceRoot = path.resolve(
  process.env.ARAIL_OFFLINE_SECURITY_EVIDENCE_DIR ||
    path.join(repo, "docs/qa/daily/arail/offline-security"),
);
const retentionDays = Number(process.env.ARAIL_OFFLINE_SECURITY_RETENTION_DAYS || 30);
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const reportBase = `OFFLINE_SECURITY_${runId}`;
const lockDir = path.join(evidenceRoot, ".lock");
const tempRoot = path.join(evidenceRoot, `.run-${runId}-${process.pid}`);
const node = process.execPath;
const bash = "/bin/bash";
const sandboxExec = "/usr/bin/sandbox-exec";
const noNetworkProfile = "(version 1)(allow default)(deny network*)";
const startedAt = new Date();
const results = [];
let infrastructureFailure = null;

if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) {
  console.error("ARAIL_OFFLINE_SECURITY_RETENTION_DAYS must be an integer from 1 to 365");
  process.exit(2);
}
if (!existsSync(path.join(repo, "package-lock.json")) || !existsSync(path.join(repo, ".git"))) {
  console.error(`Not an AssureRail repository root: ${repo}`);
  process.exit(2);
}

mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
try {
  mkdirSync(lockDir, { mode: 0o700 });
} catch (error) {
  if (error?.code === "EEXIST") {
    console.error(`Offline security run already active: ${lockDir}`);
    process.exit(75);
  }
  throw error;
}
mkdirSync(path.join(tempRoot, "home"), { recursive: true, mode: 0o700 });
mkdirSync(path.join(tempRoot, "tmp"), { recursive: true, mode: 0o700 });
mkdirSync(path.join(tempRoot, "api-dist"), { recursive: true, mode: 0o700 });

const cleanEnvironment = {
  HOME: path.join(tempRoot, "home"),
  TMPDIR: path.join(tempRoot, "tmp"),
  PATH: ["/usr/bin", "/bin", "/usr/sbin", "/sbin", "/usr/local/bin", path.join(repo, "node_modules/.bin")].join(":"),
  CI: "1",
  NODE_ENV: "test",
  NEXT_TELEMETRY_DISABLED: "1",
  TURBO_TELEMETRY_DISABLED: "1",
  CHECKPOINT_DISABLE: "1",
  npm_config_offline: "true",
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_update_notifier: "false",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  LANG: "C",
  LC_ALL: "C",
};

function isolated(command, args) {
  const envArgs = Object.entries(cleanEnvironment).flatMap(([key, value]) => [`${key}=${value}`]);
  const invocation = ["/usr/bin/env", "-i", ...envArgs, command, ...args];
  if (process.platform === "darwin" && existsSync(sandboxExec)) {
    return { command: sandboxExec, args: ["-p", noNetworkProfile, ...invocation], mode: "macOS sandbox-exec deny network*" };
  }
  if (process.platform === "linux") {
    const unshare = ["/usr/bin/unshare", "/bin/unshare"].find(existsSync);
    if (unshare) return { command: unshare, args: ["--net", "--", ...invocation], mode: "Linux unshare network namespace" };
  }
  return null;
}

function tail(value, maxLines = 300, maxChars = 50000) {
  const lines = String(value || "").split(/\r?\n/);
  const joined = lines.slice(-maxLines).join("\n");
  return joined.length > maxChars ? joined.slice(-maxChars) : joined;
}

function run(name, command, args = [], options = {}) {
  if (options.blockedBy && options.blockedBy.status !== "PASS") {
    const result = { name, status: "BLOCKED", exitCode: null, durationMs: 0, output: `Blocked because ${options.blockedBy.name} did not pass.` };
    results.push(result);
    return result;
  }
  const wrapped = isolated(command, args);
  if (!wrapped) {
    const result = { name, status: "FAIL", exitCode: 2, durationMs: 0, output: "No supported local network-isolation primitive is available." };
    results.push(result);
    infrastructureFailure ||= result.output;
    return result;
  }
  const began = Date.now();
  const child = spawnSync(wrapped.command, wrapped.args, {
    cwd: options.cwd || repo,
    encoding: "utf8",
    timeout: options.timeoutMs || 180000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = tail([child.stdout, child.stderr, child.error?.message].filter(Boolean).join("\n"));
  const exitCode = child.status ?? (child.signal ? 124 : 2);
  const result = {
    name,
    status: exitCode === 0 ? "PASS" : "FAIL",
    exitCode,
    signal: child.signal || null,
    durationMs: Date.now() - began,
    output,
  };
  if (exitCode === 2 || child.error) infrastructureFailure ||= `${name}: ${child.error?.message || `exit ${exitCode}`}`;
  results.push(result);
  console.log(`${result.status.padEnd(7)} ${name} (${result.durationMs} ms)`);
  return result;
}

function findShellScripts(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", ".next", "node_modules", "dist", "generated"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) findShellScripts(target, output);
    else if (entry.isFile() && entry.name.endsWith(".sh")) output.push(path.relative(repo, target));
  }
  return output.sort();
}

function pythonPath() {
  const candidates = [process.env.PYTHON, "/Library/Frameworks/Python.framework/Versions/3.10/bin/python3", "/usr/local/bin/python3.12", "/opt/homebrew/bin/python3", "/usr/bin/python3"];
  return candidates.find((candidate) => candidate && existsSync(candidate)) || null;
}

function atomicWrite(file, body) {
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, body, { encoding: "utf8", mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, file);
}

function writeEvidence(isolationMode) {
  const finishedAt = new Date();
  const failures = results.filter((result) => result.status !== "PASS");
  const status = infrastructureFailure ? "HARNESS_ERROR" : failures.length ? "FAIL" : "PASS";
  const report = {
    schemaVersion: 1,
    runId,
    status,
    exitCode: infrastructureFailure ? 2 : failures.length ? 1 : 0,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    repository: repo,
    revision: gitRevision(),
    isolation: isolationMode,
    offline: true,
    liveCredentialsLoaded: false,
    dockerUsed: false,
    retentionDays,
    harnessError: infrastructureFailure,
    limitations: [
      "No online vulnerability-advisory freshness check; dependency verification uses package-lock and installed package metadata only.",
      "No browser DAST, Docker scan, live database, payment, bank, settlement, bureau, OCR-model or other provider call.",
      "Document abuse checks use deterministic local fixtures and parser paths; model quality and provider behaviour need separate controlled-live evidence.",
    ],
    steps: results,
  };
  const jsonFile = path.join(evidenceRoot, `${reportBase}.json`);
  const textFile = path.join(evidenceRoot, `${reportBase}.txt`);
  const text = [
    `AssureRail daily offline security evidence — ${runId}`,
    `Status: ${status}`,
    `Exit code: ${report.exitCode}`,
    `Revision: ${report.revision}`,
    `Isolation: ${isolationMode}`,
    `Started: ${report.startedAt}`,
    `Finished: ${report.finishedAt}`,
    "",
    ...results.flatMap((result) => [
      `[${result.status}] ${result.name} (exit=${result.exitCode ?? "n/a"}; ${result.durationMs} ms)`,
      result.output || "(no output)",
      "",
    ]),
    "Limitations:",
    ...report.limitations.map((item) => `- ${item}`),
    "",
  ].join("\n");
  atomicWrite(jsonFile, `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(textFile, text);
  atomicWrite(path.join(evidenceRoot, "latest.json"), `${JSON.stringify({ runId, status, report: path.basename(jsonFile) }, null, 2)}\n`);
  atomicWrite(path.join(evidenceRoot, "latest.txt"), `${path.basename(textFile)}\n${status}\n`);
  return { report, jsonFile, textFile };
}

function gitRevision() {
  const child = spawnSync("/usr/bin/git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" });
  return child.status === 0 ? child.stdout.trim() : "UNKNOWN";
}

function pruneEvidence() {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(evidenceRoot)) {
    if (!/^OFFLINE_SECURITY_\d{8}T\d{6}Z\.(?:json|txt)$/.test(name)) continue;
    const file = path.join(evidenceRoot, name);
    if (statSync(file).mtimeMs < cutoff) rmSync(file, { force: true });
  }
}

let isolationMode = "unavailable";
try {
  const probe = isolated(node, ["-e", "process.exit(0)"]);
  if (!probe) {
    infrastructureFailure = "No supported local network-isolation primitive is available.";
  } else {
    isolationMode = probe.mode;
    const preflight = spawnSync(probe.command, probe.args, { cwd: repo, encoding: "utf8", timeout: 10000 });
    if (preflight.status !== 0) infrastructureFailure = `Network-isolation preflight failed with exit ${preflight.status ?? 2}.`;
  }

  if (!infrastructureFailure) {
    const shellScripts = findShellScripts(repo);
    run("Shell syntax", bash, ["-n", ...shellScripts]);
    run("High-confidence tracked-secret scan", node, ["scripts/check-assurerail-offline-secrets.mjs"]);
    run("Local dependency lock and install integrity", node, ["scripts/check-assurerail-offline-dependencies.mjs"], { timeoutMs: 300000 });
    run("Repository security invariants", node, ["scripts/check-assurerail-invariants.mjs"]);
    run("Public exposure source check", node, ["apps/assurerail/scripts/pub00-public-claims-check.mjs"]);
    run("Commercial policy generated-artifact check", node, ["scripts/generate-assurerail-commercial-policy.mjs", "--check"]);
    run("Commercial pricing invariants", node, ["scripts/check-assurerail-commercial-policy.mjs"]);
    run("Phase-1 DA operations artifact check", node, ["scripts/build-assurerail-phase1-da-ops-pack.mjs", "--check"]);
    run("Phase-1 DA operations claims and links", node, ["scripts/check-assurerail-phase1-da-ops-pack.mjs"]);
    run("Download package classification check", node, ["apps/assurerail/scripts/package-download-artifacts.mjs", "--check"]);
    run("Web auth, access and download negative tests", node, [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      "--test",
      "apps/assurerail/scripts/private-ui-access.test.ts",
      "apps/assurerail/scripts/diligence-access.test.ts",
      "apps/assurerail/scripts/demo-showcase-access.test.ts",
      "apps/assurerail/scripts/download-access.test.ts",
      "apps/assurerail/scripts/download-exposure.test.ts",
    ], { timeoutMs: 240000 });

    const selectedApiTests = [
      "apps/assurerail-api/src/characterisation/auth-guard-chain.test.ts",
      "apps/assurerail-api/src/institutions/institution-access.service.test.ts",
      "apps/assurerail-api/src/internal-access/internal-access-policy.test.ts",
      "apps/assurerail-api/src/internal-access/internal-access-readiness.test.ts",
      "apps/assurerail-api/src/internal-access/internal-access.service.test.ts",
      "apps/assurerail-api/src/internal-access/internal-workspace-policy.test.ts",
      "apps/assurerail-api/src/trustee/trustee-authorisation.test.ts",
      "apps/assurerail-api/src/cases/case-evidence-boundary.test.ts",
      "apps/assurerail-api/src/evidence/evidence-intake-boundary.test.ts",
      "apps/assurerail-api/src/customer-operations/engagement-pricing.test.ts",
      "apps/assurerail-api/src/customer-operations/assessment-execution-fees.test.ts",
    ];
    const compile = run("API security-test compilation", path.join(repo, "node_modules/.bin/tsc"), [
      "--module", "commonjs",
      "--target", "ES2022",
      "--esModuleInterop",
      "--allowSyntheticDefaultImports",
      "--experimentalDecorators",
      "--emitDecoratorMetadata",
      "--skipLibCheck",
      "--strict",
      "--outDir", path.join(tempRoot, "api-dist"),
      "--rootDir", "apps/assurerail-api/src",
      "--types", "node",
      "--sourceMap", "false",
      ...selectedApiTests,
    ], { timeoutMs: 300000 });
    run("API auth and RBAC negative tests", node, [
      "--test",
      path.join(tempRoot, "api-dist/characterisation/auth-guard-chain.test.js"),
      path.join(tempRoot, "api-dist/institutions/institution-access.service.test.js"),
      path.join(tempRoot, "api-dist/internal-access/internal-access-policy.test.js"),
      path.join(tempRoot, "api-dist/internal-access/internal-access-readiness.test.js"),
      path.join(tempRoot, "api-dist/internal-access/internal-access.service.test.js"),
      path.join(tempRoot, "api-dist/internal-access/internal-workspace-policy.test.js"),
      path.join(tempRoot, "api-dist/trustee/trustee-authorisation.test.js"),
      path.join(tempRoot, "api-dist/cases/case-evidence-boundary.test.js"),
      path.join(tempRoot, "api-dist/evidence/evidence-intake-boundary.test.js"),
    ], { cwd: path.join(repo, "apps/assurerail-api"), timeoutMs: 240000, blockedBy: compile });
    run("API pricing invariant tests", node, [
      "--test",
      path.join(tempRoot, "api-dist/customer-operations/engagement-pricing.test.js"),
      path.join(tempRoot, "api-dist/customer-operations/assessment-execution-fees.test.js"),
    ], { cwd: path.join(repo, "apps/assurerail-api"), timeoutMs: 240000, blockedBy: compile });

    const python = pythonPath();
    if (python) run("Document and OCR input-abuse tests", python, ["-m", "unittest", "scripts/test_assurerail_document_extract.py"], { timeoutMs: 240000 });
    else {
      const result = { name: "Document and OCR input-abuse tests", status: "FAIL", exitCode: 2, durationMs: 0, output: "No local Python 3 interpreter is available." };
      results.push(result);
      infrastructureFailure ||= result.output;
    }
  }

  const { report, jsonFile, textFile } = writeEvidence(isolationMode);
  pruneEvidence();
  console.log(`Evidence JSON: ${jsonFile}`);
  console.log(`Evidence text: ${textFile}`);
  process.exitCode = report.exitCode;
} catch (error) {
  infrastructureFailure ||= error?.stack || String(error);
  try {
    const { report, jsonFile, textFile } = writeEvidence(isolationMode);
    console.error(`Harness error evidence JSON: ${jsonFile}`);
    console.error(`Harness error evidence text: ${textFile}`);
    process.exitCode = report.exitCode;
  } catch (evidenceError) {
    console.error(infrastructureFailure);
    console.error(`Evidence write failed: ${evidenceError?.stack || evidenceError}`);
    process.exitCode = 2;
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  rmSync(lockDir, { recursive: true, force: true });
}
