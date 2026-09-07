import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { PrismaClient } from "@prisma/assurerail-client";
import { CasesService } from "../cases/cases.service";
import { sha256Digest, type TransactionDiscriminatorV1 } from "../contracts/v1";
import { EvidenceIntakeService } from "../evidence/evidence-intake.service";
import type { MalwareScanner } from "../evidence/malware-scanner.service";
import type { EvidenceObjectStore } from "../evidence/object-store.service";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { AssureLensMonitoringService, ASSURELENS_PROFILE } from "../monitoring/assurelens-monitoring.service";
import {
  ASSUREPOOL_PTC_PREPARATION_PROFILE,
  AssurePoolPtcPreparationService,
} from "../ptc-preparation/assurepool-ptc-preparation.service";
import { PersistenceFoundationService } from "../persistence/persistence-foundation.service";
import type { PrismaService } from "../store/prisma.service";
import {
  buildMultiPartySimulationCorpus,
  buildPtcPreparationSimulationFamily,
  completeSimulationGateDigest,
  ptcPreparationSimulationFamilyDigest,
  simulationCorpusDigest,
  validateParticipantTopology,
  type MultiPartySimulationScenario,
  type PtcPreparationSimulationScenario,
  type SimulationGate,
} from "./multi-party-simulation";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the disposable SIM-100 rehearsal");
const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = parsedDatabaseUrl.pathname.replace(/^\//, "");
if (process.env.ARAIL_DISPOSABLE_SIMULATION_DATABASE !== "SIM100_ONLY"
  || !["127.0.0.1", "localhost", "::1"].includes(parsedDatabaseUrl.hostname)
  || !databaseName.startsWith("assurerail_sim100_")) {
  throw new Error("SIM-100 refuses any database without the disposable marker, loopback host and assurerail_sim100_ name prefix");
}
const phase = process.env.ARAIL_SIM_PHASE ?? "run";
if (!new Set(["run", "verify"]).has(phase)) throw new Error("ARAIL_SIM_PHASE must be run or verify");

process.env.ASSURERAIL_OPERATING_MODE = "SHADOW";
process.env.ARAIL_PARTICIPANT_ADMISSION_V1 = "shadow";
process.env.ARAIL_NEUTRAL_INGRESS_V1 = "shadow";
process.env.ARAIL_TRANSACTION_CASE_V1 = "shadow";

const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const railDb = db as unknown as PrismaService;
const access = new InstitutionAccessService(railDb);
const stepUp = new StepUpService(railDb);
const cases = new CasesService(railDb, access, stepUp);
const persistence = new PersistenceFoundationService(railDb);
const monitoring = new AssureLensMonitoringService();
const ptcPreparation = new AssurePoolPtcPreparationService();
const evidence = new EvidenceIntakeService(railDb, access, stepUp, persistence, {} as MalwareScanner, {} as EvidenceObjectStore);

const providerId = "assurelens.assurelocker";
const providerRefId = "sim100_provider_assurelens";
const ptcPreparationProviderId = "assurepool.sim100-provider";
const ptcPreparationProviderRefId = "sim100_provider_assurepool_ptc_prep";
const pendingInstructionIdempotencyKey = ["sim100", "pending", "instruction"].join("-");
const primaryKeys = generateKeyPairSync("ed25519");
const alternateKeys = generateKeyPairSync("ed25519");
const keyId = fingerprint(primaryKeys.publicKey);
const alternateKeyId = fingerprint(alternateKeys.publicKey);
const ptcPreparationKeys = generateKeyPairSync("ed25519");
const ptcPreparationAlternateKeys = generateKeyPairSync("ed25519");
const ptcPreparationKeyId = fingerprint(ptcPreparationKeys.publicKey);
const trustedEnvironment = {
  ARAIL_ASSURELENS_TRUSTED_KEYS_JSON: JSON.stringify([{
    providerId, keyId, publicKeyPem: primaryKeys.publicKey.export({ format: "pem", type: "spki" }).toString(),
  }]),
} as NodeJS.ProcessEnv;
const ptcPreparationTrustedEnvironment = {
  ARAIL_ASSUREPOOL_TRUSTED_KEYS_JSON: JSON.stringify([{
    providerId: ptcPreparationProviderId,
    keyId: ptcPreparationKeyId,
    publicKeyPem: ptcPreparationKeys.publicKey.export({ format: "pem", type: "spki" }).toString(),
  }]),
} as NodeJS.ProcessEnv;

type Outcome = { scenarioId: string; gate: SimulationGate; decision: "BLOCKED" | "REVIEW_REQUIRED"; code: string };
type Fixture = {
  scenario: MultiPartySimulationScenario;
  caseId: string;
  ownerInstitutionId: string;
  actorInstitutionId: string;
  actorUserId: string;
  actorSessionId: string;
  connectorId: string | null;
};

function fingerprint(key: KeyObject): string {
  return createHash("sha256").update(key.export({ format: "der", type: "spki" })).digest("hex").slice(0, 32);
}

function transaction(scenario: MultiPartySimulationScenario): TransactionDiscriminatorV1 {
  return {
    transactionRoute: scenario.transactionRoute, representation: scenario.representation,
    jurisdiction: "IND", marketContext: "DOMESTIC",
    placementOrListing: scenario.transactionRoute === "DA" ? "BILATERAL" : "PRIVATE_PLACEMENT",
    lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", assetClass: "MSME_LOAN", operatingMode: "SHADOW",
    extensionProfileRef: null,
    routePack: { routePackId: `sim100-${scenario.transactionRoute.toLowerCase()}`, version: "1.0.0", status: "REVIEW_PENDING", effectiveAt: null },
    legalRecord: { status: "UNDECLARED", recordType: null, recordkeeperInstitutionRef: null, designationEvidenceRef: null },
  };
}

function packagePayload(scenario: MultiPartySimulationScenario): Record<string, unknown> {
  const now = Date.now();
  const issuedAt = new Date(now - (scenario.fault === "EXPIRED_PROVIDER_PACKAGE" ? 120_000 : 60_000));
  const expiresAt = scenario.fault === "EXPIRED_PROVIDER_PACKAGE" ? new Date(now - 1_000) : new Date(now + 86_400_000);
  const coverage = scenario.fault === "INCONSISTENT_COVERAGE"
    ? { suppliedEntityCount: 5, evaluatedEntityCount: 4, unresolvedEntityCount: 1, staleEntityCount: 0, unavailableSourceFamilies: [], coverageBps: 9_999 }
    : { suppliedEntityCount: 5, evaluatedEntityCount: 5, unresolvedEntityCount: 0, staleEntityCount: 0, unavailableSourceFamilies: [], coverageBps: 10_000 };
  const findings = scenario.fault === "RAW_IDENTIFIER_LEAKAGE" ? [{
    findingRef: `${scenario.scenarioId}:finding`, subjectRef: "ABCDE1234F", metric: "REPAYMENT_DRIFT",
    severity: "HIGH", outcome: "FAIL", observedAt: new Date(now - 90_000).toISOString(),
    explanation: { confidence: "MEDIUM", sources: [], triggeringEvents: [], limitations: [] }, evidenceRefs: [],
  }] : [];
  return {
    packageVersion: ASSURELENS_PROFILE, packageId: `${scenario.scenarioId}:package`, providerId,
    providerBookRef: `${scenario.scenarioId}:book`, evaluationRunRef: `${scenario.scenarioId}:run`,
    operatingMode: "SHADOW", engineVersion: "sim100-assurelens-1.0.0",
    asOfAt: new Date(now - 120_000).toISOString(), issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString(),
    inputDigest: sha256Digest({ scenarioId: scenario.scenarioId, input: "synthetic-no-pii" }),
    result: scenario.fault === "RAW_IDENTIFIER_LEAKAGE" ? "REVIEW_REQUIRED" : "VERIFIED",
    coverage, findings,
    qualifications: [{ code: "SYNTHETIC_SIMULATION_ONLY", severity: "LIMITATION", text: "Disposable test evidence; never customer or production evidence." }],
    boundary: { completeIndebtednessClaim: false, creditDecision: false, automaticTransactionRestriction: false, lenderDecisionRequired: true },
  };
}

function providerEnvelope(scenario: MultiPartySimulationScenario): Record<string, unknown> {
  const payload = packagePayload(scenario);
  const signingKeys = scenario.fault === "UNTRUSTED_PROVIDER_KEY" ? alternateKeys : primaryKeys;
  const signingKeyId = scenario.fault === "UNTRUSTED_PROVIDER_KEY" ? alternateKeyId : keyId;
  const payloadDigest = sha256Digest(payload);
  const signature = sign(null, Buffer.from(["assurelens.provider-envelope.v1", providerId, signingKeyId, payloadDigest].join("\n")), signingKeys.privateKey).toString("base64url");
  const envelope: Record<string, unknown> = {
    envelopeVersion: "assurelens.provider-envelope.v1", providerId, algorithm: "Ed25519", keyId: signingKeyId,
    payloadDigest, signature, status: "ACTIVE", payload,
  };
  if (scenario.fault === "TAMPERED_PROVIDER_PAYLOAD") envelope.payload = { ...payload, providerBookRef: `${scenario.scenarioId}:tampered-after-signing` };
  return envelope;
}

function ptcPreparationSsa(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    rulesetVersion: "ssa-prep-1",
    source: {
      instrument: "RBI Master Direction — Securitisation of Standard Assets Directions, 2021",
      archivePath: "docs/regulatory-sources/RBI_SSA_Master_Directions_2021_upd_2022-12-05.txt",
      archiveSha256Prefix: "30412fa5697c7ccc",
      clausesVerifiedAt: "2026-09-07",
    },
    counselConfirmationPending: true,
    requiredMrrBps: 500,
    mrrBand: "BAND_5PC",
    mrrBandReason: "SIM-100 conventional PTC fixture",
    findings: [{
      rule: "SSA_COUNSEL_CONFIRMATION", clause: "ruleset release", basis: "T2_INTERPRETIVE",
      outcome: "REVIEW_REQUIRED", detail: "independent counsel confirmation pending",
    }],
    overall: "REVIEW_REQUIRED",
    ...overrides,
  };
}

