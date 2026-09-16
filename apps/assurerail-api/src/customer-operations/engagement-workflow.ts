import { engagementQuote, type EngagementQuoteInput, type PreparationRoute } from "./engagement-pricing";
import { calculateExactFee, type ExactFeeRule } from "./fee-calculation";
import { sha256Digest } from "../contracts/v1";

export const ASSET_FAMILIES = ["VEHICLE_EV", "VEHICLE_OTHER", "HOUSING", "GOLD", "EDUCATION", "MSME", "OTHER"] as const;
export type BillingProfile = { legalName: string; billingEmail: string; address: string; stateCode: string; postalCode: string; gstRegistration: "REGISTERED" | "UNREGISTERED"; gstin: string | null };
export function billingProfile(value: unknown): BillingProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("billing profile required");
  const v = value as Record<string, unknown>;
  const field = (key: string, max: number) => { const s = v[key]; if (typeof s !== "string" || !s.trim() || s.trim().length > max) throw new Error(`invalid ${key}`); return s.trim(); };
  const legalName = field("legalName", 200), billingEmail = field("billingEmail", 254), address = field("address", 600), stateCode = field("stateCode", 2), postalCode = field("postalCode", 6);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail) || !/^[0-9]{2}$/.test(stateCode) || !/^[1-9][0-9]{5}$/.test(postalCode)) throw new Error("invalid billing email, state code or postal code");
  if (v.gstRegistration !== "REGISTERED" && v.gstRegistration !== "UNREGISTERED") throw new Error("GST registration selection required");
  const gstin = v.gstRegistration === "REGISTERED" ? field("gstin", 15).toUpperCase() : null;
  if (gstin && (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin) || !gstin.startsWith(stateCode))) throw new Error("GSTIN format/state mismatch");
  return { legalName, billingEmail, address, stateCode, postalCode, gstRegistration: v.gstRegistration, gstin };
}

/** Tax treatment comes from an independently approved institution rate card, never the browser. */
export function stagePrice(baseMinor: string, taxRule: ExactFeeRule) {
  if (taxRule.feeBasis !== "NOTIONAL_BASIS_POINTS" || taxRule.minimumFeeMinor != null || taxRule.maximumFeeMinor != null) throw new Error("approved percentage tax rule without floor/cap required");
  const taxMinor = calculateExactFee(taxRule, { quantityMinor: "1", notionalMinor: baseMinor }).feeMinor;
  return { baseMinor, taxMinor, totalMinor: (BigInt(baseMinor) + BigInt(taxMinor)).toString() };
}
export function acceptedPricing(input: EngagementQuoteInput, taxRule: ExactFeeRule) {
  const q = engagementQuote(input);
  return { ...q, initial: stagePrice(q.initialAssessmentMinor, taxRule), committedPreparation: stagePrice(q.committedPreparationBalanceMinor, taxRule), standalonePreparation: stagePrice(q.standalonePreparationBalanceMinor, taxRule) };
}
export function stageAmount(quote: ReturnType<typeof acceptedPricing>, stage: string, route: PreparationRoute | null) {
  if (stage === "INITIAL") return quote.initial;
  if (stage !== "PREPARATION" || !route) throw new Error("accepted preparation route required");
  return route === "COMMITTED" ? quote.committedPreparation : quote.standalonePreparation;
}
export function engagementAcceptanceDigest(input: { quote: unknown; scope: unknown; billingProfile: unknown; contractId: string; termsDigest: string }) { return sha256Digest(input); }

/** Credits/refunds must be resolved explicitly; they cannot silently make a paid stage eligible. */
export function paidStageReadiness(input: { invoiceStatus: string; grossMinor: string; netMinor: string; expectedMinor: string; receivedMinor: string; unresolvedAdjustment: boolean }) {
  if (input.unresolvedAdjustment) return { ready: false, reason: "PAYMENT_ADJUSTMENT_PENDING" };
  if (input.invoiceStatus !== "ISSUED_SHADOW") return { ready: false, reason: "ISSUED_UNCORRECTED_INVOICE_REQUIRED" };
  if (input.grossMinor !== input.expectedMinor || input.netMinor !== input.expectedMinor) return { ready: false, reason: "ACCEPTED_QUOTE_MISMATCH" };
  if (input.receivedMinor !== input.expectedMinor) return { ready: false, reason: BigInt(input.receivedMinor) > BigInt(input.expectedMinor) ? "OVERPAYMENT_REQUIRES_RECONCILIATION" : "PAYMENT_OUTSTANDING" };
  return { ready: true, reason: "PAID_SHADOW_ONLY" };
}
