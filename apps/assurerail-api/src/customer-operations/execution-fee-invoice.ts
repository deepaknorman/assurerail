import { sha256Digest } from "../contracts/v1";
import { commercialPolicy } from "../generated/commercial-policy";
import { DESIGN_PARTNER_DISCOUNT_BPS, DESIGN_PARTNER_PROGRAMME, designPartnerInvoiceDiscount } from "./design-partner-discount";
import { executionAccrual } from "./engagement-pricing";
import { stagePrice } from "./engagement-workflow";
import type { ExactFeeRule } from "./fee-calculation";

export type ExecutionCoupon = {
  id: string;
  institutionId: string;
  programmeCode: string;
  discountBps: number;
  slot: number | null;
  status: string;
};

export type ExecutionFeeCalculationInput = {
  sellerInstitutionId: string;
  engagementId: string;
  transactionCaseId: string;
  closingRef: string;
  sequence: number;
  acceptedMinimumMinor: string;
  previousCumulativeConsiderationMinor: string;
  acceptedCumulativeConsiderationMinor: string;
  eligibleStandalonePremiumMinor: string;
  previouslyAppliedPremiumMinor: string;
  considerationAcceptanceDigest: string;
  sellerAcceptanceEvidenceRef: string;
  buyerAcceptanceEvidenceRef: string;
  acceptedAt: string;
  taxRule: ExactFeeRule;
  coupon: ExecutionCoupon | null;
};

export const executionFeePolicyDigest = sha256Digest({
  policyVersion: commercialPolicy.policyVersion,
  execution: commercialPolicy.execution,
  designPartnerProgramme: {
    programmeCode: DESIGN_PARTNER_PROGRAMME,
    discountBps: DESIGN_PARTNER_DISCOUNT_BPS,
    eligibleFeeClass: "CORE_EXECUTION_SUCCESS_FEE",
  },
});

const subtract = (left: string, right: string) => (BigInt(left) - BigInt(right)).toString();
const add = (...values: string[]) => values.reduce((sum, value) => sum + BigInt(value), 0n).toString();

export function executionFeeCalculation(input: ExecutionFeeCalculationInput) {
  const accrual = executionAccrual({
    sellerId: input.sellerInstitutionId,
    previousSettledMinor: input.previousCumulativeConsiderationMinor,
    cumulativeSettledMinor: input.acceptedCumulativeConsiderationMinor,
    acceptedMinimumMinor: input.acceptedMinimumMinor,
    eligiblePaidStandalonePremiumMinor: input.eligibleStandalonePremiumMinor,
    previousAppliedPremiumMinor: input.previouslyAppliedPremiumMinor,
  });
  const gross = stagePrice(accrual.incrementalGrossMinor, input.taxRule);
  const postPremiumBaseMinor = accrual.incrementalExecutionDueMinor;
  const postPremium = stagePrice(postPremiumBaseMinor, input.taxRule);
  const couponDiscount = input.coupon
    ? designPartnerInvoiceDiscount(postPremium, input.taxRule, input.coupon)
    : null;
  const netBaseMinor = couponDiscount?.discountedBaseMinor ?? postPremium.baseMinor;
  const netTaxMinor = couponDiscount?.discountedTaxMinor ?? postPremium.taxMinor;
  const netTotalMinor = couponDiscount?.discountedTotalMinor ?? postPremium.totalMinor;
  const premiumTaxCreditMinor = subtract(gross.taxMinor, postPremium.taxMinor);
  const designPartnerTaxCreditMinor = couponDiscount?.taxCreditMinor ?? "0";
  const totalTaxCreditMinor = add(premiumTaxCreditMinor, designPartnerTaxCreditMinor);
  const designPartnerCreditBaseMinor = couponDiscount?.baseCreditMinor ?? "0";
  const totalCreditMinor = add(accrual.incrementalPremiumCreditMinor, designPartnerCreditBaseMinor, totalTaxCreditMinor);
  const designPartnerTotalCreditMinor = add(designPartnerCreditBaseMinor, designPartnerTaxCreditMinor);
  const taxRuleSnapshot = {
    feeBasis: input.taxRule.feeBasis,
    rateValue: input.taxRule.rateValue,
    minimumFeeMinor: input.taxRule.minimumFeeMinor ?? null,
    maximumFeeMinor: input.taxRule.maximumFeeMinor ?? null,
    roundingMode: input.taxRule.roundingMode,
  };
  const snapshot = {
    sellerInstitutionId: input.sellerInstitutionId,
    engagementId: input.engagementId,
    transactionCaseId: input.transactionCaseId,
    closingRef: input.closingRef,
    sequence: input.sequence,
    policyVersion: accrual.policyVersion,
    policyDigest: executionFeePolicyDigest,
    acceptedMinimumMinor: input.acceptedMinimumMinor,
    previousCumulativeConsiderationMinor: input.previousCumulativeConsiderationMinor,
    acceptedCumulativeConsiderationMinor: input.acceptedCumulativeConsiderationMinor,
    considerationAcceptanceDigest: input.considerationAcceptanceDigest,
    sellerAcceptanceEvidenceRef: input.sellerAcceptanceEvidenceRef,
    buyerAcceptanceEvidenceRef: input.buyerAcceptanceEvidenceRef,
    acceptedAt: input.acceptedAt,
    cumulativeGrossBaseMinor: accrual.cumulativeExecutionEarnedMinor,
    incrementalGrossBaseMinor: accrual.incrementalGrossMinor,
    eligibleStandalonePremiumMinor: input.eligibleStandalonePremiumMinor,
    previouslyAppliedPremiumMinor: input.previouslyAppliedPremiumMinor,
    appliedPremiumCreditMinor: accrual.incrementalPremiumCreditMinor,
    remainingPremiumMinor: accrual.remainingPremiumMinor,
    postPremiumBaseMinor,
    designPartnerCouponId: input.coupon?.id ?? null,
    designPartnerProgrammeCode: input.coupon?.programmeCode ?? null,
    designPartnerDiscountBps: input.coupon?.discountBps ?? null,
    designPartnerCreditBaseMinor,
    netBaseMinor,
    grossTaxMinor: gross.taxMinor,
    premiumTaxCreditMinor,
    designPartnerTaxCreditMinor,
    totalTaxCreditMinor,
    netTaxMinor,
    grossTotalMinor: gross.totalMinor,
    invoiceGrossTotalMinor: postPremium.totalMinor,
    designPartnerTotalCreditMinor,
    totalCreditMinor,
    netTotalMinor,
    taxRuleSnapshot,
  };
  return { ...snapshot, snapshotDigest: sha256Digest(snapshot), invoiceDiscount: couponDiscount };
}