function ptcPreparationPackage(scenario: PtcPreparationSimulationScenario): Record<string, unknown> {
  const generatedAt = "2026-09-07T10:00:00.000Z";
  const loans = [{ loanRef: `${scenario.scenarioId}:loan`, includedInTransferSet: true, commitment: sha256Digest({ scenarioId: scenario.scenarioId }) }];
  const tapeBody = {
    profileId: "assurepool.frozen-da-evidence/2.0", tapeVersion: "2.0",
    poolId: `${scenario.scenarioId}:pool`, manifestHash: sha256Digest(loans), loans,
  };
  const performanceResult = {
    valueBasis: "DISBURSED_VALUE", note: "SIM-100 synthetic evidence; never production",
    asOfCycle: null, vintages: [], unvintaged: 0, rolls: [], cycleGaps: [], par: [], parObservedShareBps: 0,
  };
  let ssaPreparation = ptcPreparationSsa();
  let preparationRoute = "PTC_PREP";
  if (scenario.variant === "READY_WITH_COUNSEL_PENDING") {
    ssaPreparation = ptcPreparationSsa({
      overall: "READY",
      findings: [{ rule: "SSA_MRR_BAND", clause: "Cl. 12", basis: "T1_BRIGHT_LINE", outcome: "PASS", detail: "pass" }],
    });
  }
  if (scenario.variant === "FAIL_FINDING_WITH_NON_FAIL_OVERALL") {
    ssaPreparation = ptcPreparationSsa({
      overall: "REVIEW_REQUIRED",
      findings: [{ rule: "SSA_MRR_RETENTION", clause: "Cl. 12", basis: "T1_BRIGHT_LINE", outcome: "FAIL", detail: "fail" }],
    });
  }
  if (scenario.variant === "MRR_BAND_BPS_MISMATCH") {
    ssaPreparation = ptcPreparationSsa({ requiredMrrBps: 1000, mrrBand: "BAND_5PC" });
  }
  if (scenario.variant === "DA_PACKAGE_ON_PTC_CASE") preparationRoute = "DA";
  const body = {
    profileId: "assurepool.frozen-da-evidence/2.0", packageVersion: "2.0", generatedAt,
    tape: { ...tapeBody, tapeHash: sha256Digest(tapeBody) },
    performance: {
      snapshotVersion: "1.0", generatedAt, poolId: tapeBody.poolId, sourceAsOfCycle: null,
      result: performanceResult, resultDigest: sha256Digest(performanceResult),
    },
    preparationRoute,
    ssaPreparation,
  };
  return { ...body, packageDigest: sha256Digest(body) };
}

