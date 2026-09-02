import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const service = readFileSync(resolve(process.cwd(), "src/secondary-transfer/secondary-transfer.service.ts"), "utf8");
const controllers = readFileSync(resolve(process.cwd(), "src/secondary-transfer/secondary-transfer.controllers.ts"), "utf8");

test("[AR27][PERIMETER] product endpoints cannot dispatch or execute external actions", () => {
  assert.doesNotMatch(controllers, /@(?:Post|Patch|Delete)\([^)]*(?:execute|settle|trade|dispatch|register-update|mint|burn)/i);
  assert.doesNotMatch(service, /\.dispatch\(|HtsAdapter|HcsAdapter|SettlementAdapter|ExternalInstruction/);
  assert.match(service, /externalMutation: "NONE"/);
  assert.match(service, /legalEffect: "NONE_ASSERTED"/);
});

test("[AR27][ACCESS] registry, overview and evidence remain institution and case scoped", () => {
  assert.match(service, /sellerInstitutionId: actor\.actingInstitutionId/);
  assert.match(service, /buyerInstitutionId: actor\.actingInstitutionId/);
  assert.match(service, /await this\.requireCase\(actor, caseId, "VIEW_CASE"\)/);
  assert.match(service, /granteeInstitutionId: actingInstitutionId/);
  assert.match(service, /assertionDigest must match the retained current evidence payload digest/);
  assert.ok((service.match(/requireEligibleEvidence\(tx,/g) ?? []).length >= 3,
    "evidence eligibility must be rechecked inside every decisive write transaction");
});

test("[AR27][REPAIR] correction is append-only, maker-checker and externally inert", () => {
  assert.match(service, /repair proposer cannot review their own proposal/);
  assert.match(service, /secondaryTransferEvidence\.create/);
  assert.doesNotMatch(service, /secondaryTransferEvidence\.update|secondaryTransferEvidence\.delete/);
  assert.match(service, /status: "RESOLVED"/);
  assert.match(service, /purpose: "SECONDARY_TRANSFER_REPAIR_REVIEW"/);
});
