#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(
  root,
  "docs/security/assurerail-sec01-dependency-baseline.json",
);
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const args = [
  "audit",
  "--workspace",
  "@code/assurerail-api",
  "--workspace",
  "@code/assurerail",
  "--omit=dev",
  "--audit-level=high",
  "--json",
];

const result = spawnSync("npm", args, {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch {
  console.error("SEC-01 dependency gate: npm audit did not return valid JSON.");
  if (result.stderr) console.error(result.stderr.trim());
  process.exit(2);
}

const counts = report?.metadata?.vulnerabilities;
if (!counts || typeof report?.vulnerabilities !== "object") {
  console.error("SEC-01 dependency gate: advisory service was unavailable or returned no audit report.");
  if (report?.message) console.error(report.message);
  process.exit(2);
}

const errors = [];
for (const severity of ["critical", "high", "moderate", "low"]) {
  const actual = Number(counts[severity]);
  const maximum = Number(baseline.maximum[severity]);
  if (!Number.isInteger(actual) || actual < 0) {
    errors.push(`${severity}: audit count is missing or malformed`);
    continue;
  }
  if (!Number.isInteger(maximum) || maximum < 0) {
    errors.push(`${severity}: baseline maximum is missing or malformed`);
    continue;
  }
  if (actual > maximum) {
    errors.push(`${severity}: ${actual} exceeds baseline maximum ${maximum}`);
  }
}

const actualModerates = Object.entries(report.vulnerabilities)
  .filter(([, finding]) => finding.severity === "moderate")
  .map(([name]) => name)
  .sort();
const acceptedModerates = [...baseline.acceptedModeratePackages].sort();
if (JSON.stringify(actualModerates) !== JSON.stringify(acceptedModerates)) {
  errors.push(
    `moderate package set changed: expected [${acceptedModerates.join(", ")}], received [${actualModerates.join(", ")}]`,
  );
}

if (errors.length) {
  console.error("SEC-01 dependency gate FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `SEC-01 dependency gate PASS — critical=${counts.critical}, high=${counts.high}, moderate=${counts.moderate}, low=${counts.low}`,
);
console.log(
  `Open monitored moderate chain: ${actualModerates.join(", ")} (review by ${baseline.reviewBy}).`,
);
