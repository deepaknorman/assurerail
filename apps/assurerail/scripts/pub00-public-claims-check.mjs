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
const downloads = await source("apps/web/src/app/downloads/page.tsx");
const investors = await source("apps/web/src/app/investors/page.tsx");
const railBriefing = await source(
  "apps/web/src/app/downloads/briefings/AssureRail/page.tsx",
);
const poolTokenisation = await source(
  "apps/web/src/app/downloads/briefings/Pool-Tokenisation/page.tsx",
);
const historicRbi = await source(
  "apps/web/src/app/downloads/briefings/RBI-July2026/page.tsx",
);

requireText(railLanding, "Built, evidenced and activated are different states.", "AssureRail landing");
requireText(railLanding, "No live matching", "AssureRail landing");
requireText(downloads, "governed transaction infrastructure", "Downloads index");
requireText(investors, "AssurePool DA preparation", "Investor page");
requireText(investors, "company, IP, funding and licence", "Investor page");
requireText(railBriefing, "earlier token-first AssureRail briefing has been withdrawn", "AssureRail briefing");
requireText(poolTokenisation, "AssurePool remains a Direct Assignment-only", "Pool tokenisation briefing");
requireText(historicRbi, "Historic briefing — not current product", "Historic RBI briefing");

for (const [label, value] of [
  ["Downloads index", downloads],
  ["Investor page", investors],
  ["AssureRail briefing", railBriefing],
]) {
  rejectText(value, "AssureRail — the subsidiary", label);
  rejectText(value, "separately-incorporated subsidiary", label);
  rejectText(value, "AssurePool transactional spikes", label);
}

console.log(
  "PUB-00 public claims: current AssureRail, AssurePool and corporate-structure boundaries verified; legacy token-first briefings are withdrawn or visibly historic.",
);
