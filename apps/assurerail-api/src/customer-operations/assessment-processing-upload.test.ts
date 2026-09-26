import test from "node:test";
import assert from "node:assert/strict";
import { assessmentRetentionUntil } from "./assessment-processing.service";

test("assessment upload retention is stable across exact request replays",()=>{
  const createdAt=new Date("2026-09-27T00:00:00.000Z");
  const first=assessmentRetentionUntil(createdAt,365,new Date("2026-09-27T01:00:00.000Z"));
  const replay=assessmentRetentionUntil(createdAt,365,new Date("2026-10-01T00:00:00.000Z"));
  assert.equal(first,"2027-09-27T00:00:00.000Z");
  assert.equal(replay,first);
  assert.throws(()=>assessmentRetentionUntil(createdAt,1,new Date("2026-09-29T00:00:00.000Z")),/retention window has ended/);
});
