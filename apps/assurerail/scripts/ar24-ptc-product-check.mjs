import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [policy, page, cockpit, dockerfile, compose] = await Promise.all([
  read("src/lib/customer-workspace.ts"),
  read("src/app/workspace/cases/[caseId]/ptc/page.tsx"),
  read("src/app/workspace/cases/[caseId]/page.tsx"),
  read("Dockerfile"),
  read("../../docker-compose.assurerail.yml"),
]);
assert.match(policy, /NEXT_PUBLIC_ASSURERAIL_PTC_PRODUCT_V1/);
assert.match(page, /No funds, issue, allotment, notice or register action was dispatched/);
assert.match(page, /Never use fixtures to close an external gate/);
for (const section of ["External gates", "Parties & function performers", "Trustee & authoritative record", "Replay authorisation", "Immutable PTC completion plan", "Break repair queue"])
  assert.match(page, new RegExp(section));
assert.match(page, /keyFor\(scope: string\)/);
assert.match(page, /Comparison report/);
assert.match(page, /Evidence pack/);
assert.match(cockpit, /Open PTC journey/);
assert.match(dockerfile, /ARG NEXT_PUBLIC_ASSURERAIL_PTC_PRODUCT_V1="off"/);
assert.ok(compose.includes("NEXT_PUBLIC_ASSURERAIL_PTC_PRODUCT_V1: ${NEXT_PUBLIC_ASSURERAIL_PTC_PRODUCT_V1:-off}"));
assert.ok(compose.includes("ARAIL_PTC_PRODUCT_V1: ${ARAIL_PTC_PRODUCT_V1:-off}"));
console.log("AR-24 conventional PTC product boundary checks passed");
