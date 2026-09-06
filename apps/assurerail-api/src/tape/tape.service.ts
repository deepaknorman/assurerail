import { Injectable } from "@nestjs/common";
import { audit } from "../common/audit";
import { fetchTape } from "./tape-provider.client";
import { verifyTape, type TapeVerification } from "./verify";
import type { AssurePoolTape } from "./tape.types";

@Injectable()
export class TapeService {
  /** Fetch a tape from AssureLocker (or DEMO) and verify it end to end. */
  async load(poolId: string): Promise<{ tape: AssurePoolTape; verification: TapeVerification }> {
    const tape = await fetchTape(poolId);
    const verification = verifyTape(tape);
    audit("tape.loaded", { poolId, tapeHash: tape.tapeHash, ok: verification.ok, mintReady: verification.mintReady });
    return { tape, verification };
  }
}
