import assert from "node:assert/strict";
import test from "node:test";
import {
  SIMULATION_FAULTS,
  buildMultiPartySimulationCorpus,
  buildPtcPreparationSimulationFamily,
  completeSimulationGateDigest,
  ptcPreparationSimulationFamilyDigest,
  simulationCorpusDigest,
  validateParticipantTopology,
} from "./multi-party-simulation";

test("[SIM-100][CORPUS] deterministic matrix contains 200 distinct multi-party scenarios", () => {
  const first = buildMultiPartySimulationCorpus();
  const second = buildMultiPartySimulationCorpus();
  assert.equal(first.length, 200);
  assert.equal(new Set(first.map((scenario) => scenario.scenarioId)).size, first.length);
  assert.equal(simulationCorpusDigest(first), simulationCorpusDigest(second));
  assert.equal(simulationCorpusDigest(first), "sha256:e92c0bbdb9298d23c4714d9f880e1afc0e0ca491747946fa0865f3c89f9d200e");
  assert.deepEqual(new Set(first.map((scenario) => scenario.fault)), new Set(SIMULATION_FAULTS));
  for (const route of ["DA", "PTC"]) assert.equal(first.filter((scenario) => scenario.transactionRoute === route).length, 100);
  for (const representation of ["CONVENTIONAL", "TOKENISED"]) assert.equal(first.filter((scenario) => scenario.representation === representation).length, 100);
  for (const partyCount of [2, 3, 4, 5, 6]) assert.equal(first.filter((scenario) => scenario.partyCount === partyCount).length, 40);
});

test("[SIM-100][PTC-PREP] signed preparation conformance is registered in the institutional gate", () => {
  const first = buildPtcPreparationSimulationFamily();
  const second = buildPtcPreparationSimulationFamily();
  assert.equal(first.length, 8);
  assert.equal(new Set(first.map((scenario) => scenario.scenarioId)).size, first.length);
  assert.equal(first.filter((scenario) => scenario.expectedDecision === "REVIEW_REQUIRED").length, 1);
  assert.equal(first.filter((scenario) => scenario.expectedDecision === "BLOCKED").length, 7);
  assert.equal(ptcPreparationSimulationFamilyDigest(first), ptcPreparationSimulationFamilyDigest(second));
  assert.equal(ptcPreparationSimulationFamilyDigest(first), "sha256:3d41522e8acc160cd0d9334e244c3a70252ccaa54dc5f9bf92448c6cc18c1e38");
  assert.equal(completeSimulationGateDigest(), "sha256:6c1449791456fae491580ff766a69fdf02f05b02f14a8836de80dc86a70ae684");
  for (const scenario of first) {
    assert.equal(scenario.transactionRoute, "PTC");
    assert.equal(scenario.representation, "CONVENTIONAL");
    assert.deepEqual(scenario.partyRoles, ["ISSUER", "TRUSTEE", "RTA"]);
  }
});

test("[SIM-100][TOPOLOGY] DA requires both transfer parties and PTC requires trustee plus recordkeeper", () => {
  const corpus = buildMultiPartySimulationCorpus();
  for (const scenario of corpus) {
    const result = validateParticipantTopology(scenario);
    if (scenario.transactionRoute === "PTC" && scenario.partyCount === 2) {
      assert.deepEqual(result, { allowed: false, code: "PTC_TRUSTEE_OR_RECORDKEEPER_ABSENT" });
      if (!["INACTIVE_MEMBER", "WRONG_SESSION_CONTEXT", "NON_PARTICIPANT_ACCESS"].includes(scenario.fault)) {
        assert.equal(scenario.expectedGate, "PARTICIPANT_TOPOLOGY");
      }
    } else {
      assert.equal(result.allowed, true, scenario.scenarioId);
    }
  }
});

test("[SIM-100][EXPECTATIONS] no adverse scenario is classified as accepted", () => {
  for (const scenario of buildMultiPartySimulationCorpus()) {
    if (scenario.fault === "NONE" && !(scenario.transactionRoute === "PTC" && scenario.partyCount === 2)) {
      assert.deepEqual([scenario.expectedGate, scenario.expectedDecision], ["RAIL_REVIEW", "REVIEW_REQUIRED"]);
    }
    else assert.equal(scenario.expectedDecision, "BLOCKED", scenario.scenarioId);
  }
});
