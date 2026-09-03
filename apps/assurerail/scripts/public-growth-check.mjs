#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const required = [
  "src/app/routes/[slug]/page.tsx",
  "src/app/for/[slug]/page.tsx",
  "src/app/status/page.tsx",
  "src/app/trust/page.tsx",
  "src/app/replay/page.tsx",
  "src/app/replay/ReplayInquiryForm.tsx",
  "src/app/api/inquiries/route.ts",
  "src/app/resources/page.tsx",
  "src/app/resources/[slug]/page.tsx",
  "src/app/sitemap.ts",
  "src/app/robots.ts",
  "src/lib/public-content.ts",
];

for (const path of required) if (!existsSync(resolve(root, path))) failures.push(`missing ${path}`);

const content = readFileSync(resolve(root, "src/lib/public-content.ts"), "utf8");
for (const token of ["direct-assignment", "ptc", "originators", "transferees-investors", "trustees", "completed-deal-replay-before-platform-replacement", "authoritative-records-reconciliation-and-digital-representations"]) {
  if (!content.includes(token)) failures.push(`public content is missing ${token}`);
}

const inquiry = readFileSync(resolve(root, "src/app/api/inquiries/route.ts"), "utf8");
for (const control of ["ASSURERAIL_INBOUND_ENABLED", "ASSURERAIL_PUBLIC_ORIGINS", "ASSURERAIL_INBOUND_ALLOWED_HOSTS", "ASSURERAIL_INBOUND_WEBHOOK_SECRET", "MAX_BYTES", "MAX_BUCKETS", "takeRateLimit", "readBoundedBody", "lookup(url.hostname", "isPrivateAddress", 'redirect: "manual"', "AbortSignal.timeout", 'cache: "no-store"']) {
  if (!inquiry.includes(control)) failures.push(`inbound endpoint is missing control ${control}`);
}
for (const forbidden of ["multipart/form-data", "transactionDocument", "borrowerData", "customerFile"]) {
  if (inquiry.includes(forbidden)) failures.push(`inbound endpoint includes prohibited intake ${forbidden}`);
}
const inquiryForm = readFileSync(resolve(root, "src/app/replay/ReplayInquiryForm.tsx"), "utf8");
if (!/consent:\s*false/.test(inquiryForm)) failures.push("replay contact consent must default unchecked");

const allPublic = [
  content,
  readFileSync(resolve(root, "src/app/page.tsx"), "utf8"),
  readFileSync(resolve(root, "src/app/trust/page.tsx"), "utf8"),
  readFileSync(resolve(root, "src/app/status/page.tsx"), "utf8"),
  readFileSync(resolve(root, "src/app/replay/page.tsx"), "utf8"),
].join("\n");
for (const claim of ["VAPT complete", "production-ready", "atomic settlement", "token transfer equals title", "RBI approved", "SEBI approved", "guaranteed return"]) {
  if (allPublic.toLowerCase().includes(claim.toLowerCase())) failures.push(`unsafe public claim present: ${claim}`);
}
if (!allPublic.includes("Live transaction services are not currently offered")) failures.push("current public availability boundary is absent");

if (failures.length) {
  console.error("GTM-01/PUB-01/INBOUND-01/PUB-02/CONTENT-01 check FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Public growth tranches verified: routes/personas/trust/status, bounded inbound handoff, resources, sitemap and claim guards.");
