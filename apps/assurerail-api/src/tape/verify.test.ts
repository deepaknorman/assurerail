// The core 2a property: the venue trusts the MATH, not the transport.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAssurePoolTapeFixtureV1,
  computePoolManifestV1,
  hashObject,
  type AssurePoolTapeV1,
  type TapeInputLoanV1,
} from "../provider-contracts/v1";
import { buildDemoTape } from "./demo-tape";
import { verifyTape } from "./verify";

test("demo tape passes integrity and is mint-ready (lock CONFIRMED)", () => {
  const v = verifyTape(buildDemoTape("POOL-X"));
  assert.equal(v.ok, true);
  assert.equal(v.mintReady, true);
  assert.deepEqual(v.reasons, []);
});

test("tampering with the tape body fails the integrity check", () => {
  const tape = buildDemoTape("POOL-X");
  const tampered = { ...tape, aggregates: { ...tape.aggregates, mintableMinor: "999999999999" } };
  const v = verifyTape(tampered);
  assert.equal(v.ok, false);
  assert.ok(v.reasons.some((r) => /integrity check failed/.test(r)));
});

test("integrity-valid tape with a non-CONFIRMED lock is NOT mint-ready", () => {
  const demo = buildDemoTape("POOL-X");
  const { tapeHash: _drop, ...body } = demo;
  const reserved = { ...body, lock: { ...demo.lock!, state: "RESERVED" } };
  const tape = { ...reserved, tapeHash: `sha256:${hashObject(reserved)}` };
  const v = verifyTape(tape);
  assert.equal(v.ok, true); // integrity fine
  assert.equal(v.mintReady, false); // but the reserve-then-mint gate blocks
  assert.ok(v.reasons.some((r) => /lock is not CONFIRMED/.test(r)));
});

// ── H6: the manifest binds per-loan content; a post-freeze rewrite is provable ──────────────────

test("computePoolManifest is deterministic and order-independent on its input", () => {
  const a = [
    { loanRef: "L2", verdict: "WARNING" as const, overridden: false, disbursedMinor: "50000", originationDate: "2024-06-15", classificationBucket: "SMA-1" },
    { loanRef: "L1", verdict: "ELIGIBLE" as const, overridden: false, disbursedMinor: "90000", originationDate: "2024-07-15", classificationBucket: "STANDARD" },
  ];
  const reordered = [a[1], a[0]]; // same records, different order
  assert.equal(computePoolManifestV1(a), computePoolManifestV1(reordered));
  // undefined vs null on absent optionals must not change the hash (both normalise to null)
  const withUndef = [{ loanRef: "L1", verdict: "ELIGIBLE" as const, overridden: false, disbursedMinor: undefined, originationDate: undefined, classificationBucket: undefined }];
  const withNull = [{ loanRef: "L1", verdict: "ELIGIBLE" as const, overridden: false, disbursedMinor: null, originationDate: null, classificationBucket: null }];
  assert.equal(computePoolManifestV1(withUndef), computePoolManifestV1(withNull));
});

test("a change to ANY sealed field yields a different manifest (classification, override, disbursed, date)", () => {
  const base = [{ loanRef: "L1", verdict: "ELIGIBLE" as const, overridden: false, overrideReason: null, disbursedMinor: "90000", originationDate: "2024-07-15", classificationBucket: "STANDARD" }];
  const m0 = computePoolManifestV1(base);
  assert.notEqual(m0, computePoolManifestV1([{ ...base[0], classificationBucket: "NPA" }]));
  assert.notEqual(m0, computePoolManifestV1([{ ...base[0], verdict: "HARD_EXCLUDE" as const }]));
  assert.notEqual(m0, computePoolManifestV1([{ ...base[0], overridden: true, overrideReason: "in anyway" }]));
  assert.notEqual(m0, computePoolManifestV1([{ ...base[0], disbursedMinor: "1" }]));
  assert.notEqual(m0, computePoolManifestV1([{ ...base[0], originationDate: "2023-01-01" }]));
});

/** Build a self-consistent frozen tape the SAME way AssureLocker does: manifest sealed over the
 *  frozen loans, tapeHash over the body. */
function sealTape(loans: TapeInputLoanV1[]): AssurePoolTapeV1 {
  const manifestHash = computePoolManifestV1(loans);
  return buildAssurePoolTapeFixtureV1(
    { poolId: "POOL-H6", claId: "CLA-H6", cutoffDate: "2026-06-30", manifestHash, frozenAt: "2026-07-01T00:00:00Z" },
    loans,
    { state: "CONFIRMED", reference: "cbslock_h6", loanCount: loans.filter((l) => l.verdict === "ELIGIBLE" || l.verdict === "WARNING" || l.overridden).length },
  );
}

test("a freshly frozen, untampered tape verifies (manifest matches) and is mint-ready", () => {
  const loans: TapeInputLoanV1[] = [
    { loanRef: "L1", verdict: "ELIGIBLE", overridden: false, disbursedMinor: "90000", originationDate: "2024-06-15", classificationBucket: "STANDARD" },
    { loanRef: "L2", verdict: "WARNING", overridden: false, disbursedMinor: "50000", originationDate: "2024-07-15", classificationBucket: "SMA-1" },
  ];
  const v = verifyTape(sealTape(loans));
  assert.equal(v.ok, true);
  assert.equal(v.mintReady, true);
  assert.deepEqual(v.reasons, []);
});

test("H6 — a post-freeze reclassification FAILS verifyTape with the manifest-mismatch reason", () => {
  // Seal over the ORIGINAL loans (STANDARD/ELIGIBLE), then simulate exactly what buildPoolTape does
  // after a CLASSIFICATION_CHANGED event: it re-reads the LIVE (drifted) loan rows but carries the
  // STORED (sealed) manifestHash through. tapeHash self-recomputes to match the drifted body — yet
  // the manifest no longer commits to the published content.
  const original: TapeInputLoanV1[] = [
    { loanRef: "L1", verdict: "ELIGIBLE", overridden: false, disbursedMinor: "90000", originationDate: "2024-06-15", classificationBucket: "STANDARD" },
    { loanRef: "L2", verdict: "WARNING", overridden: false, disbursedMinor: "50000", originationDate: "2024-07-15", classificationBucket: "SMA-1" },
  ];
  const sealedManifest = computePoolManifestV1(original);
  const drifted = original.map((l) => (l.loanRef === "L1" ? { ...l, classificationBucket: "NPA", verdict: "HARD_EXCLUDE" as const } : l));
  const driftedTape = buildAssurePoolTapeFixtureV1(
    { poolId: "POOL-H6", claId: "CLA-H6", cutoffDate: "2026-06-30", manifestHash: sealedManifest /* stale/sealed */, frozenAt: "2026-07-01T00:00:00Z" },
    drifted,
    { state: "CONFIRMED", reference: "cbslock_h6", loanCount: 1 },
  );
  const v = verifyTape(driftedTape);
  // tapeHash alone is self-consistent on the drifted body — the OLD check would have passed.
  const { tapeHash, ...body } = driftedTape;
  assert.equal(`sha256:${hashObject(body)}`, tapeHash);
  // ...but the manifest recompute catches the tamper.
  assert.equal(v.ok, false);
  assert.equal(v.mintReady, false);
  assert.ok(v.reasons.some((r) => /manifestHash mismatch — pool content drifted from the frozen manifest/.test(r)));
});
