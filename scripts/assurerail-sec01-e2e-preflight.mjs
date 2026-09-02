#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";

const requiredAccounts = [
  "participantOrgAdminA",
  "participantViewerA",
  "participantViewerB",
  "internalViewer",
  "internalManager",
  "internalSysadmin",
  "internalSecurityAdmin",
  "internalSuperadmin",
];

const failures = [];
const webUrl = process.env.ARAIL_E2E_WEB_URL;
const apiUrl = process.env.ARAIL_E2E_API_URL;
const accountsPath = process.env.ARAIL_E2E_ACCOUNTS_FILE;

function validateTarget(label, value) {
  if (!value) {
    failures.push(`${label} is required`);
    return;
  }
  try {
    const parsed = new URL(value);
    const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(local && process.env.ARAIL_E2E_ALLOW_LOCAL_HTTP === "yes")) {
      failures.push(`${label} must use HTTPS (local HTTP additionally requires ARAIL_E2E_ALLOW_LOCAL_HTTP=yes)`);
    }
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      failures.push(`${label} must be an origin only, with no credentials, path, query or fragment`);
    }
  } catch {
    failures.push(`${label} is not a valid URL`);
  }
}

validateTarget("ARAIL_E2E_WEB_URL", webUrl);
validateTarget("ARAIL_E2E_API_URL", apiUrl);

let document;
if (!accountsPath) {
  failures.push("ARAIL_E2E_ACCOUNTS_FILE is required");
} else {
  if (!isAbsolute(accountsPath)) failures.push("ARAIL_E2E_ACCOUNTS_FILE must be an absolute path");
  try {
    const stat = statSync(accountsPath);
    if (!stat.isFile()) failures.push("ARAIL_E2E_ACCOUNTS_FILE must name a regular file");
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
      failures.push("ARAIL_E2E_ACCOUNTS_FILE must not be readable or writable by group/other (chmod 600)");
    }
    document = JSON.parse(readFileSync(accountsPath, "utf8"));
  } catch (error) {
    failures.push(`cannot read/parse ARAIL_E2E_ACCOUNTS_FILE: ${error.message}`);
  }
}

if (document) {
  if (document.schemaVersion !== 1) failures.push("account file schemaVersion must be 1");
  const emails = new Set();
  for (const name of requiredAccounts) {
    const account = document.accounts?.[name];
    if (!account) {
      failures.push(`missing account ${name}`);
      continue;
    }
    if (typeof account.email !== "string" || !account.email.includes("@") || account.email.endsWith(".invalid")) {
      failures.push(`${name}.email must be a provisioned non-placeholder address`);
    } else if (emails.has(account.email.toLowerCase())) {
      failures.push(`${name}.email duplicates another role account`);
    } else {
      emails.add(account.email.toLowerCase());
    }
    if (typeof account.password !== "string" || account.password.length < 12 || account.password.includes("REPLACE")) {
      failures.push(`${name}.password must be a provisioned secret of at least 12 characters`);
    }
    if (name.startsWith("participant") && (!account.institutionId || account.institutionId.startsWith("replace-"))) {
      failures.push(`${name}.institutionId must be provisioned`);
    }
    if (name.startsWith("internal") && account.institutionId) {
      failures.push(`${name} must not carry participant institution context`);
    }
  }
  const tenantA = document.accounts?.participantViewerA?.institutionId;
  const tenantB = document.accounts?.participantViewerB?.institutionId;
  if (tenantA && tenantB && tenantA === tenantB) failures.push("participant tenants A and B must be different");
}

if (failures.length) {
  console.error("AssureRail SEC-01 authenticated E2E preflight FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("No test was executed; the external evidence gate remains OPEN.");
  process.exit(1);
}

console.log("AssureRail SEC-01 authenticated E2E preflight PASS — authorised target and role matrix are present.");
