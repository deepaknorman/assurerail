import { Injectable } from "@nestjs/common";
import { audit } from "../common/audit";
import { fetchTape } from "./tape-provider.client";
import { verifyTape, type TapeVerification } from "./verify";
import type { AssurePoolTape } from "./tape.types";

@Injectable()
export class TapeService {
  /** Fetch an optional AssurePool-profile tape from its configured provider (or DEMO) and verify it. */
  async load(poolId: string): Promise<{
    tape: AssurePoolTape;
    verification: TapeVerification;
    providerEvidence?: Readonly<Record<string, string>>;
  }> {
    const fetched = await fetchTape(poolId);
    const tape = fetched.tape;
    const verification = fetched.contractVersion === "v2"
      ? {
          ok: true,
          mintReady: tape.lock?.state === "CONFIRMED",
          reasons: tape.lock?.state === "CONFIRMED" ? [] : ["mint blocked: on-book lock is not CONFIRMED (reserve-then-mint)"],
        }
      : verifyTape(tape);
    const providerEvidence = fetched.contractVersion === "v2" ? {
      profileId: fetched.providerEnvelope.payload.profileId,
      providerId: fetched.providerEnvelope.providerId,
      keyId: fetched.providerEnvelope.keyId,
      payloadDigest: fetched.providerEnvelope.payloadDigest,
      packageDigest: fetched.providerEnvelope.payload.packageDigest,
      performanceResultDigest: fetched.providerEnvelope.payload.performance.resultDigest,
    } : undefined;
    audit("tape.loaded", {
      poolId,
      tapeHash: tape.tapeHash,
      contractVersion: fetched.contractVersion,
      providerId: providerEvidence?.providerId,
      payloadDigest: providerEvidence?.payloadDigest,
      ok: verification.ok,
      mintReady: verification.mintReady,
    });
    return { tape, verification, providerEvidence };
  }
}
