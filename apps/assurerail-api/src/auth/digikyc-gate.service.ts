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
 * Defaults to live when IDENTITY_PROVIDER_API_KEY is set, else demo.
 *
 * To enable the LIVE gate you need ALL of: DIGIKYC_GATE=live, a DIGIKYC_STATUS_SERVICE_SECRET that MATCHES
 * the provider's DIGIKYC_STATUS_SERVICE_SECRET (sent in the x-digikyc-status-secret header), and
 * IDENTITY_PROVIDER_API_KEY (the venue's scoped bearer credential). The LIVE branch POSTs { email }
 * to the configured provider endpoint, which returns only { active, did }
 * (a did:web reference, never PII). Any non-200 / missing secret / network error fails closed.
 */
@Injectable()
export class DigiKycGateService {
  private readonly log = new Logger("DigiKycGate");
  private readonly mode = (process.env.DIGIKYC_GATE ?? (config.identityProviderApiKey ? "live" : "demo")).toLowerCase();

  async verify(email: string, claimedDid?: string): Promise<DigiKycResult> {
    if (!email || !email.includes("@")) return { ok: false, reason: "invalid-email" };

    if (this.mode !== "live") {
      // DEMO: reference a deterministic pseudo-DID derived from the email (no PII, no network lookup).
      const did = claimedDid || `did:web:demo.assurerail.invalid:user:${Buffer.from(email.toLowerCase()).toString("hex").slice(0, 12)}`;
      return { ok: true, did, reason: "demo" };
    }

    // LIVE: ask the configured provider whether this identity is active. Service-authenticated with
    // the provider-specific secret plus Rail's scoped bearer credential. The response is
    // { active, did } — DID only, never PII.
    // Fail-closed on any error (missing secret / non-200 / network / malformed body).
    const serviceSecret = process.env.DIGIKYC_STATUS_SERVICE_SECRET ?? "";
    if (!serviceSecret) {
      this.log.warn("digikyc live gate: DIGIKYC_STATUS_SERVICE_SECRET is unset — failing closed");
      return { ok: false, reason: "gate-secret-unset" };
    }
    try {
      const res = await fetch(`${config.identityProviderApiUrl}/v1/internal/digikyc-status`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-digikyc-status-secret": serviceSecret,
          ...(config.identityProviderApiKey ? { authorization: `Bearer ${config.identityProviderApiKey}` } : {}),
        },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) return { ok: false, reason: `identity-provider-${res.status}` };
      const j = (await res.json()) as { active?: boolean; did?: string };
      if (!j.active || !j.did) return { ok: false, reason: "not-digikyc-ed" };
      return { ok: true, did: j.did };
    } catch (e) {
      this.log.warn(`digikyc live check failed: ${(e as Error).message}`);
      return { ok: false, reason: "gate-error" };
    }
  }
}
