#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kit = path.join(repoRoot, "demo/assurerail/founder-initial-assessment");
const accountsFile = process.env.ASSURERAIL_PROSPECT_DEMO_ACCOUNTS_FILE
  || path.join(homedir(), ".assurerail-demo/prospect-demo-accounts.json");
const remote = process.argv.includes("--remote");
const failures = [];

function check(condition, message) {
  if (condition) console.log(`PASS  ${message}`);
  else {
    console.error(`FAIL  ${message}`);
    failures.push(message);
  }
}

function rows(csv) {
  const lines = csv.trim().split(/\r?\n/u);
  const headings = lines.shift().split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [headings[index], value])));
}

function tapeFacts(items) {
  const pairs = new Set(items.map((row) => `${row.loan_id}\u0000${row.party_id}`));
  const seen = new Set();
  let duplicates = 0;
  for (const row of items) {
    const key = `${row.loan_id}\u0000${row.party_id}`;
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  const uniqueLoans = new Map();
  for (const row of items) {
    if (!uniqueLoans.has(row.loan_id)) uniqueLoans.set(row.loan_id, BigInt(row.principal_minor));
  }
  const principalMinor = [...uniqueLoans.values()].reduce((sum, value) => sum + value, 0n);
  return { pairCount: pairs.size, duplicates, principalMinor };
}

const manifest = JSON.parse(await readFile(path.join(kit, "demo-manifest.json"), "utf8"));
const first = tapeFacts(rows(await readFile(path.join(kit, manifest.firstUpload.file), "utf8")));
const corrected = tapeFacts(rows(await readFile(path.join(kit, manifest.correctedUpload.file), "utf8")));
const runbookPath = path.join(repoRoot, "docs/demo/assurerail/AssureRail_Prospect_Demo_Runbook.html");
const videoPath = path.join(repoRoot, "docs/demo/assurerail/AssureRail_Prospect_Mini_Demo_1080p.mp4");
const captionsPath = path.join(repoRoot, "docs/demo/assurerail/AssureRail_Prospect_Mini_Demo.srt");

check(manifest.classification === "SYNTHETIC_ONLY", "manifest is restricted to synthetic data");
check(manifest.bookRef === "AR-DEMO-EV-001", "reserved demonstration book is selected");
check(first.pairCount === manifest.primaryPairCount, "v1 unique loan × borrower count matches the quote");
check(first.duplicates === 1, "v1 contains exactly one attributable duplicate");
check(corrected.pairCount === manifest.primaryPairCount, "v2 unique loan × borrower count matches the quote");
check(corrected.duplicates === 0, "v2 removes the duplicate");
check(first.principalMinor === corrected.principalMinor, "v2 preserves the underlying principal");
check(manifest.correctedUpload.expectedOutcome === "FIX_AND_REASSESS", "v2 does not overstate readiness while required EV evidence remains absent");
const [runbookStat, videoStat, captionsStat] = await Promise.all([
  stat(runbookPath).catch(() => null), stat(videoPath).catch(() => null), stat(captionsPath).catch(() => null),
]);
check(Boolean(runbookStat?.isFile()), "presenter runbook is packaged as HTML");
check(Boolean(videoStat?.isFile() && videoStat.size > 1_000_000), "captioned prospect video is packaged");
check(Boolean(captionsStat?.isFile() && captionsStat.size > 100), "SRT caption sidecar is packaged");

const accountStat = await stat(accountsFile).catch(() => null);
check(path.isAbsolute(accountsFile), "credential file path is absolute");
check(Boolean(accountStat?.isFile()), "private credential file exists");
check(Boolean(accountStat && (accountStat.mode & 0o077) === 0), "private credential file is mode 600");

if (accountStat?.isFile()) {
  const profile = JSON.parse(await readFile(accountsFile, "utf8"));
  const roles = ["sellerCommercialAdmin", "sellerDataPreparer", "invoicePreparer", "invoiceChecker"];
  check(profile.institutionId === "demo-nbfc-ev-001", "credentials use the reserved demonstration institution");
  check(roles.every((role) => profile.accounts?.[role]), "all four controlled identities are present");
  check(roles.every((role) => profile.accounts?.[role]?.email?.endsWith("@example.test")), "all identities use reserved example.test addresses");
  check(roles.every((role) => !String(profile.accounts?.[role]?.password).includes("REPLACE_")), "placeholder passwords have been replaced");
  check(roles.every((role) => /^[A-Z2-7]+=*$/iu.test(profile.accounts?.[role]?.totpSecret || "")), "all identities have valid base32 TOTP seeds");
}

if (remote) {
  const checks = [
    ["public login", "https://assurerail.com/login"],
    ["API health", "https://api.assurerail.com/healthz"],
    ["API readiness", "https://api.assurerail.com/readyz"],
  ];
  for (const [label, url] of checks) {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) }).catch(() => null);
    check(Boolean(response?.ok), `${label} endpoint responds successfully`);
  }
}

if (failures.length) {
  console.error(`\nProspect demo preflight failed: ${failures.length} check(s).`);
  process.exit(1);
}
console.log("\nProspect demo source, data and private identities are internally consistent.");
