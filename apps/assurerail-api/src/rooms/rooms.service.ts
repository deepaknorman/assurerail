import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { audit } from "../common/audit";
import { sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { PrismaService } from "../store/prisma.service";
import {
  assertLegacyRoomRefreshExtendsPrior,
  legacyRoomChainTail,
  legacyRoomCounts,
  parseLegacyRoomExportBundle,
  type LegacyRoomExportBundleV1,
  type LegacyRoomExportV1,
} from "./legacy-room-contract";
import { DARK_IMPORTED_GRANT_STATUS, PASSIVE_ROOM_POLICY_VERSION, mapLegacyRoomPurpose } from "./room-policy";
import { ROOM_SOURCE_VIEWS, RoomSourceAdapterService, type RoomSourceView } from "./room-source-adapters";

type Actor = { actorUserId: string; actingInstitutionId: string; actorSessionId: string };
type Mapping = { legacyDid: string; institutionId: string };
type Comparison = { dimension: string; matched: boolean; expected: unknown; observed: unknown; severity: "HIGH" | "MEDIUM" };

function enabled(): void {
  const flags = inspectPersistenceFlags(process.env);
  if (flags.transactionCase !== "shadow" || flags.roomReadSource !== "compare" || flags.roomWriteSource !== "legacy") {
    throw new ForbiddenException("Rail room comparison is disabled; legacy remains the only write authority");
  }
}

function required(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue;
}

function comparison(dimension: string, expected: unknown, observed: unknown, severity: "HIGH" | "MEDIUM" = "HIGH"): Comparison {
  return { dimension, matched: sha256Digest(expected) === sha256Digest(observed), expected, observed, severity };
}

function uniqueConstraint(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
    private readonly sources: RoomSourceAdapterService,
  ) {}

  async list(actor: Actor, caseId: string) {
    await this.requireOwner(actor, caseId, "VIEW_CASE_ROOM");
    const rooms = await this.db.caseRoom.findMany({
      where: { transactionCaseId: caseId }, orderBy: { createdAt: "asc" },
      include: { grants: { orderBy: { createdAt: "asc" } }, legacyImports: { orderBy: { importVersion: "desc" }, take: 1, include: { parityRuns: { orderBy: { runAt: "desc" }, take: 1 } } } },
    });
    return rooms.map((room) => ({ ...room, legacyImport: room.legacyImports[0] ?? null, legacyImports: undefined }));
  }

  async get(actor: Actor, caseId: string, roomId: string) {
    await this.requireOwner(actor, caseId, "VIEW_CASE_ROOM");
    const room = await this.loadRoom(caseId, roomId);
    return {
      ...room,
      accessEvents: room.accessEvents.map((event) => ({ ...event, sequence: event.sequence.toString() })),
      legacyImport: room.legacyImports[0] ?? null,
      legacyImports: undefined,
    };
  }

  async sourceView(actor: Actor, caseId: string, roomId: string, viewValue: string) {
    await this.requireOwner(actor, caseId, "VIEW_CASE_ROOM");
    await this.loadRoom(caseId, roomId);
    const view = required(viewValue, "view", 80).toUpperCase() as RoomSourceView;
    if (!ROOM_SOURCE_VIEWS.includes(view)) throw new BadRequestException(`view must be one of: ${ROOM_SOURCE_VIEWS.join(", ")}`);
    return this.sources.view(roomId, view);
  }

  async messages(actor: Actor, caseId: string, roomId: string) {
    await this.requireOwner(actor, caseId, "VIEW_CASE_ROOM");
    await this.loadRoom(caseId, roomId);
    return this.db.roomMessage.findMany({ where: { caseRoomId: roomId }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] });
  }

  async accessEvents(actor: Actor, caseId: string, roomId: string) {
    await this.requireOwner(actor, caseId, "VIEW_CASE_ROOM");
    await this.loadRoom(caseId, roomId);
    const events = await this.db.roomAccessEvent.findMany({ where: { caseRoomId: roomId }, orderBy: { sequence: "asc" } });
    return events.map((event) => ({ ...event, sequence: event.sequence.toString() }));
  }

  async compatibility(actor: Actor, caseId: string, roomId: string) {
    await this.requireOwner(actor, caseId, "VIEW_CASE_ROOM");
    const room = await this.loadRoom(caseId, roomId);
    const latest = room.legacyImports[0] ?? null;
    const sealedRoom = latest?.sealedExport && typeof latest.sealedExport === "object" && !Array.isArray(latest.sealedExport)
      ? (latest.sealedExport as Record<string, unknown>).room as Record<string, unknown> | undefined
      : undefined;
    return {
      id: room.legacyRoomId ?? room.id,
      poolId: room.legacyPoolId,
      claId: room.legacyClaId,
      manifestHash: room.sourceManifestDigest,
      transferorDid: sealedRoom?.transferorDid ?? null,
      purpose: room.legacyPurpose,
      status: sealedRoom?.status ?? room.status,
      relianceTextVersion: sealedRoom?.relianceTextVersion ?? null,
      declarationTextVersion: sealedRoom?.declarationTextVersion ?? null,
      openedAt: room.openedAt,
      closedAt: room.closedAt,
      createdAt: room.createdAt,
      migration: {
        readSource: "compare",
        writeSource: "legacy",
        importStatus: latest?.status ?? "NOT_IMPORTED",
        importVersion: latest?.importVersion ?? null,
        exportDigest: latest?.exportDigest ?? null,
      },
    };
  }

  async importLegacy(actor: Actor, caseId: string, body: {
    batchId?: string; sourceReferenceId?: string; participantMappings?: Mapping[]; bundle?: unknown; stepUpEvidenceId?: string;
  }) {
    const authority = await this.requireOwner(actor, caseId, "REVIEW_ROOM_MIGRATION");
    const bundle = this.parseBundle(body.bundle);
    const existing = await this.db.legacyRoomImport.findUnique({
      where: { sourceSystem_legacyRoomId_exportDigest: { sourceSystem: bundle.export.source.system, legacyRoomId: bundle.export.room.id, exportDigest: bundle.exportDigest } },
      include: { caseRoom: true, migrationReceipt: true },
    });
    if (existing) {
      if (existing.caseRoom.transactionCaseId !== caseId) throw new ConflictException("legacy room snapshot belongs to another transaction case");
      return existing;
    }
    const prior = await this.db.legacyRoomImport.findFirst({
      where: { sourceSystem: bundle.export.source.system, legacyRoomId: bundle.export.room.id },
      orderBy: { importVersion: "desc" }, include: { caseRoom: true },
    });
    if (prior && prior.caseRoom.transactionCaseId !== caseId) throw new ConflictException("legacy room identity belongs to another transaction case");
    if (prior) {
      try { assertLegacyRoomRefreshExtendsPrior(prior.sealedExport as unknown as LegacyRoomExportV1, bundle.export); }
      catch (error) { throw new ConflictException((error as Error).message); }
    }
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId }, include: { parties: true } });
    if (!transactionCase) throw new NotFoundException("transaction case not found");
    const sourceReferenceId = required(body.sourceReferenceId, "sourceReferenceId", 200);
    const sourceReference = await this.db.sourceReference.findUnique({ where: { id: sourceReferenceId } });
    if (!sourceReference || sourceReference.transactionCaseId !== caseId) throw new BadRequestException("source reference must belong to this transaction case");
    if (sourceReference.sourceObjectId !== bundle.export.room.poolId) throw new BadRequestException("source reference does not identify the legacy room pool");
    if (sourceReference.sourceObjectType === "FROZEN_ASSET_TAPE" && transactionCase.transactionRoute !== "DA") {
      throw new BadRequestException("an AssurePool frozen DA tape cannot establish PTC route capability");
    }
    if (prior && prior.caseRoom.sourceReferenceId !== sourceReferenceId) throw new ConflictException("legacy room refresh cannot change its source reference");
    const mappings = this.validateMappings(body.participantMappings, bundle.export, transactionCase.ownerInstitutionId, transactionCase.parties);
    if (prior) {
      const existingGrants = await this.db.roomGrant.findMany({ where: { caseRoomId: prior.caseRoomId } });
      for (const grant of existingGrants) {
        const mapped = grant.legacyTransfereeDid ? mappings.get(grant.legacyTransfereeDid) : null;
        if (!mapped || mapped !== grant.granteeInstitutionId) throw new ConflictException("legacy DID-to-institution mapping changed across import versions");
      }
    }
    const batchId = required(body.batchId, "batchId", 200);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const counts = legacyRoomCounts(bundle.export);
    const roomCollision = prior ? null : await this.db.caseRoom.findUnique({ where: { id: bundle.export.room.id } });
    const caseRoomId = prior?.caseRoomId ?? (roomCollision ? `room_${randomUUID()}` : bundle.export.room.id);
    const importVersion = (prior?.importVersion ?? 0) + 1;
    const receiptBatchId = `${batchId}#${sha256Digest({
      sourceSystem: bundle.export.source.system,
      legacyRoomId: bundle.export.room.id,
      importVersion,
    }).slice(-16)}`;
    const receiptDigest = sha256Digest({ batchId, migrationName: "assurerail-pr07-legacy-room-import", caseId, caseRoomId, exportDigest: bundle.exportDigest, counts, sourceHighWaterMark: bundle.export.source.highWaterMark, actorUserId: actor.actorUserId });
    const created = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "ROOM_LEGACY_IMPORT", institutionId: actor.actingInstitutionId }, tx);
      const receipt = await tx.migrationReceipt.create({ data: {
        id: `migr_${randomUUID()}`, batchId: receiptBatchId, migrationName: "assurerail-pr07-legacy-room-import",
        sourceSystem: bundle.export.source.system, sourceHighWaterMark: bundle.export.source.highWaterMark,
        sourceCount: counts.total, targetCount: counts.total, sourceDigest: bundle.exportDigest, targetDigest: bundle.exportDigest,
        operatorRef: actor.actorUserId, reviewerRef: null, status: "VERIFIED", institutionId: actor.actingInstitutionId,
        transactionCaseId: caseId, completedAt: new Date(), receiptDigest,
      } });
      const room = prior
        ? await tx.caseRoom.update({ where: { id: caseRoomId }, data: {
          legacySourceVersion: bundle.export.source.version,
          closedAt: bundle.export.room.closedAt ? new Date(bundle.export.room.closedAt) : null,
          aggregateVersion: { increment: 1 },
        } })
        : await tx.caseRoom.create({ data: {
          id: caseRoomId, transactionCaseId: caseId, purpose: mapLegacyRoomPurpose(bundle.export.room.purpose),
          policyVersion: PASSIVE_ROOM_POLICY_VERSION, sourceReferenceId, sourceManifestDigest: bundle.export.room.manifestHash,
          status: "DARK_IMPORTED", legacyRoomId: bundle.export.room.id, legacyPoolId: bundle.export.room.poolId,
          legacyClaId: bundle.export.room.claId, legacyPurpose: bundle.export.room.purpose,
          legacySourceSystem: bundle.export.source.system, legacySourceVersion: bundle.export.source.version,
          openedAt: bundle.export.room.openedAt ? new Date(bundle.export.room.openedAt) : null,
          closedAt: bundle.export.room.closedAt ? new Date(bundle.export.room.closedAt) : null,
          createdByUserId: actor.actorUserId, createdByMandateId: authority.mandateId!,
        } });
      for (const invite of bundle.export.invites) {
        const institutionId = mappings.get(invite.transfereeDid)!;
        await tx.roomGrant.upsert({
          where: { caseRoomId_legacyInviteId: { caseRoomId, legacyInviteId: invite.id } },
          create: {
            id: `rgrant_${randomUUID()}`, caseRoomId, granteeInstitutionId: institutionId, purpose: "PASSIVE_DILIGENCE",
            classification: invite.eligibilityCategory ?? "LEGACY_UNCLASSIFIED", status: DARK_IMPORTED_GRANT_STATUS,
            declarationTextVersion: bundle.export.room.declarationTextVersion, relianceTextVersion: bundle.export.room.relianceTextVersion,
            declarationDigest: invite.declarationHash, declarationAt: invite.declarationAt ? new Date(invite.declarationAt) : null,
            relianceAcceptedAt: invite.relianceAcceptedAt ? new Date(invite.relianceAcceptedAt) : null,
            legacyInviteId: invite.id, legacyTransfereeDid: invite.transfereeDid, legacyStatus: invite.status,
            grantedByUserId: actor.actorUserId,
          },
          update: {
            classification: invite.eligibilityCategory ?? "LEGACY_UNCLASSIFIED", status: DARK_IMPORTED_GRANT_STATUS,
            declarationDigest: invite.declarationHash, declarationAt: invite.declarationAt ? new Date(invite.declarationAt) : null,
            relianceAcceptedAt: invite.relianceAcceptedAt ? new Date(invite.relianceAcceptedAt) : null,
            legacyStatus: invite.status,
          },
        });
      }
      for (const event of bundle.export.accessLog.slice((prior?.sourceCounts as { accessEvents?: number } | null)?.accessEvents ?? 0)) {
        await tx.roomAccessEvent.create({ data: {
          id: `racc_${randomUUID()}`, caseRoomId, sequence: BigInt(event.seq), chainOrigin: "LEGACY",
          hashRoomReference: event.roomId, actingInstitutionId: mappings.get(event.actorDid) ?? null,
          actorReference: event.actorDid, action: event.action, objectReference: event.objectRef,
          previousHash: event.prevHash, eventHash: event.entryHash, occurredAt: new Date(event.at),
        } });
      }
      for (const message of bundle.export.messages.slice((prior?.sourceCounts as { messages?: number } | null)?.messages ?? 0)) {
        await tx.roomMessage.create({ data: {
          id: `rmsg_${randomUUID()}`, caseRoomId, authorInstitutionId: mappings.get(message.authorDid) ?? null,
          authorReference: message.authorDid,
          authorRole: message.authorRole ?? (message.authorDid === bundle.export.room.transferorDid ? "TRANSFEROR" : "TRANSFEREE"),
          messageKind: message.authorDid === bundle.export.room.transferorDid ? "ANSWER" : "QUESTION",
          body: message.body, bodyDigest: sha256Digest({ body: message.body }), legacyMessageId: message.id,
          occurredAt: new Date(message.at),
        } });
      }
      const imported = await tx.legacyRoomImport.create({ data: {
        id: `rimport_${randomUUID()}`, caseRoomId, migrationReceiptId: receipt.id, migrationBatchId: batchId,
        sourceSystem: bundle.export.source.system, sourceVersion: bundle.export.source.version,
        legacyRoomId: bundle.export.room.id, importVersion, exportDigest: bundle.exportDigest,
        sourceHighWaterMark: bundle.export.source.highWaterMark, sourceCounts: json(counts),
        chainTailHash: legacyRoomChainTail(bundle.export), sealedExport: json(bundle.export), importedByUserId: actor.actorUserId,
      } });
      return { room, imported, receipt };
    }).catch(async (error) => {
      if (!uniqueConstraint(error)) throw error;
      const replay = await this.db.legacyRoomImport.findUnique({
        where: { sourceSystem_legacyRoomId_exportDigest: { sourceSystem: bundle.export.source.system, legacyRoomId: bundle.export.room.id, exportDigest: bundle.exportDigest } },
        include: { caseRoom: true, migrationReceipt: true },
      });
      if (replay?.caseRoom.transactionCaseId === caseId) return { room: replay.caseRoom, imported: replay, receipt: replay.migrationReceipt };
      throw new ConflictException("legacy import batch, room version or mirrored record conflicts with another operation");
    });
    audit("rail.room.legacy_imported", { actorUserId: actor.actorUserId, actingInstitutionId: actor.actingInstitutionId, caseId, caseRoomId, exportDigest: bundle.exportDigest, legacyRoomId: bundle.export.room.id });
    return created;
  }

  async runParity(actor: Actor, caseId: string, roomId: string, body: { currentBundle?: unknown; stepUpEvidenceId?: string }) {
    await this.requireOwner(actor, caseId, "REVIEW_ROOM_MIGRATION");
    const room = await this.loadRoom(caseId, roomId);
    const latest = room.legacyImports[0];
    if (!latest) throw new BadRequestException("room has no sealed legacy import");
    const current = this.parseBundle(body.currentBundle);
    if (current.export.room.id !== room.legacyRoomId || current.export.source.system !== latest.sourceSystem) {
      throw new BadRequestException("parity source does not identify the imported legacy room");
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const comparisons = this.compare(current, room);
    const mismatches = comparisons.filter((item) => !item.matched);
    const observedSnapshotDigest = sha256Digest(comparisons.map(({ dimension, observed }) => ({ dimension, observed })));
    const result = mismatches.length === 0 ? "MATCHED" : "BREAK_OPEN";
    const run = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "ROOM_PARITY_REVIEW", institutionId: actor.actingInstitutionId }, tx);
      const created = await tx.roomParityRun.create({ data: {
        id: `rparity_${randomUUID()}`, legacyRoomImportId: latest.id,
        expectedExportDigest: current.exportDigest, observedSnapshotDigest, result,
        comparisons: json(comparisons), mismatchCount: mismatches.length, runByUserId: actor.actorUserId,
        breaks: { create: mismatches.map((item) => ({
          id: `rbreak_${randomUUID()}`, dimension: item.dimension, severity: item.severity,
          expected: json(item.expected), observed: json(item.observed),
        })) },
      }, include: { breaks: true } });
      await tx.legacyRoomImport.update({ where: { id: latest.id }, data: {
        status: result === "MATCHED" ? "PARITY_MATCHED" : "BREAK_OPEN",
        reviewedByUserId: actor.actorUserId, reviewedAt: new Date(),
      } });
      if (mismatches.length) {
        await tx.caseRoom.update({ where: { id: room.id }, data: { status: "BLOCKED", aggregateVersion: { increment: 1 } } });
      } else {
        const unresolved = await tx.roomParityBreak.count({ where: {
          status: { in: ["OPEN", "REPAIR_IN_PROGRESS"] }, roomParityRun: { legacyRoomImport: { caseRoomId: room.id } },
        } });
        if (unresolved === 0) await tx.caseRoom.updateMany({ where: { id: room.id, status: "BLOCKED" }, data: { status: "DARK_IMPORTED", aggregateVersion: { increment: 1 } } });
      }
      return created;
    });
    audit("rail.room.parity_run", { actorUserId: actor.actorUserId, actingInstitutionId: actor.actingInstitutionId, caseId, roomId, result, mismatchCount: mismatches.length });
    return run;
  }

  async openBreaks(actor: Actor, caseId: string) {
    await this.requireOwner(actor, caseId, "REVIEW_ROOM_MIGRATION");
    return this.db.roomParityBreak.findMany({
      where: { status: { in: ["OPEN", "REPAIR_IN_PROGRESS"] }, roomParityRun: { legacyRoomImport: { caseRoom: { transactionCaseId: caseId } } } },
      orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
    });
  }

  async resolveBreak(actor: Actor, caseId: string, breakId: string, body: {
    ownerReference?: string; resolutionEvidence?: unknown; stepUpEvidenceId?: string;
  }) {
    await this.requireOwner(actor, caseId, "REVIEW_ROOM_MIGRATION");
    const current = await this.db.roomParityBreak.findUnique({ where: { id: breakId }, include: {
      roomParityRun: { include: { legacyRoomImport: { include: { caseRoom: true } } } },
    } });
    if (!current || current.roomParityRun.legacyRoomImport.caseRoom.transactionCaseId !== caseId) throw new NotFoundException("parity break not found");
    if (current.status === "RESOLVED") return current;
    if (current.roomParityRun.runByUserId === actor.actorUserId) throw new ForbiddenException("the parity runner cannot independently close their own break");
    const ownerReference = required(body.ownerReference, "ownerReference", 300);
    if (!body.resolutionEvidence || typeof body.resolutionEvidence !== "object" || Array.isArray(body.resolutionEvidence)) {
      throw new BadRequestException("resolutionEvidence must be an object with retained repair evidence");
    }
    const resolutionEvidence = json(body.resolutionEvidence);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const roomId = current.roomParityRun.legacyRoomImport.caseRoomId;
    const resolved = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "ROOM_PARITY_REVIEW", institutionId: actor.actingInstitutionId }, tx);
      const changed = await tx.roomParityBreak.updateMany({ where: { id: breakId, status: { in: ["OPEN", "REPAIR_IN_PROGRESS"] } }, data: {
        status: "RESOLVED", ownerReference, resolutionEvidence, resolvedByUserId: actor.actorUserId, resolvedAt: new Date(),
      } });
      if (changed.count !== 1) throw new ConflictException("parity break was concurrently resolved");
      const open = await tx.roomParityBreak.count({ where: {
        status: { in: ["OPEN", "REPAIR_IN_PROGRESS"] }, roomParityRun: { legacyRoomImport: { caseRoomId: roomId } },
      } });
      const latestImport = await tx.legacyRoomImport.findFirst({ where: { caseRoomId: roomId }, orderBy: { importVersion: "desc" }, include: { parityRuns: { orderBy: { runAt: "desc" }, take: 1 } } });
      if (open === 0 && latestImport?.parityRuns[0]?.result === "MATCHED") {
        await tx.caseRoom.updateMany({ where: { id: roomId, status: "BLOCKED" }, data: { status: "DARK_IMPORTED", aggregateVersion: { increment: 1 } } });
      }
      return tx.roomParityBreak.findUniqueOrThrow({ where: { id: breakId } });
    });
    audit("rail.room.parity_break_resolved", { actorUserId: actor.actorUserId, actingInstitutionId: actor.actingInstitutionId, caseId, roomId, breakId, ownerReference });
    return resolved;
  }

  private parseBundle(value: unknown): LegacyRoomExportBundleV1 {
    try { return parseLegacyRoomExportBundle(value); }
    catch (error) { throw new BadRequestException((error as Error).message); }
  }

  private validateMappings(value: unknown, exported: LegacyRoomExportV1, ownerInstitutionId: string, parties: Array<{ institutionId: string; status: string }>) {
    if (!Array.isArray(value)) throw new BadRequestException("participantMappings must be an array");
    const mappings = new Map<string, string>();
    const institutions = new Set<string>();
    for (const [index, raw] of value.entries()) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException(`participantMappings[${index}] must be an object`);
      const item = raw as Record<string, unknown>;
      const legacyDid = required(item.legacyDid, `participantMappings[${index}].legacyDid`, 500);
      const institutionId = required(item.institutionId, `participantMappings[${index}].institutionId`, 160);
      if (mappings.has(legacyDid) || institutions.has(institutionId)) throw new BadRequestException("participant mappings must be one-to-one");
      mappings.set(legacyDid, institutionId); institutions.add(institutionId);
    }
    const requiredDids = new Set([exported.room.transferorDid, ...exported.invites.map((item) => item.transfereeDid)]);
    if ([...requiredDids].some((did) => !mappings.has(did))) throw new BadRequestException("every transferor and invited transferee DID requires an explicit institution mapping");
    if (mappings.get(exported.room.transferorDid) !== ownerInstitutionId) throw new BadRequestException("legacy transferor must map to the case owner institution");
    const active = new Set([ownerInstitutionId, ...parties.filter((item) => item.status === "ACTIVE").map((item) => item.institutionId)]);
    if ([...mappings.values()].some((institutionId) => !active.has(institutionId))) throw new BadRequestException("every mapped institution must be an active case party");
    return mappings;
  }

  private compare(current: LegacyRoomExportBundleV1, room: Awaited<ReturnType<RoomsService["loadRoom"]>>): Comparison[] {
    const latest = room.legacyImports[0] ?? null;
    const grants = [...room.grants].sort((left, right) => (left.legacyInviteId ?? "").localeCompare(right.legacyInviteId ?? ""));
    const events = [...room.accessEvents].sort((left, right) => left.sequence < right.sequence ? -1 : left.sequence > right.sequence ? 1 : 0);
    const messages = [...room.messages].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime() || left.id.localeCompare(right.id));
    return [
      comparison("export.digest", current.exportDigest, latest?.exportDigest),
      comparison("room.status", current.export.room.status, this.sealedRoom(latest?.sealedExport)?.status ?? null),
      comparison("room.binding", {
        roomId: current.export.room.id, poolId: current.export.room.poolId, claId: current.export.room.claId,
        manifestHash: current.export.room.manifestHash, purpose: current.export.room.purpose,
      }, {
        roomId: room.legacyRoomId, poolId: room.legacyPoolId, claId: room.legacyClaId,
        manifestHash: room.sourceManifestDigest, purpose: room.legacyPurpose,
      }),
      comparison("grants.and.declarations", current.export.invites.map((item) => ({
        id: item.id, did: item.transfereeDid, status: item.status, classification: item.eligibilityCategory,
        declarationHash: item.declarationHash, declarationAt: item.declarationAt, relianceAcceptedAt: item.relianceAcceptedAt,
      })), grants.map((item) => ({
        id: item.legacyInviteId, did: item.legacyTransfereeDid, status: item.legacyStatus, classification: item.classification === "LEGACY_UNCLASSIFIED" ? null : item.classification,
        declarationHash: item.declarationDigest, declarationAt: item.declarationAt?.toISOString() ?? null,
        relianceAcceptedAt: item.relianceAcceptedAt?.toISOString() ?? null,
      }))),
      comparison("messages.order.and.content", current.export.messages.map((item) => ({ id: item.id, authorDid: item.authorDid, at: item.at, bodyDigest: sha256Digest({ body: item.body }) })),
        messages.map((item) => ({ id: item.legacyMessageId, authorDid: item.authorReference, at: item.occurredAt.toISOString(), bodyDigest: item.bodyDigest }))),
      comparison("access.chain", { count: current.export.accessLog.length, tail: legacyRoomChainTail(current.export), hashes: current.export.accessLog.map((item) => item.entryHash) },
        { count: events.length, tail: events.at(-1)?.eventHash ?? "GENESIS", hashes: events.map((item) => item.eventHash) }),
      comparison("source.manifest", current.export.sourceSnapshot.manifestHash, room.sourceManifestDigest),
      comparison("authorization.mapping", current.export.invites.map((item) => item.transfereeDid).sort(), grants.map((item) => item.legacyTransfereeDid).filter(Boolean).sort(), "HIGH"),
    ];
  }

  private sealedRoom(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const room = (value as Record<string, unknown>).room;
    return room && typeof room === "object" && !Array.isArray(room) ? room as Record<string, unknown> : null;
  }

  private async requireOwner(actor: Actor, caseId: string, action: "VIEW_CASE_ROOM" | "REVIEW_ROOM_MIGRATION") {
    enabled();
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId } });
    if (!transactionCase || transactionCase.ownerInstitutionId !== actor.actingInstitutionId) throw new NotFoundException("transaction case not found");
    return this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action, scopeType: "TRANSACTION_CASE", scopeRef: caseId });
  }

  private async loadRoom(caseId: string, roomId: string) {
    const room = await this.db.caseRoom.findUnique({ where: { id: roomId }, include: {
      grants: { orderBy: { createdAt: "asc" } }, accessEvents: { orderBy: { sequence: "asc" } },
      messages: { orderBy: [{ occurredAt: "asc" }, { id: "asc" }] },
      legacyImports: { orderBy: { importVersion: "desc" }, include: { parityRuns: { orderBy: { runAt: "desc" }, include: { breaks: true } } } },
    } });
    if (!room || room.transactionCaseId !== caseId) throw new NotFoundException("case room not found");
    return room;
  }
}
