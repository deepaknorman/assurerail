import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { audit } from "../common/audit";
import { sha256Digest } from "../contracts/v1";
import { StepUpService } from "../institutions/step-up.service";
import {
  CONTROLLED_LIVE_GATE_CODES,
  EXTERNAL_GATE_CODES,
  PRODUCTION_ONLY_GATE_CODES,
  inspectActivationManifest,
} from "../runtime/activation-manifest";
import { PrismaService } from "../store/prisma.service";

const GATE_CODES = new Set<string>([...CONTROLLED_LIVE_GATE_CODES, ...PRODUCTION_ONLY_GATE_CODES]);
const SCOPE_TYPES = new Set(["GLOBAL", "ROUTE_FUNCTION", "CONNECTOR", "CUSTOMER_COHORT"]);
const MAX_GATE_VALIDITY_MS = 366 * 24 * 60 * 60 * 1_000;

function required(value: unknown, name: string, max = 2_000): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return trimmed;
}

function optional(value: unknown, name: string, max = 500): string | null {
  return value === undefined || value === null || value === "" ? null : required(value, name, max);
}

function exactDigest(value: unknown, name: string): string {
  const digest = required(value, name, 80);
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new BadRequestException(`${name} must be lowercase sha256:<64 hex>`);
  return digest;
}

function date(value: unknown, name: string): Date {
  const raw = required(value, name, 120);
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return parsed;
}

function gateScope(body: { scopeType?: unknown; scopeRef?: unknown }) {
  const scopeType = required(body.scopeType, "scopeType", 40);
  if (!SCOPE_TYPES.has(scopeType)) throw new BadRequestException("scopeType is invalid");
  const scopeRef = optional(body.scopeRef, "scopeRef", 500);
  if (scopeType === "GLOBAL" && scopeRef) throw new BadRequestException("GLOBAL scope cannot have scopeRef");
  if (scopeType !== "GLOBAL" && !scopeRef) throw new BadRequestException(`${scopeType} scope requires scopeRef`);
  return { scopeType, scopeRef, scopeKey: `${scopeType}:${scopeRef ?? "*"}` };
}

function externalEvidenceRef(value: string, gateCode: string): void {
  if (/synthetic|fixture|demo|example/i.test(value)) {
    throw new BadRequestException(`external evidence for ${gateCode} cannot be a synthetic/demo/fixture reference`);
  }
}

@Injectable()
export class OperationalReadinessService {
  constructor(private readonly db: PrismaService, private readonly stepUp: StepUpService) {}

  list(environment?: string) {
    return this.db.operationalReadinessGate.findMany({
      where: environment ? { environment } : undefined,
      include: { currentDecision: true },
      orderBy: [{ environment: "asc" }, { scopeKey: "asc" }, { gateCode: "asc" }, { requirementVersion: "desc" }],
    });
  }

