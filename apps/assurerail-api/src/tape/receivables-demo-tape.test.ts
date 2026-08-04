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

test("the pool spreads across several buyers, with no single buyer over the concentration cap", () => {
  // This previously asserted ONE anchor per pool — which, once concentration is measured per BUYER
  // (as the cap intends) rather than per invoice, is 100% concentration and cannot legitimately pass.
  // The old suite asserted single-anchor AND k-anon-pass side by side; only per-invoice grouping made
  // both true at once. A receivables pool has to be genuinely diversified to clear the gate.
  const recs = buildReceivablesRecords(POOL);
  const buyers = new Set(recs.map((r) => r.buyerDid));
  assert.ok(buyers.size >= 2, `expected multiple buyers, got ${buyers.size}`);

  const total = recs.reduce((s, r) => s + BigInt(r.invoiceAmountMinor), 0n);
  const byBuyer = new Map<string, bigint>();
  for (const r of recs) byBuyer.set(r.buyerDid, (byBuyer.get(r.buyerDid) ?? 0n) + BigInt(r.invoiceAmountMinor));
  for (const [did, amt] of byBuyer) {
    const bps = Number((amt * 10_000n) / total);
    assert.ok(bps <= 5000, `buyer ${did} holds ${bps}bps of the pool, over the 5000bps cap`);
  }
});

test("the receivables pool clears the k-anon mint gate and verifies end-to-end", () => {
  const tape = buildReceivablesDemoTape(POOL);
  const kanon = checkKAnon(tape);
  assert.equal(kanon.ok, true, kanon.reasons.join("; "));
  assert.equal(verifyTape(tape).ok, true);
});

test("k-anon aggregates concentration PER BUYER, so a single-buyer pool is refused", () => {
  // The regression guard for the false PASS: force every entry onto one obligor and the gate must
  // fail on concentration, even though each individual invoice is a small slice of the pool.
  const tape = buildReceivablesDemoTape(POOL);
  const singleBuyer = {
    ...tape,
    loans: tape.loans.map((l) => ({ ...l, obligorRef: "did:web:IND:institution:one-buyer" })),
  };
  const kanon = checkKAnon(singleBuyer);
  assert.equal(kanon.ok, false);
  assert.ok(
    kanon.reasons.some((r) => r.includes("concentration")),
    `expected a concentration failure, got: ${kanon.reasons.join("; ")}`,
  );
});
