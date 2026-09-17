#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";

const failures = [];
const webUrl = process.env.ARAIL_UX_WEB_URL ?? process.env.ARAIL_E2E_WEB_URL;
const apiUrl = process.env.ARAIL_UX_API_URL ?? process.env.ARAIL_E2E_API_URL;
const accountsPath = process.env.ARAIL_UX_ACCOUNTS_FILE ?? process.env.ARAIL_E2E_ACCOUNTS_FILE;

function validateTarget(label, value) {
  if (!value) {
    failures.push(`${label} is required`);
    return;
  }
  try {
    const parsed = new URL(value);
    const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(local && process.env.ARAIL_UX_ALLOW_LOCAL_HTTP === "yes")) {
      failures.push(`${label} must use HTTPS (local HTTP additionally requires ARAIL_UX_ALLOW_LOCAL_HTTP=yes)`);
    }
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      failures.push(`${label} must be an origin only, with no credentials, path, query or fragment`);
    }
  } catch {
    failures.push(`${label} is not a valid URL`);
  }
}

if (process.env.ARAIL_UX_AUTHORISED !== "yes") {
  failures.push("ARAIL_UX_AUTHORISED=yes is required for this authenticated pre-production run");
}
validateTarget("ARAIL_UX_WEB_URL (or ARAIL_E2E_WEB_URL)", webUrl);
validateTarget("ARAIL_UX_API_URL (or ARAIL_E2E_API_URL)", apiUrl);

let document;
if (!accountsPath) {
  failures.push("ARAIL_UX_ACCOUNTS_FILE (or ARAIL_E2E_ACCOUNTS_FILE) is required");
} else {
  if (!isAbsolute(accountsPath)) failures.push("the UX account file path must be absolute");
  try {
    const stat = statSync(accountsPath);
    if (!stat.isFile()) failures.push("the UX account file must be a regular file");
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
      failures.push("the UX account file must not be readable or writable by group/other (chmod 600)");
    }
    document = JSON.parse(readFileSync(accountsPath, "utf8"));
  } catch (error) {
    failures.push(`cannot read or parse the UX account file: ${error.message}`);
  }
}

if (document) {
  if (document.schemaVersion !== 1) failures.push("account file schemaVersion must be 1");
  const account = document.accounts?.participantOrgAdminA;
  if (!account) failures.push("account file must include participantOrgAdminA");
  if (account) {
    if (typeof account.email !== "string" || !account.email.includes("@") || account.email.endsWith(".invalid")) {
      failures.push("participantOrgAdminA.email must be a provisioned non-placeholder address");
    }
    if (typeof account.password !== "string" || account.password.length < 12 || account.password.includes("REPLACE")) {
      failures.push("participantOrgAdminA.password must be a provisioned secret of at least 12 characters");
    }
    if (typeof account.institutionId !== "string" || !account.institutionId || account.institutionId.startsWith("replace-")) {
      failures.push("participantOrgAdminA.institutionId must be provisioned");
    }
  }
}

if (failures.length) {
  console.error("AssureRail authenticated UX preflight FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("No browser test was executed and no external UX evidence was created.");
  process.exit(1);
}

console.log("AssureRail authenticated UX preflight PASS — authorised target and private participant account are present.");
