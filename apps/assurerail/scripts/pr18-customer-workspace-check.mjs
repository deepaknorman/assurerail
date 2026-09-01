import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [policy, home, detail, opportunity, header] = await Promise.all([
  read("src/lib/customer-workspace.ts"), read("src/app/workspace/page.tsx"),
  read("src/app/workspace/cases/[caseId]/page.tsx"), read("src/app/workspace/opportunities/[opportunityId]/page.tsx"),
  read("src/components/VenueHeader.tsx"),
]);

assert.match(policy, /EXPECTED.*RECEIVED.*VERIFIED.*RECONCILED.*LEGALLY_EFFECTIVE/s);
assert.match(policy, /status: "UNAVAILABLE"/);
assert.match(home, /Visibility never grants authority/);
assert.match(home, /membership, mandate, appointment, case role and route entitlement/);
assert.match(detail, /Source as-of/);
assert.match(detail, /Qualifications/);
assert.match(detail, /Support cannot close a break/);
assert.match(opportunity, /not an order book, automatic match, legal completion or ownership record/i);
assert.match(header, /Legacy console/);
assert.match(header, /NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1/);
console.log("PR-18 customer workspace boundary checks passed");
