// Pure tape verification — no framework deps, so it is trivially unit-testable. Trust the math, not
// the transport: recompute tapeHash over the body and compare (integrity); check the supported
// version; then mint-readiness (the reserve-then-mint lock, owned by AssureLocker, must be CONFIRMED).
import { CoLending } from "@code/shared";
import { type AssurePoolTape, SUPPORTED_TAPE_VERSION } from "./tape.types";

export interface TapeVerification {
  ok: boolean; // integrity + version valid
  mintReady: boolean; // ok AND lock CONFIRMED
  reasons: string[];
}

export function verifyTape(tape: AssurePoolTape): TapeVerification {
  const reasons: string[] = [];
  const { tapeHash, ...body } = tape;
  const recomputed = `sha256:${CoLending.hashObject(body)}`;
  if (recomputed !== tapeHash) reasons.push(`tapeHash mismatch — integrity check failed (recomputed ${recomputed})`);
  if (tape.tapeVersion !== SUPPORTED_TAPE_VERSION) reasons.push(`unsupported tapeVersion ${tape.tapeVersion} (need ${SUPPORTED_TAPE_VERSION})`);

  const ok = reasons.length === 0;
  const mintReady = ok && tape.lock?.state === "CONFIRMED";
  if (ok && !mintReady) reasons.push("mint blocked: on-book lock is not CONFIRMED (reserve-then-mint)");
  return { ok, mintReady, reasons };
}
