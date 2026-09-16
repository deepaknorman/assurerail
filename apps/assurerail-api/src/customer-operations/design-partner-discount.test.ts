import test from "node:test";
import assert from "node:assert/strict";
import { DESIGN_PARTNER_DISCOUNT_BPS, DESIGN_PARTNER_PROGRAMME, designPartnerInvoiceDiscount, validatedDesignPartnerPayable } from "./design-partner-discount";
import { cumulativeExecutionFee } from "./engagement-pricing";

const tax = { feeBasis: "NOTIONAL_BASIS_POINTS", rateValue: "1800", roundingMode: "HALF_UP" } as const;
const coupon = { id: "coupon-1", institutionId: "seller-1", programmeCode: DESIGN_PARTNER_PROGRAMME, discountBps: DESIGN_PARTNER_DISCOUNT_BPS, slot: 1, status: "APPROVED" };

test("design-partner credit discounts the service fee before recalculating GST", () => {
  const result = designPartnerInvoiceDiscount({ baseMinor: "31200000", taxMinor: "5616000", totalMinor: "36816000" }, tax, coupon);
  assert.deepEqual({ base: result.discountedBaseMinor, tax: result.discountedTaxMinor, total: result.discountedTotalMinor }, { base: "21840000", tax: "3931200", total: "25771200" });
  assert.equal(result.totalCreditMinor, "11044800");
});

test("discount application fails closed for altered or unapproved coupons", () => {
  for (const change of [{ status: "PROPOSED" }, { discountBps: 2999 }, { programmeCode: "OTHER" }, { slot: 3 }]) {
    assert.throws(() => designPartnerInvoiceDiscount({ baseMinor: "100", taxMinor: "18", totalMinor: "118" }, tax, { ...coupon, ...change }), /approved design-partner/);
  }
  assert.throws(() => designPartnerInvoiceDiscount({ baseMinor: "100", taxMinor: "17", totalMinor: "117" }, tax, coupon), /do not reconcile/);
});

test("only a digest-bound approved entity coupon changes the payable amount", () => {
  const discount = designPartnerInvoiceDiscount({ baseMinor: "31200000", taxMinor: "5616000", totalMinor: "36816000" }, tax, coupon);
  const invoice = { grossFeeMinor: discount.standardTotalMinor, creditMinor: discount.totalCreditMinor, netFeeMinor: discount.discountedTotalMinor, designPartnerDiscount: { id: "discount-1", couponId: coupon.id, ...discount, coupon } };
  assert.equal(validatedDesignPartnerPayable(invoice, coupon.institutionId), "25771200");
  assert.throws(() => validatedDesignPartnerPayable({ ...invoice, netFeeMinor: "25771199" }, coupon.institutionId), /snapshot/);
  assert.throws(() => validatedDesignPartnerPayable(invoice, "another-seller"), /binding/);
});

test("lifetime coupon produces the expected 28/21 bps marginal execution economics", () => {
  const at25 = designPartnerInvoiceDiscount({ baseMinor: cumulativeExecutionFee("25000000000"), taxMinor: "18000000", totalMinor: "118000000" }, tax, coupon);
  const at50 = designPartnerInvoiceDiscount({ baseMinor: cumulativeExecutionFee("50000000000"), taxMinor: "31500000", totalMinor: "206500000" }, tax, coupon);
  const at300 = designPartnerInvoiceDiscount({ baseMinor: cumulativeExecutionFee("300000000000"), taxMinor: "166500000", totalMinor: "1091500000" }, tax, coupon);
  assert.equal(at25.discountedBaseMinor, "70000000");
  assert.equal(at50.discountedBaseMinor, "122500000");
  assert.equal(at300.discountedBaseMinor, "647500000");
});
