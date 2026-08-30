declare const exactIntegerBrand: unique symbol;
export type ExactInteger = string & { readonly [exactIntegerBrand]: true };

const CANONICAL_INTEGER = /^(?:0|-?[1-9]\d*)$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;
const UNIT_CODE = /^[A-Z][A-Z0-9_]{1,31}$/;

export function exactInteger(value: unknown, fieldName = "value", allowNegative = true): ExactInteger {
  if (typeof value !== "string" || !CANONICAL_INTEGER.test(value)) {
    throw new Error(`${fieldName} must be a canonical decimal integer string with no leading zero or plus sign`);
  }
  if (!allowNegative && value.startsWith("-")) throw new Error(`${fieldName} cannot be negative`);
  return value as ExactInteger;
}

export interface ExactMoney {
  readonly currency: string;
  /** Integer count of the smallest declared unit, encoded as a canonical string. */
  readonly units: ExactInteger;
  /** Decimal places represented by one whole currency unit; stored explicitly, never inferred. */
  readonly scale: number;
}

export interface ExactUnitQuantity {
  readonly unitCode: string;
  /** Integer count of the smallest declared unit, encoded as a canonical string. */
  readonly units: ExactInteger;
  readonly scale: number;
}

function assertScale(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 18) {
    throw new Error(`${fieldName} must be an integer from 0 through 18`);
  }
  return value;
}

export function exactMoney(input: {
  currency: unknown;
  units: unknown;
  scale: unknown;
  allowNegative?: boolean;
}): ExactMoney {
  if (typeof input.currency !== "string" || !CURRENCY_CODE.test(input.currency)) {
    throw new Error("currency must be an uppercase three-letter code");
  }
  return {
    currency: input.currency,
    units: exactInteger(input.units, "money.units", input.allowNegative ?? false),
    scale: assertScale(input.scale, "money.scale"),
  };
}

export function exactUnitQuantity(input: {
  unitCode: unknown;
  units: unknown;
  scale: unknown;
  allowNegative?: boolean;
}): ExactUnitQuantity {
  if (typeof input.unitCode !== "string" || !UNIT_CODE.test(input.unitCode)) {
    throw new Error("unitCode must be a governed uppercase unit code");
  }
  return {
    unitCode: input.unitCode,
    units: exactInteger(input.units, "quantity.units", input.allowNegative ?? false),
    scale: assertScale(input.scale, "quantity.scale"),
  };
}