function ptcPreparationProviderEnvelope(scenario: PtcPreparationSimulationScenario): Record<string, unknown> {
  const payload = ptcPreparationPackage(scenario);
  const untrusted = scenario.variant === "UNTRUSTED_PROVIDER_KEY";
  const signingKeys = untrusted ? ptcPreparationAlternateKeys : ptcPreparationKeys;
  const signingKeyId = fingerprint(signingKeys.publicKey);
  const payloadDigest = sha256Digest(payload);
  let signature = sign(
    null,
    Buffer.from(`assurepool.provider-envelope/2.0|${ptcPreparationProviderId}|Ed25519|${signingKeyId}|${payloadDigest}`),
    signingKeys.privateKey,
  ).toString("base64url");
  if (scenario.variant === "INVALID_PROVIDER_SIGNATURE") signature = "A".repeat(86);
  const envelope: Record<string, unknown> = {
    envelopeVersion: "assurepool.provider-envelope/2.0", providerId: ptcPreparationProviderId,
    algorithm: "Ed25519", keyId: signingKeyId, payloadDigest, signature, payload,
  };
  if (scenario.variant === "TAMPERED_SSA_UNDER_OLD_SIGNATURE") {
    envelope.payload = {
      ...payload,
      ssaPreparation: { ...(payload.ssaPreparation as Record<string, unknown>), requiredMrrBps: 1000 },
    };
  }
  return envelope;
}

async function rejects(action: () => Promise<unknown> | unknown, pattern: RegExp, label: string): Promise<string> {
  try { await action(); } catch (error) {
    const message = (error as Error).message;
    assert.match(message, pattern, label);
    return message;
  }
  assert.fail(`${label}: expected rejection`);
}

async function seedInstitution(id: string, userId: string): Promise<void> {
  await db.institution.create({ data: {
    id, legalName: `Synthetic ${id}`, institutionKind: "REGULATED_ENTITY", jurisdiction: "IN",
    legalIdentifiers: {}, status: "ACTIVE", applicantUserId: userId,
  } });
  await db.participantAdmission.create({ data: {
    id: `admission_${id}`, institutionId: id, status: "ADMITTED", termsVersion: "sim100-v1", rulebookVersion: "sim100-v1",
    applicationDigest: sha256Digest({ id, admitted: true }), effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 86_400_000),
  } });
}

