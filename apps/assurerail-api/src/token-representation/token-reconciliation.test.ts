import assert from "node:assert/strict";
import test from "node:test";
import { compareTokenRepresentation, normalisePositions } from "./token-reconciliation";

test("[PR11] token mirror reconciles only when supply, positions, economics and authority all agree", () => {
  const result = compareTokenRepresentation({
    tokenSupplyMinor: "100",
    tokenHoldings: [{ holderRef: "did:b", unitsMinor: "40" }, { holderRef: "did:a", unitsMinor: "60" }],
    economicInterests: [{ holderRef: "did:a", unitsMinor: "60" }, { holderRef: "did:b", unitsMinor: "40" }],
    authoritativeRecord: [{ holderRef: "did:a", unitsMinor: "60" }, { holderRef: "did:b", unitsMinor: "40" }],
  });
  assert.equal(result.matched, true);
  assert.deepEqual(result.checks.map((item) => item.matched), [true, true, true]);
});

test("[PR11] an authoritative-record mismatch remains a blocking break", () => {
  const result = compareTokenRepresentation({
    tokenSupplyMinor: "100",
    tokenHoldings: [{ holderRef: "did:a", unitsMinor: "100" }],
    economicInterests: [{ holderRef: "did:a", unitsMinor: "100" }],
    authoritativeRecord: [{ holderRef: "did:b", unitsMinor: "100" }],
  });
  assert.equal(result.matched, false);
  assert.equal(result.checks[2].code, "ECONOMIC_INTEREST_VS_AUTHORITY");
  assert.equal(result.checks[2].matched, false);
});

test("[PR11] position inputs reject non-canonical amounts and duplicate holders", () => {
  assert.throws(() => normalisePositions([{ holderRef: "did:a", unitsMinor: "01" }], "positions"), /canonical/);
  assert.throws(() => normalisePositions([
    { holderRef: "did:a", unitsMinor: "1" },
    { holderRef: "did:a", unitsMinor: "2" },
  ], "positions"), /duplicate/);
});
