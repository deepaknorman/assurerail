#!/usr/bin/env node
// AssureRail venue invariants — static guards that keep the standalone venue at (or above) AssureLocker's
// security bar and preserve its correctness/segregation properties. Fast, dependency-free; run on every
// build (scripts/assurerail-build-check.sh) and in the daily shadow QA. Exit 1 on any violation.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const ROOT = execSync("git rev-parse --show-toplevel").toString().trim();
const API = `${ROOT}/apps/assurerail-api`;
const rd = (p) => (existsSync(`${ROOT}/${p}`) ? readFileSync(`${ROOT}/${p}`, "utf8") : "");
const git = (c) => { try { return execSync(c, { cwd: ROOT }).toString().trim(); } catch { return ""; } };

let fail = 0;
const pass = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31m✗ ${m}\x1b[0m`); fail = 1; };
const has = (s, sub) => s.includes(sub);

// ── 1. Secrets never tracked ──────────────────────────────────────────────────
console.log("── secrets & env hygiene ──");
const tracked = git("git ls-files apps/assurerail-api").split("\n").filter(Boolean);
if (tracked.some((f) => f.endsWith("/.env") || f === "apps/assurerail-api/.env")) bad(".env is TRACKED by git — must be gitignored (secrets leak)");
else pass(".env is not tracked");
const ignored = git("git check-ignore apps/assurerail-api/.env");
if (ignored) pass(".env is gitignored"); else bad(".env is not covered by .gitignore");
// belt-and-suspenders vs gitleaks: no obvious secret material in TRACKED venue files
// Actual secret MATERIAL only — not field-name references like `json.private_key` in the auth code.
// A leaked SA key/PEM is caught by "-----BEGIN"; a leaked SA JSON literal by the quoted "private_key":.
const secretNeedles = ["-----BEGIN", "firebase-adminsdk", "h0Qa6YBV2Zaj", "AIzaSy", '"private_key":'];
let leaks = [];
for (const f of tracked) {
  if (f.endsWith(".env") || f.endsWith(".env.example")) continue; // example carries only placeholders
  const body = rd(f);
  for (const n of secretNeedles) if (has(body, n)) leaks.push(`${f} contains "${n}"`);
}
if (leaks.length) bad(`possible secret material in tracked files:\n     ${leaks.join("\n     ")}`);
else pass("no secret material in tracked venue files");

// ── 2. CORS is not wildcard-by-default ────────────────────────────────────────
console.log("── network exposure ──");
const main = rd("apps/assurerail-api/src/main.ts");
if (has(main, "ASSURERAIL_CORS_ANY") && has(main, "origin: origins.length ? origins : false")) pass("CORS defaults to an allowlist (wildcard only behind an explicit opt-in)");
else bad("CORS default is not a strict allowlist (main.ts must gate `origin:true` behind ASSURERAIL_CORS_ANY)");

// ── 3. Ledger value-path is transactional (P3 hardening must not regress) ─────
console.log("── ledger atomicity ──");
const dvp = rd("apps/assurerail-api/src/dvp/dvp.service.ts");
const mint = rd("apps/assurerail-api/src/mint/mint.service.ts");
const prismaRepo = rd("apps/assurerail-api/src/store/prisma-mint.repository.ts");
if (has(dvp, "this.repo.settleDvp") && !has(dvp, "this.repo.adjustHolding")) pass("DvP goes through atomic settleDvp (no direct holding writes)");
else bad("dvp.service must use repo.settleDvp and must NOT call adjustHolding directly on the value path");
if (has(mint, "this.repo.commitMint") && !has(mint, "this.repo.saveNote(")) pass("mint goes through atomic commitMint");
else bad("mint.service must use repo.commitMint (Note+MintLog+holding in one transaction)");
const txCount = (prismaRepo.match(/\$transaction/g) || []).length;
if (txCount >= 3 && has(prismaRepo, "InsufficientUnitsError") && has(prismaRepo, "::numeric")) pass(`Prisma store uses $transaction (${txCount}×) + guarded atomic balance moves`);
else bad("prisma-mint.repository must wrap value-path ops in $transaction with a guarded (::numeric) balance move");

// ── 4. Database segregation (venue never touches AssureLocker's DB/client) ────
console.log("── database segregation ──");
const schema = rd("apps/assurerail-api/prisma/schema.prisma");
if (has(schema, "@prisma/assurerail-client")) pass("venue Prisma client is the isolated @prisma/assurerail-client");
else bad("venue schema must generate the named @prisma/assurerail-client (not the default/shared client)");
const foreignClients = tracked
  .filter((f) => f.endsWith(".ts"))
  .filter((f) => /@prisma\/(client|data-client|control-client)\b/.test(rd(f)));
if (foreignClients.length) bad(`venue imports AssureLocker's Prisma client(s): ${foreignClients.join(", ")}`);
else pass("no AssureLocker Prisma client imports in the venue");
const alImports = tracked.filter((f) => f.endsWith(".ts")).filter((f) => /from ["']@code\/api/.test(rd(f)));
if (alImports.length) bad(`venue imports @code/api internals: ${alImports.join(", ")}`);
else pass("no @code/api imports in the venue (segregation intact)");

// ── 5. Adapters fail-closed / default to DEMO ─────────────────────────────────
console.log("── adapters ──");
const cfg = rd("apps/assurerail-api/src/config.ts");
const demoDefaults = ["tapeSource", "htsAdapter", "hcsAnchor", "settlementAdapter"].every((k) => new RegExp(`${k}[^\\n]*\\?\\?[^\\n]*"?demo"?`, "i").test(cfg) || new RegExp(`${k}.*"demo"`, "i").test(cfg));
if (demoDefaults) pass("all external adapters default to DEMO (no accidental live calls without config)");
else bad("config.ts must default tapeSource/htsAdapter/hcsAnchor/settlementAdapter to 'demo'");

console.log("");
if (fail) { console.log("\x1b[31m✗ AssureRail invariants FAILED\x1b[0m"); process.exit(1); }
console.log("\x1b[32m✓ AssureRail invariants clean\x1b[0m");