async function seedFixture(scenario: MultiPartySimulationScenario): Promise<Fixture> {
  const suffix = String(scenario.sequence).padStart(3, "0");
  const actorUserId = `sim100_user_${suffix}`;
  const actorInstitutionId = `sim100_actor_${suffix}`;
  const ownerInstitutionId = scenario.fault === "NON_PARTICIPANT_ACCESS" ? `sim100_owner_${suffix}` : actorInstitutionId;
  const actorSessionId = `sim100_session_${suffix}`;
  const caseId = `sim100_case_${suffix}`;
  await db.venueUser.create({ data: {
    id: actorUserId, firebaseUid: `sim100-firebase-${suffix}`, email: `sim100-${suffix}@example.invalid`,
    status: "ACTIVE", allowlisted: true, identityVerifiedAt: new Date(Date.now() - 60_000),
  } });
  await seedInstitution(actorInstitutionId, actorUserId);
  if (ownerInstitutionId !== actorInstitutionId) await seedInstitution(ownerInstitutionId, actorUserId);
  const memberId = `sim100_member_${suffix}`;
  await db.institutionMember.create({ data: {
    id: memberId, institutionId: actorInstitutionId, userId: actorUserId, invitedEmail: `sim100-${suffix}@example.invalid`,
    membershipRole: "ADMIN", status: scenario.fault === "INACTIVE_MEMBER" ? "SUSPENDED" : "ACTIVE",
    effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 86_400_000), acceptedAt: new Date(Date.now() - 60_000),
  } });
  const mandateIds: Record<string, string> = {};
  for (const action of ["VIEW_CASE", "OPERATE_CASE", "MANAGE_EVIDENCE"] as const) {
    const id = `sim100_mandate_${suffix}_${action.toLowerCase()}`;
    mandateIds[action] = id;
    await db.authorityMandate.create({ data: {
      id, institutionId: actorInstitutionId, memberId, action, scopeType: "INSTITUTION", scopeRef: null, scopeKey: "INSTITUTION:*",
      limits: {}, conditions: {}, delegationBasis: "SYNTHETIC_SIMULATION", authorityEvidenceRef: `synthetic://${scenario.scenarioId}/authority`,
      status: "ACTIVE", proposedByUserId: actorUserId, proposalStepUpId: `fixture://${scenario.scenarioId}`,
      approvedByUserId: `sim100_checker_${suffix}`, effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 86_400_000),
    } });
  }
  await db.venueSession.create({ data: {
    id: actorSessionId, userId: actorUserId,
    activeInstitutionId: scenario.fault === "WRONG_SESSION_CONTEXT" ? `sim100_wrong_context_${suffix}` : actorInstitutionId,
    credentialAssurance: "WEBAUTHN", expiresAt: new Date(Date.now() + 86_400_000), securityContext: { fixture: "SIM-100" },
  } });
  await db.routeEntitlement.create({ data: {
    id: `sim100_route_${suffix}`, institutionId: actorInstitutionId, transactionRoute: scenario.transactionRoute,
    representation: scenario.representation, assetClass: "MSME_LOAN", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
    materialFunction: "ASSET_OR_INSTRUMENT_ADMISSION", functionPerformer: "PARTICIPANT_OWNED",
    routePackRef: `assurerail://simulation/${scenario.transactionRoute.toLowerCase()}/v1`, permissionEvidenceRef: `synthetic://${scenario.scenarioId}/route`,
    operatingModes: ["SHADOW"], limits: {}, conditions: {}, status: "ACTIVE", proposedByUserId: actorUserId,
    proposalStepUpId: `fixture://${scenario.scenarioId}`, approvedByUserId: `sim100_checker_${suffix}`,
    effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 86_400_000),
  } });
  await db.transactionCase.create({ data: {
    id: caseId, caseReference: `SIM100-${suffix}`, ownerInstitutionId, transactionRoute: scenario.transactionRoute,
    representation: scenario.representation, jurisdiction: "IN", marketContext: "DOMESTIC",
    placementOrListing: scenario.transactionRoute === "DA" ? "BILATERAL" : "PRIVATE_PLACEMENT",
    lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", assetClass: "MSME_LOAN", operatingMode: "SHADOW",
    routePackRef: `assurerail://simulation/${scenario.transactionRoute.toLowerCase()}/v1`, routePackVersion: "1.0.0",
    status: "DRAFT", creationIdempotencyKey: `sim100-create-${suffix}`, creationRequestDigest: sha256Digest({ scenarioId: scenario.scenarioId }),
    createdByUserId: actorUserId, createdByMandateId: mandateIds.OPERATE_CASE,
    versions: { create: {
      id: `sim100_case_version_${suffix}`, version: 1,
      spec: { corpusVersion: scenario.corpusVersion, scenarioId: scenario.scenarioId, fault: scenario.fault, synthetic: true },
      specDigest: sha256Digest({ scenarioId: scenario.scenarioId, fault: scenario.fault }), reason: "SIM-100 disposable scenario",
      createdByUserId: actorUserId, createdByMandateId: mandateIds.OPERATE_CASE,
    } },
  } });
  for (let index = 0; index < scenario.partyCount; index += 1) {
    const institutionId = index === 0 ? ownerInstitutionId : `sim100_party_${suffix}_${index}`;
    if (index > 0) await seedInstitution(institutionId, actorUserId);
    await db.caseParty.create({ data: {
      id: `sim100_case_party_${suffix}_${index}`, transactionCaseId: caseId, institutionId,
      partyRole: scenario.partyRoles[index], status: "ACTIVE", authorityEvidenceRef: `synthetic://${scenario.scenarioId}/party/${index}`,
      acceptedByUserId: actorUserId, acceptedAt: new Date(Date.now() - 30_000), createdByUserId: actorUserId,
    } });
  }
  let connectorId: string | null = null;
  if (["NONE", "UNCERTIFIED_CONNECTOR"].includes(scenario.fault)) {
    connectorId = `sim100_connector_${suffix}`;
    await db.connectorRegistration.create({ data: {
      id: connectorId, institutionId: actorInstitutionId, providerReferenceId: providerRefId,
      connectorKey: `sim100-lens-${suffix}`, connectorType: "MONITORING_EVIDENCE", displayName: "SIM-100 AssureLens",
      transport: "API", endpoint: null,
      schemaProfiles: [{ profileRef: ASSURELENS_PROFILE, schemaId: "assurerail.intake.v1", schemaVersion: "1.0.0" }],
      credentialVaultRef: "vault://sim100/not-a-secret", status: scenario.fault === "NONE" ? "CERTIFIED_SHADOW" : "PENDING_CERTIFICATION",
      createdByUserId: actorUserId,
    } });
  }
  return { scenario, caseId, ownerInstitutionId, actorInstitutionId, actorUserId, actorSessionId, connectorId };
}

async function ensureCertification(fixture: Fixture, schemaId: string, schemaVersion: string): Promise<void> {
  assert.ok(fixture.connectorId);
  await db.connectorCertification.create({ data: {
    id: `cert_${fixture.connectorId}`, connectorRegistrationId: fixture.connectorId, profileRef: ASSURELENS_PROFILE,
    schemaId, schemaVersion, operatingMode: "SHADOW", status: "APPROVED",
    conformanceEvidenceDigest: sha256Digest({ connectorId: fixture.connectorId, tests: 12 }),
    conformanceResult: { passed: true, executedTests: 12, criticalFailures: [] }, qualifications: [], reason: "SIM-100 disposable certification",
    proposedByUserId: fixture.actorUserId, proposalStepUpId: `fixture://${fixture.scenario.scenarioId}/cert-propose`,
    reviewedByUserId: `checker_${fixture.actorUserId}`, reviewStepUpId: `fixture://${fixture.scenario.scenarioId}/cert-review`,
    effectiveAt: new Date(Date.now() - 30_000), expiresAt: new Date(Date.now() + 86_400_000),
  } });
}

