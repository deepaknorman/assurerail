import { BadRequestException, Injectable } from "@nestjs/common";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/typescript-types";
import { PrismaService } from "../store/prisma.service";

// WebAuthn passkey enrolment + management (@simplewebauthn/server v8). Register a hardware/biometric
// credential while signed in, list them, remove them. RP config from env (defaults suit local dev;
// the box sets WEBAUTHN_RP_ID=assurerail.com + WEBAUTHN_ORIGIN=https://assurerail.com). Passkey LOGIN
// (custom-token sign-in) is a deliberate follow-up — this delivers the "set up a passkey" flow.
const RP_NAME = process.env.WEBAUTHN_RP_NAME || "AssureRail";
const RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "http://localhost:3007";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class WebAuthnService {
  constructor(private readonly db: PrismaService) {}

  async listCredentials(uid: string) {
    return this.db.webAuthnCredential.findMany({
      where: { firebaseUid: uid },
      select: { id: true, name: true, deviceType: true, backedUp: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async registrationOptions(uid: string, userName: string, displayName: string) {
    await this.db.webAuthnChallenge.deleteMany({ where: { firebaseUid: uid, type: "registration" } });
    const existing = await this.db.webAuthnCredential.findMany({ where: { firebaseUid: uid }, select: { credentialId: true, transports: true } });
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: uid,
      userName,
      userDisplayName: displayName,
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({ id: Buffer.from(c.credentialId, "base64url"), type: "public-key" as const, transports: c.transports as AuthenticatorTransportFuture[] })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
    await this.db.webAuthnChallenge.create({ data: { firebaseUid: uid, challenge: options.challenge, type: "registration", expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) } });
    return options;
  }

  async verifyRegistration(uid: string, response: RegistrationResponseJSON, name?: string) {
    const ch = await this.db.webAuthnChallenge.findFirst({ where: { firebaseUid: uid, type: "registration" }, orderBy: { createdAt: "desc" } });
    if (!ch || ch.expiresAt < new Date()) throw new BadRequestException("no active registration challenge — start again");
    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      verification = await verifyRegistrationResponse({ response, expectedChallenge: ch.challenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID, requireUserVerification: true });
    } catch (e) {
      await this.db.webAuthnChallenge.deleteMany({ where: { challenge: ch.challenge } }).catch(() => undefined);
      throw new BadRequestException(`passkey registration failed: ${(e as Error).message}`);
    }
    await this.db.webAuthnChallenge.deleteMany({ where: { challenge: ch.challenge } }).catch(() => undefined);
    if (!verification.verified || !verification.registrationInfo) throw new BadRequestException("passkey could not be verified");
    const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const transports = (response.response.transports as string[]) ?? [];
    await this.db.webAuthnCredential.create({
      data: {
        firebaseUid: uid,
        credentialId: Buffer.from(credentialID).toString("base64url"),
        publicKey: Buffer.from(credentialPublicKey),
        counter: BigInt(counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports,
        name: name?.trim() || "Passkey",
      },
    });
    return { verified: true };
  }

  async deleteCredential(uid: string, id: string) {
    await this.db.webAuthnCredential.deleteMany({ where: { id, firebaseUid: uid } });
    return { ok: true };
  }
}
