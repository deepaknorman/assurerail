// The core 2a property: the venue trusts the MATH, not the transport.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CoLending } from "@code/shared";
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
  const tape = { ...reserved, tapeHash: `sha256:${CoLending.hashObject(reserved)}` };
  const v = verifyTape(tape);
  assert.equal(v.ok, true); // integrity fine
  assert.equal(v.mintReady, false); // but the reserve-then-mint gate blocks
  assert.ok(v.reasons.some((r) => /lock is not CONFIRMED/.test(r)));
});
