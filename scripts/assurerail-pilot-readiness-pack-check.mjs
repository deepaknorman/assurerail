#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const required = [
  "apps/assurerail/public/favicon.png",
  "apps/assurerail/src/lib/public-structured-data.ts",
  "docs/gtm/AssureRail_Pilot_In_A_Day_Readiness_Pack.md",
  "docs/gtm/AssureRail_Pilot_Pricing_And_Commercial_Schedule_DRAFT.md",
  "docs/gtm/templates/AssureRail_Pilot_Pricing_Worksheet.xlsx",
  "docs/gtm/templates/AssureRail_Pilot_Readiness_Checklist.csv",
  "docs/legal/AssureRail_Replay_Shadow_Pilot_Agreement_DRAFT.md",
  "scripts/build-assurerail-pilot-pricing-xlsx.py",
  "scripts/build-assurerail-web-assets.mjs",
];
for (const path of required) if (!existsSync(resolve(root, path))) failures.push(`missing ${path}`);

function source(path) { return readFileSync(resolve(root, path), "utf8"); }
const publicContent = source("apps/assurerail/src/lib/public-content.ts");
for (const slug of [
  "signed-evidence-packages-still-require-institutional-review",
  "from-completed-deal-replay-to-a-controlled-shadow",
]) if (!publicContent.includes(slug)) failures.push(`missing public article ${slug}`);

const structured = source("apps/assurerail/src/lib/public-structured-data.ts");
for (const token of ["#organization", "#website", "BreadcrumbList", "ImageObject"]) {
  if (!structured.includes(token)) failures.push(`structured-data contract missing ${token}`);
}
for (const premature of ["legalName", "taxID", "addressCountry", "foundingDate"]) {
  if (new RegExp(`^[^/\\n]*${premature}`, "m").test(structured)) failures.push(`premature company field in structured data: ${premature}`);
}

const pricing = source("docs/gtm/AssureRail_Pilot_Pricing_And_Commercial_Schedule_DRAFT.md");
for (const token of ["0.30%", "0.50%", "fee base", "minimum", "cap", "refund", "Assurance or professional opinion"]) {
  if (!pricing.includes(token)) failures.push(`pricing governance missing ${token}`);
}
const agreement = source("docs/legal/AssureRail_Replay_Shadow_Pilot_Agreement_DRAFT.md");
for (const token of [
  "Not for signature until the AssureRail contracting entity",
  "Controlled-live",
  "Data scope and handling",
  "Intellectual property",
  "Confidentiality and publicity",
  "Liability, indemnities and insurance",
  "Schedule 4 — authority and activation record",
]) if (!agreement.includes(token)) failures.push(`pilot agreement missing ${token}`);

const readiness = source("docs/gtm/AssureRail_Pilot_In_A_Day_Readiness_Pack.md");
for (const token of ["Private synthetic demonstration", "Completed-deal replay", "Current-transaction shadow", "NO-GO", "safe-pause"]) {
  if (!readiness.includes(token)) failures.push(`one-day readiness pack missing ${token}`);
}

const png = readFileSync(resolve(root, "apps/assurerail/public/favicon.png"));
if (png.length < 32 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") failures.push("favicon.png is not a PNG");
else if (png.readUInt32BE(16) !== 64 || png.readUInt32BE(20) !== 64) failures.push("favicon.png must be exactly 64x64");
const workbook = readFileSync(resolve(root, "docs/gtm/templates/AssureRail_Pilot_Pricing_Worksheet.xlsx"));
if (workbook.length < 1_000 || workbook.subarray(0, 2).toString() !== "PK") failures.push("pricing workbook is not a valid XLSX container");

const anonymousSources = [
  "apps/assurerail/src/app/page.tsx",
  "apps/assurerail/src/lib/public-capability.ts",
  "apps/assurerail/src/lib/public-content.ts",
].map(source).join("\n");
for (const confidential of ["0.30%", "0.50%", "30 bps", "50 bps", "AR-LENS-01", "PTC preparation Stage 4"]) {
  if (anonymousSources.includes(confidential)) failures.push(`confidential detail leaked to anonymous source: ${confidential}`);
}

if (failures.length) {
  console.error("AssureRail pilot/public readiness pack FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("AssureRail pilot/public readiness pack verified: public metadata/assets, two articles, governed pricing, draft contract and one-day mobilisation controls.");
