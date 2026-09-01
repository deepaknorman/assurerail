import assert from "node:assert/strict";
import test from "node:test";
import { calculateExactFee, exactMinor } from "./fee-calculation";

test("[PR20][FEES] conventional and tokenised PTC examples calculate 30 and 50 basis points exactly", () => {
  const input = { quantityMinor: "1", notionalMinor: "100000000" };
  assert.equal(calculateExactFee({ feeBasis: "NOTIONAL_BASIS_POINTS", rateValue: "30", roundingMode: "DOWN" }, input).feeMinor, "300000");
  assert.equal(calculateExactFee({ feeBasis: "NOTIONAL_BASIS_POINTS", rateValue: "50", roundingMode: "DOWN" }, input).feeMinor, "500000");
});

test("[PR20][FEES] agreed PTC revenue examples preserve exact INR minor units", () => {
  const midSizeTransferredNotionalPaise = "165000000000"; // 55% of INR 300 crore
  const largeTransferredNotionalPaise = "2200000000000"; // 55% of INR 4,000 crore
  const conventional = { feeBasis: "NOTIONAL_BASIS_POINTS", rateValue: "30", roundingMode: "DOWN" } as const;
  const tokenised = { feeBasis: "NOTIONAL_BASIS_POINTS", rateValue: "50", roundingMode: "DOWN" } as const;
  assert.equal(calculateExactFee(conventional, { quantityMinor: "1", notionalMinor: midSizeTransferredNotionalPaise }).feeMinor, "495000000");
  assert.equal(calculateExactFee(conventional, { quantityMinor: "1", notionalMinor: largeTransferredNotionalPaise }).feeMinor, "6600000000");
  assert.equal(calculateExactFee(tokenised, { quantityMinor: "1", notionalMinor: midSizeTransferredNotionalPaise }).feeMinor, "825000000");
});

test("[PR20][FEES] half-up, minimum and maximum rules remain exact", () => {
  assert.equal(calculateExactFee({ feeBasis: "NOTIONAL_BASIS_POINTS", rateValue: "1", roundingMode: "HALF_UP" }, { quantityMinor: "0", notionalMinor: "5000" }).feeMinor, "1");
  assert.equal(calculateExactFee({ feeBasis: "FIXED_MINOR", rateValue: "4", minimumFeeMinor: "7", roundingMode: "DOWN" }, { quantityMinor: "0", notionalMinor: "0" }).feeMinor, "7");
  assert.equal(calculateExactFee({ feeBasis: "PER_UNIT_MINOR", rateValue: "9", maximumFeeMinor: "20", roundingMode: "DOWN" }, { quantityMinor: "3", notionalMinor: "0" }).feeMinor, "20");
});

test("[PR20][FEES] floating, exponential, negative and excessive basis-point values fail closed", () => {
  for (const value of ["1.2", "1e3", "-1", "01", 1]) assert.throws(() => exactMinor(value, "amount"));
  assert.throws(() => calculateExactFee({ feeBasis: "NOTIONAL_BASIS_POINTS", rateValue: "10001", roundingMode: "DOWN" }, { quantityMinor: "1", notionalMinor: "1" }), /cannot exceed/);
});
