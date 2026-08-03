import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReceivablesRecords, buildReceivablesDemoTape, isReceivablesPool } from "./receivables-demo-tape";
import { checkKAnon } from "../mint/kanon";
import { verifyTape } from "./verify";

const POOL = "HDFCBANK-RECV-TATASTEEL-2026Q3";

test("isReceivablesPool detects the RECV marker", () => {
  assert.equal(isReceivablesPool(POOL), true);
  assert.equal(isReceivablesPool("HDFC-MSME-2026Q2"), false);
});

test("seeded receivables are receivables-shaped (IRN, acceptance state, single bullet due date) and deterministic", () => {
  const a = buildReceivablesRecords(POOL);
  const b = buildReceivablesRecords(POOL);
  assert.deepEqual(a, b); // deterministic per poolId
  assert.ok(a.length >= 6);
  for (const r of a) {
    assert.match(r.irn, /^[0-9a-f]{64}$/); // high-entropy IRN stand-in
    assert.ok(r.acceptanceState === "EXPLICITLY_ACCEPTED" || r.acceptanceState === "CONTRACTUALLY_DEEMED_ACCEPTED");
    assert.match(r.dueDate, /^2026-\d{2}-\d{2}$/); // ONE bullet maturity — no amortisation schedule (the §2 diff)
    assert.match(r.acceptedAt, /^2025-\d{2}-\d{2}$/); // acceptance is the seasoning basis
    assert.ok(BigInt(r.invoiceAmountMinor) > 0n);
    assert.ok(r.buyerDid.startsWith("did:web:IND:institution:")); // the anchor buyer
    assert.equal(Object.prototype.hasOwnProperty.call(r, "emiMinor"), false); // no loan fields
  }
});

test("the anchor buyer is consistent across the pool (one anchor per pool)", () => {
  const recs = buildReceivablesRecords(POOL);
  const anchors = new Set(recs.map((r) => r.buyerDid));
  assert.equal(anchors.size, 1);
});

test("the receivables pool clears the k-anon mint gate and verifies end-to-end", () => {
  const tape = buildReceivablesDemoTape(POOL);
  const kanon = checkKAnon(tape);
  assert.equal(kanon.ok, true, kanon.reasons.join("; "));
  assert.equal(verifyTape(tape).ok, true);
});
