import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packaged = readFileSync(resolve(root, "src/generated/download-artifacts.ts"), "utf8");
const page = readFileSync(resolve(root, "src/app/downloads/page.tsx"), "utf8");
const access = readFileSync(resolve(root, "src/app/downloads/access/route.ts"), "utf8");
const shared = readFileSync(resolve(root, "src/app/downloads/assurerail/phase1-da/commercial-terms/route.ts"), "utf8");
const integrationPlan = readFileSync(resolve(root, "src/app/downloads/assurerail/phase1-da/integration-implementation-plan/route.ts"), "utf8");
const env = readFileSync(resolve(root, ".env.example"), "utf8");
const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");
const packager = readFileSync(resolve(root, "scripts/package-download-artifacts.mjs"), "utf8");

test("web package contains only public and shared-password document bodies", () => {
  assert.match(packaged, /DA-CUSTOMER-GUIDE/);
  assert.match(packaged, /DA-COMMERCIAL-TERMS/);
  assert.match(packaged, /DA-INTEGRATION-PLAN/);
  for (const protectedBodyMarker of ["Sevenfincorp", "8.5%", "Provider work order", "Buyer Primary Administrator", "Seller MSA minimum clauses"]) {
    assert.equal(packaged.includes(protectedBodyMarker), false, protectedBodyMarker);
  }
});

test("artifact packaging rejects unknown classifications and duplicate identifiers", () => {
  assert.match(packager, /allowedClassifications/);
  assert.match(packager, /invalid classification/);
  assert.match(packager, /duplicates an artifact id/);
});

test("authenticated and internal documents remain behind the engagement workspace", () => {
  assert.match(page, /Engagement workspace/);
  assert.match(page, /approved workspace for that institution and engagement/);
  assert.match(page, /Sign in to your workspace/);
  for (const protectedTitle of ["Seller document suite", "Pre-incorporation seller commitment letter", "Phase 1 operating pack index", "Buyer onboarding and MSA schedule"]) {
    assert.equal(page.includes(protectedTitle), false, protectedTitle);
  }
  for (const path of [
    "src/app/downloads/assurerail/phase1-da/seller-document-suite",
    "src/app/downloads/assurerail/phase1-da/buyer-onboarding-schedule",
    "src/app/downloads/assurerail/phase1-da/referral-addendum",
  ]) assert.equal(existsSync(resolve(root, path)), false, path);
});

test("shared material is unlocked server-side with a signed HttpOnly cookie", () => {
  for (const marker of ["sharedDownloadsConfigured", "verifySharedDownloadPassword", "createSharedDownloadSession", "httpOnly: true", 'sameSite: "strict"', 'path: "/downloads"']) assert.ok(access.includes(marker), marker);
  for (const marker of ["verifySharedDownloadSession", "noindex, nofollow, noarchive", "no-store, private"]) assert.ok(shared.includes(marker), marker);
  for (const marker of ["DA-INTEGRATION-PLAN", "verifySharedDownloadSession", "noindex, nofollow, noarchive", "no-store, private"]) assert.ok(integrationPlan.includes(marker), marker);
  assert.match(access, /Retry-After/);
  assert.match(access, /application\/x-www-form-urlencoded/);
});

test("secrets remain server-only environment placeholders", () => {
  assert.match(env, /ASSURERAIL_DOWNLOADS_SHARED_ENABLED=no/);
  assert.match(env, /ASSURERAIL_DOWNLOADS_SHARED_PASSWORD=\s*(?:#.*)?$/m);
  assert.match(env, /ASSURERAIL_DOWNLOADS_SESSION_SECRET=\s*(?:#.*)?$/m);
  assert.doesNotMatch(env, /NEXT_PUBLIC_ASSURERAIL_DOWNLOADS/);
});

test("protected document files are absent from public assets", () => {
  assert.equal(existsSync(resolve(root, "public/downloads")), false);
});

test("production image packages served artifacts without copying protected document bodies", () => {
  assert.match(dockerfile, /artifact-manifest\.json/);
  assert.match(dockerfile, /AssureRail_Phase1_DA_Customer_Service_Guide\.html/);
  assert.match(dockerfile, /AssureRail_Phase1_DA_Quote_Reconciliation_Credit_And_Refund_Terms\.html/);
  assert.match(dockerfile, /AssureRail_Counterparty_Integration_Implementation_Plan\.html/);
  for (const forbidden of ["Referral_Partner_Addendum.html", "Seller_Document_Suite.html", "Buyer_Onboarding_And_MSA_Schedule.html", "Provider_Onboarding_And_Work_Order.html"]) assert.equal(dockerfile.includes(forbidden), false, forbidden);
});
