/** Current conventional-DA commercial policy. Accepted quotes retain their frozen policy version. */
import { commercialPolicy } from "../generated/commercial-policy";
import { sha256Digest } from "../contracts/v1";
import { exactMinor } from "./fee-calculation";

export const ENGAGEMENT_PRICING_VERSION = commercialPolicy.policyVersion;
export const HISTORICAL_COUNT_ONLY_PRICING_VERSION = "DA-2026-09-15-COUNT-30INITIAL-STANDALONE";
export type PreparationRoute = "COMMITTED" | "STANDALONE";
export type EngagementQuoteInput = {
  primaryPairCount: unknown;
  linkedPartyCount: unknown;
  sellerProposedConsiderationMinor: unknown;
  aggregateProgrammeConsiderationMinor: unknown;
};

const minor = (value: unknown, name: string) => BigInt(exactMinor(value, name));
const max = (a: bigint, b: bigint) => a > b ? a : b;
const min = (a: bigint, b: bigint) => a < b ? a : b;
const integerCount = (value: unknown, name: string) => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 1_000_000) {
    throw new Error(`${name} must be a whole number between 0 and 1000000`);
  }
  return BigInt(value as number);
};
const roundedRatio = (numerator: bigint, denominator: bigint) => {
  if (denominator <= 0n) throw new Error("allocation denominator must be positive");
  return (numerator + denominator / 2n) / denominator;
};

function supplementMinor(
  sellerConsideration: bigint,
  aggregateConsideration: bigint,
  threshold: bigint,
  rateBps: bigint,
) {
  if (aggregateConsideration <= threshold) return 0n;
  const aggregateExcess = aggregateConsideration - threshold;
  return roundedRatio(aggregateExcess * rateBps * sellerConsideration, aggregateConsideration * 10_000n);
}

export function engagementQuote(input: EngagementQuoteInput) {
  const primaryPairCount = integerCount(input.primaryPairCount, "primaryPairCount");
  if (primaryPairCount < 1n) throw new Error("primaryPairCount must be at least 1");
  const linkedPartyCount = integerCount(input.linkedPartyCount, "linkedPartyCount");
  const sellerConsideration = minor(input.sellerProposedConsiderationMinor, "sellerProposedConsiderationMinor");
  const aggregateConsideration = minor(input.aggregateProgrammeConsiderationMinor, "aggregateProgrammeConsiderationMinor");
  if (sellerConsideration < 1n) throw new Error("sellerProposedConsiderationMinor must be positive");
  if (aggregateConsideration < sellerConsideration) throw new Error("aggregate programme consideration cannot be less than this seller's proposed consideration");

  const committedPolicy = commercialPolicy.fixedStages.committed;
  const standalonePolicy = commercialPolicy.fixedStages.standalone;
  const committedBase = max(
    primaryPairCount * BigInt(committedPolicy.primaryUnitFeeMinor) + linkedPartyCount * BigInt(committedPolicy.linkedPartyFeeMinor),
    BigInt(committedPolicy.minimumFeeMinor),
  );
  const standaloneBase = max(
    primaryPairCount * BigInt(standalonePolicy.primaryUnitFeeMinor) + linkedPartyCount * BigInt(standalonePolicy.linkedPartyFeeMinor),
    BigInt(standalonePolicy.minimumFeeMinor),
  );
  const committedSupplement = supplementMinor(
    sellerConsideration,
    aggregateConsideration,
    BigInt(committedPolicy.largeProgrammeThresholdMinor),
    BigInt(committedPolicy.largeProgrammeSupplementBps),
  );
  const standaloneSupplement = supplementMinor(
    sellerConsideration,
    aggregateConsideration,
    BigInt(standalonePolicy.largeProgrammeThresholdMinor),
    BigInt(standalonePolicy.largeProgrammeSupplementBps),
  );
  const committed = committedBase + committedSupplement;
  const standalone = standaloneBase + standaloneSupplement;
  const initialPercent = BigInt(commercialPolicy.fixedStages.initialAssessment.invoicePercentOfStandaloneFixedQuote);
  const initial = roundedRatio(standalone * initialPercent, 100n);

  const quote = {
    policyVersion: ENGAGEMENT_PRICING_VERSION,
    currency: commercialPolicy.currency,
    currencyScale: commercialPolicy.currencyScale,
    countingBasis: commercialPolicy.fixedStages.counting,
    primaryPairCount: Number(primaryPairCount),
    linkedPartyCount: Number(linkedPartyCount),
    sellerProposedConsiderationMinor: sellerConsideration.toString(),
    aggregateProgrammeConsiderationMinor: aggregateConsideration.toString(),
    committedBaseMinor: committedBase.toString(),
    standaloneBaseMinor: standaloneBase.toString(),
    committedLargeProgrammeSupplementMinor: committedSupplement.toString(),
    standaloneLargeProgrammeSupplementMinor: standaloneSupplement.toString(),
    initialAssessmentMinor: initial.toString(),
    committedFixedMinor: committed.toString(),
    standaloneFixedMinor: standalone.toString(),
    committedPreparationBalanceMinor: (committed - initial).toString(),
    standalonePreparationBalanceMinor: (standalone - initial).toString(),
    standalonePremiumMinor: (standalone - committed).toString(),
    initialDeliveryModel: commercialPolicy.fixedStages.initialAssessment.deliveryModel,
    preparationDeliveryModel: commercialPolicy.fixedStages.portfolioPreparation.deliveryModel,
    includedAutomatedReassessments: commercialPolicy.fixedStages.initialAssessment.includedAutomatedReassessments,
    reassessmentWindowDays: commercialPolicy.fixedStages.initialAssessment.reassessmentWindowDays,
    executionBasis: commercialPolicy.execution.feeBasis,
    executionMinimumMinor: commercialPolicy.execution.minimumFeeMinor,
    executionCumulativePerSeller: commercialPolicy.execution.perSellerCumulative,
    standardFileConnectionMinor: commercialPolicy.additionalServices.secureFileConnection.feeMinor,
    apiIntegration: commercialPolicy.additionalServices.apiIntegration,
    taxAndExternalExpenses: "EXCLUDED",
  } as const;
  return { ...quote, quoteDigest: sha256Digest(quote) };
}

