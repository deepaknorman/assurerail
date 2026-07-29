import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoTape } from "../tape/demo-tape";
import type { TapeLoan } from "../tape/tape.types";
import { checkKAnon } from "./kanon";

test("demo pool passes k-anon (value, seasoning, concentration)", () => {
  const r = checkKAnon(buildDemoTape("POOL-X"));
  assert.equal(r.ok, true);
  assert.deepEqual(r.reasons, []);
  assert.ok(r.detail.maxConcentrationBps <= 5000);
});

test("a concentrated pool fails the concentration check", () => {
  const tape = buildDemoTape("POOL-Y");
  const big = {
    ...tape,
    loans: [
      { ...tape.loans[0]!, disbursedMinor: "80000000000", mintable: true },
      { ...tape.loans[1]!, disbursedMinor: "20000000000", mintable: true },
    ],
    aggregates: { ...tape.aggregates, mintableMinor: "100000000000" },
  };
  const r = checkKAnon(big);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => /concentration/.test(x)));
});

test("a sub-floor pool fails the value check", () => {
  const tape = buildDemoTape("POOL-Z");
  const small = {
    ...tape,
    loans: tape.loans.map((l: TapeLoan) => ({ ...l, disbursedMinor: "1000000" })),
    aggregates: { ...tape.aggregates, mintableMinor: "3000000" },
  };
  const r = checkKAnon(small);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => /below floor/.test(x)));
});
