import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");

const env = read(".env.example");
const helpers = read("src/lib/customer-workspace.ts");
const guided = read("src/app/workspace/start/page.tsx");
const sandboxPage = read("src/app/sandbox/page.tsx");
const sandbox = read("src/app/sandbox/SandboxExperience.tsx");
const fixtures = read("src/lib/sandbox-scenarios.ts");

for (const [flag, helper] of [
  ["NEXT_PUBLIC_ASSURERAIL_GUIDED_JOURNEY_V1", "guidedJourneyEnabled"],
  ["NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1", "sandboxEnabled"],
]) {
  assert.match(env, new RegExp(`^${flag}=off`, "m"));
  assert.ok(helpers.includes(helper));
}

assert.ok(existsSync(resolve(root, "src/app/workspace/start/page.tsx")));
assert.ok(existsSync(resolve(root, "src/app/sandbox/page.tsx")));
assert.ok(sandboxPage.includes("notFound()"));
assert.ok(sandboxPage.includes("robots: { index: false"));
assert.ok(guided.includes("does not admit an institution"));
assert.ok(guided.includes("Completed transaction evidence owner"));
assert.ok(fixtures.includes('route: "DA"'));
assert.ok(fixtures.includes('route: "PTC"'));
assert.ok(fixtures.includes('finality classification is UNKNOWN'));
assert.ok(fixtures.includes('result: "REVIEW_REQUIRED"'));
assert.ok(fixtures.includes('result: "BLOCKED"'));
assert.ok(sandbox.includes("No API write, money, title, issuance, register or token action occurs"));
assert.doesNotMatch(sandbox, /vpost|fetch\(|axios|XMLHttpRequest/);

console.log("CX-01/SIM-01: guided institutional setup and fail-closed synthetic DA/PTC sandbox verified.");
