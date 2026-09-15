/** Current DA commercial policy. Historical accepted lifecycle quotes keep their own calculator. */
import { exactMinor } from "./fee-calculation";
import { sha256Digest } from "../contracts/v1";

export const ENGAGEMENT_PRICING_VERSION = "DA-2026-09-15-COUNT-30INITIAL-STANDALONE";
const minor = (x: unknown, name: string) => BigInt(exactMinor(x, name));
const max = (a: bigint, b: bigint) => a > b ? a : b;
const min = (a: bigint, b: bigint) => a < b ? a : b;
export type PreparationRoute = "COMMITTED" | "STANDALONE";

export function engagementQuote(loanCount: unknown) {
  if (!Number.isSafeInteger(loanCount) || (loanCount as number) < 1 || (loanCount as number) > 1_000_000) throw new Error("unique admitted loan count must be between 1 and 1000000");
  const count = BigInt(loanCount as number);
  const committed = max(count * 50_000n, 80_000_000n);
  const standalone = max(count * 65_000n, 104_000_000n);
  // The common Initial Assessment payment is 30% of the standalone quote. It is
  // credited once against either route, so both route balances still conserve exactly.
  const initial = (standalone * 30n + 50n) / 100n;
  const quote = {
    policyVersion: ENGAGEMENT_PRICING_VERSION, currency: "INR", currencyScale: 2,
    uniqueLoanCount: Number(count), initialAssessmentMinor: initial.toString(),
    committedFixedMinor: committed.toString(), standaloneFixedMinor: standalone.toString(),
    committedPreparationBalanceMinor: (committed - initial).toString(),
    standalonePreparationBalanceMinor: (standalone - initial).toString(),
    standalonePremiumMinor: (standalone - committed).toString(),
    initialDeliveryModel: "AUTOMATED_UNSIGNED_NO_CONSULTANT_REVIEW",
    preparationDeliveryModel: "QUALIFIED_EXPERT_REVIEW_AND_SIGNOFF",
    includedAutomatedReassessments: 3, reassessmentWindowDays: 30,
    executionBasis: "ACTUAL_PURCHASE_CONSIDERATION_SETTLED",
    executionMinimumProposalMinor: "50000000",
    executionMinimumStatus: "REQUIRES_EXPLICIT_QUOTE_ACCEPTANCE",
    standardFileConnectionMinor: "5000000", apiIntegration: "ON_REQUEST_QUOTE",
    taxAndExternalExpenses: "EXCLUDED",
  } as const;
  return { ...quote, quoteDigest: sha256Digest(quote) };
}

/** Cumulative fee, rounded once at programme level; never restart slabs on each closing. */
export function cumulativeExecutionFee(settledMinor: string, acceptedMinimumMinor: string) {
  const settled = minor(settledMinor, "settledMinor");
  const minimum = minor(acceptedMinimumMinor, "acceptedMinimumMinor");
  if (settled === 0n) return "0";
  const slabs: [bigint | null, bigint][] = [[10_000_000_000n, 50n], [50_000_000_000n, 40n], [100_000_000_000n, 35n], [null, 30n]];
  let lower = 0n, weighted = 0n;
  for (const [limit, rate] of slabs) {
    const end = min(settled, limit ?? settled);
    weighted += max(0n, end - lower) * rate;
    if (end === settled) break;
    lower = end;
  }
  return max(minimum, (weighted + 5_000n) / 10_000n).toString();
}

export function executionAccrual(input: {
  previousSettledMinor: string; cumulativeSettledMinor: string; acceptedMinimumMinor: string;
  eligiblePaidStandalonePremiumMinor: string; previousAppliedPremiumMinor: string;
}) {
  const previous = minor(input.previousSettledMinor, "previousSettledMinor");
  const cumulative = minor(input.cumulativeSettledMinor, "cumulativeSettledMinor");
  if (cumulative < previous) throw new Error("settlement reversal requires a separate reconciled correction");
  const before = BigInt(cumulativeExecutionFee(previous.toString(), input.acceptedMinimumMinor));
  const now = BigInt(cumulativeExecutionFee(cumulative.toString(), input.acceptedMinimumMinor));
  const premium = minor(input.eligiblePaidStandalonePremiumMinor, "eligiblePaidStandalonePremiumMinor");
  const applied = minor(input.previousAppliedPremiumMinor, "previousAppliedPremiumMinor");
  if (applied > min(premium, before)) throw new Error("prior premium credit exceeds earned fee or paid premium");
  const credit = min(premium - applied, now - before);
  return {
    cumulativeExecutionEarnedMinor: now.toString(), incrementalGrossMinor: (now - before).toString(),
    incrementalPremiumCreditMinor: credit.toString(), incrementalExecutionDueMinor: (now - before - credit).toString(),
    remainingPremiumMinor: (premium - applied - credit).toString(),
    noCashRefund: true, taxAndPassThroughCreditAllowed: false,
  };
}

export function withdrawalTopUp(loanCount: number, input: {
  route: PreparationRoute; reason: "VOLUNTARY_SWITCH" | "VOLUNTARY_WITHDRAWAL" | "FAILED_CLOSE" | "BUYER_REJECTION";
  mandateAccepted: boolean; topUpTermAccepted: boolean; fixedServiceDelivered: boolean; previousTopUpMinor: string;
}) {
  if (!["COMMITTED", "STANDALONE"].includes(input.route) || !["VOLUNTARY_SWITCH", "VOLUNTARY_WITHDRAWAL", "FAILED_CLOSE", "BUYER_REJECTION"].includes(input.reason)) throw new Error("invalid withdrawal decision");
  const q = engagementQuote(loanCount), previous = minor(input.previousTopUpMinor, "previousTopUpMinor");
  const cap = BigInt(q.standalonePremiumMinor);
  if (previous > cap) throw new Error("prior top-up exceeds same-scope premium");
  const eligible = input.route === "COMMITTED" && input.mandateAccepted === true && input.topUpTermAccepted === true && input.fixedServiceDelivered === true && ["VOLUNTARY_SWITCH", "VOLUNTARY_WITHDRAWAL"].includes(input.reason);
  return eligible ? (cap - previous).toString() : "0";
}
