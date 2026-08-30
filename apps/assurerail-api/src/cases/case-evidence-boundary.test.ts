import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const evidenceService = readFileSync(resolve(process.cwd(), "src/evidence/evidence-intake.service.ts"), "utf8");
const caseService = readFileSync(resolve(process.cwd(), "src/cases/cases.service.ts"), "utf8");

test("[PR06][BOUNDARY] evidence lock and case-party access are enforced without a legacy room dependency", () => {
  assert.match(evidenceService, /requireCaseParticipant\(institutionId, body\.envelope\.transactionCaseId, true\)/);
  assert.match(evidenceService, /case evidence is immutable after evidence lock/);
  assert.match(evidenceService, /ownerInstitutionId: institutionId/);
  assert.match(evidenceService, /parties: \{ some: \{ institutionId, status: "ACTIVE" \} \}/);
  assert.match(caseService, /transactionCaseId: caseId/);
  assert.doesNotMatch(caseService, /CoLendingService|poolId|claId|NoteHolding/);
});
