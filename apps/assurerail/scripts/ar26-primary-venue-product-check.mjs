import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [policy, venue, opportunity, workspace, dockerfile, compose] = await Promise.all([
  read("src/lib/customer-workspace.ts"), read("src/app/workspace/venue/page.tsx"),
  read("src/app/workspace/opportunities/[opportunityId]/page.tsx"), read("src/app/workspace/page.tsx"),
  read("Dockerfile"), read("../../docker-compose.assurerail.yml"),
]);
assert.match(policy, /NEXT_PUBLIC_ASSURERAIL_PRIMARY_VENUE_PRODUCT_V1/);
assert.match(venue, /Discover only opportunities addressed to your institution/);
assert.match(venue, /No public order book, automatic match, trade execution, funds movement, custody or legal completion/);
for (const capability of ["Versioned terms", "Named audience", "Interest and RFQ", "Private negotiation", "Allocation and case handoff"]) assert.match(opportunity, new RegExp(capability, "i"));
assert.match(opportunity, /Accept governed case role/);
assert.match(opportunity, /not a match, executed trade, completed transaction or ownership record/);
assert.match(workspace, /Open venue/);
assert.match(dockerfile, /ARG NEXT_PUBLIC_ASSURERAIL_PRIMARY_VENUE_PRODUCT_V1="off"/);
assert.ok(compose.includes("NEXT_PUBLIC_ASSURERAIL_PRIMARY_VENUE_PRODUCT_V1: ${NEXT_PUBLIC_ASSURERAIL_PRIMARY_VENUE_PRODUCT_V1:-off}"));
assert.ok(compose.includes("ARAIL_PRIMARY_VENUE_PRODUCT_V1: ${ARAIL_PRIMARY_VENUE_PRODUCT_V1:-off}"));
console.log("AR-26 primary venue product boundary checks passed");
