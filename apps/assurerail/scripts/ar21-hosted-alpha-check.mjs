import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [policy, home, tasks, header, dockerfile, compose] = await Promise.all([
  read("src/lib/customer-workspace.ts"),
  read("src/app/workspace/page.tsx"),
  read("src/app/workspace/tasks/page.tsx"),
  read("src/components/VenueHeader.tsx"),
  read("Dockerfile"),
  read("../../docker-compose.assurerail.yml"),
]);

assert.match(policy, /NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1/);
assert.match(policy, /TaskPriority/);
assert.match(home, /Action centre/);
assert.match(tasks, /Task visibility is not command authority/);
assert.match(tasks, /This is not evidence that every transaction or external gate is complete/);
assert.match(header, /institutions\/\$\{encodeURIComponent\(activeInstitutionId\)\}\/hosted-alpha\/tasks/);
assert.match(header, /isAdmin && !activeInstitutionId/);
assert.doesNotMatch(header, /if \(notifOpen && notifs\.length === 0\)/);
assert.match(dockerfile, /ARG NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1="off"/);
assert.match(dockerfile, /NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1=\$NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1/);
assert.ok(compose.includes("NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1: ${NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1:-off}"));
assert.ok(compose.includes("ARAIL_HOSTED_ALPHA_V1: ${ARAIL_HOSTED_ALPHA_V1:-off}"));

console.log("AR-21 hosted-alpha customer boundary checks passed");
