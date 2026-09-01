import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { audit } from "../common/audit";
import { sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { WebhooksService } from "../platform/webhooks.service";
import { PrismaService } from "../store/prisma.service";
import { DEVELOPER_CONTRACT_CATALOGUE_V1, SANDBOX_FIXTURE_SET_V1, evaluateSoftwareConformance } from "./developer-contracts";

export type DeveloperActor = { actorUserId: string; actorSessionId: string; actingInstitutionId: string };
const CLIENT_ACTIONS = ["INGEST_EVIDENCE", "READ_RECEIPTS", "READ_CASE_EVENTS", "ACKNOWLEDGE_PROVIDER_ACTION", "RECEIVE_WEBHOOKS"] as const;

function enabled(): void {
  if (inspectPersistenceFlags(process.env).developerPortal !== "shadow") throw new ForbiddenException("developer portal is disabled");
}
function required(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim(); if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`); return result;
}
function date(value: unknown, name: string): Date {
  const result = new Date(required(value, name, 80)); if (!Number.isFinite(result.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`); return result;
}
function actions(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== "string" || !CLIENT_ACTIONS.includes(item as never))) {
    throw new BadRequestException(`allowedActions must contain only: ${CLIENT_ACTIONS.join(", ")}`);
  }
  return [...new Set(value as string[])].sort();
}
function vaultRef(value: unknown): string {
  const result = required(value, "credentialVaultRef", 500);
  if (!/^vault-kv-v2:\/\/[a-zA-Z0-9_.\/-]+#[a-zA-Z0-9_-]+$/.test(result) || result.includes("..")) throw new BadRequestException("credentialVaultRef must be an opaque Vault KV-v2 reference");
  return result;
}
function fingerprint(value: unknown): string {
  const result = required(value, "credentialFingerprint", 80);
  if (!/^sha256:[a-f0-9]{64}$/.test(result)) throw new BadRequestException("credentialFingerprint must be a lowercase sha256 digest");
  return result;
}
function json(value: unknown): Prisma.InputJsonValue { return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue; }

@Injectable()
export class DeveloperPortalService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService, private readonly stepUp: StepUpService, private readonly webhooks: WebhooksService) {}

  contracts(actor: DeveloperActor) { enabled(); return this.authorised(actor, "VIEW_INSTITUTION").then(() => DEVELOPER_CONTRACT_CATALOGUE_V1); }
  fixtures(actor: DeveloperActor) { enabled(); return this.authorised(actor, "OPERATE_CONNECTORS").then(() => SANDBOX_FIXTURE_SET_V1); }

  async listClients(actor: DeveloperActor) {
    enabled(); await this.authorised(actor, "VIEW_INSTITUTION");
    return this.db.developerClientRegistration.findMany({ where: { institutionId: actor.actingInstitutionId }, select: {
      id: true, institutionId: true, clientKey: true, displayName: true, allowedActions: true, status: true,
      currentCredentialVersion: true, createdByUserId: true, createdByMandateId: true, createdAt: true, updatedAt: true,
      credentials: { orderBy: { version: "desc" }, select: { id: true, version: true, credentialFingerprint: true, status: true, reason: true, effectiveAt: true, expiresAt: true, supersededAt: true, revokedAt: true, createdAt: true } },
    }, orderBy: { createdAt: "asc" } });
  }

  async registerClient(actor: DeveloperActor, body: { clientKey?: unknown; displayName?: unknown; allowedActions?: unknown; credentialVaultRef?: unknown; credentialFingerprint?: unknown; expiresAt?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    enabled(); const authority = await this.authorised(actor, "MANAGE_DEVELOPER_INTEGRATION");
    const clientKey = required(body.clientKey, "clientKey", 120); const displayName = required(body.displayName, "displayName", 200);
    const allowedActions = actions(body.allowedActions); const credentialVaultRef = vaultRef(body.credentialVaultRef); const credentialFingerprint = fingerprint(body.credentialFingerprint);
    const expiresAt = date(body.expiresAt, "expiresAt"); if (expiresAt <= new Date()) throw new BadRequestException("expiresAt must be in the future");
    const reason = required(body.reason, "reason", 1_000); const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      return await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "DEVELOPER_CLIENT_REGISTER", institutionId: actor.actingInstitutionId }, tx);
        const id = `dclient_${randomUUID()}`;
        const client = await tx.developerClientRegistration.create({ data: { id, institutionId: actor.actingInstitutionId, clientKey, displayName, allowedActions: json(allowedActions), currentCredentialVersion: 1, createdByUserId: actor.actorUserId, createdByMandateId: authority.mandateId! } });
        await tx.developerCredentialVersion.create({ data: { id: `dcred_${randomUUID()}`, developerClientId: id, version: 1, credentialVaultRef, credentialFingerprint, reason, createdByUserId: actor.actorUserId, createdByMandateId: authority.mandateId!, stepUpEvidenceId, effectiveAt: new Date(), expiresAt } });
        return client;
      });
    } catch (error) { if ((error as { code?: string }).code === "P2002") throw new ConflictException("client key or credential fingerprint already exists in this institution scope"); throw error; }
  }

  async rotateCredential(actor: DeveloperActor, clientId: string, body: { expectedVersion?: unknown; credentialVaultRef?: unknown; credentialFingerprint?: unknown; effectiveAt?: unknown; expiresAt?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    enabled(); const authority = await this.authorised(actor, "MANAGE_DEVELOPER_INTEGRATION");
    const client = await this.client(actor, clientId); if (client.status !== "SHADOW_ONLY") throw new ConflictException("client is not eligible for credential rotation");
    if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion !== client.currentCredentialVersion) throw new ConflictException(`client credential version is ${client.currentCredentialVersion}`);
    const effectiveAt = date(body.effectiveAt, "effectiveAt"); const expiresAt = date(body.expiresAt, "expiresAt"); if (expiresAt <= effectiveAt) throw new BadRequestException("expiresAt must follow effectiveAt");
    const credentialVaultRef = vaultRef(body.credentialVaultRef); const credentialFingerprint = fingerprint(body.credentialFingerprint); const reason = required(body.reason, "reason", 1_000); const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "DEVELOPER_CREDENTIAL_ROTATE", institutionId: actor.actingInstitutionId }, tx);
      const advanced = await tx.developerClientRegistration.updateMany({ where: { id: clientId, institutionId: actor.actingInstitutionId, currentCredentialVersion: client.currentCredentialVersion, status: "SHADOW_ONLY" }, data: { currentCredentialVersion: { increment: 1 } } });
      if (advanced.count !== 1) throw new ConflictException("client changed during credential rotation");
      await tx.developerCredentialVersion.updateMany({ where: { developerClientId: clientId, status: "ACTIVE_SHADOW" }, data: { status: "SUPERSEDED", supersededAt: effectiveAt } });
      return tx.developerCredentialVersion.create({ data: { id: `dcred_${randomUUID()}`, developerClientId: clientId, version: client.currentCredentialVersion + 1, credentialVaultRef, credentialFingerprint, reason, createdByUserId: actor.actorUserId, createdByMandateId: authority.mandateId!, stepUpEvidenceId, effectiveAt, expiresAt } });
    });
  }

  async listConformance(actor: DeveloperActor) { enabled(); await this.authorised(actor, "VIEW_INSTITUTION"); return this.db.developerConformanceRun.findMany({ where: { institutionId: actor.actingInstitutionId }, orderBy: { createdAt: "desc" } }); }
  async runConformance(actor: DeveloperActor, body: { connectorRegistrationId?: unknown; schemaProfileRef?: unknown; observations?: unknown; stepUpEvidenceId?: unknown }) {
    enabled(); const authority = await this.authorised(actor, "OPERATE_CONNECTORS"); const connectorRegistrationId = required(body.connectorRegistrationId, "connectorRegistrationId", 160);
    if (!Array.isArray(body.observations) || body.observations.length > 20) throw new BadRequestException("observations must be a bounded array of at most 20 fixture results");
    const connector = await this.db.connectorRegistration.findFirst({ where: { id: connectorRegistrationId, institutionId: actor.actingInstitutionId } }); if (!connector) throw new NotFoundException("connector not found");
    const schemaProfileRef = required(body.schemaProfileRef, "schemaProfileRef", 240); const result = evaluateSoftwareConformance(body.observations); const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const row = await this.db.$transaction(async (tx) => { await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "DEVELOPER_CONFORMANCE_RUN", institutionId: actor.actingInstitutionId }, tx); return tx.developerConformanceRun.create({ data: { id: `dconf_${randomUUID()}`, institutionId: actor.actingInstitutionId, connectorRegistrationId, fixtureSetVersion: SANDBOX_FIXTURE_SET_V1.fixtureSetVersion, schemaProfileRef, result: result.result, assertions: json(result.assertions), inputDigest: result.inputDigest, resultDigest: result.resultDigest, sandboxNonEvidence: true, createdByUserId: actor.actorUserId, createdByMandateId: authority.mandateId!, stepUpEvidenceId } }); });
    audit("rail.developer.conformance_recorded", { institutionId: actor.actingInstitutionId, connectorRegistrationId, result: result.result }); return row;
  }

  async listWebhooks(actor: DeveloperActor) { enabled(); await this.authorised(actor, "VIEW_DELIVERY_HEALTH"); return this.webhooks.listForInstitution(actor.actingInstitutionId); }
  async subscribeWebhook(actor: DeveloperActor, body: { url?: unknown; events?: unknown; stepUpEvidenceId?: unknown }) { enabled(); await this.authorised(actor, "MANAGE_DEVELOPER_INTEGRATION"); const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160); await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "DEVELOPER_WEBHOOK_REGISTER", institutionId: actor.actingInstitutionId }); return this.webhooks.subscribe(required(body.url, "url", 500), actionsOrEvents(body.events), actor.actingInstitutionId); }
  async verifyWebhook(actor: DeveloperActor, id: string, stepUpEvidenceId: string) { enabled(); await this.authorised(actor, "MANAGE_DEVELOPER_INTEGRATION"); await this.webhooks.requireInstitutionSubscription(id, actor.actingInstitutionId); await this.stepUp.consume({ evidenceId: required(stepUpEvidenceId, "stepUpEvidenceId", 160), userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "DEVELOPER_WEBHOOK_VERIFY", institutionId: actor.actingInstitutionId }); return this.webhooks.verify(id); }
  async deliveryHealth(actor: DeveloperActor, limit?: number) { enabled(); await this.authorised(actor, "VIEW_DELIVERY_HEALTH"); const bounded = limit === undefined ? 50 : Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50; return this.webhooks.deliveriesForInstitution(actor.actingInstitutionId, bounded); }
  async replayDelivery(actor: DeveloperActor, id: string, stepUpEvidenceId: string) { enabled(); await this.authorised(actor, "MANAGE_DEVELOPER_INTEGRATION"); await this.webhooks.requireInstitutionDelivery(id, actor.actingInstitutionId); await this.stepUp.consume({ evidenceId: required(stepUpEvidenceId, "stepUpEvidenceId", 160), userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "DEVELOPER_WEBHOOK_REPLAY", institutionId: actor.actingInstitutionId }); return this.webhooks.replayDelivery(id); }

  async exportIntegration(actor: DeveloperActor, body: { stepUpEvidenceId?: unknown }) {
    enabled(); const authority = await this.authorised(actor, "EXPORT_INTEGRATION_DATA"); const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const [connectors, clients, conformance, subscriptions, deliveries] = await Promise.all([
      this.db.connectorRegistration.findMany({ where: { institutionId: actor.actingInstitutionId }, include: { certifications: true, subjectMappings: true } }),
      this.db.developerClientRegistration.findMany({ where: { institutionId: actor.actingInstitutionId }, select: { id: true, clientKey: true, displayName: true, allowedActions: true, status: true, currentCredentialVersion: true, createdAt: true, updatedAt: true, credentials: { select: { id: true, version: true, credentialFingerprint: true, status: true, reason: true, effectiveAt: true, expiresAt: true, supersededAt: true, revokedAt: true, createdAt: true } } } }),
      this.db.developerConformanceRun.findMany({ where: { institutionId: actor.actingInstitutionId } }), this.webhooks.listForInstitution(actor.actingInstitutionId), this.webhooks.deliveriesForInstitution(actor.actingInstitutionId, 200),
    ]);
    const packageData = toCanonicalValue({ exportVersion: "1.0.0", institutionId: actor.actingInstitutionId, generatedAt: new Date().toISOString(), connectors, clients, conformance, subscriptions, deliveries });
    const recordCounts = { connectors: connectors.length, clients: clients.length, credentials: clients.reduce((sum, item) => sum + item.credentials.length, 0), conformanceRuns: conformance.length, subscriptions: subscriptions.length, deliveries: deliveries.length };
    const manifestDigest = sha256Digest(packageData);
    await this.db.$transaction(async (tx) => { await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "DEVELOPER_EXIT_EXPORT", institutionId: actor.actingInstitutionId }, tx); await tx.integrationExitExport.create({ data: { id: `dexit_${randomUUID()}`, institutionId: actor.actingInstitutionId, exportVersion: "1.0.0", scope: json({ integrationOnly: true, deliveryLimit: 200, secretsExcluded: true }), recordCounts: json(recordCounts), manifestDigest, requestedByUserId: actor.actorUserId, requestedByMandateId: authority.mandateId!, stepUpEvidenceId } }); });
    return { manifest: { exportVersion: "1.0.0", recordCounts, manifestDigest, secretsExcluded: true }, data: packageData };
  }

  private authorised(actor: DeveloperActor, action: Parameters<InstitutionAccessService["requireHuman"]>[0]["action"]) { return this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action }); }
  private async client(actor: DeveloperActor, id: string) { const item = await this.db.developerClientRegistration.findFirst({ where: { id, institutionId: actor.actingInstitutionId } }); if (!item) throw new NotFoundException("developer client not found"); return item; }
}

function actionsOrEvents(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 100 || value.some((item) => typeof item !== "string" || !/^[a-zA-Z0-9.*_-]{1,120}$/.test(item))) throw new BadRequestException("events must contain 1 to 100 valid event names");
  return [...new Set(value as string[])];
}
