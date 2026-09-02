import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [policy, registry, journey, casePage, workspace, dockerfile, compose] = await Promise.all([
  read("src/lib/customer-workspace.ts"), read("src/app/workspace/tokenised/page.tsx"),
  read("src/app/workspace/cases/[caseId]/tokenised/page.tsx"), read("src/app/workspace/cases/[caseId]/page.tsx"),
  read("src/app/workspace/page.tsx"), read("Dockerfile"), read("../../docker-compose.assurerail.yml"),
]);
assert.match(policy, /NEXT_PUBLIC_ASSURERAIL_TOKENISED_PRODUCT_V1/);
assert.match(registry, /Tokenised DA and PTC register/);
assert.match(registry, /token is not presumed legal title/);
for (const capability of ["External activation gates", "Representation boundary", "Link the DA token mirror", "Prepare an observe-only token action", "Four-way reconciliation", "Propose the separately governed PTC mirror", "External evidence gates", "Dormant action plans", "Download evidence pack"]) assert.match(journey, new RegExp(capability, "i"));
assert.match(journey, /No token or payment action can be dispatched/);
assert.match(casePage, /Open tokenised journey/);
assert.match(workspace, /Tokenised DA & PTC/);
assert.match(dockerfile, /ARG NEXT_PUBLIC_ASSURERAIL_TOKENISED_PRODUCT_V1="off"/);
assert.ok(compose.includes("NEXT_PUBLIC_ASSURERAIL_TOKENISED_PRODUCT_V1: ${NEXT_PUBLIC_ASSURERAIL_TOKENISED_PRODUCT_V1:-off}"));
assert.ok(compose.includes("ARAIL_TOKENISED_PRODUCT_V1: ${ARAIL_TOKENISED_PRODUCT_V1:-off}"));
console.log("AR-28 tokenised route product boundary checks passed");
