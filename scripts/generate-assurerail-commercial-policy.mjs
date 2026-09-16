#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "config/assurerail-da-commercial-policy.json");
const checkOnly = process.argv.includes("--check");
const policy = JSON.parse(await readFile(sourcePath, "utf8"));
const publicPolicy = {
  policyVersion: policy.policyVersion,
  effectiveDate: policy.effectiveDate,
  currency: policy.currency,
  currencyScale: policy.currencyScale,
  phase: policy.phase,
  fixedStages: policy.fixedStages,
  execution: policy.execution,
  additionalServices: {
    customerSelectionRequired: policy.additionalServices.customerSelectionRequired,
    secureFileConnection: policy.additionalServices.secureFileConnection,
    apiIntegration: policy.additionalServices.apiIntegration,
    ongoingMonitoring: policy.additionalServices.ongoingMonitoring,
  },
};
const targets = [
  { path: resolve(root, "apps/assurerail-api/src/generated/commercial-policy.ts"), value: policy },
  { path: resolve(root, "apps/assurerail/src/lib/generated/commercial-policy.ts"), value: publicPolicy },
];

let stale = false;
for (const target of targets) {
  const rendered = `/* Generated from config/assurerail-da-commercial-policy.json. Do not edit. */\nexport const commercialPolicy = ${JSON.stringify(target.value, null, 2)} as const;\n`;
  let current = "";
  try { current = await readFile(target.path, "utf8"); } catch {}
  if (current === rendered) continue;
  stale = true;
  if (!checkOnly) {
    await mkdir(dirname(target.path), { recursive: true });
    await writeFile(target.path, rendered);
  }
  console.error(`${checkOnly ? "STALE" : "UPDATED"}: ${target.path.slice(root.length + 1)}`);
}
if (checkOnly && stale) process.exitCode = 1;
