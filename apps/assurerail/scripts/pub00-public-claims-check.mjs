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

requireText(railLanding, "Private evaluation now", "AssureRail landing");
requireText(railLanding, "Live transaction services are not currently offered", "AssureRail landing");
requireText(availability, "what an external visitor can request today", "Availability page");
requireText(publicCapability, "PRIVATE_EVALUATION", "Public capability registry");
requireText(publicCapability, "does not currently offer public matching, execution, custody, funds handling or settlement services", "Public capability registry");

for (const [label, value] of [
  ["AssureRail landing", railLanding],
  ["Availability page", availability],
  ["Public capability registry", publicCapability],
]) {
  rejectText(value, "AssureRail — the subsidiary", label);
  rejectText(value, "separately-incorporated subsidiary", label);
  rejectText(value, "AssurePool transactional spikes", label);
}

console.log(
  "PUB-00 public claims: AssureRail availability and corporate-structure boundaries verified in the standalone public surface.",
);
