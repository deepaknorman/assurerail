import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const [
  policy,
  register,
  casePage,
  caseIntegrations,
  workspace,
  dockerfile,
  compose,
] = await Promise.all([
  read("src/lib/customer-workspace.ts"),
  read("src/app/workspace/integrations/page.tsx"),
  read("src/app/workspace/cases/[caseId]/page.tsx"),
  read("src/app/workspace/cases/[caseId]/integrations/page.tsx"),
  read("src/app/workspace/page.tsx"),
  read("Dockerfile"),
  read("../../docker-compose.assurerail.yml"),
]);
assert.match(policy, /NEXT_PUBLIC_ASSURERAIL_ENTERPRISE_INTEGRATION_V1/);
for (const text of [
  "Lender registry",
  "trustee",
  "RTA/depository",
  "payment",
  "signing",
  "stamping",
  "rating",
  "servicing",
  "finance",
  "CRM",
  "notification",
])
  assert.match(register, new RegExp(text, "i"));
assert.match(register, /software pass is not certification/i);
assert.match(register, /NO DISPATCH/);
assert.match(casePage, /Case integrations/);
assert.match(
  caseIntegrations,
  /binding records\s+authority; it never dispatches/i
);
assert.match(workspace, /Enterprise integrations/);
assert.match(
  dockerfile,
  /ARG NEXT_PUBLIC_ASSURERAIL_ENTERPRISE_INTEGRATION_V1="off"/
);
assert.ok(
  compose.includes(
    "ARAIL_ENTERPRISE_INTEGRATION_V1: ${ARAIL_ENTERPRISE_INTEGRATION_V1:-off}"
  )
);
assert.ok(
  compose.includes(
    "NEXT_PUBLIC_ASSURERAIL_ENTERPRISE_INTEGRATION_V1: ${NEXT_PUBLIC_ASSURERAIL_ENTERPRISE_INTEGRATION_V1:-off}"
  )
);
console.log("AR-29 enterprise integration boundary checks passed");
