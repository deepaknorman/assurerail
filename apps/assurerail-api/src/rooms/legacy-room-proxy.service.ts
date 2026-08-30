import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { sha256Digest } from "../contracts/v1";
import { ConnectorRequestAuthService, type SignedConnectorRequest } from "../integrations/connector-request-auth.service";
import { ConnectorSubjectMappingService, LEGACY_PROXY_ACTIONS, type LegacyProxyAction } from "../integrations/connector-subject-mapping.service";
import { PersistenceFoundationService } from "../persistence/persistence-foundation.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { PrismaService } from "../store/prisma.service";
import { ActiveRoomsService } from "./active-rooms.service";
import type { RoomActor } from "./room-authority.service";

const LEGACY_PROXY_PROFILE = "assurerail.legacy-room-proxy.v1";

function required(value: unknown, name: string, max = 2_000): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("payload must be an object");
  return value as Record<string, unknown>;
}

function action(value: unknown): LegacyProxyAction {
  const result = required(value, "action", 80) as LegacyProxyAction;
  if (!LEGACY_PROXY_ACTIONS.includes(result)) throw new BadRequestException("unsupported legacy room proxy action");
  return result;
}

type AuthenticatedConnector = Awaited<ReturnType<ConnectorRequestAuthService["authenticate"]>>;

/**
 * Narrow compatibility boundary for the existing AssureLocker room screens. A signed connector
 * request is evidence of the caller supplied by the old runtime; a separately approved subject
 * mapping is what authorises that subject to act for a Rail institution and case.
 */
@Injectable()
export class LegacyRoomProxyService {
  constructor(
    private readonly db: PrismaService,
    private readonly auth: ConnectorRequestAuthService,
    private readonly mappings: ConnectorSubjectMappingService,
    private readonly persistence: PersistenceFoundationService,
    private readonly rooms: ActiveRoomsService,
  ) {}

