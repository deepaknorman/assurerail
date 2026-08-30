import { Injectable, Logger } from "@nestjs/common";
import { config } from "../config";

export interface DigiKycResult {
  ok: boolean; // person has an ACTIVE DigiKYC identity in AssureLocker
  did?: string; // the AssureLocker DID (a reference only — never PII)
  reason?: string;
}

/**
 * First identity-provider adapter: verifies an existing AssureLocker DigiKYC identity and returns a
 * subject reference without copying PII. IdentityBindingService owns the neutral boundary, and a
 * successful result binds identity only; it does not admit a participant or grant a Rail action.
 *   DIGIKYC_GATE=demo  accept any plausible email, synthesise a deterministic pseudo-DID (no lookup)
 *   DIGIKYC_GATE=live  call AssureLocker with the venue's scoped credential; fail-closed on error
 * Defaults to live when ASSURELOCKER_API_KEY is set, else demo.
 *
 * To enable the LIVE gate you need ALL of: DIGIKYC_GATE=live, a DIGIKYC_STATUS_SERVICE_SECRET that MATCHES
 * apps/api's DIGIKYC_STATUS_SERVICE_SECRET (box-only shared secret; sent in the x-digikyc-status-secret
 * header), and ASSURELOCKER_API_KEY (the venue's scoped bearer credential). The LIVE branch POSTs
 * { email } to AssureLocker's internal POST /v1/internal/digikyc-status, which returns only { active, did }
 * (a did:web reference, never PII). Any non-200 / missing secret / network error fails closed.
 */
@Injectable()
export class DigiKycGateService {
  private readonly log = new Logger("DigiKycGate");
  private readonly mode = (process.env.DIGIKYC_GATE ?? (config.assureLockerApiKey ? "live" : "demo")).toLowerCase();

  async verify(email: string, claimedDid?: string): Promise<DigiKycResult> {
    if (!email || !email.includes("@")) return { ok: false, reason: "invalid-email" };

    if (this.mode !== "live") {
      // DEMO: reference a deterministic pseudo-DID derived from the email (no PII, no network lookup).
      const did = claimedDid || `did:web:ind.id.assurelocker.com:user:demo-${Buffer.from(email.toLowerCase()).toString("hex").slice(0, 12)}`;
      return { ok: true, did, reason: "demo" };
    }

    // LIVE: ask AssureLocker whether this identity is DigiKYC-ed (ACTIVE DID). Service-authenticated with the
    // box-only shared secret (x-digikyc-status-secret, must match apps/api's DIGIKYC_STATUS_SERVICE_SECRET),
    // plus the venue's scoped bearer credential. The response is { active, did } — DID only, never PII.
    // Fail-closed on any error (missing secret / non-200 / network / malformed body).
    const serviceSecret = process.env.DIGIKYC_STATUS_SERVICE_SECRET ?? "";
    if (!serviceSecret) {
      this.log.warn("digikyc live gate: DIGIKYC_STATUS_SERVICE_SECRET is unset — failing closed");
      return { ok: false, reason: "gate-secret-unset" };
    }
    try {
      const res = await fetch(`${config.assureLockerApiUrl}/v1/internal/digikyc-status`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-digikyc-status-secret": serviceSecret,
          ...(config.assureLockerApiKey ? { authorization: `Bearer ${config.assureLockerApiKey}` } : {}),
        },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) return { ok: false, reason: `assurelocker-${res.status}` };
      const j = (await res.json()) as { active?: boolean; did?: string };
      if (!j.active || !j.did) return { ok: false, reason: "not-digikyc-ed" };
      return { ok: true, did: j.did };
    } catch (e) {
      this.log.warn(`digikyc live check failed: ${(e as Error).message}`);
      return { ok: false, reason: "gate-error" };
    }
  }
}
