#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const staticRoot = resolve(import.meta.dirname, "..", ".next", "static");
if (!existsSync(staticRoot)) {
  console.error("Built exposure check requires a completed Next.js build");
  process.exit(1);
}

function filesBelow(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

const clientText = filesBelow(staticRoot)
  .filter((path) => /\.(?:js|css|map|json|txt)$/.test(path))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

const protectedMarkers = [
  "AR-21/22",
  "PR-09 · AR-23",
  "Hyderabad primary and Pune recovery",
  "PARTNER_EXECUTED_PILOT",
  "Participant/trustee-authorised all-leg historic replay",
];
const leaked = protectedMarkers.filter((marker) => clientText.includes(marker));
if (leaked.length) {
  console.error("Protected diligence content leaked into public client assets");
  leaked.forEach((marker) => console.error(`- ${marker}`));
  process.exit(1);
}

console.log(`Built public exposure verified across ${filesBelow(staticRoot).length} client assets; protected markers absent.`);