  async handle(req: SignedConnectorRequest, rawBody: unknown) {
    const flags = inspectPersistenceFlags(process.env);
    if (flags.legacyRoomProxy !== "shadow" || flags.roomReadSource !== "rail" || flags.roomWriteSource !== "rail") {
      throw new ForbiddenException("legacy room compatibility proxy is disabled");
    }
    const body = object(rawBody);
    const requestedAction = action(body.action);
    const externalSubjectRef = required(body.externalSubjectRef, "externalSubjectRef", 500);
    const externalActorRef = required(body.externalActorRef, "externalActorRef", 500);
    const payload = object(body.payload ?? {});
    const authenticated = await this.auth.authenticate(req, LEGACY_PROXY_PROFILE);
    await this.persistence.receiveInbox({
      providerReferenceId: authenticated.connector.providerReferenceId!,
      externalMessageId: authenticated.requestId,
      idempotencyKey: authenticated.requestId,
      schemaId: "assurerail.legacy-room-proxy.command",
      schemaVersion: "1.0.0",
      payload: body,
      signatureStatus: "VERIFIED",
    });
    const identity = await this.mappings.resolveIdentity(authenticated.connector.id, externalSubjectRef);

    if (requestedAction === "LIST_ROOMS") {
      return this.list(authenticated, identity.institutionId, externalSubjectRef, externalActorRef);
    }

    const caseId = await this.resolveCaseId(identity.institutionId, requestedAction, payload);
    if (!caseId) return { routed: false, writeSource: "LEGACY", reason: "NO_ACTIVE_RAIL_COHORT" };
    const mapping = await this.mappings.resolve(authenticated.connector.id, externalSubjectRef, requestedAction, caseId);
    const actor = this.proxyActor(authenticated, mapping.id, mapping.institutionId, externalActorRef, requestedAction);

    switch (requestedAction) {
      case "CREATE_ROOM": {
        if (payload.legacyPurpose !== undefined && payload.legacyPurpose !== "DA") {
          throw new BadRequestException("Rail cutover currently supports AssurePool DA rooms only; PTC remains outside PR-08");
        }
        const sourceReference = await this.resolveSource(caseId, required(payload.sourceObjectId, "payload.sourceObjectId", 500));
        const room = await this.rooms.create(actor, caseId, {
          idempotencyKey: authenticated.requestId,
          sourceReferenceId: sourceReference.id,
          purpose: "PASSIVE_DILIGENCE",
          reason: required(payload.reason ?? "legacy room compatibility cutover", "payload.reason", 1_000),
        });
        return this.roomView(room.id, mapping.institutionId);
      }
      case "INVITE": {
        const roomId = required(payload.roomId, "payload.roomId", 200);
        const targetExternalSubjectRef = required(payload.targetExternalSubjectRef, "payload.targetExternalSubjectRef", 500);
        const target = await this.mappings.resolveIdentity(authenticated.connector.id, targetExternalSubjectRef);
        const expiresAt = typeof payload.expiresAt === "string"
          ? payload.expiresAt
          : new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
        const result = await this.rooms.invite(actor, caseId, roomId, {
          institutionId: target.institutionId,
          idempotencyKey: authenticated.requestId,
          expiresAt,
          authorityEvidenceRef: `signed-connector-request:${authenticated.requestId}`,
        });
        return {
          ...result,
          invitationLink: result.invitationToken
            ? `/transfer-room/${encodeURIComponent(result.invitationToken)}`
            : null,
        };
      }
      case "INVITATION_CONTEXT": {
        const token = required(payload.invitationToken, "payload.invitationToken", 500);
        const result = await this.rooms.invitationContext(actor, token);
        const room = await this.roomView(result.roomId, mapping.institutionId);
        return { ...result, room };
      }
      case "ACCEPT_INVITATION":
        return this.rooms.acceptInvitation(actor, required(payload.invitationToken, "payload.invitationToken", 500), {
          classification: required(payload.classification, "payload.classification", 160),
          declarationAccepted: true,
          relianceAccepted: true,
          declarationEvidenceText: typeof payload.declarationEvidenceText === "string" ? payload.declarationEvidenceText : undefined,
          idempotencyKey: authenticated.requestId,
        });
      case "READ_ROOM":
        return this.roomView(required(payload.roomId, "payload.roomId", 200), mapping.institutionId, actor);
      case "READ_SOURCE":
        return this.rooms.sourceView(actor, caseId, required(payload.roomId, "payload.roomId", 200), required(payload.view, "payload.view", 80));
      case "READ_MESSAGES":
        return this.rooms.messages(actor, caseId, required(payload.roomId, "payload.roomId", 200));
      case "POST_MESSAGE":
        return this.rooms.postMessage(actor, caseId, required(payload.roomId, "payload.roomId", 200), {
          body: required(payload.body, "payload.body", 20_000), idempotencyKey: authenticated.requestId,
        });
      case "CLOSE_ROOM":
        return this.rooms.close(actor, caseId, required(payload.roomId, "payload.roomId", 200), {
          outcome: payload.outcome === "WITHDRAWN" ? "WITHDRAWN" : "COMPLETED",
          reason: required(payload.reason ?? payload.outcome ?? "COMPLETED", "payload.reason", 1_000),
          idempotencyKey: authenticated.requestId,
        });
      case "EXPORT_DOSSIER":
        return this.rooms.recordExport(actor, caseId, required(payload.roomId, "payload.roomId", 200), required(payload.exportDigest, "payload.exportDigest", 80));
    }
  }