export function executionFeeRecordDigest(record: Record<string, unknown>) {
  const snapshot = {
    sellerInstitutionId: record.sellerInstitutionId,
    engagementId: record.engagementId,
    transactionCaseId: record.transactionCaseId,
    closingRef: record.closingRef,
    sequence: record.sequence,
    policyVersion: record.policyVersion,
    policyDigest: record.policyDigest,
    acceptedMinimumMinor: record.acceptedMinimumMinor,
    previousCumulativeConsiderationMinor: record.previousCumulativeConsiderationMinor,
    acceptedCumulativeConsiderationMinor: record.acceptedCumulativeConsiderationMinor,
    considerationAcceptanceDigest: record.considerationAcceptanceDigest,
    sellerAcceptanceEvidenceRef: record.sellerAcceptanceEvidenceRef,
    buyerAcceptanceEvidenceRef: record.buyerAcceptanceEvidenceRef,
    acceptedAt: record.acceptedAt instanceof Date ? record.acceptedAt.toISOString() : record.acceptedAt,
    cumulativeGrossBaseMinor: record.cumulativeGrossBaseMinor,
    incrementalGrossBaseMinor: record.incrementalGrossBaseMinor,
    eligibleStandalonePremiumMinor: record.eligibleStandalonePremiumMinor,
    previouslyAppliedPremiumMinor: record.previouslyAppliedPremiumMinor,
    appliedPremiumCreditMinor: record.appliedPremiumCreditMinor,
    remainingPremiumMinor: record.remainingPremiumMinor,
    postPremiumBaseMinor: record.postPremiumBaseMinor,
    designPartnerCouponId: record.designPartnerCouponId,
    designPartnerProgrammeCode: record.designPartnerProgrammeCode,
    designPartnerDiscountBps: record.designPartnerDiscountBps,
    designPartnerCreditBaseMinor: record.designPartnerCreditBaseMinor,
    netBaseMinor: record.netBaseMinor,
    grossTaxMinor: record.grossTaxMinor,
    premiumTaxCreditMinor: record.premiumTaxCreditMinor,
    designPartnerTaxCreditMinor: record.designPartnerTaxCreditMinor,
    totalTaxCreditMinor: record.totalTaxCreditMinor,
    netTaxMinor: record.netTaxMinor,
    grossTotalMinor: record.grossTotalMinor,
    invoiceGrossTotalMinor: record.invoiceGrossTotalMinor,
    designPartnerTotalCreditMinor: record.designPartnerTotalCreditMinor,
    totalCreditMinor: record.totalCreditMinor,
    netTotalMinor: record.netTotalMinor,
    taxRuleSnapshot: record.taxRuleSnapshot,
  };
  return sha256Digest(snapshot);
}

export function executionFeeStatementDigest(input: {
  executionInvoiceId: string;
  executionSnapshotDigest: string;
  statementRef: string;
  grossFeeMinor: string;
  creditMinor: string;
  netFeeMinor: string;
}) {
  return sha256Digest(input);
}

export function executionFeeSettlementLeg(input: {
  id: string;
  status: string;
  snapshotDigest: string;
  sellerInstitutionId: string;
  transactionCaseId: string;
  closingRef: string;
  netTotalMinor: string;
  invoiceStatement: { statementRef: string; status: string; netFeeMinor: string; statementDigest: string };
}) {
  if (input.status !== "APPROVED" || input.invoiceStatement.status !== "ISSUED_SHADOW") throw new Error("independently issued execution invoice required");
  if (input.invoiceStatement.netFeeMinor !== input.netTotalMinor) throw new Error("execution invoice amount no longer matches its snapshot");
  return {
    legRef: `assurerail-fee:${input.id}`,
    sellerInstitutionId: input.sellerInstitutionId,
    beneficiaryRef: "ASSURERAIL_FEES",
    purpose: "SERVICE_FEE" as const,
    amountMinor: input.netTotalMinor,
    invoiceRef: input.invoiceStatement.statementRef,
    transactionCaseId: input.transactionCaseId,
    closingRef: input.closingRef,
    feeSnapshotDigest: input.snapshotDigest,
    invoiceStatementDigest: input.invoiceStatement.statementDigest,
    custodyProvidedByRail: false as const,
    railMayReleaseFunds: false as const,
    settlementProvedByInvoice: false as const,
  };
}
