import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [policy, page, cockpit, dockerfile, compose] = await Promise.all([
  read("src/lib/customer-workspace.ts"), read("src/app/workspace/cases/[caseId]/lifecycle/page.tsx"),
  read("src/app/workspace/cases/[caseId]/page.tsx"), read("Dockerfile"), read("../../docker-compose.assurerail.yml"),
]);
assert.match(policy, /NEXT_PUBLIC_ASSURERAIL_LIFECYCLE_PRODUCT_V1/);
assert.match(page, /No external lifecycle action was dispatched/);
for (const value of ["Collections", "waterfall\/distribution", "notices", "substitutions", "repurchases", "defaults", "maturity"]) assert.match(page, new RegExp(value, "i"));
assert.match(page, /Append corrected observation/);
assert.match(page, /Independently reconcile/);
assert.match(cockpit, /item\.status === "COMPLETED".*Open lifecycle/);
assert.match(dockerfile, /ARG NEXT_PUBLIC_ASSURERAIL_LIFECYCLE_PRODUCT_V1="off"/);
assert.ok(compose.includes("NEXT_PUBLIC_ASSURERAIL_LIFECYCLE_PRODUCT_V1: ${NEXT_PUBLIC_ASSURERAIL_LIFECYCLE_PRODUCT_V1:-off}"));
assert.ok(compose.includes("ARAIL_LIFECYCLE_PRODUCT_V1: ${ARAIL_LIFECYCLE_PRODUCT_V1:-off}"));
console.log("AR-25 lifecycle product boundary checks passed");
