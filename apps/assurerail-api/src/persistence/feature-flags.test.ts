import assert from "node:assert/strict";
import test from "node:test";
import { inspectPersistenceFlags } from "./feature-flags";

test("[PR02][FLAGS] persistence paths default to inert/legacy-compatible values", () => {
  assert.deepEqual(inspectPersistenceFlags({}), {
    neutralIngress: "off",
    durableRelay: "legacy",
    errors: [],
  });
});

test("[PR02][FLAGS] only the explicit shadow and durable modes are accepted", () => {
  assert.deepEqual(inspectPersistenceFlags({
    ARAIL_NEUTRAL_INGRESS_V1: "SHADOW",
    ARAIL_DURABLE_RELAY_MODE: "DURABLE",
  }), {
    neutralIngress: "shadow",
    durableRelay: "durable",
    errors: [],
  });
  const rejected = inspectPersistenceFlags({
    ARAIL_NEUTRAL_INGRESS_V1: "true",
    ARAIL_DURABLE_RELAY_MODE: "enabled",
  });
  assert.equal(rejected.neutralIngress, "off");
  assert.equal(rejected.durableRelay, "legacy");
  assert.equal(rejected.errors.length, 2);
});
