import assert from "node:assert/strict";
import test from "node:test";
import { canonicalSerialize, sha256Digest, toCanonicalValue } from "./canonical";
import { exactInteger, exactMoney, exactUnitQuantity } from "./exact-values";

test("[PR01][CANONICAL] object order is irrelevant and digests bind exact canonical bytes", () => {
  const first = { z: [3, { b: true, a: "x" }], a: null };
  const second = { a: null, z: [3, { a: "x", b: true }] };
  assert.equal(canonicalSerialize(first), '{"a":null,"z":[3,{"a":"x","b":true}]}');
  assert.equal(canonicalSerialize(first), canonicalSerialize(second));
  assert.equal(sha256Digest(first), sha256Digest(second));
  assert.match(sha256Digest(first), /^sha256:[a-f0-9]{64}$/);
});

test("[PR01][CANONICAL] ambiguous or lossy JavaScript values are rejected", () => {
  assert.throws(() => canonicalSerialize({ amount: 1.1 }), /exact decimal values belong in strings/);
  assert.throws(() => canonicalSerialize({ amount: Number.MAX_SAFE_INTEGER + 1 }), /safe canonical integer/);
  assert.throws(() => canonicalSerialize({ amount: 1n }), /BigInt/);
  assert.throws(() => canonicalSerialize([undefined]), /cannot be undefined/);
  assert.throws(() => canonicalSerialize(new Date("2026-01-01T00:00:00Z")), /plain object/);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalSerialize(cyclic), /cycle/);
});

test("[PR01][CANONICAL] undefined object properties are removed only at the JSON source boundary", () => {
  const converted = toCanonicalValue({ included: "yes", absent: undefined });
  assert.deepEqual(converted, { included: "yes" });
  assert.equal(canonicalSerialize(converted), '{"included":"yes"}');
  assert.throws(() => canonicalSerialize({ included: "yes", absent: undefined }), /cannot be undefined/);
});

test("[PR01][CANONICAL] provider JSON keys cannot mutate object prototypes during conversion", () => {
  const source = JSON.parse('{"__proto__":{"polluted":true},"a":1}') as Record<string, unknown>;
  assert.equal(canonicalSerialize(source), '{"__proto__":{"polluted":true},"a":1}');
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("[PR01][EXACT_VALUE] money and units never accept floats, exponent notation or leading zeroes", () => {
  assert.deepEqual(exactMoney({ currency: "INR", units: "123456", scale: 2 }), {
    currency: "INR",
    units: "123456",
    scale: 2,
  });
  assert.deepEqual(exactUnitQuantity({ unitCode: "CERTIFICATE_SMALLEST_UNIT", units: "10", scale: 6 }), {
    unitCode: "CERTIFICATE_SMALLEST_UNIT",
    units: "10",
    scale: 6,
  });
  assert.equal(exactInteger("-5", "adjustment", true), "-5");
  for (const invalid of ["01", "+1", "1.0", "1e3", "", 1]) {
    assert.throws(() => exactInteger(invalid), /canonical decimal integer string/);
  }
  assert.throws(() => exactMoney({ currency: "inr", units: "1", scale: 2 }), /uppercase/);
  assert.throws(() => exactMoney({ currency: "INR", units: "-1", scale: 2 }), /cannot be negative/);
  assert.throws(() => exactUnitQuantity({ unitCode: "token", units: "1", scale: 0 }), /governed uppercase/);
});
