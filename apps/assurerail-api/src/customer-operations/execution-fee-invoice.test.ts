import { test } from "node:test";
import assert from "node:assert/strict";
import { DESIGN_PARTNER_DISCOUNT_BPS, DESIGN_PARTNER_PROGRAMME, validatedDesignPartnerPayable } from "./design-partner-discount";
import { executionFeeCalculation, executionFeeRecordDigest, executionFeeSettlementLeg, executionFeeStatementDigest } from "./execution-fee-invoice";
import type { ExactFeeRule } from "./fee-calculation";

const taxRule: ExactFeeRule = { feeBasis: "NOTIONAL_BASIS_POINTS", rateValue: "1800", minimumFeeMinor: null, maximumFeeMinor: null, roundingMode: "HALF_UP" };
const coupon = { id: "coupon-1", institutionId: "seller-1", programmeCode: DESIGN_PARTNER_PROGRAMME, discountBps: DESIGN_PARTNER_DISCOUNT_BPS, slot: 1, status: "APPROVED" };
const input = (overrides: Partial<Parameters<typeof executionFeeCalculation>[0]> = {}) => ({
  sellerInstitutionId: "seller-1", engagementId: "engagement-1", transactionCaseId: "case-1", closingRef: "close-1", sequence: 1,
  acceptedMinimumMinor: "50000000", previousCumulativeConsiderationMinor: "0", acceptedCumulativeConsiderationMinor: "55000000000",
  eligibleStandalonePremiumMinor: "24000000", previouslyAppliedPremiumMinor: "0",
  considerationAcceptanceDigest: `sha256:${"a".repeat(64)}`, sellerAcceptanceEvidenceRef: "evidence:seller-acceptance",
  buyerAcceptanceEvidenceRef: "evidence:buyer-acceptance", acceptedAt: "2026-09-17T10:00:00.000Z", taxRule, coupon,
  ...overrides,
});

test("premium conversion is applied before the single design-partner invoice discount", () => {
  const result = executionFeeCalculation(input());
  assert.equal(result.incrementalGrossBaseMinor, "190000000");
  assert.equal(result.appliedPremiumCreditMinor, "24000000");
  assert.equal(result.postPremiumBaseMinor, "166000000");
  assert.equal(result.designPartnerCreditBaseMinor, "49800000");
  assert.equal(result.netBaseMinor, "116200000");
  assert.equal(result.grossTotalMinor, "224200000");
  assert.equal(result.invoiceGrossTotalMinor, "195880000");
  assert.equal(result.designPartnerTotalCreditMinor, "58764000");
  assert.equal(result.totalCreditMinor, "87084000");
  assert.equal(result.netTotalMinor, "137116000");
  assert.equal(result.invoiceDiscount?.standardBaseMinor, result.postPremiumBaseMinor);
  const invoice = { grossFeeMinor: result.invoiceGrossTotalMinor, creditMinor: result.designPartnerTotalCreditMinor, netFeeMinor: result.netTotalMinor, designPartnerDiscount: { ...result.invoiceDiscount, coupon } };
  assert.equal(validatedDesignPartnerPayable(invoice, "seller-1"), result.netTotalMinor);
});

test("cumulative seller schedule and minimum are never reset between closes", () => {
  const first = executionFeeCalculation(input({ acceptedCumulativeConsiderationMinor: "10000000000", eligibleStandalonePremiumMinor: "0", coupon: null }));
  assert.equal(first.cumulativeGrossBaseMinor, "50000000");
  const second = executionFeeCalculation(input({ sequence: 2, previousCumulativeConsiderationMinor: "10000000000", acceptedCumulativeConsiderationMinor: "30000000000", eligibleStandalonePremiumMinor: "0", coupon: null, closingRef: "close-2" }));
  assert.equal(second.cumulativeGrossBaseMinor, "115000000");
  assert.equal(second.incrementalGrossBaseMinor, "65000000");
  assert.equal(second.invoiceGrossTotalMinor, "76700000");
  assert.equal(second.netTotalMinor, "76700000");
});

test("record digest and settlement leg bind the reviewed seller invoice without custody claims", () => {
  const result = executionFeeCalculation(input());
  assert.equal(executionFeeRecordDigest({ ...result, invoiceDiscount: undefined }), result.snapshotDigest);
  assert.notEqual(executionFeeStatementDigest({ executionInvoiceId: "efi-1", executionSnapshotDigest: result.snapshotDigest, statementRef: "EXEC:engagement-1:1", grossFeeMinor: result.invoiceGrossTotalMinor, creditMinor: result.designPartnerTotalCreditMinor, netFeeMinor: result.netTotalMinor }), executionFeeStatementDigest({ executionInvoiceId: "efi-1", executionSnapshotDigest: result.snapshotDigest, statementRef: "EXEC:engagement-1:1", grossFeeMinor: result.invoiceGrossTotalMinor, creditMinor: result.designPartnerTotalCreditMinor, netFeeMinor: "1" }));
  const leg = executionFeeSettlementLeg({ id: "efi-1", status: "APPROVED", snapshotDigest: result.snapshotDigest, sellerInstitutionId: "seller-1", transactionCaseId: "case-1", closingRef: "close-1", netTotalMinor: result.netTotalMinor, invoiceStatement: { statementRef: "EXEC:engagement-1:1", status: "ISSUED_SHADOW", netFeeMinor: result.netTotalMinor, statementDigest: `sha256:${"b".repeat(64)}` } });
  assert.deepEqual({ purpose: leg.purpose, amountMinor: leg.amountMinor, invoiceRef: leg.invoiceRef, custodyProvidedByRail: leg.custodyProvidedByRail, railMayReleaseFunds: leg.railMayReleaseFunds, settlementProvedByInvoice: leg.settlementProvedByInvoice }, { purpose: "SERVICE_FEE", amountMinor: result.netTotalMinor, invoiceRef: "EXEC:engagement-1:1", custodyProvidedByRail: false, railMayReleaseFunds: false, settlementProvedByInvoice: false });
  assert.throws(() => executionFeeSettlementLeg({ ...leg, id: "efi-1", status: "PROPOSED", snapshotDigest: result.snapshotDigest, netTotalMinor: result.netTotalMinor, invoiceStatement: { statementRef: leg.invoiceRef, status: "DRAFT", netFeeMinor: result.netTotalMinor, statementDigest: leg.invoiceStatementDigest } }), /issued/);
});