  listActivations(environment?: string) {
    return this.db.deploymentActivation.findMany({
      where: environment ? { environment } : undefined,
      include: { gateBindings: { orderBy: { gateCode: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async proposeGate(actor: { userId: string; sessionId: string }, body: {
    environment?: unknown;
    scopeType?: unknown;
    scopeRef?: unknown;
    gateCode?: unknown;
    requirementVersion?: unknown;
    title?: unknown;
    requirement?: unknown;
    ownerUserId?: unknown;
    supersedesId?: unknown;
    stepUpEvidenceId?: unknown;
  }) {
    const environment = required(body.environment, "environment", 120);
    const scoped = gateScope(body);
    const gateCode = required(body.gateCode, "gateCode", 120);
    if (!GATE_CODES.has(gateCode)) throw new BadRequestException("gateCode is not in the governed PR-12 registry");
    const requirementVersion = body.requirementVersion;
    if (!Number.isSafeInteger(requirementVersion) || Number(requirementVersion) < 1) throw new BadRequestException("requirementVersion must be a positive integer");
    const title = required(body.title, "title", 240);
    const requirement = required(body.requirement, "requirement", 4_000);
    const ownerUserId = required(body.ownerUserId, "ownerUserId", 160);
    const supersedesId = optional(body.supersedesId, "supersedesId", 160);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const target = await this.db.venueUser.findUnique({ where: { id: ownerUserId }, select: { status: true, identityVerifiedAt: true } });
    if (!target || target.status !== "ACTIVE" || !target.identityVerifiedAt) throw new BadRequestException("gate owner must be an active identity-bound staff user");
    if (supersedesId) {
      const prior = await this.db.operationalReadinessGate.findUnique({ where: { id: supersedesId } });
      if (!prior || prior.environment !== environment || prior.scopeKey !== scoped.scopeKey || prior.gateCode !== gateCode) {
        throw new BadRequestException("supersedesId must identify the preceding version of the same environment/scope/gate");
      }
      if (prior.requirementVersion >= Number(requirementVersion)) throw new BadRequestException("requirementVersion must increase");
    }
    const evidenceClassRequired = EXTERNAL_GATE_CODES.has(gateCode) ? "EXTERNAL" : "INTERNAL";
    const proposalDigest = sha256Digest({ environment, ...scoped, gateCode, requirementVersion, title, requirement, evidenceClassRequired, ownerUserId, supersedesId });
    const id = `org_${randomUUID()}`;
    try {
      const gate = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "READINESS_GATE_PROPOSE", institutionId: null }, tx);
        return tx.operationalReadinessGate.create({ data: {
          id, environment, ...scoped, gateCode, requirementVersion: Number(requirementVersion), title, requirement,
          evidenceClassRequired, ownerUserId, proposedByUserId: actor.userId, proposalStepUpId: stepUpEvidenceId,
          proposalDigest, supersedesId,
        } });
      });
      audit("operational.readiness.gate.proposed", { actorUserId: actor.userId, gateId: id, environment, scopeKey: scoped.scopeKey, gateCode });
      return gate;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("this readiness gate version or proposal already exists");
      throw error;
    }
  }

  async reviewGate(actor: { userId: string; sessionId: string }, gateId: string, body: {
    accept?: unknown;
    evidenceClass?: unknown;
    evidenceRef?: unknown;
    evidenceDigest?: unknown;
    reason?: unknown;
    validFrom?: unknown;
    expiresAt?: unknown;
    stepUpEvidenceId?: unknown;
  }) {
    const gate = await this.db.operationalReadinessGate.findUnique({ where: { id: gateId }, include: { decisions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!gate) throw new NotFoundException("readiness gate not found");
    if (!["OPEN", "SUBMITTED", "REJECTED"].includes(gate.status)) throw new ConflictException("readiness gate is not reviewable");
    if (actor.userId === gate.proposedByUserId || actor.userId === gate.ownerUserId) throw new ForbiddenException("gate proposer/owner cannot independently accept the gate");
    const accept = body.accept === true;
    const evidenceClass = required(body.evidenceClass, "evidenceClass", 20).toUpperCase();
    if (!["INTERNAL", "EXTERNAL"].includes(evidenceClass)) throw new BadRequestException("evidenceClass must be INTERNAL or EXTERNAL");
    if (accept && evidenceClass !== gate.evidenceClassRequired) throw new BadRequestException(`${gate.gateCode} requires ${gate.evidenceClassRequired} evidence`);
    const evidenceRef = required(body.evidenceRef, "evidenceRef", 500);
    if (accept && gate.evidenceClassRequired === "EXTERNAL") externalEvidenceRef(evidenceRef, gate.gateCode);
    const evidenceDigest = exactDigest(body.evidenceDigest, "evidenceDigest");
    const reason = required(body.reason, "reason", 2_000);
    const validFrom = date(body.validFrom, "validFrom");
    const expiresAt = date(body.expiresAt, "expiresAt");
    const now = new Date();
    if (validFrom > now) throw new BadRequestException("validFrom cannot be in the future");
    if (expiresAt <= now || expiresAt <= validFrom) throw new BadRequestException("expiresAt must be in the future and follow validFrom");
    if (expiresAt.getTime() - validFrom.getTime() > MAX_GATE_VALIDITY_MS) throw new BadRequestException("readiness evidence validity cannot exceed 366 days");
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const version = (gate.decisions[0]?.version ?? 0) + 1;
    const decision = accept ? "ACCEPT" : "REJECT";
    const decisionDigest = sha256Digest({ gateId, version, decision, evidenceClass, evidenceRef, evidenceDigest, reason, validFrom: validFrom.toISOString(), expiresAt: expiresAt.toISOString(), decidedByUserId: actor.userId });
    const decisionId = `ord_${randomUUID()}`;
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "READINESS_GATE_REVIEW", institutionId: null }, tx);
      const created = await tx.operationalReadinessDecision.create({ data: {
        id: decisionId, readinessGateId: gateId, version, decision, evidenceClass, evidenceRef, evidenceDigest,
        reason, decidedByUserId: actor.userId, decisionStepUpId: stepUpEvidenceId, decisionDigest, validFrom, expiresAt,
      } });
      const claimed = await tx.operationalReadinessGate.updateMany({
        where: { id: gateId, currentDecisionId: gate.currentDecisionId },
        data: {
          status: accept ? "ACCEPTED" : "REJECTED", currentEvidenceRef: evidenceRef, currentEvidenceDigest: evidenceDigest,
          currentDecisionId: created.id, acceptedAt: accept ? now : null, expiresAt: accept ? expiresAt : null,
        },
      });
      if (claimed.count !== 1) throw new ConflictException("readiness gate was concurrently reviewed");
      return tx.operationalReadinessGate.findUniqueOrThrow({ where: { id: gateId }, include: { currentDecision: true } });
    });
    audit("operational.readiness.gate.reviewed", { actorUserId: actor.userId, gateId, decision, decisionId });
    return updated;
  }

