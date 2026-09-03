import test from "node:test";
import assert from "node:assert/strict";
import { qualificationStage, validateReplayInquiry } from "../src/lib/inbound-contract.ts";

const valid = {
  organization: " Example NBFC ",
  workEmail: "Treasury@Example.com",
  jobRole: "Treasury head",
  institutionType: "NBFC_ORIGINATOR",
  route: "BOTH",
  currentStage: "COMPLETED_DEAL_AVAILABLE",
  transactionOwner: "NAMED",
  timing: "WITHIN_30_DAYS",
  consent: true,
  website: "",
};

test("normalises the bounded enquiry and marks a named completed case discovery-ready", () => {
  const result = validateReplayInquiry(valid);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.organization, "Example NBFC");
  assert.equal(result.data.workEmail, "treasury@example.com");
  assert.equal(qualificationStage(result.data), "REPLAY_DISCOVERY_READY");
});

test("rejects honeypot traffic, extra fields and invalid enum values", () => {
  assert.equal(validateReplayInquiry({ ...valid, website: "https://spam.invalid" }).ok, false);
  assert.equal(validateReplayInquiry({ ...valid, transactionReference: "customer-data" }).ok, false);
  assert.equal(validateReplayInquiry({ ...valid, route: "TOKEN" }).ok, false);
});

test("requires consent and applies strict field bounds", () => {
  assert.equal(validateReplayInquiry({ ...valid, consent: false }).ok, false);
  assert.equal(validateReplayInquiry({ ...valid, organization: "A" }).ok, false);
  assert.equal(validateReplayInquiry({ ...valid, jobRole: "x".repeat(101) }).ok, false);
});

test("does not promote an enquiry without a named data owner", () => {
  const result = validateReplayInquiry({ ...valid, transactionOwner: "NOT_YET" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(qualificationStage(result.data), "NURTURE_TRANSACTION_OWNER");
});
