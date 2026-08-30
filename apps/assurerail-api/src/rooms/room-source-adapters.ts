import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../store/prisma.service";
import { redactPassiveRoomView } from "./room-policy";

export const ROOM_SOURCE_VIEWS = ["SUMMARY", "TAPE", "FINDINGS", "DOSSIER_METADATA"] as const;
export type RoomSourceView = (typeof ROOM_SOURCE_VIEWS)[number];

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * Provider-neutral room source projection. AssurePool is one supported evidence profile; the room
 * never calls CoLendingService, borrows a CLA identity, or treats provider capability as verified.
 */
@Injectable()
export class RoomSourceAdapterService {
  constructor(private readonly db: PrismaService) {}

  async view(caseRoomId: string, view: RoomSourceView) {
    const room = await this.db.caseRoom.findUnique({
      where: { id: caseRoomId },
      include: {
        sourceReference: {
          include: { intakeSubmissions: { where: { validationStatus: "VALID" }, orderBy: { receivedAt: "desc" }, take: 1 } },
        },
      },
    });
    if (!room?.sourceReference) throw new NotFoundException("room source reference is unavailable");
    const intake = room.sourceReference.intakeSubmissions[0];
    if (!intake?.payload) throw new NotFoundException("room source payload is unavailable");
    const payload = object(intake.payload);
    const normalized = object(payload.normalized);
    const extensions = object(payload.extensions);
    const sourceRecord = object(extensions.sourceRecord);
    const profileId = typeof extensions.profileId === "string" ? extensions.profileId : "provider-neutral";
    const base = {
      adapter: profileId === "assurepool.frozen-da-tape" ? "ASSUREPOOL_EVIDENCE_V1" : "PROVIDER_NEUTRAL_EVIDENCE_V1",
      profileId,
      sourceReference: {
        id: room.sourceReference.id,
        sourceSystem: room.sourceReference.sourceSystem,
        sourceObjectType: room.sourceReference.sourceObjectType,
        sourceObjectId: room.sourceReference.sourceObjectId,
        sourceVersion: room.sourceReference.sourceVersion,
        payloadDigest: room.sourceReference.payloadDigest,
        authoritativeStatus: room.sourceReference.authoritativeStatus,
      },
      roomManifestDigest: room.sourceManifestDigest,
      intake: { id: intake.id, receivedAt: intake.receivedAt.toISOString(), signatureStatus: intake.signatureStatus, validationStatus: intake.validationStatus },
    };
    if (view === "SUMMARY") return redactPassiveRoomView({ ...base, normalized });
    if (view === "TAPE") return redactPassiveRoomView({ ...base, sourceRecord });
    if (view === "FINDINGS") {
      const findings = Array.isArray(extensions.findings) ? extensions.findings : [];
      return redactPassiveRoomView({ ...base, findings, availability: findings.length ? "AVAILABLE" : "NOT_SUPPLIED_BY_SOURCE_PROFILE" });
    }
    return redactPassiveRoomView({
      ...base,
      dossier: object(extensions.dossierMetadata),
      availability: Object.keys(object(extensions.dossierMetadata)).length ? "AVAILABLE" : "NOT_SUPPLIED_BY_SOURCE_PROFILE",
    });
  }
}
