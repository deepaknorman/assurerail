import { Logger } from "@nestjs/common";

export interface VenueGoogleCreds {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const log = new Logger("GoogleCreds");
let cached: VenueGoogleCreds | null | undefined;

/**
 * Decode the venue's Firebase Admin service-account JSON from FIREBASE_ADMIN_CONFIG (base64) — the same
 * convention AssureLocker uses. The ONE service account authenticates BOTH firebase-admin (ID-token
 * verification) AND the reCAPTCHA Enterprise assessment client. Secret — box env only, never in git.
 * Returns null when unset, so auth runs in an explicit "unconfigured" posture (login disabled) rather
 * than crashing the DEMO.
 */
export function loadGoogleCreds(): VenueGoogleCreds | null {
  if (cached !== undefined) return cached;
  const b64 = process.env.FIREBASE_ADMIN_CONFIG?.trim();
  if (!b64) {
    cached = null;
    return null;
  }
  try {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    if (!json.project_id || !json.client_email || !json.private_key) throw new Error("missing project_id/client_email/private_key");
    cached = {
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: String(json.private_key).replace(/\\n/g, "\n"),
    };
    return cached;
  } catch (e) {
    log.error(`FIREBASE_ADMIN_CONFIG is set but not valid base64 service-account JSON: ${(e as Error).message}`);
    cached = null;
    return null;
  }
}
