import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const [policy, page, internalPage, dockerfile, compose] = await Promise.all([
  read("src/lib/customer-workspace.ts"),
  read("src/app/internal/production-scale/page.tsx"),
  read("src/app/internal/page.tsx"),
  read("Dockerfile"),
  read("../../docker-compose.assurerail.yml"),
]);

assert.match(policy, /NEXT_PUBLIC_ASSURERAIL_PRODUCTION_SCALE_V1/);
for (const text of [
  "Production scale & release board",
  "Readiness gates",
  "Operational blockers",
  "Signed activation",
  "Assessment history",
])
  assert.match(page, new RegExp(text, "i"));
assert.match(
  page,
  /never closes a VAPT, counsel,\s+participant, trustee, provider, DR or customer gate/i
);
assert.match(page, /This is not release approval/);
assert.match(internalPage, /workspace\.href\.startsWith\("\/internal\/"\)/);
assert.match(
  dockerfile,
  /ARG NEXT_PUBLIC_ASSURERAIL_PRODUCTION_SCALE_V1="off"/
);
assert.ok(
  compose.includes(
    "ARAIL_PRODUCTION_SCALE_V1: ${ARAIL_PRODUCTION_SCALE_V1:-off}"
  )
);
assert.ok(
  compose.includes(
    "NEXT_PUBLIC_ASSURERAIL_PRODUCTION_SCALE_V1: ${NEXT_PUBLIC_ASSURERAIL_PRODUCTION_SCALE_V1:-off}"
  )
);
console.log("AR-30 production-scale boundary checks passed");