  async proposeActivation(actor: { userId: string; sessionId: string }, body: {
    manifestB64?: unknown;
    signatureB64?: unknown;
    signingKeyId?: unknown;
    stepUpEvidenceId?: unknown;
  }) {
    const manifestB64 = required(body.manifestB64, "manifestB64", 350_000);
    const signatureB64 = required(body.signatureB64, "signatureB64", 2_000);
    const signingKeyId = required(body.signingKeyId, "signingKeyId", 240);
    const publicKey = required(process.env.ARAIL_ACTIVATION_PUBLIC_KEY_B64, "configured ARAIL_ACTIVATION_PUBLIC_KEY_B64", 4_000);
    let decoded: Record<string, unknown>;
    try { decoded = JSON.parse(Buffer.from(manifestB64, "base64").toString("utf8")) as Record<string, unknown>; }
    catch { throw new BadRequestException("manifestB64 must be base64-encoded JSON"); }
    const inspected = inspectActivationManifest({
      ASSURERAIL_OPERATING_MODE: String(decoded.operatingMode ?? ""),
      ASSURERAIL_ENVIRONMENT: String(decoded.environment ?? ""),
      ASSURERAIL_BUILD_COMMIT: String(decoded.buildCommit ?? ""),
      ARAIL_ACTIVATION_MANIFEST_B64: manifestB64,
      ARAIL_ACTIVATION_SIGNATURE_B64: signatureB64,
      ARAIL_ACTIVATION_PUBLIC_KEY_B64: publicKey,
    });
    if (inspected.errors.length || !inspected.manifest || !inspected.manifestDigest) {
      throw new BadRequestException(`activation manifest rejected: ${inspected.errors.join("; ")}`);
    }
    const manifest = inspected.manifest;
    const manifestDigest = inspected.manifestDigest;
    const gates = await this.db.operationalReadinessGate.findMany({
      where: { environment: manifest.environment, status: "ACCEPTED", gateCode: { in: manifest.gates.map((gate) => gate.code) } },
      include: { currentDecision: true },
    });
    for (const manifestGate of manifest.gates) {
      const gate = gates.find((candidate) => candidate.gateCode === manifestGate.code && candidate.scopeKey === manifestGate.scopeKey);
      if (!gate?.currentDecision || gate.currentDecision.decision !== "ACCEPT"
        || gate.currentDecision.evidenceDigest !== manifestGate.evidenceDigest
        || gate.currentDecision.evidenceRef !== manifestGate.evidenceRef
        || gate.currentDecision.id !== manifestGate.decisionRef
        || !gate.expiresAt || gate.expiresAt <= new Date()) {
        throw new ConflictException(`manifest gate ${manifestGate.code} does not match a current accepted durable decision`);
      }
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const id = `dar_${randomUUID()}`;
    try {
      const activation = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "DEPLOYMENT_ACTIVATION_REGISTER", institutionId: null }, tx);
        const created = await tx.deploymentActivation.create({ data: {
          id, manifestId: manifest.manifestId, environment: manifest.environment, operatingMode: manifest.operatingMode,
          buildCommit: manifest.buildCommit, status: "DRAFT", manifest: manifest as never, manifestDigest,
          signingKeyId, signature: signatureB64, proposedByUserId: actor.userId,
          proposalStepUpId: stepUpEvidenceId, expiresAt: new Date(manifest.expiresAt),
        } });
        await tx.deploymentActivationGate.createMany({ data: manifest.gates.map((manifestGate) => {
          const gate = gates.find((candidate) => candidate.gateCode === manifestGate.code && candidate.scopeKey === manifestGate.scopeKey)!;
          return { deploymentActivationId: created.id, readinessGateId: gate.id, readinessDecisionId: gate.currentDecision!.id, gateCode: gate.gateCode, scopeKey: gate.scopeKey, evidenceDigest: gate.currentDecision!.evidenceDigest };
        }) });
        return created;
      });
      audit("deployment.activation.proposed", { actorUserId: actor.userId, activationId: id, manifestId: manifest.manifestId, manifestDigest });
      return activation;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("activation manifest already registered");
      throw error;
    }
  }

  async reviewActivation(actor: { userId: string; sessionId: string }, activationId: string, body: { approve?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    const activation = await this.db.deploymentActivation.findUnique({ where: { id: activationId }, include: { gateBindings: { include: { readinessGate: true, readinessDecision: true } } } });
    if (!activation) throw new NotFoundException("deployment activation not found");
    if (activation.status !== "DRAFT") throw new ConflictException("deployment activation is not pending review");
    if (activation.proposedByUserId === actor.userId) throw new ForbiddenException("activation proposer cannot approve the same release");
    if (activation.expiresAt <= new Date()) throw new ConflictException("deployment activation has expired");
    for (const binding of activation.gateBindings) {
      if (binding.readinessGate.status !== "ACCEPTED" || binding.readinessGate.currentDecisionId !== binding.readinessDecisionId
        || binding.readinessDecision.decision !== "ACCEPT" || binding.readinessDecision.expiresAt <= new Date()
        || binding.evidenceDigest !== binding.readinessDecision.evidenceDigest) {
        throw new ConflictException(`readiness gate ${binding.gateCode} changed or expired after activation proposal`);
      }
    }
    const approve = body.approve === true;
    const reason = required(body.reason, "reason", 2_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();
    const approvalDigest = sha256Digest({
      activationId: activation.id,
      manifestDigest: activation.manifestDigest,
      decision: approve ? "APPROVE" : "REJECT",
      reason,
      actorUserId: actor.userId,
      decidedAt: now.toISOString(),
    });
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "DEPLOYMENT_ACTIVATION_REGISTER", institutionId: null }, tx);
      const claimed = await tx.deploymentActivation.updateMany({
        where: { id: activation.id, status: "DRAFT", approvedByUserId: null },
        data: approve ? {
          status: "APPROVED", approvedByUserId: actor.userId, approvalStepUpId: stepUpEvidenceId,
          approvalReason: reason, approvalDigest, approvedAt: now,
        } : {
          status: "REVOKED", revokedByUserId: actor.userId, revocationStepUpId: stepUpEvidenceId,
          revocationReason: reason, revokedAt: now,
        },
      });
      if (claimed.count !== 1) throw new ConflictException("deployment activation was concurrently reviewed");
      return tx.deploymentActivation.findUniqueOrThrow({ where: { id: activation.id }, include: { gateBindings: true } });
    });
    audit("deployment.activation.reviewed", { actorUserId: actor.userId, activationId, approved: approve, reason });
    return updated;
  }

  async revokeActivation(actor: { userId: string; sessionId: string }, activationId: string, body: { reason?: unknown; stepUpEvidenceId?: unknown }) {
    const reason = required(body.reason, "reason", 2_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const activation = await this.db.deploymentActivation.findUnique({ where: { id: activationId } });
    if (!activation || activation.status !== "APPROVED") throw new ConflictException("only an approved activation can be revoked");
    const now = new Date();
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "DEPLOYMENT_ACTIVATION_REVOKE", institutionId: null }, tx);
      const claimed = await tx.deploymentActivation.updateMany({ where: { id: activationId, status: "APPROVED" }, data: { status: "REVOKED", revokedByUserId: actor.userId, revocationStepUpId: stepUpEvidenceId, revocationReason: reason, revokedAt: now } });
      if (claimed.count !== 1) throw new ConflictException("deployment activation was concurrently changed");
      return tx.deploymentActivation.findUniqueOrThrow({ where: { id: activationId } });
    });
    audit("deployment.activation.revoked", { actorUserId: actor.userId, activationId, reason });
    return updated;
  }
}
