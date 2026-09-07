#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const paths = [
  "src/app/page.tsx",
  "src/app/status/page.tsx",
  "src/app/trust/page.tsx",
  "src/app/replay/page.tsx",
  "src/app/routes/[slug]/page.tsx",
  "src/app/for/[slug]/page.tsx",
  "src/app/resources/page.tsx",
  "src/app/resources/[slug]/page.tsx",
  "src/components/PublicSite.tsx",
  "src/lib/public-capability.ts",
  "src/lib/public-content.ts",
  "src/lib/public-structured-data.ts",
];
const publicSource = paths.map((path) => `\nFILE:${path}\n${readFileSync(resolve(root, path), "utf8")}`).join("\n");
const forbidden = [
  /\b(?:PR|AR|SEC|CX|SIM|PUB|INBOUND)-\d/,
  /behind disabled controls/i,
  /production-scale assessment board/i,
  /\bVAPT\b/,
  /\bAzure\b/,
  /\bHyderabad\b/,
  /\bPune\b/,
  /\bKey Vault\b/i,
  /\bHMAC\b/,
  /\bAssurePool\b/,
  /\bAssurePlane\b/,
];
const failures = forbidden.filter((pattern) => pattern.test(publicSource)).map((pattern) => `anonymous source contains ${pattern}`);
const sitemap = readFileSync(resolve(root, "src/app/sitemap.ts"), "utf8");
const footer = readFileSync(resolve(root, "src/components/PublicSite.tsx"), "utf8");
const diligence = readFileSync(resolve(root, "src/lib/diligence-content.ts"), "utf8");
const proxy = readFileSync(resolve(root, "src/proxy.ts"), "utf8");
if (sitemap.includes("/diligence") || sitemap.includes("/sandbox")) failures.push("controlled routes must not appear in the public sitemap");
if (footer.includes('href="/diligence"') || footer.includes('href="/sandbox"')) failures.push("controlled routes must not appear in anonymous navigation");
if (!diligence.startsWith('import "server-only";')) failures.push("diligence content must be server-only");
for (const token of ["ASSURERAIL_DILIGENCE_ENABLED", "ASSURERAIL_DILIGENCE_USERNAME", "ASSURERAIL_DILIGENCE_PASSWORD", '"/diligence/:path*"', "X-Robots-Tag", "no-store", "Referrer-Policy", "X-Content-Type-Options"]) {
  if (!proxy.includes(token)) failures.push(`diligence proxy is missing ${token}`);
}
for (const token of ["ASSURERAIL_PRIVATE_UI_ENABLED", '"/internal/:path*"', '"/workspace/:path*"', '"/admin/:path*"']) {
  if (!proxy.includes(token)) failures.push(`private operational UI proxy is missing ${token}`);
}
if (failures.length) {
  console.error("Public exposure boundary FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Public exposure boundary verified across ${paths.length} anonymous source files; detailed diligence remains server-only and gated.`);