/** Seller-specific cumulative fee. Callers must keep one settlement sequence per seller. */
export function cumulativeExecutionFee(settledMinor: string, acceptedMinimumMinor: string = commercialPolicy.execution.minimumFeeMinor) {
  const settled = minor(settledMinor, "sellerCumulativeSettledMinor");
  const minimum = minor(acceptedMinimumMinor, "acceptedMinimumMinor");
  if (settled === 0n) return "0";
  let lower = 0n;
  let weighted = 0n;
  for (const slab of commercialPolicy.execution.slabs) {
    const limit = slab.throughConsiderationMinor === null ? null : BigInt(slab.throughConsiderationMinor);
    const end = min(settled, limit ?? settled);
    weighted += max(0n, end - lower) * BigInt(slab.rateBps);
    if (end === settled) break;
    lower = end;
  }
  return max(minimum, roundedRatio(weighted, 10_000n)).toString();
}

export function executionAccrual(input: {
  sellerId: string;
  previousSettledMinor: string;
  cumulativeSettledMinor: string;
  acceptedMinimumMinor?: string;
  eligiblePaidStandalonePremiumMinor: string;
  previousAppliedPremiumMinor: string;
}) {
  if (typeof input.sellerId !== "string" || !input.sellerId.trim()) throw new Error("sellerId is required for seller-specific accrual");
  const previous = minor(input.previousSettledMinor, "previousSellerSettledMinor");
  const cumulative = minor(input.cumulativeSettledMinor, "cumulativeSellerSettledMinor");
  if (cumulative < previous) throw new Error("settlement reversal requires a separate reconciled correction");
  const minimum = input.acceptedMinimumMinor ?? commercialPolicy.execution.minimumFeeMinor;
  const before = BigInt(cumulativeExecutionFee(previous.toString(), minimum));
  const now = BigInt(cumulativeExecutionFee(cumulative.toString(), minimum));
  const premium = minor(input.eligiblePaidStandalonePremiumMinor, "eligiblePaidStandalonePremiumMinor");
  const applied = minor(input.previousAppliedPremiumMinor, "previousAppliedPremiumMinor");
  if (applied > min(premium, before)) throw new Error("prior premium credit exceeds earned fee or paid premium");
  const credit = min(premium - applied, now - before);
  return {
    policyVersion: ENGAGEMENT_PRICING_VERSION,
    sellerId: input.sellerId.trim(),
    sellerCumulativeSettledMinor: cumulative.toString(),
    cumulativeExecutionEarnedMinor: now.toString(),
    incrementalGrossMinor: (now - before).toString(),
    incrementalPremiumCreditMinor: credit.toString(),
    incrementalExecutionDueMinor: (now - before - credit).toString(),
    remainingPremiumMinor: (premium - applied - credit).toString(),
    noCashRefund: commercialPolicy.execution.standalonePremiumConversionCredit.cashRefund === false,
    taxAndPassThroughCreditAllowed: false,
  };
}

export function withdrawalTopUp(quote: Pick<ReturnType<typeof engagementQuote>, "standalonePremiumMinor">, input: {
  route: PreparationRoute;
  reason: "VOLUNTARY_SWITCH" | "VOLUNTARY_WITHDRAWAL" | "FAILED_CLOSE" | "BUYER_REJECTION";
  mandateAccepted: boolean;
  topUpTermAccepted: boolean;
  fixedServiceDelivered: boolean;
  previousTopUpMinor: string;
}) {
  if (!["COMMITTED", "STANDALONE"].includes(input.route) || !["VOLUNTARY_SWITCH", "VOLUNTARY_WITHDRAWAL", "FAILED_CLOSE", "BUYER_REJECTION"].includes(input.reason)) throw new Error("invalid withdrawal decision");
  const previous = minor(input.previousTopUpMinor, "previousTopUpMinor");
  const cap = BigInt(quote.standalonePremiumMinor);
  if (previous > cap) throw new Error("prior top-up exceeds same-scope premium");
  const eligible = input.route === "COMMITTED" && input.mandateAccepted === true && input.topUpTermAccepted === true && input.fixedServiceDelivered === true && ["VOLUNTARY_SWITCH", "VOLUNTARY_WITHDRAWAL"].includes(input.reason);
  return eligible ? (cap - previous).toString() : "0";
}

/** 17:00 IST on the first Monday strictly after the twentieth local calendar day. */
export function quoteExpiryAt(offeredAt: Date) {
  if (!Number.isFinite(offeredAt.getTime())) throw new Error("valid offeredAt required");
  const ist = new Date(offeredAt.getTime() + 330 * 60_000);
  const twentiethDay = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 20));
  const daysToFollowingMonday = ((8 - twentiethDay.getUTCDay()) % 7) || 7;
  return new Date(Date.UTC(
    twentiethDay.getUTCFullYear(),
    twentiethDay.getUTCMonth(),
    twentiethDay.getUTCDate() + daysToFollowingMonday,
    11,
    30,
  ));
}
