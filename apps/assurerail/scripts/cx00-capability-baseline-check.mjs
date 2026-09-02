import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const capabilitySource = read("src/lib/public-capability.ts");
const envExample = read(".env.example");
const workspaceSource = read("src/lib/customer-workspace.ts");

const expectedRoutes = [
  "src/app/workspace/page.tsx",
  "src/app/workspace/tasks/page.tsx",
  "src/app/workspace/institution/page.tsx",
  "src/app/workspace/venue/page.tsx",
  "src/app/workspace/secondary/page.tsx",
  "src/app/workspace/tokenised/page.tsx",
  "src/app/workspace/integrations/page.tsx",
  "src/app/workspace/operations/page.tsx",
  "src/app/workspace/developer/page.tsx",
  "src/app/workspace/cases/[caseId]/page.tsx",
  "src/app/workspace/cases/[caseId]/da/page.tsx",
  "src/app/workspace/cases/[caseId]/ptc/page.tsx",
  "src/app/workspace/cases/[caseId]/lifecycle/page.tsx",
  "src/app/workspace/cases/[caseId]/secondary/page.tsx",
  "src/app/workspace/cases/[caseId]/tokenised/page.tsx",
  "src/app/workspace/cases/[caseId]/integrations/page.tsx",
];

for (const route of expectedRoutes) {
  assert.equal(existsSync(resolve(root, route)), true, `missing customer route: ${route}`);
}

const expectedWebFlags = [
  "NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1",
  "NEXT_PUBLIC_ASSURERAIL_CUSTOMER_OPERATIONS_V1",
  "NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1",
  "NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_DA_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_PTC_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_LIFECYCLE_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_PRIMARY_VENUE_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_SECONDARY_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_TOKENISED_PRODUCT_V1",
  "NEXT_PUBLIC_ASSURERAIL_ENTERPRISE_INTEGRATION_V1",
  "NEXT_PUBLIC_ASSURERAIL_PRODUCTION_SCALE_V1",
];

for (const flag of expectedWebFlags) {
  assert.match(envExample, new RegExp(`^${flag}=off`, "m"), `${flag} must default off`);
  assert.ok(workspaceSource.includes(flag), `${flag} must have a web boundary helper`);
}

for (const id of [
  "institutional-control",
  "conventional-da",
  "conventional-ptc",
  "primary-secondary",
  "tokenised-representations",
  "enterprise-integration",
  "controlled-live-production",
]) {
  assert.ok(capabilitySource.includes(`id: "${id}"`), `missing public capability: ${id}`);
}

assert.match(capabilitySource, /controlled-live[\s\S]*state: "NOT_AVAILABLE"/);
assert.ok(capabilitySource.includes("No controlled-live or production route is available"));
assert.ok(capabilitySource.includes("participant/trustee-authorised all-leg historic replay"));
assert.ok(!capabilitySource.includes("AssurePool Note"));
assert.ok(!capabilitySource.includes("settlement risk eliminated"));
assert.ok(!capabilitySource.includes("e₹"));

console.log(
  `CX-00 capability baseline: ${expectedRoutes.length} customer routes, ${expectedWebFlags.length} fail-closed web flags and 7 publication-safe capability entries verified.`
);