async function executePtcPreparationFamily(fixtures: Fixture[]): Promise<Outcome[]> {
  const fixture = fixtures.find((item) => item.scenario.transactionRoute === "PTC"
    && item.scenario.representation === "CONVENTIONAL"
    && item.scenario.partyCount === 3
    && item.scenario.fault === "NONE");
  assert.ok(fixture, "PTC-preparation family requires the canonical conventional PTC fixture");
  const connectorId = "sim100_connector_assurepool_ptc_prep";
  await db.connectorRegistration.create({ data: {
    id: connectorId,
    institutionId: fixture.actorInstitutionId,
    providerReferenceId: ptcPreparationProviderRefId,
    connectorKey: "sim100-assurepool-ptc-prep",
    connectorType: "PTC_PREPARATION_EVIDENCE",
    displayName: "SIM-100 AssurePool PTC preparation",
    transport: "API",
    endpoint: null,
    schemaProfiles: [{
      profileRef: ASSUREPOOL_PTC_PREPARATION_PROFILE,
      schemaId: "assurerail.neutral-intake",
      schemaVersion: "1.0.0",
    }],
    credentialVaultRef: "vault://sim100/not-a-secret",
    status: "CERTIFIED_SHADOW",
    createdByUserId: fixture.actorUserId,
  } });
  await db.connectorCertification.create({ data: {
    id: "sim100_cert_assurepool_ptc_prep",
    connectorRegistrationId: connectorId,
    profileRef: ASSUREPOOL_PTC_PREPARATION_PROFILE,
    schemaId: "assurerail.neutral-intake",
    schemaVersion: "1.0.0",
    operatingMode: "SHADOW",
    status: "APPROVED",
    conformanceEvidenceDigest: ptcPreparationSimulationFamilyDigest(),
    conformanceResult: { passed: true, executedTests: 8, criticalFailures: [] },
    qualifications: [{ code: "SYNTHETIC_SIMULATION_ONLY", severity: "LIMITATION" }],
    reason: "SIM-100 disposable PTC-preparation conformance family",
    proposedByUserId: fixture.actorUserId,
    proposalStepUpId: "fixture://sim100/ptc-prep/cert-propose",
    reviewedByUserId: `checker_${fixture.actorUserId}`,
    reviewStepUpId: "fixture://sim100/ptc-prep/cert-review",
    effectiveAt: new Date(Date.now() - 30_000),
    expiresAt: new Date(Date.now() + 86_400_000),
  } });

  const expectedPatterns: Record<PtcPreparationSimulationScenario["variant"], RegExp> = {
    VALID_REVIEW_REQUIRED: /never used/,
    TAMPERED_SSA_UNDER_OLD_SIGNATURE: /packageDigest mismatch/,
    READY_WITH_COUNSEL_PENDING: /cannot be READY while counsel confirmation is pending/,
    FAIL_FINDING_WITH_NON_FAIL_OVERALL: /overall REVIEW_REQUIRED is inconsistent with finding outcomes/,
    MRR_BAND_BPS_MISMATCH: /requiredMrrBps is inconsistent with mrrBand/,
    DA_PACKAGE_ON_PTC_CASE: /preparationRoute must be PTC_PREP/,
    UNTRUSTED_PROVIDER_KEY: /signing key is not trusted/,
    INVALID_PROVIDER_SIGNATURE: /signature verification failed/,
  };
  const outcomes: Outcome[] = [];
  for (const scenario of buildPtcPreparationSimulationFamily()) {
    try {
      const mapped = ptcPreparation.verifyAndMap({
        institutionId: fixture.actorInstitutionId,
        transactionCaseId: fixture.caseId,
        transaction: transaction(fixture.scenario),
        providerEnvelope: ptcPreparationProviderEnvelope(scenario),
        receivedAt: new Date("2026-09-07T10:01:00.000Z"),
      }, ptcPreparationTrustedEnvironment);
      assert.equal(scenario.variant, "VALID_REVIEW_REQUIRED", `${scenario.scenarioId}: unexpected acceptance`);
      assert.equal(mapped.providerResult, "REVIEW_REQUIRED");
      const body = {
        connectorRegistrationId: connectorId,
        evidenceType: "PTC_PREPARATION_EVIDENCE",
        classification: "CASE_CONFIDENTIAL",
        purpose: "SIM-100 PTC preparation evidence",
        retentionUntilAt: new Date(Date.now() + 86_400_000).toISOString(),
        result: "REVIEW_REQUIRED",
        profileRef: ASSUREPOOL_PTC_PREPARATION_PROFILE,
        qualifications: mapped.envelope.qualifications,
        envelope: mapped.envelope,
      };
      const accepted = await evidence.ingestJson(fixture.actorUserId, fixture.actorInstitutionId, body);
      const replay = await evidence.ingestJson(fixture.actorUserId, fixture.actorInstitutionId, body);
      assert.equal(accepted.replay, false);
      assert.equal(replay.replay, true);
      assert.equal(replay.submissionId, accepted.submissionId);
      const stored = await db.evidenceVersion.findUniqueOrThrow({ where: { id: accepted.evidenceVersionId } });
      assert.equal(stored.result, "REVIEW_REQUIRED");
      outcomes.push({ scenarioId: scenario.scenarioId, gate: "RAIL_REVIEW", decision: "REVIEW_REQUIRED", code: "PTC_PREPARATION_RESULT_NOT_PROMOTED" });
    } catch (error) {
      assert.notEqual(scenario.variant, "VALID_REVIEW_REQUIRED", `${scenario.scenarioId}: ${(error as Error).message}`);
      assert.match((error as Error).message, expectedPatterns[scenario.variant], scenario.scenarioId);
      outcomes.push({ scenarioId: scenario.scenarioId, gate: "PROVIDER_EVIDENCE", decision: "BLOCKED", code: scenario.variant });
    }
  }
  for (const [index, outcome] of outcomes.entries()) {
    const expected = buildPtcPreparationSimulationFamily()[index];
    assert.equal(outcome.gate, expected.expectedGate, expected.scenarioId);
    assert.equal(outcome.decision, expected.expectedDecision, expected.scenarioId);
  }
  return outcomes;
}

