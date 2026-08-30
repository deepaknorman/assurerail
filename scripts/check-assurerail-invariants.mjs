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

// NODE_ENV is only a Node/framework optimisation choice. The venue's evidence and capability boundary
// is the explicit AssureRail mode; production must never be inferred merely because a demo build is
// optimised, and an undeclared production process must fail closed.
const appModule = rd("apps/assurerail-api/src/app.module.ts");
const runtimeProfile = rd("apps/assurerail-api/src/runtime/runtime-profile.ts");
const metricsModule = rd("apps/assurerail-api/src/platform/metrics.module.ts");
if (has(main, "assertRuntimeEnvironment(process.env)")) pass("startup validates the explicit AssureRail operating mode before boot");
else bad("main.ts must call assertRuntimeEnvironment(process.env) before creating the Nest app");
if (has(appModule, "shouldMountDemoEndpoints(process.env)") && has(appModule, "...demoModules")) pass("DemoModule is conditionally assembled from the validated mode contract");
else bad("AppModule must conditionally mount DemoModule via shouldMountDemoEndpoints");
if (has(metricsModule, 'from "./metrics.controller"') && !has(metricsModule, 'from "./platform.controllers"')) pass("always-on metrics does not eagerly import the DB-only platform bundle");
else bad("MetricsModule must import the isolated metrics.controller, not the DB-only platform.controllers bundle");
const requiredModes = ["DEMO", "REPLAY", "SHADOW", "SANDBOX", "CONTROLLED_LIVE", "PRODUCTION"];
if (requiredModes.every((mode) => has(runtimeProfile, `"${mode}"`))) pass("all six reviewed operating/evidence modes are declared");
else bad("runtime-profile.ts is missing one or more reviewed AssureRail operating modes");
const productionPreconditions = [
  "DATABASE_URL",
  "FIREBASE_ADMIN_CONFIG",
  "ASSURELOCKER_API_KEY",
  "DIGIKYC_STATUS_SERVICE_SECRET",
  "RECAPTCHA_SITE_KEY",
  "RECAPTCHA_ENFORCE",
  "ASSURELOCKER_API_URL must use https://",
];
if (productionPreconditions.every((needle) => has(runtimeProfile, needle))) pass("controlled-live/production preconditions remain fail-closed");
else bad("runtime-profile.ts is missing one or more controlled-live/production preconditions");