  private async list(authenticated: AuthenticatedConnector, institutionId: string, externalSubjectRef: string, externalActorRef: string) {
    const cases = await this.db.transactionCase.findMany({
      where: {
        OR: [{ ownerInstitutionId: institutionId }, { parties: { some: { institutionId, status: "ACTIVE" } } }],
        roomAuthority: { is: { writeSource: "RAIL", state: "ACTIVE" } },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    const rows: unknown[] = [];
    for (const transactionCase of cases) {
      let mapping;
      try {
        mapping = await this.mappings.resolve(authenticated.connector.id, externalSubjectRef, "LIST_ROOMS", transactionCase.id);
      } catch (error) {
        if (error instanceof ForbiddenException) continue;
        throw error;
      }
      const actor = this.proxyActor(authenticated, mapping.id, institutionId, externalActorRef, "LIST_ROOMS");
      const rooms = await this.rooms.list(actor, transactionCase.id);
      for (const room of rooms) rows.push(await this.roomView(room.id, institutionId));
    }
    return { rooms: rows };
  }

  private async resolveCaseId(institutionId: string, requestedAction: LegacyProxyAction, payload: Record<string, unknown>): Promise<string | null> {
    if (typeof payload.caseId === "string" && payload.caseId.trim()) return payload.caseId.trim();
    if (["READ_ROOM", "READ_SOURCE", "READ_MESSAGES", "POST_MESSAGE", "INVITE", "CLOSE_ROOM", "EXPORT_DOSSIER"].includes(requestedAction)) {
      const room = await this.db.caseRoom.findUnique({ where: { id: required(payload.roomId, "payload.roomId", 200) } });
      if (!room) throw new NotFoundException("case room not found");
      return room.transactionCaseId;
    }
    if (["INVITATION_CONTEXT", "ACCEPT_INVITATION"].includes(requestedAction)) {
      const token = required(payload.invitationToken, "payload.invitationToken", 500);
      const grant = await this.db.roomGrant.findUnique({
        where: { invitationDigest: sha256Digest({ purpose: "ROOM_INVITATION", token }) },
        include: { caseRoom: true },
      });
      if (!grant || grant.granteeInstitutionId !== institutionId) throw new NotFoundException("room invitation not found");
      return grant.caseRoom.transactionCaseId;
    }
    if (requestedAction === "CREATE_ROOM") {
      const sourceObjectId = required(payload.sourceObjectId, "payload.sourceObjectId", 500);
      const sources = await this.db.sourceReference.findMany({
        where: { sourceObjectId, transactionCaseId: { not: null } },
        select: { transactionCaseId: true },
      });
      const caseIds = [...new Set(sources.map((item) => item.transactionCaseId).filter((value): value is string => Boolean(value)))];
      const eligible: string[] = [];
      for (const caseId of caseIds) {
        const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId }, include: { parties: true, roomAuthority: true } });
        if (transactionCase && (transactionCase.ownerInstitutionId === institutionId || transactionCase.parties.some((item) => item.institutionId === institutionId && item.status === "ACTIVE"))
          && transactionCase.roomAuthority?.writeSource === "RAIL" && transactionCase.roomAuthority.state === "ACTIVE") eligible.push(caseId);
      }
      if (eligible.length === 0) return null;
      if (eligible.length !== 1) throw new ConflictException("source object maps to more than one active Rail case");
      return eligible[0];
    }
    throw new BadRequestException("caseId cannot be resolved for this proxy action");
  }

  private async resolveSource(caseId: string, sourceObjectId: string) {
    const sources = await this.db.sourceReference.findMany({ where: { transactionCaseId: caseId, sourceObjectId } });
    if (sources.length !== 1) throw new ConflictException(sources.length ? "source object version is ambiguous" : "source object is not retained for this case");
    return sources[0];
  }

  private proxyActor(authenticated: AuthenticatedConnector, mappingId: string, institutionId: string, externalActorRef: string, requestedAction: LegacyProxyAction): RoomActor {
    return {
      actorUserId: `external_${sha256Digest({ externalActorRef }).slice(7, 39)}`,
      actingInstitutionId: institutionId,
      actorSessionId: `connector:${authenticated.requestId}`,
      proxyAuthority: { connectorId: authenticated.connector.id, mappingId, requestId: authenticated.requestId, externalActorRef, action: requestedAction },
    };
  }

  private async roomView(roomId: string, actingInstitutionId: string, actor?: RoomActor) {
    const room = await this.db.caseRoom.findUnique({
      where: { id: roomId },
      include: { transactionCase: { include: { ownerInstitution: true } }, sourceReference: true, grants: true, accessEvents: { orderBy: { sequence: "asc" } } },
    });
    if (!room) throw new NotFoundException("case room not found");
    if (actor) await this.rooms.get(actor, room.transactionCaseId, room.id);
    const owner = room.transactionCase.ownerInstitutionId === actingInstitutionId;
    const myGrant = room.grants.find((item) => item.granteeInstitutionId === actingInstitutionId);
    return {
      id: room.id,
      caseId: room.transactionCaseId,
      poolId: room.sourceReference?.sourceObjectId ?? room.legacyPoolId,
      claId: room.legacyClaId,
      manifestHash: room.sourceManifestDigest,
      transferorDid: room.transactionCase.ownerInstitution.legacyEntityRef ?? room.transactionCase.ownerInstitution.id,
      purpose: room.transactionCase.transactionRoute === "DA" ? "DA" : "PTC_DATA_ROOM",
      status: room.status === "CLOSED" && room.closeReason === "WITHDRAWN" ? "WITHDRAWN" : room.status,
      openedAt: room.openedAt,
      closedAt: room.closedAt,
      createdAt: room.createdAt,
      role: owner ? "TRANSFEROR" : "TRANSFEREE",
      inviteCount: owner ? room.grants.length : undefined,
      invite: myGrant ?? undefined,
      invites: owner ? room.grants : undefined,
      accessLog: owner ? room.accessEvents.map((event) => ({ ...event, sequence: event.sequence.toString() })) : undefined,
    };
  }
}
