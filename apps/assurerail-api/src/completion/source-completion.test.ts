import assert from "node:assert/strict";
import test from "node:test";
import { sourceCompletionMismatch, type SourceCompletionComparison } from "./source-completion.service";

const MATCHED: SourceCompletionComparison = {
  expectedSourceObjectId: "pool-1",
  expectedSourceVersion: "1.0",
  expectedManifestDigest: `sha256:${"a".repeat(64)}`,
  expectedLockReference: "lock-1",
  observedSourceObjectId: "pool-1",
  observedSourceState: "PERMANENT",
  observedSourceVersion: "1.0",
  observedManifestDigest: `sha256:${"a".repeat(64)}`,
  observedLockReference: "lock-1",
};

test("[PR08][COMPLETION] exact source object, version, manifest, state and lock reconcile", () => {
  assert.equal(sourceCompletionMismatch(MATCHED), null);
});

test("[PR08][COMPLETION] every exact-source divergence opens a specifically attributable break", () => {
  const cases: Array<[keyof SourceCompletionComparison, unknown, string]> = [
    ["observedSourceObjectId", "pool-2", "SOURCE_OBJECT_MISMATCH"],
    ["observedSourceState", "CONFIRMED", "SOURCE_STATE_NOT_PERMANENT"],
    ["observedSourceVersion", "2.0", "SOURCE_VERSION_MISMATCH"],
    ["observedManifestDigest", `sha256:${"b".repeat(64)}`, "MANIFEST_DIGEST_MISMATCH"],
    ["observedLockReference", "lock-2", "LOCK_REFERENCE_MISMATCH"],
  ];
  for (const [field, value, code] of cases) {
    assert.equal(sourceCompletionMismatch({ ...MATCHED, [field]: value })?.code, code);
  }
});

test("[PR08][COMPLETION] a route with no expected lock does not invent a lock-reference match", () => {
  assert.equal(sourceCompletionMismatch({ ...MATCHED, expectedLockReference: null, observedLockReference: null }), null);
});