async function executeScenario(fixture: Fixture): Promise<Outcome> {
  const { scenario } = fixture;
  const topology = validateParticipantTopology(scenario);
  const firebaseUid = `sim100-firebase-${String(scenario.sequence).padStart(3, "0")}`;
  if (scenario.fault === "WRONG_SESSION_CONTEXT") {
    await rejects(() => stepUp.issue({ firebaseUid, sessionId: fixture.actorSessionId, purpose: "CASE_TRANSITION", institutionId: fixture.actorInstitutionId, method: "WEBAUTHN" }), /active session context/, scenario.scenarioId);
    return { scenarioId: scenario.scenarioId, gate: "SESSION_STEP_UP", decision: "BLOCKED", code: "SESSION_INSTITUTION_MISMATCH" };
  }
  const stepUpEvidence = await stepUp.issue({ firebaseUid, sessionId: fixture.actorSessionId, purpose: "CASE_TRANSITION", institutionId: fixture.actorInstitutionId, method: "WEBAUTHN" });
  if (scenario.fault === "INACTIVE_MEMBER") {
    await rejects(() => cases.get(fixture.actorUserId, fixture.actorInstitutionId, fixture.caseId), /institution authority denied: MEMBERSHIP_NOT_ACTIVE/, scenario.scenarioId);
    assert.equal((await db.stepUpEvidence.findUniqueOrThrow({ where: { id: stepUpEvidence.id } })).consumedAt, null);
    return { scenarioId: scenario.scenarioId, gate: "INSTITUTION_AUTHORITY", decision: "BLOCKED", code: "MEMBERSHIP_NOT_ACTIVE" };
  }
  if (scenario.fault === "NON_PARTICIPANT_ACCESS") {
    await rejects(() => cases.get(fixture.actorUserId, fixture.actorInstitutionId, fixture.caseId), /transaction case not found/, scenario.scenarioId);
    assert.equal((await db.stepUpEvidence.findUniqueOrThrow({ where: { id: stepUpEvidence.id } })).consumedAt, null);
    return { scenarioId: scenario.scenarioId, gate: "CASE_PARTICIPATION", decision: "BLOCKED", code: "CASE_NOT_DISCLOSED" };
  }
  const loaded = await cases.get(fixture.actorUserId, fixture.actorInstitutionId, fixture.caseId);
  assert.equal(loaded.parties.length, scenario.partyCount, scenario.scenarioId);
  const route = await access.evaluateRoute(fixture.actorInstitutionId, {
    transactionRoute: scenario.transactionRoute, representation: scenario.representation, assetClass: "MSME_LOAN",
    lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", materialFunction: "ASSET_OR_INSTRUMENT_ADMISSION", operatingMode: "SHADOW",
  });
  assert.deepEqual(route, { allowed: true, code: "ROUTE_ENTITLED" }, scenario.scenarioId);
  await stepUp.consume({ evidenceId: stepUpEvidence.id, userId: fixture.actorUserId, sessionId: fixture.actorSessionId, purpose: "CASE_TRANSITION", institutionId: fixture.actorInstitutionId });
  await rejects(() => stepUp.consume({ evidenceId: stepUpEvidence.id, userId: fixture.actorUserId, sessionId: fixture.actorSessionId, purpose: "CASE_TRANSITION", institutionId: fixture.actorInstitutionId }), /valid, unconsumed step-up evidence/, `${scenario.scenarioId}: one-use step-up`);
  if (!topology.allowed) return { scenarioId: scenario.scenarioId, gate: "PARTICIPANT_TOPOLOGY", decision: "BLOCKED", code: topology.code };

  let mapped: ReturnType<AssureLensMonitoringService["verifyAndMap"]>;
  try {
    mapped = monitoring.verifyAndMap({
      institutionId: fixture.actorInstitutionId, transactionCaseId: fixture.caseId,
      transaction: transaction(scenario), providerEnvelope: providerEnvelope(scenario),
    }, trustedEnvironment);
  } catch (error) {
    assert.equal(scenario.expectedGate, "PROVIDER_EVIDENCE", `${scenario.scenarioId}: ${(error as Error).message}`);
    const expectedPattern: Partial<Record<typeof scenario.fault, RegExp>> = {
      TAMPERED_PROVIDER_PAYLOAD: /payload digest mismatch/,
      UNTRUSTED_PROVIDER_KEY: /signing key is not trusted/,
      EXPIRED_PROVIDER_PACKAGE: /has expired/,
      INCONSISTENT_COVERAGE: /coverageBps is inconsistent/,
      RAW_IDENTIFIER_LEAKAGE: /raw entity identifier/,
    };
    assert.match((error as Error).message, expectedPattern[scenario.fault]!, scenario.scenarioId);
    return { scenarioId: scenario.scenarioId, gate: "PROVIDER_EVIDENCE", decision: "BLOCKED", code: scenario.fault };
  }
  assert.ok(fixture.connectorId);
  if (scenario.fault === "NONE") await ensureCertification(fixture, mapped.envelope.schemaId, mapped.envelope.schemaVersion);
  const intakeBody = {
    connectorRegistrationId: fixture.connectorId,
    evidenceType: "MONITORING_EVIDENCE", classification: "CASE_CONFIDENTIAL", purpose: "SIM-100 monitoring evidence",
    retentionUntilAt: new Date(Date.now() + 86_400_000).toISOString(), result: "REVIEW_REQUIRED",
    profileRef: ASSURELENS_PROFILE, qualifications: mapped.envelope.qualifications, envelope: mapped.envelope,
  };
  if (scenario.fault === "UNCERTIFIED_CONNECTOR") {
    await rejects(() => evidence.ingestJson(fixture.actorUserId, fixture.actorInstitutionId, intakeBody), /connector is not certified/, scenario.scenarioId);
    return { scenarioId: scenario.scenarioId, gate: "CONNECTOR_CERTIFICATION", decision: "BLOCKED", code: "CONNECTOR_NOT_CERTIFIED" };
  }
  const accepted = await evidence.ingestJson(fixture.actorUserId, fixture.actorInstitutionId, intakeBody);
  const replay = await evidence.ingestJson(fixture.actorUserId, fixture.actorInstitutionId, intakeBody);
  assert.equal(accepted.replay, false);
  assert.equal(replay.replay, true);
  assert.equal(replay.submissionId, accepted.submissionId);
  const stored = await db.evidenceVersion.findUniqueOrThrow({ where: { id: accepted.evidenceVersionId } });
  assert.equal(stored.result, "REVIEW_REQUIRED");
  return { scenarioId: scenario.scenarioId, gate: "RAIL_REVIEW", decision: "REVIEW_REQUIRED", code: "PROVIDER_RESULT_NOT_PROMOTED" };
}

