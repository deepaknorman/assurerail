// Pure tape verification — no framework deps, so it is trivially unit-testable. Trust the math, not
// the transport: recompute tapeHash over the body and compare (integrity); check the supported
// version; recompute the FROZEN manifest from the loan rows (H6 tamper-evidence — the manifest binds
// per-loan classification, so post-freeze drift is provable); then mint-readiness (the reserve-then-
// mint lock, owned by AssureLocker, must be CONFIRMED).
import { computePoolManifestV1, hashObject } from "../provider-contracts/v1";
import { type AssurePoolTape, SUPPORTED_TAPE_VERSION } from "./tape.types";

export interface TapeVerification {
  ok: boolean; // integrity + version valid
  mintReady: boolean; // ok AND lock CONFIRMED
  reasons: string[];
}

export function verifyTape(tape: AssurePoolTape): TapeVerification {
  const reasons: string[] = [];
  const { tapeHash, ...body } = tape;
  const recomputed = `sha256:${hashObject(body)}`;
  if (recomputed !== tapeHash) reasons.push(`tapeHash mismatch — integrity check failed (recomputed ${recomputed})`);
  if (tape.tapeVersion !== SUPPORTED_TAPE_VERSION) reasons.push(`unsupported tapeVersion ${tape.tapeVersion} (need ${SUPPORTED_TAPE_VERSION})`);

  // H6 — the actual tamper-evidence. tapeHash alone is self-consistent even on a drifted tape (the
  // body is rebuilt from live loan rows). The manifest is sealed/anchored at freeze; recompute it
  // from the tape's OWN per-loan rows and compare. A post-freeze reclassification (or any per-loan
  // structural rewrite) yields a manifest that differs from the frozen one → FAIL.
  const recomputedManifest = computePoolManifestV1(tape.loans);
  if (recomputedManifest !== tape.manifestHash) {
    reasons.push("manifestHash mismatch — pool content drifted from the frozen manifest");
  }

  const ok = reasons.length === 0;
  const mintReady = ok && tape.lock?.state === "CONFIRMED";
  if (ok && !mintReady) reasons.push("mint blocked: on-book lock is not CONFIRMED (reserve-then-mint)");
  return { ok, mintReady, reasons };
}