// ── 3. Reviewed controller surface remains exact ──────────────────────────────
console.log("── endpoint contract ──");
const endpointContract = rd("apps/assurerail-api/src/characterisation/current-endpoint-contract.ts");
const endpointRows = (endpointContract.match(/\be\("(?:GET|POST|PATCH|DELETE)"/g) || []).length;
if (endpointRows === 58) pass("reviewed endpoint inventory contains exactly 58 classified routes");
else bad(`reviewed endpoint inventory must contain exactly 58 routes (found ${endpointRows})`);
if (has(endpointContract, "GLOBAL_VENUE") && has(endpointContract, "RESOURCE_ID_ONLY") && has(endpointContract, "AR-C01")) pass("current tenant/resource scoping gaps remain explicit in the inventory");
else bad("endpoint inventory must retain explicit GLOBAL_VENUE/RESOURCE_ID_ONLY scope and AR-C01 linkage");

// ── 4. PR-01 neutral contracts stay complete, provider-neutral and runtime-inert ─
console.log("── neutral contracts v1 ──");
const neutralTaxonomy = rd("apps/assurerail-api/src/contracts/v1/taxonomy.ts");
const neutralSchemas = rd("apps/assurerail-api/src/contracts/v1/schema-registry.ts");
const neutralFlag = rd("apps/assurerail-api/src/contracts/v1/feature-flag.ts");
const neutralMappings = rd("apps/assurerail-api/src/contracts/v1/mappings.ts");
const neutralModes = ["REPLAY", "SHADOW", "SANDBOX", "CONTROLLED_LIVE", "PRODUCTION"];
if (neutralModes.every((mode) => has(neutralTaxonomy, `"${mode}"`)) && has(neutralTaxonomy, "runtime-only and cannot be serialized")) {
  pass("transaction operating modes are explicit and exclude runtime-only DEMO evidence");
} else bad("neutral operating-mode taxonomy is incomplete or has lost the DEMO evidence boundary");
const neutralSchemaIds = ["neutral-intake", "neutral-evidence", "neutral-acknowledgement", "neutral-event"];
if (neutralSchemaIds.every((id) => has(neutralSchemas, `assurerail.${id}`))) pass("all four neutral envelope schemas are registered");
else bad("neutral intake/evidence/acknowledgement/event schema registry is incomplete");
if (has(neutralFlag, '"off"') && has(neutralFlag, '"read_only"') && has(neutralFlag, "no write/enforcement mode")) pass("PR-01 flag remains off/read-only only");
else bad("ARAIL_NEUTRAL_TAXONOMY_V1 must not gain a write/enforcement mode in PR-01");
if (!has(appModule, "contracts/v1") && has(neutralMappings, "assurepool.frozen-da-tape") && has(neutralMappings, "assuretransfer.receivables-da")) {
  pass("neutral mappings are source-profile adapters and remain disconnected from runtime modules");
} else bad("PR-01 neutral contracts must stay runtime-inert with explicit source-profile mappings");

// ── 5. PR-02 durability and webhook security controls remain fail-closed ─────
console.log("── persistence foundation ──");
const persistenceSchema = rd("apps/assurerail-api/prisma/schema.prisma");
const persistenceMigration = rd("apps/assurerail-api/prisma/migrations/20260830190000_assurerail_pr02_persistence_foundation/migration.sql");
const relay = rd("apps/assurerail-api/src/platform/outbox-relay.service.ts");
const webhookEgress = rd("apps/assurerail-api/src/platform/webhook-egress.service.ts");
const webhookVault = rd("apps/assurerail-api/src/platform/webhook-secret-vault.service.ts");
const persistenceModels = [
  "ProviderReference", "SourceReference", "IntakeSubmission", "IntakeReceipt", "IdempotencyRecord",
  "InboxMessage", "OutboxMessage", "ExternalInstruction", "ExternalAcknowledgement", "MigrationReceipt",
];
if (persistenceModels.every((model) => has(persistenceSchema, `model ${model} {`))) pass("all ten additive PR-02 persistence models are declared");
else bad("PR-02 persistence schema is missing one or more required additive models");
if (has(persistenceMigration, 'UPDATE "WebhookSubscription"') && has(persistenceMigration, '"secret" = NULL') && has(persistenceMigration, "LEGACY_PLAINTEXT_SECRET_CLEARED_REPROVISION_AND_VERIFY")) {
  pass("legacy webhook subscriptions are disabled and plaintext secrets cleared by migration");
} else bad("PR-02 migration must fail closed for legacy webhook subscriptions and plaintext secrets");
if (has(relay, "FOR UPDATE SKIP LOCKED") && has(relay, "DEAD_LETTER") && has(relay, 'verifiedAt: { lte: current.createdAt }')) {
  pass("durable relay claims safely, dead-letters and excludes pre-verification history");
} else bad("durable relay must retain safe claims, terminal failure and subscription-verification boundaries");
if (has(webhookEgress, "assertPublicWebhookEndpoint") && has(webhookEgress, 'redirect: "manual"') && has(webhookEgress, "guardedConnectLookup")) {
  pass("webhook egress retains public-address, redirect and DNS-rebinding controls");
} else bad("webhook egress SSRF/rebinding controls are incomplete");
if (has(persistenceSchema, "secretVaultRef") && has(webhookVault, "VAULT_APPROLE_ROLE_ID") && has(webhookVault, 'redirect: "error"')) {
  pass("webhook secrets use an opaque Vault reference and redirect-safe Vault client");
} else bad("webhook secret storage must remain Vault-backed with redirect-safe access");
if (has(runtimeProfile, "requires ARAIL_DURABLE_RELAY_MODE=durable") && has(runtimeProfile, "VAULT_ADDR is required")) {
  pass("controlled-live/production startup requires durable relay and Vault configuration");
} else bad("live startup must fail closed without the durable relay and Vault configuration");

// ── 6. Ledger value-path is transactional (P3 hardening must not regress) ─────
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

// ── 7. Database segregation (venue never touches AssureLocker's DB/client) ────
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

// ── 8. Adapters default to DEMO; the runtime profile blocks them from live modes ─
console.log("── adapters ──");
const cfg = rd("apps/assurerail-api/src/config.ts");
const demoDefaults = ["tapeSource", "htsAdapter", "hcsAnchor", "settlementAdapter"].every((k) => new RegExp(`${k}[^\\n]*\\?\\?[^\\n]*"?demo"?`, "i").test(cfg) || new RegExp(`${k}.*"demo"`, "i").test(cfg));
if (demoDefaults) pass("all external adapters default to DEMO (the runtime profile separately forbids them in live modes)");
else bad("config.ts must default tapeSource/htsAdapter/hcsAnchor/settlementAdapter to 'demo'");

console.log("");
if (fail) { console.log("\x1b[31m✗ AssureRail invariants FAILED\x1b[0m"); process.exit(1); }
console.log("\x1b[32m✓ AssureRail invariants clean\x1b[0m");
