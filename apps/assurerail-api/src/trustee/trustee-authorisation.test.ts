import { test } from "node:test";
import assert from "node:assert/strict";
import { signTrusteeAuthorisation, verifyTrusteeAuthorisation } from "./trustee-authorisation";

const base = {
  trusteeDid: "did:web:demo.assurerail.invalid:entity:trustee",
  poolId: "HDFCBANK-RECV-TATASTEEL-2026Q3",
  tapeHash: "a".repeat(64),
  mintableMinor: "30000000000",
  authorisedAt: "2026-08-03T00:00:00.000Z",
  nonce: "deadbeefdeadbeef",
};

test("a trustee authorisation signs and verifies", () => {
  const auth = signTrusteeAuthorisation(base, "k1");
  assert.equal(auth.scheme, "arail-trustee-auth:v1:hmac-sha256");
  assert.match(auth.signature, /^[0-9a-f]{64}$/);
  assert.equal(verifyTrusteeAuthorisation(auth, "k1").ok, true);
});

test("signing is deterministic for the same input and key", () => {
  assert.equal(signTrusteeAuthorisation(base, "k1").signature, signTrusteeAuthorisation(base, "k1").signature);
});

test("a tampered authorisation fails verification (the authorised amount cannot be changed)", () => {
  const auth = signTrusteeAuthorisation(base, "k1");
  assert.equal(verifyTrusteeAuthorisation({ ...auth, mintableMinor: "999999999999" }, "k1").ok, false);
});

test("a wrong key fails verification", () => {
  const auth = signTrusteeAuthorisation(base, "k1");
  assert.equal(verifyTrusteeAuthorisation(auth, "k2").ok, false);
});

test("an unknown scheme is rejected", () => {
  const auth = signTrusteeAuthorisation(base, "k1");
  assert.equal(verifyTrusteeAuthorisation({ ...auth, scheme: "bogus" as never }, "k1").ok, false);
});
