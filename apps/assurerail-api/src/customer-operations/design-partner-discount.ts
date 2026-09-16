import { sha256Digest } from "../contracts/v1";
import { stagePrice } from "./engagement-workflow";
import type { ExactFeeRule } from "./fee-calculation";

export const DESIGN_PARTNER_PROGRAMME = "DESIGN_PARTNER_30";
export const DESIGN_PARTNER_DISCOUNT_BPS = 3000;
export const DESIGN_PARTNER_MAX_ENTITIES = 2;

function percentage(amount: string, basisPoints: number): string {
  if (!/^(0|[1-9][0-9]{0,29})$/.test(amount)) throw new Error("canonical non-negative minor units required");
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) throw new Error("basis points must be an integer from 0 to 10000");
  return ((BigInt(amount) * BigInt(basisPoints) + 5_000n) / 10_000n).toString();
}

/**
 * Applies the approved coupon to AssureRail's service fee before tax. Tax is then recalculated on
 * the reduced taxable value. External/pass-through services never enter this calculation.
 */
export function designPartnerInvoiceDiscount(
  standard: { baseMinor: string; taxMinor: string; totalMinor: string },
  taxRule: ExactFeeRule,
  coupon: { id: string; institutionId: string; programmeCode: string; discountBps: number; slot: number | null; status: string },
) {
  if (coupon.status !== "APPROVED" || coupon.programmeCode !== DESIGN_PARTNER_PROGRAMME || coupon.discountBps !== DESIGN_PARTNER_DISCOUNT_BPS || coupon.slot === null || coupon.slot < 1 || coupon.slot > DESIGN_PARTNER_MAX_ENTITIES) throw new Error("approved design-partner coupon required");
  const verifiedStandard = stagePrice(standard.baseMinor, taxRule);
  if (verifiedStandard.taxMinor !== standard.taxMinor || verifiedStandard.totalMinor !== standard.totalMinor) throw new Error("standard fee and approved tax rule do not reconcile");
  const discountedBaseMinor = percentage(standard.baseMinor, 10_000 - coupon.discountBps);
  const baseCreditMinor = (BigInt(standard.baseMinor) - BigInt(discountedBaseMinor)).toString();
  const discounted = stagePrice(discountedBaseMinor, taxRule);
  const taxCreditMinor = (BigInt(standard.taxMinor) - BigInt(discounted.taxMinor)).toString();
  const totalCreditMinor = (BigInt(baseCreditMinor) + BigInt(taxCreditMinor)).toString();
  const snapshot = {
    programmeCode: coupon.programmeCode,
    discountBps: coupon.discountBps,
    slot: coupon.slot,
    standardBaseMinor: standard.baseMinor,
    standardTaxMinor: standard.taxMinor,
    standardTotalMinor: standard.totalMinor,
    discountedBaseMinor,
    discountedTaxMinor: discounted.taxMinor,
    discountedTotalMinor: discounted.totalMinor,
    baseCreditMinor,
    taxCreditMinor,
    totalCreditMinor,
  };
  return { ...snapshot, snapshotDigest: sha256Digest({ couponId: coupon.id, institutionId: coupon.institutionId, ...snapshot }) };
}

export function validatedDesignPartnerPayable(
  invoice: { grossFeeMinor: string; creditMinor: string; netFeeMinor: string; designPartnerDiscount?: any },
  institutionId: string,
): string | null {
  const discount = invoice.designPartnerDiscount;
  if (!discount) return null;
  const coupon = discount.coupon;
  if (!coupon || coupon.institutionId !== institutionId || coupon.status !== "APPROVED" || coupon.programmeCode !== DESIGN_PARTNER_PROGRAMME || coupon.discountBps !== DESIGN_PARTNER_DISCOUNT_BPS || coupon.slot === null || coupon.slot < 1 || coupon.slot > DESIGN_PARTNER_MAX_ENTITIES) throw new Error("invalid design-partner coupon binding");
  const snapshot = {
    programmeCode: discount.programmeCode,
    discountBps: discount.discountBps,
    slot: coupon.slot,
    standardBaseMinor: discount.standardBaseMinor,
    standardTaxMinor: discount.standardTaxMinor,
    standardTotalMinor: discount.standardTotalMinor,
    discountedBaseMinor: discount.discountedBaseMinor,
    discountedTaxMinor: discount.discountedTaxMinor,
    discountedTotalMinor: discount.discountedTotalMinor,
    baseCreditMinor: discount.baseCreditMinor,
    taxCreditMinor: discount.taxCreditMinor,
    totalCreditMinor: discount.totalCreditMinor,
  };
  const expectedDigest = sha256Digest({ couponId: coupon.id, institutionId, ...snapshot });
  if (discount.snapshotDigest !== expectedDigest || invoice.grossFeeMinor !== discount.standardTotalMinor || invoice.creditMinor !== discount.totalCreditMinor || invoice.netFeeMinor !== discount.discountedTotalMinor || BigInt(invoice.grossFeeMinor) - BigInt(invoice.creditMinor) !== BigInt(invoice.netFeeMinor)) throw new Error("invalid design-partner invoice snapshot");
  return discount.discountedTotalMinor;
}
