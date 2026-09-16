#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = path.join(repoRoot, "docs/operations/phase1-da");
const manifest = JSON.parse(await readFile(path.join(base, "artifact-manifest.json"), "utf8"));
const failures = [];
const requiredClassifications = new Set(["PUBLIC", "SHARED_PASSWORD", "AUTHENTICATED", "INTERNAL"]);

for (const item of manifest.artifacts) {
  if (!requiredClassifications.has(item.classification)) failures.push(`${item.id}: invalid classification`);
  for (const key of ["source", "output"]) {
    if (!item[key]) continue;
    const target = path.resolve(repoRoot, item[key]);
    try { await access(target); } catch { failures.push(`${item.id}: missing ${key} ${item[key]}`); }
  }
  if (item.output) {
    const outputPath = path.resolve(repoRoot, item.output);
    let html = "";
    try { html = await readFile(outputPath, "utf8"); } catch { continue; }
    const expectedRobots = item.classification === "PUBLIC" ? "index,follow" : "noindex,nofollow";
    if (!html.includes(`name="robots" content="${expectedRobots}"`)) failures.push(`${item.id}: incorrect robots policy`);
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      const resolved = path.resolve(path.dirname(outputPath), href.split("#")[0]);
      try { await access(resolved); } catch { failures.push(`${item.id}: broken generated link ${href}`); }
    }
  }
}

const currentSources = manifest.artifacts.filter((item) => item.status === "CURRENT").map((item) => item.source);
for (const relative of currentSources) {
  const target = path.resolve(repoRoot, relative);
  const content = await readFile(target, "utf8");
  if (/\b60\s*bps\b/i.test(content)) failures.push(`${relative}: confidential benchmark leakage`);
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const resolved = path.resolve(path.dirname(target), href.split("#")[0]);
    try { await access(resolved); } catch { failures.push(`${relative}: broken local link ${href}`); }
  }
}

for (const item of manifest.artifacts.filter((entry) => entry.status === "CURRENT" && entry.classification !== "INTERNAL")) {
  const content = await readFile(path.resolve(repoRoot, item.source), "utf8");
  if (/supplier cost plus|internal planning allowance|₹25,000 per person-day/i.test(content)) {
    failures.push(`${item.source}: internal supplier economics in customer artifact`);
  }
}

const customerGuide = await readFile(path.join(base, "AssureRail_Phase1_DA_Customer_Service_Guide.md"), "utf8");
for (const required of ["automated", "does not include a consultant", "qualified", "Base", "Premium", "Full", "item", "PTC is Phase 2"]) {
  if (!customerGuide.toLowerCase().includes(required.toLowerCase())) failures.push(`customer guide: missing ${required}`);
}

const raci = await readFile(path.join(base, "AssureRail_Phase1_DA_Participant_Register_And_RACI.md"), "utf8");
for (const required of ["Seller / originator", "Existing lender", "Buyer / direct assignee", "Seller counsel", "Buyer counsel", "CA / financial reviewer", "Bureau", "Escrow", "Collection-account bank", "ROC / NeSL / RTO", "Servicer", "Field verifier", "Data Preparer", "Referral partner", "AssureRail Finance Checker", "AssureRail Security / Privacy"]) {
  if (!raci.includes(required)) failures.push(`RACI: missing ${required}`);
}

for (const legacy of ["docs/decks/AssureRail_Institutional_GTM_Deck.html", "docs/decks/AssureRail_Objection_Handling_And_Pilot_Playbook.html"]) {
  const content = await readFile(path.join(repoRoot, legacy), "utf8");
  if (!content.includes("ARCHIVED / SUPERSEDED")) failures.push(`${legacy}: missing archive banner`);
  if (!content.includes('name="robots" content="noindex,nofollow"')) failures.push(`${legacy}: missing noindex policy`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL ${failure}`));
  process.exit(1);
}
console.log(`PASS Phase 1 DA ops pack: ${manifest.artifacts.length} artifacts checked`);
