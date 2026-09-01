import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCommercialWindow,
  commercialParticipationAmount,
  commercialStatusChange,
  commercialTermAmounts,
  exactPricingValue,
} from "./commercial-policy";

test("[PR13][MONEY] opportunity and participation amounts use exact bounded integer units", () => {
  const term = commercialTermAmounts({
    currency: "INR",
    amountUnits: "100000000",
    amountScale: 2,
    minimumParticipationUnits: "1000000",
    maximumParticipationUnits: "25000000",
  });
  assert.deepEqual(term.amount, { currency: "INR", units: "100000000", scale: 2 });
  assert.equal(commercialParticipationAmount({
    currency: "INR",
    amountUnits: "25000000",
    amountScale: 2,
  }, {
    currency: term.amount.currency,
    amountUnits: term.amount.units,
    amountScale: term.amount.scale,
    minimumParticipationUnits: term.minimum.units,
    maximumParticipationUnits: term.maximum?.units ?? null,
  }).units, "25000000");
  assert.throws(() => commercialParticipationAmount({ currency: "INR", amountUnits: "25000001", amountScale: 2 }, {
    currency: "INR", amountUnits: "100000000", amountScale: 2,
    minimumParticipationUnits: "1000000", maximumParticipationUnits: "25000000",
  }), /outside the selected term bounds/);
  assert.throws(() => commercialTermAmounts({
    currency: "INR", amountUnits: "1.5", amountScale: 2, minimumParticipationUnits: "1",
  }));
});

test("[PR13][PRICING] pricing is canonical text and never a floating-point or exponent carrier", () => {
  assert.equal(exactPricingValue("875.25"), "875.25");
  for (const invalid of [875.25, "8e2", "01.0", "1.", ".5", "1.0", "-0", "1.1234567890123"]) {
    assert.throws(() => exactPricingValue(invalid));
  }
});

test("[PR13][STATE] opportunity publication, pause, resume and terminal changes are explicit", () => {
  assert.deepEqual(commercialStatusChange("DRAFT", "PUBLISH"), { fromStatus: "DRAFT", toStatus: "PUBLISHED" });
  assert.deepEqual(commercialStatusChange("PUBLISHED", "PAUSE"), { fromStatus: "PUBLISHED", toStatus: "PAUSED" });
  assert.deepEqual(commercialStatusChange("PAUSED", "RESUME"), { fromStatus: "PAUSED", toStatus: "PUBLISHED" });
  assert.throws(() => commercialStatusChange("DRAFT", "CLOSE"), /not permitted/);
  assert.throws(() => commercialStatusChange("CLOSED", "RESUME"), /not permitted/);
});

test("[PR13][WINDOW] validity must be ordered and bounded", () => {
  assert.doesNotThrow(() => assertCommercialWindow(new Date("2026-01-01T00:00:00Z"), new Date("2026-02-01T00:00:00Z")));
  assert.throws(() => assertCommercialWindow(new Date("2026-02-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z")));
  assert.throws(() => assertCommercialWindow(new Date("2026-01-01T00:00:00Z"), new Date("2028-01-01T00:00:00Z")));
});
