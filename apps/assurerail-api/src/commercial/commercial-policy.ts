import { exactMoney, type ExactMoney } from "../contracts/v1";

export const COMMERCIAL_OPPORTUNITY_STATUSES = ["DRAFT", "PUBLISHED", "PAUSED", "WITHDRAWN", "CLOSED"] as const;
export type CommercialOpportunityStatus = (typeof COMMERCIAL_OPPORTUNITY_STATUSES)[number];

export const COMMERCIAL_CHANGE_ACTIONS = ["PUBLISH", "PAUSE", "RESUME", "WITHDRAW", "CLOSE"] as const;
export type CommercialChangeAction = (typeof COMMERCIAL_CHANGE_ACTIONS)[number];

export const COMMERCIAL_PRICING_TYPES = ["FIXED_PRICE", "YIELD_BPS", "SPREAD_BPS", "OTHER_APPROVED"] as const;
export const COMMERCIAL_MESSAGE_KINDS = ["PROPOSAL", "COUNTER", "COMMENT", "WITHDRAWAL"] as const;
export const COMMERCIAL_ALLOCATION_BASIS = ["INTEREST", "RFQ", "NEGOTIATION"] as const;

const EXACT_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d{0,11}[1-9])?$/;

const CHANGE_TARGET: Readonly<Record<CommercialChangeAction, Partial<Record<CommercialOpportunityStatus, CommercialOpportunityStatus>>>> = {
  PUBLISH: { DRAFT: "PUBLISHED" },
  PAUSE: { PUBLISHED: "PAUSED" },
  RESUME: { PAUSED: "PUBLISHED" },
  WITHDRAW: { DRAFT: "WITHDRAWN", PUBLISHED: "WITHDRAWN", PAUSED: "WITHDRAWN" },
  CLOSE: { PUBLISHED: "CLOSED", PAUSED: "CLOSED" },
};

export function commercialStatusChange(
  current: string,
  action: string,
): { fromStatus: CommercialOpportunityStatus; toStatus: CommercialOpportunityStatus } {
  if (!COMMERCIAL_OPPORTUNITY_STATUSES.includes(current as CommercialOpportunityStatus)) throw new Error("unknown opportunity status");
  if (!COMMERCIAL_CHANGE_ACTIONS.includes(action as CommercialChangeAction)) throw new Error("unknown opportunity change action");
  const toStatus = CHANGE_TARGET[action as CommercialChangeAction][current as CommercialOpportunityStatus];
  if (!toStatus) throw new Error(`${action} is not permitted from ${current}`);
  return { fromStatus: current as CommercialOpportunityStatus, toStatus };
}

export function exactPricingValue(value: unknown): string {
  if (typeof value !== "string" || value === "-0" || !EXACT_DECIMAL.test(value)) {
    throw new Error("pricingValue must be a canonical decimal string with at most 12 fractional digits");
  }
  return value;
}

export interface CommercialTermAmounts {
  amount: ExactMoney;
  minimum: ExactMoney;
  maximum: ExactMoney | null;
}

export function commercialTermAmounts(input: {
  currency: unknown;
  amountUnits: unknown;
  amountScale: unknown;
  minimumParticipationUnits: unknown;
  maximumParticipationUnits?: unknown;
}): CommercialTermAmounts {
  const amount = exactMoney({ currency: input.currency, units: input.amountUnits, scale: input.amountScale });
  const minimum = exactMoney({ currency: input.currency, units: input.minimumParticipationUnits, scale: input.amountScale });
  const maximum = input.maximumParticipationUnits === undefined || input.maximumParticipationUnits === null || input.maximumParticipationUnits === ""
    ? null
    : exactMoney({ currency: input.currency, units: input.maximumParticipationUnits, scale: input.amountScale });
  const total = BigInt(amount.units);
  const min = BigInt(minimum.units);
  const max = maximum ? BigInt(maximum.units) : total;
  if (total <= 0n) throw new Error("amountUnits must be positive");
  if (min <= 0n || min > total) throw new Error("minimum participation must be positive and not exceed the opportunity amount");
  if (max <= 0n || max < min || max > total) throw new Error("maximum participation must be between the minimum and opportunity amount");
  return { amount, minimum, maximum };
}

export function commercialParticipationAmount(input: {
  currency: unknown;
  amountUnits: unknown;
  amountScale: unknown;
}, term: {
  currency: string;
  amountUnits: string;
  amountScale: number;
  minimumParticipationUnits: string;
  maximumParticipationUnits: string | null;
}): ExactMoney {
  const amount = exactMoney({
    currency: input.currency,
    units: input.amountUnits,
    scale: input.amountScale,
  });
  if (amount.currency !== term.currency || amount.scale !== term.amountScale) {
    throw new Error("participation currency and scale must match the selected term version");
  }
  const units = BigInt(amount.units);
  const minimum = BigInt(term.minimumParticipationUnits);
  const maximum = BigInt(term.maximumParticipationUnits ?? term.amountUnits);
  if (units < minimum || units > maximum) throw new Error("participation amount is outside the selected term bounds");
  return amount;
}

export function assertCommercialWindow(validFrom: Date, expiresAt: Date, maximumDays = 366): void {
  if (!Number.isFinite(validFrom.getTime()) || !Number.isFinite(expiresAt.getTime())) throw new Error("commercial validity dates are invalid");
  if (expiresAt <= validFrom) throw new Error("commercial expiry must follow its effective time");
  if (expiresAt.getTime() - validFrom.getTime() > maximumDays * 24 * 60 * 60 * 1_000) {
    throw new Error(`commercial validity cannot exceed ${maximumDays} days`);
  }
}
