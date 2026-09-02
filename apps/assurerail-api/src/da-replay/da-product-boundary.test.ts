import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const service = readFileSync(resolve(process.cwd(), "src/da-replay/da-replay.service.ts"), "utf8");
const product = readFileSync(resolve(process.cwd(), "src/da-replay/da-product.ts"), "utf8");
const source = `${service}\n${product}`;

test("[AR23][JOURNEY] conventional DA stages remain explicit and evidence-derived", () => {
  for (const stage of ["INTAKE", "DILIGENCE", "CREDIT_DECISION", "DOCUMENTATION", "CASE_APPROVAL", "REPLAY_AUTHORISATION", "COMPLETION_PLAN", "PARTNER_EXECUTION", "RECONCILIATION", "DOSSIER"]) {
    assert.match(source, new RegExp(`code: "${stage}"`));
  }
  assert.match(source, /evidenceSatisfied\("TRANSFEREE_CREDIT_DECISION"\)/);
  assert.match(source, /evidenceSatisfied\("EXECUTED_TRANSFER_DOCUMENT"\)/);
  assert.match(source, /latest\.signatureStatus === "VERIFIED"/);
  assert.match(source, /latest\?\.validationStatus === "VALID"/);
});

test("[AR23][PERIMETER] product journey is observe-only and retains external authority gates", () => {
  assert.match(source, /operatingBoundary: "OBSERVE_ONLY"/);
  assert.match(source, /Rail performs no funds, title, notice or register act/);
  for (const gate of ["COUNSEL_ROUTE_PACK", "PARTICIPANT_AUTHORISATION", "PARTNER_EXECUTION_ACKNOWLEDGEMENTS", "AUTHORITATIVE_RECORD_CONFIRMATION", "CONTROLLED_LIVE_ACCEPTANCE"]) {
    assert.match(source, new RegExp(gate));
  }
  assert.doesNotMatch(service.slice(service.indexOf("async productOverview"), service.indexOf("async getAuthorisation")), /\.dispatch\(|ExternalInstruction|SETTLEMENT_ADAPTER|HTS_ADAPTER|HCS_ANCHOR/);
});

test("[AR23][ACCESS] overview data is case-, institution- and grant-scoped", () => {
  assert.match(source, /await this\.requireCase\(actor, caseId, "VIEW_CASE"\)/);
  assert.match(source, /granteeInstitutionId: actor\.actingInstitutionId/);
  assert.match(source, /transactionCaseId: caseId/);
  assert.match(source, /canViewEvidence \? this\.db\.evidenceObject\.findMany/);
  assert.match(source, /transactionCaseId: caseId, institutionId: actor\.actingInstitutionId/);
  assert.match(source, /canViewRooms \? this\.db\.caseRoom\.findMany/);
  assert.doesNotMatch(service.slice(service.indexOf("async productOverview"), service.indexOf("async getAuthorisation")), /proposalStepUpId|reviewStepUpId|credentialVaultRef|storageRef/);
});
