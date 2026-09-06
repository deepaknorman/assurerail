import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { loadGoogleCreds } from "./google-credentials";

// Verifies AssureRail Firebase ID tokens with firebase-admin (its OWN Firebase project `assurerail`,
// named app instance to stay isolated). Accepts base64 service-account JSON from Rail's own secret store.
@Injectable()
export class FirebaseAdminService {
  private readonly log = new Logger("FirebaseAdmin");
  private app?: App;
  readonly configured: boolean = false;

  constructor() {
    const creds = loadGoogleCreds();
    if (!creds) {
      this.log.warn("FIREBASE_ADMIN_CONFIG unset — auth is UNCONFIGURED (protected routes will 401; DEMO endpoints still work)");
      return;
    }
    this.app =
      getApps().find((a) => a.name === "assurerail") ??
      initializeApp({ credential: cert({ projectId: creds.projectId, clientEmail: creds.clientEmail, privateKey: creds.privateKey }) }, "assurerail");
    this.configured = true;
    this.log.log(`firebase-admin ready (project ${creds.projectId})`);
  }

  /** Verify a Firebase ID token (checkRevoked=true). Throws UnauthorizedException on any failure. */
  async verifyIdToken(token: string): Promise<DecodedIdToken> {
    if (!this.app) throw new UnauthorizedException("auth not configured");
    try {
      return await getAuth(this.app).verifyIdToken(token, true);
    } catch (e) {
      throw new UnauthorizedException(`invalid Firebase token: ${(e as Error).message}`);
    }
  }
}
