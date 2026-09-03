#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const publicSource = readFileSync(resolve(root, "src/lib/public-capability.ts"), "utf8");
const diligenceSource = readFileSync(resolve(root, "src/lib/diligence-content.ts"), "utf8");

function value(source, name) {
  const match = source.match(new RegExp(`export const ${name} = "([^"]+)"`));
  if (!match) throw new Error(`Missing ${name}`);
  return match[1];
}

function verifyWindow(label, reviewedText, dueText) {
  const reviewed = new Date(`${reviewedText}T00:00:00+05:30`);
  const due = new Date(`${dueText}T23:59:59+05:30`);
  const now = new Date();
  if (!Number.isFinite(reviewed.getTime()) || !Number.isFinite(due.getTime())) throw new Error(`${label} has an invalid review date`);
  if (reviewed > now) throw new Error(`${label} review date is in the future`);
  if (due <= reviewed) throw new Error(`${label} next-review date must follow its review date`);
  if (now > due) throw new Error(`${label} content is stale; review was due ${dueText}`);
  return dueText;
}

const publicDue = verifyWindow("Public", value(publicSource, "PUBLIC_CAPABILITY_REVIEWED_AT"), value(publicSource, "PUBLIC_CAPABILITY_NEXT_REVIEW_AT"));
const diligenceDue = verifyWindow("Diligence", value(diligenceSource, "DILIGENCE_REVIEWED_AT"), value(diligenceSource, "DILIGENCE_NEXT_REVIEW_AT"));
for (const milestone of ["COUNSEL_ROUTE_REVIEW", "INDEPENDENT_SECURITY_TEST", "DA_HISTORIC_REPLAY", "PTC_HISTORIC_REPLAY", "DA_PTC_SHADOW", "PARTNER_EXECUTED_PILOT"]) {
  if (!diligenceSource.includes(`id: "${milestone}"`)) throw new Error(`Missing stakeholder milestone ${milestone}`);
}
const milestoneRows = [...diligenceSource.matchAll(/\{ id: "([A-Z_]+)", label: "[^"]+", state: "[A-Z_]+", owner: "([^"]+)", lastCheckedAt: "([^"]+)", nextEvidence: "([^"]+)"/g)];
if (milestoneRows.length !== 6) throw new Error(`Expected 6 complete milestone ownership rows, found ${milestoneRows.length}`);
for (const [, milestone, owner, checkedAt, nextEvidence] of milestoneRows) {
  if (!owner.trim() || !nextEvidence.trim()) throw new Error(`${milestone} is missing an owner or next-evidence requirement`);
  const checked = new Date(`${checkedAt}T00:00:00+05:30`);
  if (!Number.isFinite(checked.getTime()) || checked > new Date()) throw new Error(`${milestone} has an invalid last-checked date`);
  if (checkedAt < value(diligenceSource, "DILIGENCE_REVIEWED_AT")) throw new Error(`${milestone} was not checked in the current diligence review`);
}
console.log(`Content freshness verified: public due ${publicDue}; diligence due ${diligenceDue}; stakeholder milestone register present.`);
