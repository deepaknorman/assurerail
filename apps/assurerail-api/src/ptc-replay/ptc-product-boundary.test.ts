import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const service = readFileSync(resolve(process.cwd(), "src/ptc-replay/ptc-replay.service.ts"), "utf8");
const product = readFileSync(resolve(process.cwd(), "src/ptc-replay/ptc-product.ts"), "utf8");
const source = `${service}\n${product}`;

test("[AR24][JOURNEY] PTC functions remain separate and evidence-derived", () => {
  for (const stage of ["PROGRAMME_TRUST", "POOL_TRANSFER_ELIGIBILITY", "COUNSEL_RATING_ASSURANCE", "DOCUMENTS_TRANCHE", "SUBSCRIPTION_CONSIDERATION", "TRUSTEE_CONTROL", "ISSUE_ALLOTMENT", "AUTHORITATIVE_RECORD", "LIFECYCLE_NOTICE_SETUP", "RECONCILIATION", "DOSSIER"])
    assert.match(source, new RegExp(`code: "${stage}"`));
  assert.match(source, /latest\.result === "VERIFIED"/);
  assert.match(source, /latest\.signatureStatus === "VERIFIED"/);
  assert.match(source, /latest\?\.validationStatus === "VALID"/);
});

test("[AR24][PERIMETER] trustee and authoritative record remain distinct external authorities", () => {
  const overview = service.slice(service.indexOf("async productOverview"), service.indexOf("async getAuthorisation"));
  assert.match(overview, /operatingBoundary: "OBSERVE_ONLY"/);
  assert.match(overview, /trustee controls the Rail workflow/);
  assert.match(overview, /route-defined RTA, depository or register remains legally operative/);
  assert.doesNotMatch(overview, /\.dispatch\(|ExternalInstruction|SETTLEMENT_ADAPTER|TOKEN_MINT/);
  for (const gate of ["COUNSEL_ROUTE_PACK", "TRUSTEE_TRANSACTION_CONTROL", "RATING_AND_ASSURANCE", "AUTHORITATIVE_REGISTER_CONFIRMATION", "CONTROLLED_LIVE_ACCEPTANCE"])
    assert.match(product, new RegExp(gate));
});

test("[AR24][ACCESS] aggregate metadata retains case, institution and grant boundaries", () => {
  const overview = service.slice(service.indexOf("async productOverview"), service.indexOf("async getAuthorisation"));
  assert.match(overview, /await this\.requireCase\(actor, caseId, "VIEW_CASE"\)/);
  assert.match(overview, /granteeInstitutionId: actor\.actingInstitutionId/);
  assert.match(overview, /transactionCaseId: caseId, institutionId: actor\.actingInstitutionId/);
  assert.doesNotMatch(overview, /proposalStepUpId|reviewStepUpId|storageRef|credentialVaultRef|replacementObservation:/);
});
