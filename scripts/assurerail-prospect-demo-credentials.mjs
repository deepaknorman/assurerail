#!/usr/bin/env node

import { createHmac } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";

const defaultAccountsFile = path.join(homedir(), ".assurerail-demo/prospect-demo-accounts.json");
const accountsFile = process.env.ASSURERAIL_PROSPECT_DEMO_ACCOUNTS_FILE || defaultAccountsFile;
const args = process.argv.slice(2);
const expectedRoles = ["sellerCommercialAdmin", "sellerDataPreparer", "invoicePreparer", "invoiceChecker"];

function fail(message) {
  console.error(`Demo credential helper: ${message}`);
  process.exit(1);
}

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/=+$/u, "").replace(/\s+/gu, "");
  let bits = "";
  for (const character of clean) {
    const index = alphabet.indexOf(character);
    if (index < 0) fail("the selected account has an invalid TOTP seed");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(seed) {
  const period = 30;
  const counter = Math.floor(Date.now() / 1000 / period);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(seed)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return {
    code: String(code % 1_000_000).padStart(6, "0"),
    validFor: period - (Math.floor(Date.now() / 1000) % period),
  };
}

if (!path.isAbsolute(accountsFile)) fail("the accounts file must use an absolute path");
const fileStat = await stat(accountsFile).catch(() => null);
if (!fileStat?.isFile()) fail(`accounts file not found: ${accountsFile}`);
if ((fileStat.mode & 0o077) !== 0) fail("the accounts file must be readable only by its owner (mode 600)");

const profile = JSON.parse(await readFile(accountsFile, "utf8"));
for (const role of expectedRoles) {
  if (!profile.accounts?.[role]) fail(`missing required role: ${role}`);
}

if (args.includes("--list")) {
  console.log("AssureRail synthetic demonstration identities\n");
  for (const role of expectedRoles) {
    const account = profile.accounts[role];
    console.log(`${role.padEnd(25)} ${account.email}  (${account.displayName})`);
  }
  console.log("\nUse --role <role> to reveal one credential set in this terminal.");
  process.exit(0);
}

const roleIndex = args.indexOf("--role");
if (roleIndex < 0 || !args[roleIndex + 1]) {
  fail("use --list or --role <role>");
}
const role = args[roleIndex + 1];
if (!expectedRoles.includes(role)) fail(`unknown role: ${role}`);
const account = profile.accounts[role];
const totp = currentTotp(account.totpSecret);

console.log("AssureRail synthetic demonstration credential");
console.log("Do not paste this output into chat, email or a committed file.\n");
console.log(`Role:         ${role}`);
console.log(`Display name: ${account.displayName}`);
console.log(`Email:        ${account.email}`);
console.log(`Password:     ${account.password}`);
console.log(`TOTP:         ${totp.code}  (about ${totp.validFor}s remaining)`);