async function operationalProbes(fixtures: Fixture[]): Promise<void> {
  const fixture = fixtures.find((item) => item.scenario.expectedGate === "RAIL_REVIEW");
  assert.ok(fixture);
  assert.ok(fixture.connectorId);
  const connectorId = fixture.connectorId;
  const recoveryScenario = { ...fixture.scenario, scenarioId: `${fixture.scenario.scenarioId}-accepted-intake-recovery` };
  const recoveryMapped = monitoring.verifyAndMap({
    institutionId: fixture.actorInstitutionId, transactionCaseId: fixture.caseId,
    transaction: transaction(recoveryScenario), providerEnvelope: providerEnvelope(recoveryScenario),
  }, trustedEnvironment);
  const recoveryBody = {
    connectorRegistrationId: connectorId,
    evidenceType: "MONITORING_EVIDENCE", classification: "CASE_CONFIDENTIAL", purpose: "SIM-100 monitoring evidence",
    retentionUntilAt: new Date(Date.now() + 86_400_000).toISOString(), result: "REVIEW_REQUIRED",
    profileRef: ASSURELENS_PROFILE, qualifications: recoveryMapped.envelope.qualifications, envelope: recoveryMapped.envelope,
  };
  const acceptedOnly = await persistence.persistIntake(providerRefId, "API", recoveryMapped.envelope);
  assert.equal(acceptedOnly.replay, false);
  assert.equal(await db.evidenceVersion.count({ where: { intakeSubmissionId: acceptedOnly.submissionId } }), 0);
  const recovered = await Promise.all([
    evidence.ingestJson(fixture.actorUserId, fixture.actorInstitutionId, recoveryBody),
    evidence.ingestJson(fixture.actorUserId, fixture.actorInstitutionId, recoveryBody),
  ]);
  assert.deepEqual(recovered.map((item) => item.replay), [true, true]);
  assert.equal(recovered[0].submissionId, acceptedOnly.submissionId);
  assert.equal(recovered[0].evidenceVersionId, recovered[1].evidenceVersionId);
  assert.equal(await db.evidenceVersion.count({ where: { intakeSubmissionId: acceptedOnly.submissionId } }), 1);
  const request = { caseId: fixture.caseId, operation: "SIMULATED_EXTERNAL_REGISTER_UPDATE", mutateExternalSystem: false };
  const [first, second] = await Promise.all([
    persistence.createExternalInstruction({ providerReferenceId: providerRefId, instructionType: "SIMULATION_OBSERVE_ONLY", idempotencyKey: pendingInstructionIdempotencyKey, request, institutionId: fixture.actorInstitutionId, transactionCaseId: fixture.caseId }),
    persistence.createExternalInstruction({ providerReferenceId: providerRefId, instructionType: "SIMULATION_OBSERVE_ONLY", idempotencyKey: pendingInstructionIdempotencyKey, request, institutionId: fixture.actorInstitutionId, transactionCaseId: fixture.caseId }),
  ]);
  assert.equal(first.instructionId, second.instructionId);
  assert.deepEqual([first.replay, second.replay].sort(), [false, true]);
  await rejects(() => persistence.createExternalInstruction({ providerReferenceId: providerRefId, instructionType: "SIMULATION_OBSERVE_ONLY", idempotencyKey: pendingInstructionIdempotencyKey, request: { ...request, mutateExternalSystem: true }, institutionId: fixture.actorInstitutionId, transactionCaseId: fixture.caseId }), /different instruction/, "conflicting instruction replay");
  const replayOne = await cases.replay(fixture.actorUserId, fixture.actorInstitutionId, fixture.caseId);
  const replayTwo = await cases.replay(fixture.actorUserId, fixture.actorInstitutionId, fixture.caseId);
  assert.equal(replayOne.receipt.id, replayTwo.receipt.id);
  assert.equal(replayOne.receipt.result, "REPRODUCED");
  await db.settlementSaga.create({ data: {
    id: "sim100_mid_restart_saga", transactionCaseId: fixture.caseId, sagaVersion: 1,
    routePackRef: `assurerail://simulation/${fixture.scenario.transactionRoute.toLowerCase()}/v1`, routePackVersion: "1.0.0",
    transactionRoute: fixture.scenario.transactionRoute, executionMode: "OBSERVE_ONLY", state: "EXECUTING",
    idempotencyKey: "sim100-mid-restart-saga", requestDigest: sha256Digest({ request, kind: "SAGA" }),
    planDigest: sha256Digest({ plan: "SIM100_RESTART" }), routeEvidenceBundleDigest: sha256Digest({ evidence: "SYNTHETIC_ONLY" }),
    legalMechanism: fixture.scenario.transactionRoute === "DA" ? "ASSIGNMENT" : "SECURITISATION_TRUST_PTC",
    considerationCurrency: "INR", considerationMinorUnits: "0", considerationScale: 2,
    historicOutcomeRef: "synthetic://sim100/no-external-outcome", historicOutcomeDigest: sha256Digest({ synthetic: true }),
    expectedOutcome: { synthetic: true, externalMutation: false }, expectedOutcomeDigest: sha256Digest({ synthetic: true, externalMutation: false }),
    createdByUserId: fixture.actorUserId, createdByMandateId: `sim100_mandate_001_operate_case`,
    legs: { create: {
      id: "sim100_mid_restart_leg", legKey: "external-register-observation", legType: "AUTHORITATIVE_REGISTER_UPDATE",
      sequence: 10, participantOwnerInstitutionId: fixture.actorInstitutionId, performerClass: "EXTERNAL_AUTHORITY",
      expected: { externalMutation: false }, expectedDigest: sha256Digest({ externalMutation: false }), state: "OBSERVED",
    } },
  } });
}

