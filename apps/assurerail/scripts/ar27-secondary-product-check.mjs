import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [policy, registry, journey, casePage, workspace, dockerfile, compose] = await Promise.all([
  read("src/lib/customer-workspace.ts"), read("src/app/workspace/secondary/page.tsx"),
  read("src/app/workspace/cases/[caseId]/secondary/page.tsx"), read("src/app/workspace/cases/[caseId]/page.tsx"),
  read("src/app/workspace/page.tsx"), read("Dockerfile"), read("../../docker-compose.assurerail.yml"),
]);
assert.match(policy, /NEXT_PUBLIC_ASSURERAIL_SECONDARY_PRODUCT_V1/);
assert.match(registry, /Secondary DA and PTC register/);
assert.match(registry, /does not execute a trade, move funds or title, issue a token/);
for (const capability of ["Evidence checklist", "Create observe-only dossier", "Independent review", "Evidence and reconciliation legs", "Append-only break repair", "Comparison CSV", "Evidence pack"]) assert.match(journey, new RegExp(capability, "i"));
assert.match(journey, /No external action was dispatched/);
assert.match(casePage, /Open secondary journey/);
assert.match(workspace, /Open register/);
assert.match(dockerfile, /ARG NEXT_PUBLIC_ASSURERAIL_SECONDARY_PRODUCT_V1="off"/);
assert.ok(compose.includes("NEXT_PUBLIC_ASSURERAIL_SECONDARY_PRODUCT_V1: ${NEXT_PUBLIC_ASSURERAIL_SECONDARY_PRODUCT_V1:-off}"));
assert.ok(compose.includes("ARAIL_SECONDARY_PRODUCT_V1: ${ARAIL_SECONDARY_PRODUCT_V1:-off}"));
console.log("AR-27 conventional secondary product boundary checks passed");
