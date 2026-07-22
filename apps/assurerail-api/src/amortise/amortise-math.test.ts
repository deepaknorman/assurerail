// Pro-rata amortisation math — the one thing that MUST be exact: conservation of value.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateAmortisation } from "./amortise-math";

const sum = (rows: { amortised: string }[]) => rows.reduce((s, r) => s + BigInt(r.amortised), 0n);

test("exact conservation: allocations always sum to exactly P", () => {
  const holdings = [
    { holderDid: "did:web:a", units: "3333333333" },
    { holderDid: "did:web:b", units: "3333333333" },
    { holderDid: "did:web:c", units: "3333333334" },
  ];
  for (const P of ["1", "7", "1000000000", "10000000000"]) {
    const r = allocateAmortisation(holdings, P);
    assert.equal(sum(r.allocations).toString(), P, `sum must equal P=${P}`);
  }
});

test("pro-rata: a 2x holder is amortised ~2x (± the rounding unit)", () => {
  const r = allocateAmortisation(
    [
      { holderDid: "did:web:big", units: "2000000" },
      { holderDid: "did:web:small", units: "1000000" },
    ],
    "300000",
  );
  const big = BigInt(r.allocations.find((a) => a.holderDid === "did:web:big")!.amortised);
  const small = BigInt(r.allocations.find((a) => a.holderDid === "did:web:small")!.amortised);
  assert.equal((big + small).toString(), "300000");
  assert.equal(big, 200000n); // 2/3 of 300000
  assert.equal(small, 100000n); // 1/3 of 300000
});

test("largest-remainder: the odd unit goes to the largest fractional remainder, deterministically", () => {
  // 3 equal holders, P=100 → floor share 33 each (99), 1 leftover. All remainders equal → tie-break by
  // holderDid → 'a' gets the extra unit. Result is stable across runs.
  const holdings = [
    { holderDid: "did:web:a", units: "100" },
    { holderDid: "did:web:b", units: "100" },
    { holderDid: "did:web:c", units: "100" },
  ];
  const r1 = allocateAmortisation(holdings, "100");
  const r2 = allocateAmortisation(holdings, "100");
  assert.equal(sum(r1.allocations).toString(), "100");
  assert.deepEqual(r1.allocations, r2.allocations, "must be deterministic");
  const a = r1.allocations.find((x) => x.holderDid === "did:web:a")!;
  assert.equal(a.amortised, "34"); // 33 + the leftover unit
});

test("full amortisation: P == outstanding → fullyAmortised, every holding drops to 0", () => {
  const holdings = [
    { holderDid: "did:web:a", units: "600" },
    { holderDid: "did:web:b", units: "400" },
  ];
  const r = allocateAmortisation(holdings, "1000");
  assert.equal(r.fullyAmortised, true);
  assert.ok(r.allocations.every((a) => a.unitsAfter === "0"), "all holdings retired");
});

test("guards: P must be positive and cannot exceed outstanding", () => {
  const holdings = [{ holderDid: "did:web:a", units: "1000" }];
  assert.throws(() => allocateAmortisation(holdings, "0"), /positive/);
  assert.throws(() => allocateAmortisation(holdings, "1001"), /exceeds outstanding/);
});

test("single holder receives the whole paydown", () => {
  const r = allocateAmortisation([{ holderDid: "did:web:only", units: "5000" }], "1234");
  assert.equal(r.allocations[0].amortised, "1234");
  assert.equal(r.allocations[0].unitsAfter, "3766");
  assert.equal(r.fullyAmortised, false);
});

test("zero-unit holders are ignored (not allocated to)", () => {
  const r = allocateAmortisation(
    [
      { holderDid: "did:web:a", units: "1000" },
      { holderDid: "did:web:z", units: "0" },
    ],
    "100",
  );
  assert.equal(r.allocations.length, 1);
  assert.equal(r.allocations[0].holderDid, "did:web:a");
});
