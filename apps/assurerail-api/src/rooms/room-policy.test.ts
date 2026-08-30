import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMERCIAL_REDACTION_MARKER,
  DARK_IMPORTED_GRANT_STATUS,
  assertRoomPurposeAvailable,
  mapLegacyRoomPurpose,
  redactPassiveRoomView,
} from "./room-policy";

test("[PR07][POLICY] every legacy purpose maps only to passive diligence", () => {
  for (const purpose of ["DA", "PTC_DATA_ROOM", "RECEIVABLES_DA"]) assert.equal(mapLegacyRoomPurpose(purpose), "PASSIVE_DILIGENCE");
  assert.equal(DARK_IMPORTED_GRANT_STATUS, "MIGRATED_DARK");
  assert.doesNotThrow(() => assertRoomPurposeAvailable("PASSIVE_DILIGENCE"));
  assert.throws(() => assertRoomPurposeAvailable("COMMERCIAL_NEGOTIATION"), /unavailable/);
});

test("[PR07][POLICY] passive views recursively redact commercial keys without corrupting benign dates", () => {
  const result = redactPassiveRoomView({ generatedAt: "2026-08-30", offerPrice: "100", nested: { coupon: "9", assetCount: 2 } }) as Record<string, any>;
  assert.equal(result.generatedAt, "2026-08-30");
  assert.equal(result.offerPrice, COMMERCIAL_REDACTION_MARKER);
  assert.equal(result.nested.coupon, COMMERCIAL_REDACTION_MARKER);
  assert.equal(result.nested.assetCount, 2);
});
