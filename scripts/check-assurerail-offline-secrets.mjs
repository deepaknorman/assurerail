#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "buffer" }).toString("utf8").split("\0").filter(Boolean);
const excluded = /(?:^|\/)(?:package-lock\.json|docs\/qa\/daily\/|\.next\/|dist\/)|\.(?:png|jpe?g|gif|ico|pdf|xlsx|pptx|docx|woff2?|ttf|zip)$/i;
const rules = [
  { id: "PRIVATE_KEY", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: "AWS_ACCESS_KEY", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "GOOGLE_API_KEY", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "GITHUB_TOKEN", pattern: /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { id: "SLACK_TOKEN", pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/ },
  { id: "OPENAI_KEY", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/ },
  { id: "SERVICE_ACCOUNT_PRIVATE_KEY", pattern: /"private_key"\s*:\s*"-----BEGIN/ },
];
const findings = [];
let scanned = 0;

for (const relative of candidates) {
  if (excluded.test(relative)) continue;
  const file = path.join(root, relative);
  let stat;
  try { stat = statSync(file); } catch { continue; }
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024) continue;
  let body;
  try { body = readFileSync(file, "utf8"); } catch { continue; }
  scanned += 1;
  for (const rule of rules) if (rule.pattern.test(body)) findings.push(`${relative}: ${rule.id}`);
}

if (findings.length) {
  console.error("OFFLINE SECRET SCAN FAILED");
  findings.forEach((finding) => console.error(`- ${finding}`));
  console.error("Secret values are deliberately redacted; inspect the named file locally.");
  process.exit(1);
}
console.log(`OFFLINE SECRET SCAN PASS — ${scanned} tracked/untracked text files; ${rules.length} high-confidence rules; values never printed`);
