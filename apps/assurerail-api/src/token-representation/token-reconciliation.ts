import { sha256Digest, toCanonicalValue } from "../contracts/v1";

export type Position = Readonly<{ holderRef: string; unitsMinor: string }>;

export type TokenReconciliationInput = Readonly<{
  tokenSupplyMinor: string;
  tokenHoldings: readonly Position[];
  economicInterests: readonly Position[];
  authoritativeRecord: readonly Position[];
}>;

export type TokenReconciliationCheck = Readonly<{
  code: "TOKEN_SUPPLY_VS_HOLDINGS" | "TOKEN_VS_ECONOMIC_INTEREST" | "ECONOMIC_INTEREST_VS_AUTHORITY";
  matched: boolean;
  expectedDigest: string;
  observedDigest: string;
  expected: unknown;
  observed: unknown;
}>;

const INTEGER = /^(0|[1-9][0-9]*)$/;

export function exactNonNegativeInteger(value: unknown, name: string): string {
  if (typeof value !== "string" || !INTEGER.test(value)) {
    throw new Error(`${name} must be a canonical non-negative integer string`);
  }
  return value;
}

export function normalisePositions(value: unknown, name: string): Position[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  const seen = new Set<string>();
  const result = value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${name}[${index}] must be an object`);
    }
    const holderRef = (item as { holderRef?: unknown }).holderRef;
    const unitsMinor = (item as { unitsMinor?: unknown }).unitsMinor;
    if (typeof holderRef !== "string" || !holderRef.trim() || holderRef.trim().length > 300) {
      throw new Error(`${name}[${index}].holderRef is required and must not exceed 300 characters`);
    }
    const canonicalHolder = holderRef.trim();
    if (seen.has(canonicalHolder)) throw new Error(`${name} contains duplicate holderRef ${canonicalHolder}`);
    seen.add(canonicalHolder);
    return {
      holderRef: canonicalHolder,
      unitsMinor: exactNonNegativeInteger(unitsMinor, `${name}[${index}].unitsMinor`),
    };
  });
  return result.sort((left, right) => left.holderRef.localeCompare(right.holderRef));
}

function total(positions: readonly Position[]): string {
  return positions.reduce((sum, item) => sum + BigInt(item.unitsMinor), 0n).toString();
}

function check(
  code: TokenReconciliationCheck["code"],
  expected: unknown,
  observed: unknown,
): TokenReconciliationCheck {
  const canonicalExpected = toCanonicalValue(expected);
  const canonicalObserved = toCanonicalValue(observed);
  const expectedDigest = sha256Digest(canonicalExpected);
  const observedDigest = sha256Digest(canonicalObserved);
  return { code, matched: expectedDigest === observedDigest, expectedDigest, observedDigest, expected: canonicalExpected, observed: canonicalObserved };
}

export function compareTokenRepresentation(input: TokenReconciliationInput) {
  const tokenSupplyMinor = exactNonNegativeInteger(input.tokenSupplyMinor, "tokenSupplyMinor");
  const tokenHoldings = normalisePositions(input.tokenHoldings, "tokenHoldings");
  const economicInterests = normalisePositions(input.economicInterests, "economicInterests");
  const authoritativeRecord = normalisePositions(input.authoritativeRecord, "authoritativeRecord");
  const checks = [
    check("TOKEN_SUPPLY_VS_HOLDINGS", { unitsMinor: tokenSupplyMinor }, { unitsMinor: total(tokenHoldings) }),
    check("TOKEN_VS_ECONOMIC_INTEREST", tokenHoldings, economicInterests),
    check("ECONOMIC_INTEREST_VS_AUTHORITY", economicInterests, authoritativeRecord),
  ] as const;
  return {
    matched: checks.every((item) => item.matched),
    tokenSupplyMinor,
    tokenHoldings,
    economicInterests,
    authoritativeRecord,
    checks,
    comparisonDigest: sha256Digest(checks),
  };
}