async function verifyPersisted(): Promise<Record<string, number>> {
  const [casesCount, parties, evidenceVersions, monitoringIntakes, ptcPreparationIntakes, pendingInstructions, consumedStepUps, replayReceipts, executingSagas, observedSagaLegs] = await Promise.all([
    db.transactionCase.count({ where: { caseReference: { startsWith: "SIM100-" } } }),
    db.caseParty.count({ where: { id: { startsWith: "sim100_case_party_" } } }),
    db.evidenceVersion.count({ where: { evidenceObject: { purpose: { in: ["SIM-100 monitoring evidence", "SIM-100 PTC preparation evidence"] } } } }),
    db.intakeSubmission.count({ where: { idempotencyKey: { startsWith: "assurelens:" } } }),
    db.intakeSubmission.count({ where: { idempotencyKey: { startsWith: "assurepool-ptc-prep:" } } }),
    db.externalInstruction.count({ where: { idempotencyKey: pendingInstructionIdempotencyKey, state: "PENDING" } }),
    db.stepUpEvidence.count({ where: { firebaseUid: { startsWith: "sim100-firebase-" }, consumedAt: { not: null } } }),
    db.caseReplayReceipt.count({ where: { transactionCase: { caseReference: { startsWith: "SIM100-" } } } }),
    db.settlementSaga.count({ where: { id: "sim100_mid_restart_saga", state: "EXECUTING" } }),
    db.settlementLeg.count({ where: { id: "sim100_mid_restart_leg", state: "OBSERVED" } }),
  ]);
  assert.equal(casesCount, 200);
  assert.equal(parties, 800);
  assert.equal(evidenceVersions, 20);
  assert.equal(monitoringIntakes, 19);
  assert.equal(ptcPreparationIntakes, 1);
  assert.equal(pendingInstructions, 1);
  assert.equal(consumedStepUps, 140);
  assert.equal(replayReceipts, 1);
  assert.equal(executingSagas, 1);
  assert.equal(observedSagaLegs, 1);
  return {
    cases: casesCount,
    parties,
    evidenceVersions,
    intakes: monitoringIntakes + ptcPreparationIntakes,
    monitoringIntakes,
    ptcPreparationIntakes,
    pendingInstructions,
    consumedStepUps,
    replayReceipts,
    executingSagas,
    observedSagaLegs,
  };
}

async function run(): Promise<void> {
  await db.$connect();
  try {
    if (phase === "verify") {
      const counts = await verifyPersisted();
      console.log(`[SIM-100] VERIFY ${JSON.stringify(counts)}`);
      return;
    }
    const corpus = buildMultiPartySimulationCorpus();
    assert.equal(corpus.length, 200);
    await db.providerReference.create({ data: {
      id: providerRefId, providerKey: `provider:${providerId}`, providerType: "MONITORING_PROVIDER",
      displayName: "SIM-100 AssureLens provider", metadata: { synthetic: true, noProductionEvidence: true },
    } });
    await db.providerReference.create({ data: {
      id: ptcPreparationProviderRefId,
      providerKey: `provider:${ptcPreparationProviderId}`,
      providerType: "PTC_PREPARATION_PROVIDER",
      displayName: "SIM-100 AssurePool PTC preparation provider",
      metadata: { synthetic: true, optionalProvider: true, noProductionEvidence: true },
    } });
    const fixtures: Fixture[] = [];
    const outcomes: Outcome[] = [];
    for (const scenario of corpus) {
      const fixture = await seedFixture(scenario);
      fixtures.push(fixture);
      const outcome = await executeScenario(fixture);
      assert.equal(outcome.gate, scenario.expectedGate, scenario.scenarioId);
      assert.equal(outcome.decision, scenario.expectedDecision, scenario.scenarioId);
      outcomes.push(outcome);
    }
    const ptcPreparationOutcomes = await executePtcPreparationFamily(fixtures);
    await operationalProbes(fixtures);
    const counts = await verifyPersisted();
    const byGate = Object.fromEntries([...new Set(outcomes.map((outcome) => outcome.gate))].sort().map((gate) => [gate, outcomes.filter((outcome) => outcome.gate === gate).length]));
    const report = {
      reportVersion: "assurerail.simulation-gate-report.v1", corpusVersion: corpus[0].corpusVersion,
      corpusDigest: simulationCorpusDigest(corpus), completeGateDigest: completeSimulationGateDigest(),
      ptcPreparationFamily: {
        version: buildPtcPreparationSimulationFamily()[0].corpusVersion,
        digest: ptcPreparationSimulationFamilyDigest(),
        scenarioCount: ptcPreparationOutcomes.length,
      },
      generatedAt: new Date().toISOString(), syntheticOnly: true,
      externalEvidenceGatesClosed: false,
      scenarioCount: outcomes.length + ptcPreparationOutcomes.length,
      passedAssertions: outcomes.length + ptcPreparationOutcomes.length,
      failedAssertions: 0,
      byGate: Object.fromEntries([...new Set([...outcomes, ...ptcPreparationOutcomes].map((outcome) => outcome.gate))]
        .sort().map((gate) => [gate, [...outcomes, ...ptcPreparationOutcomes].filter((outcome) => outcome.gate === gate).length])),
      baseByGate: byGate,
      counts,
    };
    const reportPath = process.env.ARAIL_SIM_REPORT_PATH;
    if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    console.log(`[SIM-100] PASS ${JSON.stringify(report)}`);
  } finally {
    await db.$disconnect();
  }
}

run().catch((error) => {
  console.error("[SIM-100] FAIL", error);
  process.exitCode = 1;
});
