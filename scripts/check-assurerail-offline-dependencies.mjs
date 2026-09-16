#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(root, "package-lock.json");
const failures = [];
const checked = { lockEntries: 0, installedEntries: 0, optionalMissing: 0, manifests: 0 };

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

if (!existsSync(lockPath)) failures.push("package-lock.json is missing");
const lockRaw = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : "{}";
const lock = JSON.parse(lockRaw);
if (lock.lockfileVersion !== 3) failures.push(`package-lock lockfileVersion must be 3, received ${lock.lockfileVersion}`);
if (!lock.packages || typeof lock.packages !== "object") failures.push("package-lock packages metadata is missing");

for (const [entryPath, entry] of Object.entries(lock.packages ?? {})) {
  if (!entryPath.includes("node_modules/") || entry.link) continue;
  checked.lockEntries += 1;
  if (typeof entry.resolved === "string" && entry.resolved.startsWith("http:") ) failures.push(`${entryPath}: insecure resolved URL`);
  if (typeof entry.resolved === "string" && /^https?:/.test(entry.resolved) && !/^sha512-[A-Za-z0-9+/=]+$/.test(entry.integrity ?? "")) {
    failures.push(`${entryPath}: registry dependency lacks sha512 integrity metadata`);
  }

  const installedManifest = path.join(root, entryPath, "package.json");
  if (!existsSync(installedManifest)) {
    if (entry.optional === true) { checked.optionalMissing += 1; continue; }
    failures.push(`${entryPath}: installed package metadata is missing`);
    continue;
  }
  checked.installedEntries += 1;
  const installed = readJson(installedManifest);
  if (entry.version && installed.version !== entry.version) failures.push(`${entryPath}: installed ${installed.version} does not match lock ${entry.version}`);
}

const workspaceManifests = ["package.json", "apps/assurerail/package.json", "apps/assurerail-api/package.json"];
for (const relative of workspaceManifests) {
  const manifestPath = path.join(root, relative);
  if (!existsSync(manifestPath)) { failures.push(`${relative}: manifest missing`); continue; }
  checked.manifests += 1;
  const manifest = readJson(manifestPath);
  const dependencyNames = Object.keys({ ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}), ...(manifest.optionalDependencies ?? {}) });
  for (const name of dependencyNames) {
    const segments = name.startsWith("@") ? name.split("/").slice(0, 2) : [name];
    const candidates = [
      path.join(path.dirname(manifestPath), "node_modules", ...segments, "package.json"),
      path.join(root, "node_modules", ...segments, "package.json"),
    ];
    if (!candidates.some(existsSync)) failures.push(`${relative}: direct dependency ${name} is not installed`);
  }
}

const rootManifest = readJson(path.join(root, "package.json"));
const workspaceLockEntries = ["apps/assurerail", "apps/assurerail-api"];
for (const workspace of workspaceLockEntries) {
  if (!rootManifest.workspaces?.includes("apps/*")) failures.push("root workspace declaration apps/* is missing");
  if (!lock.packages?.[workspace]) failures.push(`package-lock workspace entry ${workspace} is missing`);
  else {
    const actual = realpathSync(path.join(root, workspace));
    if (!actual.startsWith(realpathSync(root) + path.sep)) failures.push(`${workspace}: workspace resolves outside repository`);
  }
}

const digest = createHash("sha256").update(lockRaw).digest("hex");
if (failures.length) {
  console.error("OFFLINE DEPENDENCY INTEGRITY FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`OFFLINE DEPENDENCY INTEGRITY PASS — lock sha256=${digest}`);
console.log(`lock entries=${checked.lockEntries}; installed verified=${checked.installedEntries}; optional platform entries absent=${checked.optionalMissing}; manifests=${checked.manifests}`);
console.log("Advisory freshness is deliberately excluded: this check reads local lock and installed metadata only.");
