import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");

const env = read(".env.example");
const page = read("src/app/sandbox/page.tsx");
const experience = read("src/app/sandbox/SandboxExperience.tsx");
const scenarios = read("src/lib/full-system-demo.ts");
const styles = read("src/app/sandbox/page.module.css");
const proxy = read("src/proxy.ts");
const auth = read("src/lib/auth-context.tsx");

assert.match(env, /^NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1=off/m);
assert.match(env, /^ASSURERAIL_DEMO_SHOWCASE_ENABLED=no/m);
assert.match(env, /^ASSURERAIL_DEMO_SHOWCASE_USERNAME=$/m);
assert.match(env, /^ASSURERAIL_DEMO_SHOWCASE_PASSWORD=$/m);
assert.ok(page.includes("notFound()"));
assert.ok(page.includes("robots: { index: false"));
assert.ok(proxy.includes('request.nextUrl.pathname === "/sandbox"'));
assert.ok(proxy.includes('"AssureRail demonstration"'));
assert.ok(proxy.includes('"/sandbox/:path*"'));

for (const persona of ["ORIGINATOR", "TRANSFEREE", "TRUSTEE", "RECORDKEEPER", "RAIL_OPERATOR"])
  assert.ok(scenarios.includes(`id: "${persona}"`), persona);

for (const stage of ["admission", "intake", "room", "commercial", "da", "ptc", "lifecycle", "secondary", "token", "operations"])
  assert.ok(scenarios.includes(`id: "${stage}"`), stage);

assert.equal((scenarios.match(/number: "(?:0[1-9]|10)"/g) ?? []).length, 10);
assert.ok(scenarios.includes('state: "NOT_ACTIVATED"'));
assert.ok(scenarios.includes("cannot close customer, trustee, counsel, VAPT, DR or production gates"));
assert.ok(scenarios.includes("AssureLens is accepted through the same neutral evidence contract"));
assert.ok(scenarios.includes("The trustee controls the Rail workflow"));
assert.ok(scenarios.includes("The Rail observes and reconciles"));
assert.ok(experience.includes("Full system"));
assert.ok(experience.includes("Download synthetic dossier"));
assert.ok(experience.includes("No API write, money, title, issuance, register or token action occurs"));
assert.doesNotMatch(experience, /vpost|fetch\(|axios|XMLHttpRequest/);
assert.match(styles, /@media \(max-width: 620px\)/);
assert.match(styles, /prefers-reduced-motion/);
assert.ok(existsSync(resolve(root, "scripts/demo-showcase-access.test.ts")));
assert.ok(existsSync(resolve(root, "scripts/ar-demo01-browser-check.mjs")));
assert.ok(auth.includes("if (!firebaseConfigured)"));
assert.ok(auth.includes("AssureRail authentication is not configured in this environment"));

console.log("AR-DEMO-01: private, fail-closed, ten-stage full-system synthetic showcase verified.");
