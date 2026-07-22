import { Injectable } from "@nestjs/common";
import { MintService } from "../mint/mint.service";
import { SurveillanceService } from "../surveillance/surveillance.service";
import { DvpService } from "../dvp/dvp.service";
import { CloseService } from "../closure/close.service";
import { DEMO_BUYER_DIDS } from "../common/constants";

export type SeedTarget = "issued" | "active" | "traded" | "redeemed";

// T5 — the whole venue loop in one call: mint → surveillance (HCS-anchored) → a sample atomic DvP.
// Consumes the tape from AssureLocker (DEMO by default; TAPE_SOURCE=live for the real chain).
@Injectable()
export class DemoService {
  constructor(
    private readonly mint: MintService,
    private readonly surveillance: SurveillanceService,
    private readonly dvp: DvpService,
    private readonly close: CloseService,
  ) {}

  /**
   * Drive a pool to a target lifecycle state — used to seed a VARIED portfolio (some ISSUED, some ACTIVE,
   * some traded, some REDEEMED). Deterministic tape per poolId (buildDemoTape) makes each pool differ.
   */
  async seedPool(poolId: string, target: SeedTarget, buyers: string[] = DEMO_BUYER_DIDS) {
    const minted = await this.mint.mint(poolId);
    const noteId = minted.note.id;
    if (target === "issued") return { poolId, state: "ISSUED" };

    await this.surveillance.sync(noteId);
    if (target === "active") return { poolId, state: "ACTIVE" };

    const mintable = BigInt(minted.kanon.mintableMinor);
    const nTrades = target === "traded" ? buyers.length : 2;
    for (let i = 0; i < nTrades; i++) {
      const units = (mintable * BigInt(12 + i * 6)) / 100n; // 12%, 18%, 24% …
      const price = (units * BigInt(101 + i)) / 100n; // small premium
      await this.dvp.execute(noteId, { buyerDid: buyers[i % buyers.length], unitsMinor: units.toString(), priceMinor: price.toString() });
    }
    if (target === "traded") return { poolId, state: "ACTIVE-TRADED" };

    await this.close.close(noteId, { reason: "clean_up_call" });
    return { poolId, state: "REDEEMED" };
  }

  async run(poolId: string, buyerDid = DEMO_BUYER_DIDS[0]) {
    // 1) verify tape → k-anon → mint
    const minted = await this.mint.mint(poolId);
    const noteId = minted.note.id;

    // 2) surveillance mirror + HCS anchor → Note ACTIVE
    const surveillance = await this.surveillance.sync(noteId);

    // 3) atomic DvP — sell 30% of the pool at a 2% premium, settled in the configured token
    const mintable = BigInt(minted.kanon.mintableMinor);
    const units = (mintable * 30n) / 100n;
    const price = (units * 102n) / 100n;
    const dvp = await this.dvp.execute(noteId, { buyerDid, unitsMinor: units.toString(), priceMinor: price.toString() });

    return {
      poolId,
      note: minted.note,
      kAnon: minted.kanon,
      surveillance: { poolStatus: surveillance.poolStatus, ok: surveillance.ok, cycles: surveillance.mirrored.length, anchors: surveillance.mirrored.map((m) => m.anchorRef) },
      dvp: { units: dvp.dvp.units, settlementMinor: dvp.dvp.settlementMinor, token: dvp.dvp.settlementToken, settlementRef: dvp.dvp.settlementRef, anchorRef: dvp.dvp.anchorRef },
      holdings: dvp.holdings.map((h) => ({ holder: h.holderDid, units: h.units })),
      adapters: { hts: minted.adapter, settlement: dvp.settlement.adapter },
    };
  }
}
