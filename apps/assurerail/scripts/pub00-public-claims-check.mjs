import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, "../../..");

async function source(relativePath) {
  return readFile(path.join(repository, relativePath), "utf8");
}

function requireText(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`${label}: required publication boundary is missing: ${expected}`);
  }
}

function rejectText(value, rejected, label) {
  if (value.includes(rejected)) {
    throw new Error(`${label}: rejected current-state claim remains: ${rejected}`);
  }
}

const railLanding = await source("apps/assurerail/src/app/page.tsx");
const availability = await source("apps/assurerail/src/app/status/page.tsx");
const publicCapability = await source("apps/assurerail/src/lib/public-capability.ts");
const publicContent = await source("apps/assurerail/src/lib/public-content.ts");
const assessment = await source("apps/assurerail/src/app/workspace/assessment/page.tsx");
const publicCommercialPolicy = await source("apps/assurerail/src/lib/generated/commercial-policy.ts");

requireText(railLanding, "Apply for Initial Assessment", "AssureRail landing");
requireText(railLanding, "Applications open for approved NBFC portfolios", "AssureRail landing");
requireText(railLanding, "Conventional DA · Phase 1", "AssureRail landing");
requireText(availability, "Initial Assessment applications are open", "Availability page");
requireText(publicCapability, "Applications open", "Public capability registry");
requireText(publicCapability, "Execution requires an accepted seller mandate and activation with the buyer and appointed providers", "Public capability registry");
requireText(publicCapability, "does not act as custodian or hold client funds", "Public capability registry");
requireText(publicContent, "₹48 crore declared is the starting point, not the sale amount", "EV cohort article");
requireText(publicContent, "about ₹30 crore", "EV cohort article");
requireText(publicContent, "₹36.40L", "EV cohort article");
requireText(publicContent, "one ₹8 lakh minimum for the formed cohort", "EV cohort article");
requireText(publicContent, "AssureRail bears that cohort under-fill risk", "EV cohort article");
requireText(publicContent, "does not commingle ownership", "EV cohort article");
requireText(assessment, "40 bps on the first ₹25 crore", "Assessment workspace");
requireText(assessment, "₹8 lakh seller minimum", "Assessment workspace");

for (const [label, value] of [
  ["AssureRail landing", railLanding],
  ["Availability page", availability],
  ["Public capability registry", publicCapability],
  ["Public content", publicContent],
  ["Assessment workspace", assessment],
  ["Public commercial policy snapshot", publicCommercialPolicy],
]) {
  rejectText(value, "AssureRail — the subsidiary", label);
  rejectText(value, "separately-incorporated subsidiary", label);
  rejectText(value, "AssurePool transactional spikes", label);
  rejectText(value, "50 basis points on the first ₹10 crore", label);
  rejectText(value, "50 bps on the first ₹10 crore", label);
  rejectText(value, "35 bps from ₹50–100 crore", label);
  rejectText(value, "₹6.5 lakh minimum", label);
  rejectText(value, "60 bps", label);
  rejectText(value, "60 basis points", label);
  rejectText(value, "internalAssureRailRevenueBenchmarkBps", label);
  rejectText(value, "contractorDayCostMinor", label);
  rejectText(value, "basePercent", label);
}

for (const obsolete of ["₹55 crore", "₹65 lakh", "seller minimum applies", "₹5 lakh seller minimum"]) {
  rejectText(publicContent, obsolete, "EV cohort article");
}

console.log(
  "PUB-00 public claims: AssureRail availability and corporate-structure boundaries verified in the standalone public surface.",
);
