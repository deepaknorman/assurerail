import assert from "node:assert/strict";
import test from "node:test";
import { TokenisedProductService } from "./tokenised-product.service";

const actor = { actorUserId: "user-1", actorSessionId: "session-1", actingInstitutionId: "institution-1" };
const original = { ...process.env };

function enable() { process.env.ARAIL_TOKENISED_PRODUCT_V1 = "shadow"; }
function evidence(status = "ACTIVE") { return { status: "AVAILABLE", currentVersion: 1,
  institution: { status, admission: { status: "ADMITTED", effectiveAt: null, expiresAt: null } },
  versions: [{ version: 1, validationStatus: "VALID", signatureStatus: "VERIFIED", result: "VERIFIED",
    payloadDigest: `sha256:${"a".repeat(64)}`, expiresAt: null }] }; }

test.afterEach(() => { process.env = { ...original }; });

test("[AR28][SERVICE] case viewers receive DA action and reconciliation digests redacted", async () => {
  enable();
  const access = { requireHuman: async ({ action }: { action: string }) => {
    if (action === "VIEW_EVIDENCE") throw new Error("denied"); return { mandateId: "mandate-1" };
  } };
  const db = { transactionCase: { findUnique: async () => ({
    id: "case-1", caseReference: "TOK-DA-1", ownerInstitutionId: "institution-1", transactionRoute: "DA",
    representation: "TOKENISED", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", assetClass: "MSME_LOAN",
    operatingMode: "SHADOW", status: "ACTIVE", parties: [], ptcTokenRepresentation: null,
    tokenRepresentations: [{ id: "rep-1", noteId: "note-1", network: "TEST", tokenId: "token-1",
      authorityMode: "MIRROR", status: "RECONCILED", authoritativeRecordDeclarationId: "decl-1",
      connectorBindings: [], breaks: [], actions: [{ id: "action-1", sequence: 1, actionType: "MINT",
        executionMode: "OBSERVE_ONLY", state: "RECONCILED", expectedDigest: `sha256:${"b".repeat(64)}`,
        externalInstruction: { requestDigest: `sha256:${"c".repeat(64)}`, acknowledgements: [] } }],
      reconciliationSnapshots: [{ id: "snap-1", version: 1, tokenSupplyMinor: "1", tokenHoldings: {},
        economicInterests: {}, authoritativeRecord: {}, sourceAsOfAt: new Date("2026-09-01T00:00:00Z"),
        reconciliationState: "MATCHED", comparisonDigest: `sha256:${"d".repeat(64)}`, evidenceObjectId: "ev-1",
        evidenceObject: evidence() }],
    }],
  }) } };
  const service = new TokenisedProductService(db as never, access as never);
  const result = await service.overview(actor, "case-1") as { capabilities: { canViewEvidence: boolean };
    representation: { actions: Array<{ expectedDigest: string | null; instructionRequestDigest: string | null }>;
      latestReconciliation: { comparisonDigest: string | null } } };
  assert.equal(result.capabilities.canViewEvidence, false);
  assert.equal(result.representation.actions[0]?.expectedDigest, null);
  assert.equal(result.representation.actions[0]?.instructionRequestDigest, null);
  assert.equal(result.representation.latestReconciliation.comparisonDigest, null);
});

test("[AR28][SERVICE] suspended evidence provider reopens current PTC readiness without rewriting history", async () => {
  enable();
  const access = { requireHuman: async () => ({ mandateId: "mandate-1" }) };
  const db = { transactionCase: { findUnique: async () => ({
    id: "case-2", caseReference: "TOK-PTC-1", ownerInstitutionId: "institution-1", transactionRoute: "PTC",
    representation: "TOKENISED", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", assetClass: "MSME_LOAN",
    operatingMode: "SHADOW", status: "ACTIVE", parties: [], tokenRepresentations: [],
    ptcTokenRepresentation: { id: "ptc-1", programmeReference: "programme", trustReference: "trust",
      classReference: "class-a", trusteeInstitutionId: "trustee", recordkeeperInstitutionId: "recordkeeper",
      assuranceProviderInstitutionId: "assurer", authoritativeRecordDeclarationId: "decl-2", network: "TEST",
      tokenId: "token-2", authorityMode: "MIRROR", status: "SHADOW_READY", proposedByUserId: "maker",
      evidenceGates: [{ gateCode: "TRUSTEE_RECORD_RECONCILIATION", expectedEvidenceType: "PTC_TRUSTEE_RECORD_RECONCILIATION",
        accountableInstitutionId: "trustee", status: "VERIFIED", evidenceObjectId: "ev-2",
        evidenceDigest: `sha256:${"a".repeat(64)}`, sourceAsOfAt: new Date(), expiresAt: null,
        evidenceObject: evidence("SUSPENDED") }],
      actionPlans: [{ actionType: "ISSUE", sequence: 10, candidateCapabilityId: "candidate", state: "SHADOW_READY",
        blockingGateCodes: [], planDigest: `sha256:${"e".repeat(64)}` }],
    },
  }) } };
  const service = new TokenisedProductService(db as never, access as never);
  const result = await service.overview(actor, "case-2") as { representation: { evidenceGates: Array<{ status: string }> };
    stages: Array<{ code: string; state: string }> };
  assert.equal(result.representation.evidenceGates[0]?.status, "REVIEW_REQUIRED");
  assert.equal(result.stages.find((stage) => stage.code === "EXTERNAL_EVIDENCE_GATES")?.state, "ACTION_REQUIRED");
  assert.equal(result.stages.find((stage) => stage.code === "DORMANT_ACTION_PLANS")?.state, "BLOCKED");
  assert.equal(result.stages.find((stage) => stage.code === "TOKEN_LIFECYCLE")?.state, "BLOCKED");
});
