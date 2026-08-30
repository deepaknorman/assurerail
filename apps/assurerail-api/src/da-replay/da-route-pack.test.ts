import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConventionalDaSagaPlan,
  compareDaLegObservation,
  CONVENTIONAL_DA_ROUTE_PACK,
  deriveDaSagaState,
} from "./da-route-pack";
import { COMPLETED_DA_REFERENCE_REPLAY_V1 } from "./fixtures/completed-da-reference-replay-v1";

test("[PR09][DA] route plan keeps the transferee decision participant-owned and does not inject trustee/assurance", () => {
  const plan = buildConventionalDaSagaPlan(COMPLETED_DA_REFERENCE_REPLAY_V1);
  const decision = plan.find(
    (leg) => leg.legType === "TRANSFEREE_CREDIT_DECISION"
  );
  assert.equal(
    decision?.participantOwnerInstitutionId,
    COMPLETED_DA_REFERENCE_REPLAY_V1.transfereeInstitutionId
  );
  assert.equal(decision?.performerClass, "PARTICIPANT_OWNED");
  assert.deepEqual(CONVENTIONAL_DA_ROUTE_PACK.requiredPartyRoles, [
    "TRANSFEROR",
    "TRANSFEREE",
  ]);
  assert.deepEqual(CONVENTIONAL_DA_ROUTE_PACK.prohibitedAutomaticParties, [
    "TRUSTEE",
    "ASSURANCE_PROVIDER",
  ]);
  assert.equal(CONVENTIONAL_DA_ROUTE_PACK.executionMode, "OBSERVE_ONLY");
  assert.ok(
    plan.findIndex((leg) => leg.legType === "DOCUMENT_EXECUTION") <
      plan.findIndex((leg) => leg.legType === "CASH_CONSIDERATION")
  );
});

test("[PR09][DA] the completed reference outcome replays to exact observations without mutation", () => {
  const plan = buildConventionalDaSagaPlan(COMPLETED_DA_REFERENCE_REPLAY_V1);
  const comparisons = plan.map((leg) =>
    compareDaLegObservation(leg.expected, leg.expected)
  );
  assert.ok(comparisons.every((comparison) => comparison.result === "MATCHED"));
  assert.ok(
    comparisons.every((comparison) => comparison.differences.length === 0)
  );
  const observed = plan.map(() => ({ required: true, state: "OBSERVED" }));
  assert.equal(deriveDaSagaState(observed, 0), "OBSERVED");
  const reconciled = plan.map(() => ({ required: true, state: "RECONCILED" }));
  assert.equal(deriveDaSagaState(reconciled, 0), "RECONCILED");
});

test("[PR09][DA] differences remain explicit and block reconciliation rather than correcting history", () => {
  const plan = buildConventionalDaSagaPlan(COMPLETED_DA_REFERENCE_REPLAY_V1);
  const cash = plan.find((leg) => leg.legType === "CASH_CONSIDERATION")!;
  const changed = {
    ...(cash.expected as Readonly<Record<string, unknown>>),
    considerationReference: "different-historic-reference",
  };
  const result = compareDaLegObservation(cash.expected, changed);
  assert.equal(result.result, "BREAK_OPEN");
  assert.deepEqual(
    result.differences.map((item) => item.path),
    ["$.considerationReference"]
  );
  assert.equal(
    deriveDaSagaState([{ required: true, state: "BREAK_OPEN" }], 1),
    "BREAK_OPEN"
  );
});

test("[PR09][DA] exact consideration rejects unsafe or non-canonical amounts", () => {
  assert.throws(
    () =>
      buildConventionalDaSagaPlan({
        ...COMPLETED_DA_REFERENCE_REPLAY_V1,
        consideration: { currency: "INR", units: "01", scale: 2 },
      }),
    /canonical decimal integer/
  );
  assert.throws(
    () =>
      buildConventionalDaSagaPlan({
        ...COMPLETED_DA_REFERENCE_REPLAY_V1,
        consideration: { currency: "INR", units: "0", scale: 2 },
      }),
    /must be positive/
  );
});
