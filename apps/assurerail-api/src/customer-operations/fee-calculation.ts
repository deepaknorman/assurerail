export type ExactFeeRule = {
  feeBasis: "FIXED_MINOR" | "NOTIONAL_BASIS_POINTS" | "PER_UNIT_MINOR";
  rateValue: string;
  minimumFeeMinor?: string | null;
  maximumFeeMinor?: string | null;
  roundingMode: "DOWN" | "HALF_UP";
};

export function exactMinor(value: unknown, name: string, allowZero = true): string {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value) || (!allowZero && value === "0")) throw new Error(`${name} must be canonical ${allowZero ? "non-negative" : "positive"} integer text`);
  if (value.length > 30) throw new Error(`${name} exceeds 30 digits`);
  return value;
}

export function calculateExactFee(rule: ExactFeeRule, input: { quantityMinor: string; notionalMinor: string }): { basisMinor: string; feeMinor: string } {
  const rate = BigInt(exactMinor(rule.rateValue, "rateValue"));
  const quantity = BigInt(exactMinor(input.quantityMinor, "quantityMinor"));
  const notional = BigInt(exactMinor(input.notionalMinor, "notionalMinor"));
  let basis: bigint; let fee: bigint;
  if (rule.feeBasis === "FIXED_MINOR") { basis = 1n; fee = rate; }
  else if (rule.feeBasis === "PER_UNIT_MINOR") { basis = quantity; fee = quantity * rate; }
  else if (rule.feeBasis === "NOTIONAL_BASIS_POINTS") {
    if (rate > 10_000n) throw new Error("basis-point rate cannot exceed 10000");
    basis = notional; const numerator = notional * rate; fee = numerator / 10_000n;
    if (rule.roundingMode === "HALF_UP" && (numerator % 10_000n) * 2n >= 10_000n) fee += 1n;
  } else throw new Error("unsupported fee basis");
  if (!(["DOWN", "HALF_UP"] as string[]).includes(rule.roundingMode)) throw new Error("unsupported rounding mode");
  if (rule.minimumFeeMinor !== null && rule.minimumFeeMinor !== undefined) { const min = BigInt(exactMinor(rule.minimumFeeMinor, "minimumFeeMinor")); if (fee < min) fee = min; }
  if (rule.maximumFeeMinor !== null && rule.maximumFeeMinor !== undefined) { const max = BigInt(exactMinor(rule.maximumFeeMinor, "maximumFeeMinor")); if (fee > max) fee = max; }
  return { basisMinor: basis.toString(), feeMinor: fee.toString() };
}
