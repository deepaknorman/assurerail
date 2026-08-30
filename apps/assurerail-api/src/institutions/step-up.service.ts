import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/assurerail-client";
import { sha256Digest } from "../contracts/v1/canonical";
import { PrismaService } from "../store/prisma.service";
import { STEP_UP_PURPOSES, type StepUpPurpose } from "./institution-policy";

const STEP_UP_TTL_MS = 5 * 60 * 1_000;

function assertPurpose(value: string): asserts value is StepUpPurpose {
  if (!(STEP_UP_PURPOSES as readonly string[]).includes(value)) {
    throw new BadRequestException(`purpose must be one of: ${STEP_UP_PURPOSES.join(", ")}`);
  }
}

@Injectable()
export class StepUpService {
  constructor(private readonly db: PrismaService) {}

  async issue(input: {
    firebaseUid: string;
    sessionId: string;
    purpose: string;
    institutionId?: string | null;
    method: "TOTP" | "WEBAUTHN";
    assuranceContext?: Record<string, unknown>;
  }) {
    assertPurpose(input.purpose);
    const user = await this.db.venueUser.findUnique({ where: { firebaseUid: input.firebaseUid } });
    if (!user || user.status === "SUSPENDED") throw new ForbiddenException("active user required for step-up");
    const session = await this.db.venueSession.findUnique({ where: { id: input.sessionId } });
    const now = new Date();
    if (!session || session.userId !== user.id || session.revokedAt || (session.expiresAt && session.expiresAt <= now)) {
      throw new ForbiddenException("active session required for step-up");
    }
    const platformPurpose = input.purpose.startsWith("PARTICIPANT_ADMISSION_")
      || input.purpose === "ROUTE_ENTITLEMENT_REVIEW"
      || input.purpose === "MEMBERSHIP_ACCEPT";
    if (!platformPurpose && session.activeInstitutionId !== (input.institutionId ?? null)) {
      throw new ForbiddenException("step-up institution must match the active session context");
    }

    const issuedAt = now;
    const expiresAt = new Date(issuedAt.getTime() + STEP_UP_TTL_MS);
    const id = `sup_${randomUUID()}`;
    const assuranceContext = {
      credential: input.method,
      ceremony: "INSTITUTION_GOVERNANCE",
      ...(input.assuranceContext ?? {}),
    };
    const evidenceDigest = sha256Digest({
      id,
      userId: user.id,
      sessionId: input.sessionId,
      firebaseUid: input.firebaseUid,
      institutionId: input.institutionId ?? null,
      method: input.method,
      purpose: input.purpose,
      assuranceContext,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    const evidence = await this.db.stepUpEvidence.create({
      data: {
        id,
        userId: user.id,
        sessionId: input.sessionId,
        firebaseUid: input.firebaseUid,
        institutionId: input.institutionId ?? null,
        method: input.method,
        purpose: input.purpose,
        assuranceContext,
        evidenceDigest,
        issuedAt,
        expiresAt,
      },
      select: { id: true, purpose: true, institutionId: true, method: true, issuedAt: true, expiresAt: true },
    });
    return evidence;
  }

  /** Consume exactly once and only for the actor, institution and purpose to which it was issued. */
  async consume(input: {
    evidenceId: string;
    userId: string;
    sessionId: string;
    purpose: StepUpPurpose;
    institutionId?: string | null;
  }, tx: Pick<Prisma.TransactionClient, "stepUpEvidence"> = this.db): Promise<void> {
    const now = new Date();
    const consumed = await tx.stepUpEvidence.updateMany({
      where: {
        id: input.evidenceId,
        userId: input.userId,
        sessionId: input.sessionId,
        purpose: input.purpose,
        institutionId: input.institutionId ?? null,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) {
      throw new ForbiddenException("valid, unconsumed step-up evidence is required for this exact action");
    }
  }
}
