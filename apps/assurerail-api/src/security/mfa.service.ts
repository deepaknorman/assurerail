import { BadRequestException, Injectable } from "@nestjs/common";
import { generateSecret, generateURI, verify } from "otplib";
import { PrismaService } from "../store/prisma.service";
import { StepUpService } from "../institutions/step-up.service";

// MFA — TOTP (authenticator app) via otplib. Enroll generates a secret + otpauth URI (QR); the method
// is only ACTIVE after the user proves a code (verify). Self-contained; no external service.
@Injectable()
export class MfaService {
  constructor(private readonly db: PrismaService, private readonly stepUp: StepUpService) {}

  async status(uid: string) {
    const rows = await this.db.mfaEnrollment.findMany({ where: { firebaseUid: uid }, select: { method: true, verified: true, verifiedAt: true } });
    return {
      methods: rows.filter((r) => r.verified).map((r) => r.method),
      pending: rows.filter((r) => !r.verified).map((r) => r.method),
      enrolled: rows.some((r) => r.verified),
    };
  }

  /** Start TOTP enrollment — a fresh secret + otpauth URI. Overwrites any unverified pending secret. */
  async enrollTotp(uid: string, account: string) {
    const secret = generateSecret();
    await this.db.mfaEnrollment.upsert({
      where: { firebaseUid_method: { firebaseUid: uid, method: "TOTP" } },
      create: { firebaseUid: uid, method: "TOTP", secret, verified: false },
      update: { secret, verified: false, verifiedAt: null },
    });
    return { secret, uri: generateURI({ issuer: "AssureRail", label: account || uid, secret }) };
  }

  /** Confirm TOTP — verify a code against the pending secret; marks the method active. */
  async verifyTotp(uid: string, code: string, purpose?: string, institutionId?: string | null, sessionId?: string) {
    const e = await this.db.mfaEnrollment.findUnique({ where: { firebaseUid_method: { firebaseUid: uid, method: "TOTP" } } });
    if (!e?.secret) throw new BadRequestException("no pending TOTP enrolment — start setup first");
    const result = await verify({ token: (code || "").replace(/\s/g, ""), secret: e.secret, epochTolerance: 30 });
    if (!result.valid) throw new BadRequestException("invalid code — check your authenticator app clock and try again");
    await this.db.mfaEnrollment.update({ where: { id: e.id }, data: { verified: true, verifiedAt: new Date() } });
    const stepUp = purpose
      ? await this.stepUp.issue({
        firebaseUid: uid,
        sessionId: sessionId ?? "",
        purpose,
        institutionId: institutionId ?? null,
        method: "TOTP",
      })
      : null;
    return { verified: true, stepUp };
  }

  async disable(uid: string, method: string) {
    await this.db.mfaEnrollment.deleteMany({ where: { firebaseUid: uid, method } });
    return { ok: true };
  }
}
