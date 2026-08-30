import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomBytes, randomUUID } from "node:crypto";
import { sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { PrismaService } from "../store/prisma.service";
import { appendGovernedAudit } from "./governed-audit";
import {
  PASSIVE_ROOM_POLICY_VERSION,
  ROOM_DECLARATION_TEXT,
  ROOM_DECLARATION_TEXT_VERSION,
  ROOM_RELIANCE_TEXT,
  ROOM_RELIANCE_TEXT_VERSION,
  assertRoomPurposeAvailable,
} from "./room-policy";
import { RoomAuthorityService, type RoomActor } from "./room-authority.service";
import { ROOM_SOURCE_VIEWS, RoomSourceAdapterService, type RoomSourceView } from "./room-source-adapters";

function required(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function futureDate(value: unknown, name: string): Date {
  const result = new Date(required(value, name, 80));
  if (!Number.isFinite(result.getTime()) || result <= new Date()) throw new BadRequestException(`${name} must be a future ISO-8601 timestamp`);
  return result;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue;
}

@Injectable()
export class ActiveRoomsService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
    private readonly authority: RoomAuthorityService,
    private readonly sources: RoomSourceAdapterService,
  ) {}

  async list(actor: RoomActor, caseId: string) {
    this.assertProxyAction(actor, "LIST_ROOMS");
    this.requireRailReads();
    const transactionCase = await this.requireCaseParticipant(actor, caseId, "VIEW_CASE_ROOM");
    const owner = transactionCase.ownerInstitutionId === actor.actingInstitutionId;
    const rows = await this.db.caseRoom.findMany({
      where: {
        transactionCaseId: caseId,
        ...(owner ? {} : { status: "OPEN", grants: { some: { granteeInstitutionId: actor.actingInstitutionId, status: "ACTIVE" } } }),
      },
      orderBy: { createdAt: "asc" },
      include: { grants: { orderBy: { createdAt: "asc" } }, legacyImports: { orderBy: { importVersion: "desc" }, take: 1 } },
    });
    return rows.map((room) => ({ ...room, legacyImport: room.legacyImports[0] ?? null, legacyImports: undefined }));
  }

  async get(actor: RoomActor, caseId: string, roomId: string) {
    this.assertProxyAction(actor, "READ_ROOM");
    const room = await this.requireRoomRead(actor, caseId, roomId);
    await this.appendAccessAtomic(room.id, actor, "VIEW_ROOM", `case:${caseId}`);
    return this.loadSerializableRoom(room.id);
  }

  async sourceView(actor: RoomActor, caseId: string, roomId: string, rawView: string) {
    this.assertProxyAction(actor, "READ_SOURCE");
    const room = await this.requireRoomRead(actor, caseId, roomId);
    const view = required(rawView, "view", 80).toUpperCase() as RoomSourceView;
    if (!ROOM_SOURCE_VIEWS.includes(view)) throw new BadRequestException(`view must be one of: ${ROOM_SOURCE_VIEWS.join(", ")}`);
    const result = await this.sources.view(room.id, view);
    await this.appendAccessAtomic(room.id, actor, `VIEW_${view}`, `source:${room.sourceReferenceId ?? "none"}`);
    return result;
  }

  async messages(actor: RoomActor, caseId: string, roomId: string) {
    this.assertProxyAction(actor, "READ_MESSAGES");
    const room = await this.requireRoomRead(actor, caseId, roomId);
    await this.appendAccessAtomic(room.id, actor, "VIEW_MESSAGES", null);
    return this.db.roomMessage.findMany({ where: { caseRoomId: room.id }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] });
  }

  async accessEvents(actor: RoomActor, caseId: string, roomId: string) {
    this.assertProxyAction(actor, "READ_ROOM");
    const room = await this.requireRoomRead(actor, caseId, roomId);
    await this.appendAccessAtomic(room.id, actor, "VIEW_ACCESS_LOG", null);
    const events = await this.db.roomAccessEvent.findMany({ where: { caseRoomId: room.id }, orderBy: { sequence: "asc" } });
    return events.map((event) => ({ ...event, sequence: event.sequence.toString() }));
  }

  async recordExport(actor: RoomActor, caseId: string, roomId: string, rawDigest: string) {
    this.assertProxyAction(actor, "EXPORT_DOSSIER");
    const room = await this.requireRoomRead(actor, caseId, roomId);
    const exportDigest = required(rawDigest, "exportDigest", 80);
    if (!/^sha256:[a-f0-9]{64}$/.test(exportDigest)) throw new BadRequestException("exportDigest must be a lowercase sha256 digest");
    await this.db.$transaction(async (tx) => {
      await this.appendAccess(tx, room.id, actor, "DOSSIER_EXPORTED", exportDigest);
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.room.dossier_exported", detail: { caseId, roomId, exportDigest } });
    });
    return { caseId, roomId, exportDigest, recorded: true };
  }

  async create(actor: RoomActor, caseId: string, body: {
    idempotencyKey?: string; sourceReferenceId?: string; purpose?: string; reason?: string; stepUpEvidenceId?: string;
  }) {
    this.assertProxyAction(actor, "CREATE_ROOM");
    this.requireRailWrites();
    const transactionCase = await this.requireCaseOwner(actor, caseId, "OPERATE_CASE_ROOM");
    await this.authority.requireRailWrite(caseId);
    const route = await this.access.evaluateRoute(actor.actingInstitutionId, {
      transactionRoute: transactionCase.transactionRoute,
      representation: transactionCase.representation,
      assetClass: transactionCase.assetClass,
      lifecycleLeg: transactionCase.lifecycleLeg,
      materialFunction: "DISCLOSURES",
      operatingMode: transactionCase.operatingMode,
    });
    if (!route.allowed) throw new ForbiddenException(`room route denied: ${route.code}`);
    const purpose = required(body.purpose ?? "PASSIVE_DILIGENCE", "purpose", 80);
    try { assertRoomPurposeAvailable(purpose); } catch (error) { throw new BadRequestException((error as Error).message); }
    const sourceReferenceId = required(body.sourceReferenceId, "sourceReferenceId", 200);
    const source = await this.db.sourceReference.findUnique({
      where: { id: sourceReferenceId },
      include: { intakeSubmissions: { where: { validationStatus: "VALID" }, orderBy: { receivedAt: "desc" }, take: 1 } },
    });
    if (!source || source.transactionCaseId !== caseId || source.providerReferenceId.length === 0) {
      throw new BadRequestException("source reference must be a valid retained source for this case");
    }
    if (source.sourceObjectType === "FROZEN_ASSET_TAPE" && transactionCase.transactionRoute !== "DA") {
      throw new BadRequestException("an AssurePool frozen DA tape cannot create a PTC room");
    }
    const sourceManifestDigest = this.sourceManifest(source.metadata, source.intakeSubmissions[0]?.payload);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const reason = required(body.reason, "reason", 1_000);
    const requestDigest = sha256Digest({ caseId, sourceReferenceId, sourceManifestDigest, purpose, reason });
    const replay = await this.db.caseRoom.findUnique({ where: { transactionCaseId_creationIdempotencyKey: { transactionCaseId: caseId, creationIdempotencyKey: idempotencyKey } } });
    if (replay) {
      if (replay.creationRequestDigest !== requestDigest) throw new ConflictException("room idempotency key was reused with different content");
      return this.loadSerializableRoom(replay.id);
    }
    const authority = await this.authorityFor(actor, "OPERATE_CASE_ROOM", caseId);
    const stepUpEvidenceId = this.stepUpReference(actor, body.stepUpEvidenceId);
    const roomId = `room_${randomUUID()}`;
    try {
      await this.db.$transaction(async (tx) => {
        await this.consumeStepUp(tx, actor, stepUpEvidenceId, "ROOM_CREATE");
        await tx.caseRoom.create({ data: {
          id: roomId, transactionCaseId: caseId, purpose, policyVersion: PASSIVE_ROOM_POLICY_VERSION,
          sourceReferenceId, sourceManifestDigest, status: "OPEN", creationIdempotencyKey: idempotencyKey,
          creationRequestDigest: requestDigest, openedAt: new Date(), createdByUserId: actor.actorUserId,
          createdByMandateId: authority.mandateId!,
        } });
        await this.appendAccess(tx, roomId, actor, "ROOM_OPENED", `source:${sourceReferenceId}`);
        await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.room.opened", detail: { caseId, roomId, sourceReferenceId, sourceManifestDigest, purpose, reason, authorityMandateId: authority.mandateId } });
      });
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== "P2002") throw error;
      const existing = await this.db.caseRoom.findUnique({ where: { transactionCaseId_creationIdempotencyKey: { transactionCaseId: caseId, creationIdempotencyKey: idempotencyKey } } });
      if (!existing || existing.creationRequestDigest !== requestDigest) throw new ConflictException("room creation conflicted with another command");
      return this.loadSerializableRoom(existing.id);
    }
    return this.loadSerializableRoom(roomId);
  }

  async invite(actor: RoomActor, caseId: string, roomId: string, body: {
    institutionId?: string; classification?: string; idempotencyKey?: string; expiresAt?: string;
    authorityEvidenceRef?: string; stepUpEvidenceId?: string;
  }) {
    this.assertProxyAction(actor, "INVITE");
    this.requireRailWrites();
    await this.authority.requireRailWrite(caseId);
    const room = await this.requireRoomOwner(actor, caseId, roomId);
    if (room.status !== "OPEN" || room.legacyRoomId) throw new ConflictException("only an open Rail-native room can issue a Rail invitation");
    const institutionId = required(body.institutionId, "institutionId", 160);
    if (institutionId === actor.actingInstitutionId) throw new BadRequestException("room counterparty must differ from the owner");
    const party = await this.db.caseParty.findFirst({ where: { transactionCaseId: caseId, institutionId, status: "ACTIVE" } });
    if (!party || party.status !== "ACTIVE") throw new BadRequestException("invited institution must be an active case party");
    const institution = await this.db.institution.findUnique({ where: { id: institutionId }, include: { admission: true } });
    if (!institution || institution.status !== "ACTIVE" || institution.admission?.status !== "ADMITTED") throw new BadRequestException("invited institution must be admitted and active");
    if (typeof body.classification === "string" && body.classification.trim()
      && body.classification.trim() !== "PENDING_DECLARATION") {
      throw new BadRequestException("the inviter cannot assert the transferee classification; it is recorded by the transferee at acceptance");
    }
    const classification = "PENDING_DECLARATION";
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const invitationExpiresAt = futureDate(body.expiresAt, "expiresAt");
    const authorityEvidenceRef = required(body.authorityEvidenceRef, "authorityEvidenceRef", 500);
    const requestDigest = sha256Digest({ roomId, institutionId, classification, idempotencyKey, expiresAt: invitationExpiresAt.toISOString(), authorityEvidenceRef });
    const replay = await this.db.roomGrant.findUnique({ where: { caseRoomId_invitationIdempotencyKey: { caseRoomId: roomId, invitationIdempotencyKey: idempotencyKey } } });
    if (replay) {
      if (replay.invitationRequestDigest !== requestDigest) throw new ConflictException("invitation idempotency key was reused with different content");
      return { replay: true, invite: replay, invitationToken: null, note: "the invitation token is returned only on first creation" };
    }
    const existing = await this.db.roomGrant.findUnique({ where: { caseRoomId_granteeInstitutionId_purpose: { caseRoomId: roomId, granteeInstitutionId: institutionId, purpose: "PASSIVE_DILIGENCE" } } });
    if (existing) throw new ConflictException("this institution already has a room grant; use its retained lifecycle rather than creating a second identity");
    const authority = await this.authorityFor(actor, "OPERATE_CASE_ROOM", caseId);
    const stepUpEvidenceId = this.stepUpReference(actor, body.stepUpEvidenceId);
    const token = randomBytes(32).toString("base64url");
    const invitationDigest = sha256Digest({ purpose: "ROOM_INVITATION", token });
    const grant = await this.db.$transaction(async (tx) => {
      await this.consumeStepUp(tx, actor, stepUpEvidenceId, "ROOM_INVITE");
      const created = await tx.roomGrant.create({ data: {
        id: `rgrant_${randomUUID()}`, caseRoomId: roomId, granteeInstitutionId: institutionId,
        purpose: "PASSIVE_DILIGENCE", classification, status: "INVITED",
        invitationIdempotencyKey: idempotencyKey, invitationRequestDigest: requestDigest,
        invitationDigest, invitationExpiresAt, declarationTextVersion: ROOM_DECLARATION_TEXT_VERSION,
        relianceTextVersion: ROOM_RELIANCE_TEXT_VERSION, grantedByUserId: actor.actorUserId,
        grantedByMandateId: authority.mandateId,
      } });
      await this.appendAccess(tx, roomId, actor, "INVITE_SENT", `institution:${institutionId}`);
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.room.invitation_issued", detail: { caseId, roomId, grantId: created.id, institutionId, invitationExpiresAt: invitationExpiresAt.toISOString(), authorityEvidenceRef, authorityMandateId: authority.mandateId } });
      return created;
    });
    const webBase = (process.env.ASSURERAIL_WEB_URL ?? "http://localhost:3007").replace(/\/$/, "");
    return { replay: false, invite: grant, invitationToken: token, invitationLink: `${webBase}/room-invitations/${encodeURIComponent(token)}` };
  }

  async invitationContext(actor: RoomActor, token: string) {
    this.assertProxyAction(actor, "INVITATION_CONTEXT");
    this.requireRailReads();
    const grant = await this.grantByToken(token);
    if (grant.granteeInstitutionId !== actor.actingInstitutionId) throw new NotFoundException("room invitation not found");
    await this.requireCaseParticipant(actor, grant.caseRoom.transactionCaseId, "VIEW_CASE_ROOM");
    if (grant.status !== "ACTIVE") this.assertInvitationUsable(grant);
    return {
      caseId: grant.caseRoom.transactionCaseId,
      roomId: grant.caseRoomId,
      grantId: grant.id,
      purpose: grant.purpose,
      classification: grant.classification,
      grantStatus: grant.status,
      declarationRecorded: grant.status === "ACTIVE" && Boolean(grant.declarationAt) && Boolean(grant.relianceAcceptedAt),
      declarationText: ROOM_DECLARATION_TEXT,
      declarationTextVersion: grant.declarationTextVersion,
      relianceText: ROOM_RELIANCE_TEXT,
      relianceTextVersion: grant.relianceTextVersion,
      expiresAt: grant.invitationExpiresAt,
    };
  }

  async acceptInvitation(actor: RoomActor, token: string, body: {
    classification?: string; declarationAccepted?: boolean; relianceAccepted?: boolean; declarationEvidenceText?: string;
    idempotencyKey?: string; stepUpEvidenceId?: string;
  }) {
    this.assertProxyAction(actor, "ACCEPT_INVITATION");
    this.requireRailWrites();
    const grant = await this.grantByToken(token);
    await this.authority.requireRailWrite(grant.caseRoom.transactionCaseId);
    if (grant.granteeInstitutionId !== actor.actingInstitutionId) throw new NotFoundException("room invitation not found");
    if (body.declarationAccepted !== true || body.relianceAccepted !== true) throw new BadRequestException("declaration and reliance acceptance are required");
    const classification = required(body.classification, "classification", 160);
    if (grant.classification !== "PENDING_DECLARATION" && classification !== grant.classification) {
      throw new BadRequestException("classification must match the named invitation");
    }
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const declarationEvidenceDigest = body.declarationEvidenceText
      ? sha256Digest({ text: required(body.declarationEvidenceText, "declarationEvidenceText", 10_000) })
      : null;
    const requestDigest = sha256Digest({ roomId: grant.caseRoomId, grantId: grant.id, institutionId: actor.actingInstitutionId, classification, declarationAccepted: true, relianceAccepted: true, declarationEvidenceDigest });
    if (grant.status === "ACTIVE") {
      if (grant.acceptanceIdempotencyKey !== idempotencyKey || grant.acceptanceRequestDigest !== requestDigest) {
        throw new ConflictException("this invitation has already been accepted with different command content");
      }
      return grant;
    }
    this.assertInvitationUsable(grant);
    const authority = await this.authorityFor(actor, "OPERATE_CASE_ROOM", grant.caseRoom.transactionCaseId);
    const stepUpEvidenceId = this.stepUpReference(actor, body.stepUpEvidenceId);
    const acceptedAt = new Date();
    const declarationDigest = sha256Digest({
      roomId: grant.caseRoomId, grantId: grant.id, institutionId: actor.actingInstitutionId,
      classification, declarationText: ROOM_DECLARATION_TEXT,
      declarationTextVersion: grant.declarationTextVersion, relianceText: ROOM_RELIANCE_TEXT,
      relianceTextVersion: grant.relianceTextVersion, acceptedAt: acceptedAt.toISOString(),
      declarationEvidenceDigest,
    });
    const accepted = await this.db.$transaction(async (tx) => {
      await this.consumeStepUp(tx, actor, stepUpEvidenceId, "ROOM_ACCEPT");
      const changed = await tx.roomGrant.updateMany({ where: { id: grant.id, status: "INVITED", invitationDigest: grant.invitationDigest }, data: {
        status: "ACTIVE", classification, declarationDigest, declarationAt: acceptedAt, relianceAcceptedAt: acceptedAt,
        acceptedByUserId: actor.actorUserId, acceptedByMandateId: authority.mandateId, acceptedAt,
        acceptanceIdempotencyKey: idempotencyKey, acceptanceRequestDigest: requestDigest,
        grantVersion: { increment: 1 },
      } });
      if (changed.count !== 1) throw new ConflictException("invitation was already used or changed concurrently");
      await this.appendAccess(tx, grant.caseRoomId, actor, "DECLARATION_RECORDED", `grant:${grant.id}`);
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.room.invitation_accepted", detail: { caseId: grant.caseRoom.transactionCaseId, roomId: grant.caseRoomId, grantId: grant.id, institutionId: actor.actingInstitutionId, declarationDigest, authorityMandateId: authority.mandateId } });
      return tx.roomGrant.findUniqueOrThrow({ where: { id: grant.id } });
    });
    return accepted;
  }

  async postMessage(actor: RoomActor, caseId: string, roomId: string, body: { body?: string; idempotencyKey?: string }) {
    this.assertProxyAction(actor, "POST_MESSAGE");
    this.requireRailWrites();
    await this.authority.requireRailWrite(caseId);
    const room = await this.requireRoomRead(actor, caseId, roomId, true);
    const messageBody = required(body.body, "body", 20_000);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = sha256Digest({ caseId, roomId, institutionId: actor.actingInstitutionId, body: messageBody });
    const replay = await this.db.roomMessage.findUnique({ where: { caseRoomId_messageIdempotencyKey: { caseRoomId: roomId, messageIdempotencyKey: idempotencyKey } } });
    if (replay) {
      if (replay.messageRequestDigest !== requestDigest) throw new ConflictException("message idempotency key was reused with different content");
      return replay;
    }
    const isOwner = room.transactionCase.ownerInstitutionId === actor.actingInstitutionId;
    const message = await this.db.$transaction(async (tx) => {
      const created = await tx.roomMessage.create({ data: {
        id: `rmsg_${randomUUID()}`, caseRoomId: roomId, authorUserId: actor.actorUserId,
        authorInstitutionId: actor.actingInstitutionId, authorReference: this.actorRef(actor),
        authorRole: isOwner ? "TRANSFEROR" : "TRANSFEREE", messageKind: isOwner ? "ANSWER" : "QUESTION",
        body: messageBody, bodyDigest: sha256Digest({ body: messageBody }), messageIdempotencyKey: idempotencyKey,
        messageRequestDigest: requestDigest, occurredAt: new Date(),
      } });
      await this.appendAccess(tx, roomId, actor, isOwner ? "ANSWER_POSTED" : "QUESTION_POSTED", `message:${created.id}`);
      return created;
    }).catch(async (error) => {
      if ((error as { code?: string } | null)?.code !== "P2002") throw error;
      const existing = await this.db.roomMessage.findUnique({ where: { caseRoomId_messageIdempotencyKey: { caseRoomId: roomId, messageIdempotencyKey: idempotencyKey } } });
      if (!existing || existing.messageRequestDigest !== requestDigest) throw new ConflictException("message command conflicted with another request");
      return existing;
    });
    return message;
  }

  async close(actor: RoomActor, caseId: string, roomId: string, body: {
    outcome?: "COMPLETED" | "WITHDRAWN"; reason?: string; idempotencyKey?: string; stepUpEvidenceId?: string;
  }) {
    this.assertProxyAction(actor, "CLOSE_ROOM");
    this.requireRailWrites();
    await this.authority.requireRailWrite(caseId);
    const room = await this.requireRoomOwner(actor, caseId, roomId);
    const reason = required(body.reason, "reason", 1_000);
    const outcome = body.outcome === "WITHDRAWN" ? "WITHDRAWN" : "COMPLETED";
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = sha256Digest({ caseId, roomId, outcome, reason });
    if (room.status !== "OPEN") {
      if (room.closeIdempotencyKey === idempotencyKey && room.closeRequestDigest === requestDigest) return this.loadSerializableRoom(roomId);
      throw new ConflictException("room is already closed, withdrawn or unavailable");
    }
    if (room.legacyRoomId) throw new ConflictException("only an open Rail-native room can be closed by this command");
    const authority = await this.authorityFor(actor, "OPERATE_CASE_ROOM", caseId);
    const stepUpEvidenceId = this.stepUpReference(actor, body.stepUpEvidenceId);
    await this.db.$transaction(async (tx) => {
      await this.consumeStepUp(tx, actor, stepUpEvidenceId, "ROOM_CLOSE");
      const changed = await tx.caseRoom.updateMany({ where: { id: roomId, status: "OPEN", aggregateVersion: room.aggregateVersion }, data: {
        status: outcome === "WITHDRAWN" ? "WITHDRAWN" : "CLOSED", closedAt: new Date(), closeIdempotencyKey: idempotencyKey,
        closeRequestDigest: requestDigest, closeReason: reason, aggregateVersion: { increment: 1 },
      } });
      if (changed.count !== 1) throw new ConflictException("room changed concurrently");
      await tx.roomGrant.updateMany({ where: { caseRoomId: roomId, status: { in: ["INVITED", "ACTIVE"] } }, data: { status: "REVOKED", invitationDigest: null, revokedByUserId: actor.actorUserId, revokedAt: new Date(), grantVersion: { increment: 1 } } });
      await this.appendAccess(tx, roomId, actor, outcome === "WITHDRAWN" ? "ROOM_WITHDRAWN" : "ROOM_CLOSED", reason);
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: outcome === "WITHDRAWN" ? "rail.room.withdrawn" : "rail.room.closed", detail: { caseId, roomId, outcome, reason, authorityMandateId: authority.mandateId } });
    });
    return this.loadSerializableRoom(roomId);
  }

  private requireRailReads(): void {
    if (inspectPersistenceFlags(process.env).roomReadSource !== "rail") throw new ForbiddenException("Rail-owned room reads are disabled");
  }

  private requireRailWrites(): void {
    if (inspectPersistenceFlags(process.env).roomWriteSource !== "rail") throw new ForbiddenException("Rail-owned room writes are disabled");
  }

  private async requireCaseParticipant(actor: RoomActor, caseId: string, action: "VIEW_CASE_ROOM" | "OPERATE_CASE_ROOM") {
    this.requireRailReads();
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId }, include: { parties: true } });
    const party = transactionCase?.parties.find((item) => item.institutionId === actor.actingInstitutionId && item.status === "ACTIVE");
    if (!transactionCase || (transactionCase.ownerInstitutionId !== actor.actingInstitutionId && !party)) throw new NotFoundException("transaction case not found");
    await this.authorityFor(actor, action, caseId);
    return transactionCase;
  }

  private async requireCaseOwner(actor: RoomActor, caseId: string, action: "VIEW_CASE_ROOM" | "OPERATE_CASE_ROOM") {
    const transactionCase = await this.requireCaseParticipant(actor, caseId, action);
    if (transactionCase.ownerInstitutionId !== actor.actingInstitutionId) throw new NotFoundException("transaction case not found");
    return transactionCase;
  }

  private async requireRoomOwner(actor: RoomActor, caseId: string, roomId: string) {
    await this.requireCaseOwner(actor, caseId, "OPERATE_CASE_ROOM");
    const room = await this.db.caseRoom.findUnique({ where: { id: roomId } });
    if (!room || room.transactionCaseId !== caseId) throw new NotFoundException("case room not found");
    return room;
  }

  private async requireRoomRead(actor: RoomActor, caseId: string, roomId: string, operate = false) {
    const transactionCase = await this.requireCaseParticipant(actor, caseId, operate ? "OPERATE_CASE_ROOM" : "VIEW_CASE_ROOM");
    const room = await this.db.caseRoom.findUnique({ where: { id: roomId }, include: { grants: true, transactionCase: true } });
    if (!room || room.transactionCaseId !== caseId) throw new NotFoundException("case room not found");
    if (transactionCase.ownerInstitutionId === actor.actingInstitutionId) return room;
    const grant = room.grants.find((item) => item.granteeInstitutionId === actor.actingInstitutionId && item.status === "ACTIVE");
    if (!grant || room.status !== "OPEN" || !grant.declarationAt || !grant.relianceAcceptedAt
      || (grant.expiresAt && grant.expiresAt <= new Date())) throw new NotFoundException("case room not found");
    return room;
  }

  private async grantByToken(tokenValue: string) {
    const token = required(tokenValue, "invitationToken", 200);
    return this.db.roomGrant.findUniqueOrThrow({
      where: { invitationDigest: sha256Digest({ purpose: "ROOM_INVITATION", token }) },
      include: { caseRoom: true },
    }).catch(() => { throw new NotFoundException("room invitation not found"); });
  }

  private assertInvitationUsable(grant: Awaited<ReturnType<ActiveRoomsService["grantByToken"]>>): void {
    if (grant.status !== "INVITED" || grant.caseRoom.status !== "OPEN" || !grant.invitationDigest
      || !grant.invitationExpiresAt || grant.invitationExpiresAt <= new Date()) {
      throw new ConflictException("room invitation is expired, revoked, used or unavailable");
    }
  }

  private sourceManifest(metadataValue: unknown, payloadValue: unknown): string {
    const metadata = object(metadataValue);
    const payload = object(payloadValue);
    const extensions = object(payload.extensions);
    const sourceRecord = object(extensions.sourceRecord);
    const normalized = object(payload.normalized);
    const candidate = sourceRecord.manifestHash ?? normalized.sourceManifestDigest ?? normalized.manifestHash ?? metadata.manifestHash;
    if (typeof candidate !== "string" || !candidate.trim()) throw new BadRequestException("source evidence has no retained manifest binding");
    return candidate.trim();
  }

  private async appendAccessAtomic(roomId: string, actor: RoomActor, action: string, objectReference: string | null) {
    return this.db.$transaction((tx) => this.appendAccess(tx, roomId, actor, action, objectReference));
  }

  private async appendAccess(tx: Prisma.TransactionClient, roomId: string, actor: RoomActor, action: string, objectReference: string | null) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`assurerail-room:${roomId}`}))`;
    const previous = await tx.roomAccessEvent.findFirst({ where: { caseRoomId: roomId }, orderBy: { sequence: "desc" } });
    const sequence = (previous?.sequence ?? 0n) + 1n;
    const occurredAt = new Date();
    const payload = {
      roomId, sequence: sequence.toString(), chainOrigin: "RAIL", actorUserId: actor.actorUserId,
      actingInstitutionId: actor.actingInstitutionId, action, objectReference, occurredAt: occurredAt.toISOString(),
    };
    const eventHash = sha256Digest({ previousHash: previous?.eventHash ?? "GENESIS", payload });
    return tx.roomAccessEvent.create({ data: {
      id: `racc_${randomUUID()}`, caseRoomId: roomId, sequence, chainOrigin: "RAIL",
      hashRoomReference: roomId, actorUserId: actor.actorUserId, actingInstitutionId: actor.actingInstitutionId,
      actorReference: this.actorRef(actor), action, objectReference,
      previousHash: previous?.eventHash ?? "GENESIS", eventHash, occurredAt,
    } });
  }

  private actorRef(actor: RoomActor): string {
    return actor.proxyAuthority
      ? `external:${actor.proxyAuthority.externalActorRef}@institution:${actor.actingInstitutionId}:connector:${actor.proxyAuthority.connectorId}`
      : `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`;
  }

  private assertProxyAction(actor: RoomActor, expected: string): void {
    if (actor.proxyAuthority && actor.proxyAuthority.action !== expected) throw new ForbiddenException("connector subject mapping does not authorise this room action");
  }

  private async authorityFor(actor: RoomActor, action: "VIEW_CASE_ROOM" | "OPERATE_CASE_ROOM", caseId: string) {
    if (actor.proxyAuthority) return { mandateId: `connector-map:${actor.proxyAuthority.mappingId}` };
    return this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action, scopeType: "TRANSACTION_CASE", scopeRef: caseId });
  }

  private stepUpReference(actor: RoomActor, value: unknown): string {
    return actor.proxyAuthority ? `connector-request:${actor.proxyAuthority.requestId}` : required(value, "stepUpEvidenceId", 160);
  }

  private async consumeStepUp(tx: Prisma.TransactionClient, actor: RoomActor, evidenceId: string, purpose: "ROOM_CREATE" | "ROOM_INVITE" | "ROOM_ACCEPT" | "ROOM_CLOSE") {
    if (actor.proxyAuthority) return;
    await this.stepUp.consume({ evidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose, institutionId: actor.actingInstitutionId }, tx);
  }

  private async loadSerializableRoom(roomId: string) {
    const room = await this.db.caseRoom.findUniqueOrThrow({ where: { id: roomId }, include: {
      grants: { orderBy: { createdAt: "asc" } }, accessEvents: { orderBy: { sequence: "asc" } },
      messages: { orderBy: [{ occurredAt: "asc" }, { id: "asc" }] },
    } });
    return { ...room, accessEvents: room.accessEvents.map((event) => ({ ...event, sequence: event.sequence.toString() })) };
  }
}
