import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [policy, page, home, header, dockerfile, compose] = await Promise.all([
  read("src/lib/customer-workspace.ts"), read("src/app/workspace/institution/page.tsx"),
  read("src/app/workspace/page.tsx"), read("src/components/VenueHeader.tsx"), read("Dockerfile"), read("../../docker-compose.assurerail.yml"),
]);
assert.match(policy, /NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1/);
assert.match(page, /Readiness labels do not grant route authority/);
assert.match(page, /No authentication, route authority or exit action was activated/);
assert.match(page, /Secret material is never accepted here and authentication remains disabled/);
for (const section of ["Identity federation", "Service identities", "Periodic access reviews", "Planned exit"]) assert.match(page, new RegExp(section));
assert.match(home, /institutionalProductEnabled/);
assert.match(header, /workspace\/institution/);
assert.match(dockerfile, /ARG NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1="off"/);
assert.ok(compose.includes("NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1: ${NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1:-off}"));
assert.ok(compose.includes("ARAIL_INSTITUTIONAL_PRODUCT_V1: ${ARAIL_INSTITUTIONAL_PRODUCT_V1:-off}"));
console.log("AR-22 institutional product boundary checks passed");
