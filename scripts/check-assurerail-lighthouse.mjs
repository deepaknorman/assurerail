#!/usr/bin/env node
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("usage: check-assurerail-lighthouse.mjs <report.json>");
const report = JSON.parse(readFileSync(path, "utf8"));
const minimums = { performance: 0.85, accessibility: 0.95, "best-practices": 0.9, seo: 0.95 };
const failures = [];
for (const [category, minimum] of Object.entries(minimums)) {
  const score = report.categories?.[category]?.score;
  if (typeof score !== "number" || score < minimum) failures.push(`${category}: ${score ?? "missing"} < ${minimum}`);
}
if (failures.length) {
  console.error("AssureRail Lighthouse threshold FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("AssureRail Lighthouse threshold PASS.");
