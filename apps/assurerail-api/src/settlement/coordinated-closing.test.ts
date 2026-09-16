import test from "node:test";
import assert from "node:assert/strict";
import { authoriseCoordinatedClosing, createCoordinatedClosingPack, reconcileCoordinatedClosing, type CoordinatedClosingInput } from "./coordinated-closing";

const hash = (value: string) => `sha256:${value.repeat(64).slice(0,64)}`;
const input = (patch: Partial<CoordinatedClosingInput> = {}): CoordinatedClosingInput => ({
  programmeRef: "programme-ev-01",
  closingRef: "closing-01",
  rehearsal: true,
  conditions: [
    { conditionId: "cp-assignment", category: "LEGAL", status: "SATISFIED", required: true, evidenceRef: "evidence-assignment", decisionRef: "decision-legal-1" },
    { conditionId: "cp-registry", category: "REGISTRY", status: "WAIVED", required: true, evidenceRef: null, decisionRef: "waiver-counsel-1" },
  ],
  documents: [
    { slotId: "assignment", documentType: "ASSIGNMENT_AGREEMENT", required: true, evidenceVersionRef: "ev-assignment-v1", payloadDigest: hash("a") },
    { slotId: "release", documentType: "DEBT_RELEASE", required: true, evidenceVersionRef: "ev-release-v1", payloadDigest: hash("b") },
  ],
  instruction: {
    programmeRef: "programme-ev-01",
    closingRef: "closing-01",
    buyerInstitutionId: "buyer-01",
    currency: "INR",
    grossConsiderationMinor: "5000000000",
    acceptedWaterfallDigest: hash("c"),
    sellerMandateEvidenceRef: "seller-mandate-v1",
    legs: [
      { legRef: "debt", sellerInstitutionId: "seller-01", beneficiaryRef: "lender-account", purpose: "DEBT_RELEASE", amountMinor: "3000000000", invoiceRef: null },
      { legRef: "net", sellerInstitutionId: "seller-01", beneficiaryRef: "seller-account", purpose: "SELLER_NET", amountMinor: "1950000000", invoiceRef: null },
      { legRef: "fee", sellerInstitutionId: "seller-01", beneficiaryRef: "assurerail-invoice", purpose: "SERVICE_FEE", amountMinor: "50000000", invoiceRef: "invoice-ar-1" },
    ],
  },
  vanRef: "van-provider-01",
  providerProfileRef: "escrow-profile-01",
  ...patch,
});

const approvals = (closingDigest: string) => [
  { role: "SELLER_AUTHORISER" as const, actorUserId: "seller-user", institutionId: "seller-01", closingDigest, stepUpEvidenceRef: "step-seller", authorisedAt: "2026-09-17T10:00:00.000Z" },
  { role: "BUYER_AUTHORISER" as const, actorUserId: "buyer-user", institutionId: "buyer-01", closingDigest, stepUpEvidenceRef: "step-buyer", authorisedAt: "2026-09-17T10:01:00.000Z" },
];

test("dry closing pack binds CPs, documents and a balanced seller distribution instruction", () => {
  const pack = createCoordinatedClosingPack(input());
  assert.equal(pack.readiness, "READY_FOR_AUTHORISATION");
  assert.equal(pack.custodyProvidedByRail, false);
  assert.equal(pack.railMayReleaseFunds, false);
  assert.equal(pack.legalTransferEstablishedByPack, false);
  assert.match(pack.closingDigest, /^sha256:[a-f0-9]{64}$/);
});

test("pending conditions and missing documents fail closed before dual authorisation", () => {
  const pending = createCoordinatedClosingPack(input({
    conditions: [{ conditionId: "cp-assignment", category: "LEGAL", status: "PENDING", required: true, evidenceRef: null, decisionRef: null }],
    documents: [{ slotId: "assignment", documentType: "ASSIGNMENT_AGREEMENT", required: true, evidenceVersionRef: null, payloadDigest: null }],
  }));
  assert.equal(pending.readiness, "NOT_READY");
  assert.throws(() => authoriseCoordinatedClosing(pending, approvals(pending.closingDigest)));
});

test("seller and buyer must separately authorise the exact closing digest", () => {
  const pack = createCoordinatedClosingPack(input());
  assert.throws(() => authoriseCoordinatedClosing(pack, approvals(pack.closingDigest).slice(0,1)));
  assert.throws(() => authoriseCoordinatedClosing(pack, approvals(pack.closingDigest).map((item) => ({ ...item, actorUserId: "same-user" }))));
  assert.throws(() => authoriseCoordinatedClosing(pack, approvals(hash("f"))));
  assert.throws(() => authoriseCoordinatedClosing(pack, approvals(pack.closingDigest).map((item) => item.role === "SELLER_AUTHORISER" ? { ...item, institutionId: "seller-wrong" } : item)));
  assert.equal(authoriseCoordinatedClosing(pack, approvals(pack.closingDigest)).status, "AUTHORISED_FOR_PROVIDER_SUBMISSION");
});

test("ambiguous provider success stops retries and produces the repair playbook", () => {
  const pack = createCoordinatedClosingPack(input());
  const authorisation = authoriseCoordinatedClosing(pack, approvals(pack.closingDigest));
  const result = reconcileCoordinatedClosing(pack, authorisation, [
    { legRef: "debt", providerTransferRef: "provider-debt", idempotencyRef: "idem-debt", status: "SETTLED", observedAmountMinor: "3000000000", observedAt: "2026-09-17T10:02:00.000Z" },
    { legRef: "net", providerTransferRef: "provider-net", idempotencyRef: "idem-net", status: "UNKNOWN", observedAmountMinor: null, observedAt: "2026-09-17T10:02:00.000Z" },
  ]);
  assert.equal(result.status, "AMBIGUOUS_OR_PENDING");
  assert.equal(result.automaticRetryPermitted, false);
  assert.deepEqual(result.unresolvedLegRefs.sort(), ["fee", "net"]);
  assert.ok(result.repairPlaybook.includes("RECONCILE_VAN_OR_BANK_STATEMENT"));
});

test("all provider-observed legs must settle exactly before reconciliation", () => {
  const pack = createCoordinatedClosingPack(input());
  const authorisation = authoriseCoordinatedClosing(pack, approvals(pack.closingDigest));
  const observations = pack.instruction.legs.map((leg) => ({ legRef: leg.legRef, providerTransferRef: `provider-${leg.legRef}`, idempotencyRef: `idem-${leg.legRef}`, status: "SETTLED" as const, observedAmountMinor: leg.amountMinor, observedAt: "2026-09-17T10:02:00.000Z" }));
  assert.equal(reconcileCoordinatedClosing(pack, authorisation, observations).status, "RECONCILED");
  assert.throws(() => reconcileCoordinatedClosing(pack, authorisation, observations.map((item, index) => index ? item : { ...item, observedAmountMinor: "1" })));
});
