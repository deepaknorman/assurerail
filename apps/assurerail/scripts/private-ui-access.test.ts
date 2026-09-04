import assert from "node:assert/strict";
import test from "node:test";
import { isPrivateUiPath, privateUiEnabled } from "../src/lib/private-ui-access.ts";

test("classifies every operational UI family as private", () => {
  for (const path of [
    "/activity",
    "/admin/access",
    "/cases/case-1/rooms",
    "/console",
    "/institutions/inst-1/evidence",
    "/internal/production-scale",
    "/onboard",
    "/settings",
    "/workspace/cases/case-1/da",
  ]) assert.equal(isPrivateUiPath(path), true, path);
});

test("leaves anonymous publication and separately gated routes outside the private UI family", () => {
  for (const path of ["/", "/login", "/replay", "/resources", "/routes/ptc", "/diligence", "/sandbox", "/api/inquiries"])
    assert.equal(isPrivateUiPath(path), false, path);
});

test("fails closed unless the server-only private UI value is exactly yes", () => {
  for (const value of [undefined, "", "no", "true", "YES", "shadow"]) assert.equal(privateUiEnabled(value), false);
  assert.equal(privateUiEnabled("yes"), true);
});
