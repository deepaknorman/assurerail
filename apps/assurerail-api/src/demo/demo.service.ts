import { Injectable } from "@nestjs/common";
import { MintService } from "../mint/mint.service";
import { SurveillanceService } from "../surveillance/surveillance.service";
import { DvpService } from "../dvp/dvp.service";

// T5 — the whole venue loop in one call: mint → surveillance (HCS-anchored) → a sample atomic DvP.
// Consumes the tape from AssureLocker (DEMO by default; TAPE_SOURCE=live for the real chain).
@Injectable()
export class DemoService {
  constructor(
    private readonly mint: MintService,
    private readonly surveillance: SurveillanceService,
    private readonly dvp: DvpService,
  ) {}

  async run(poolId: string, buyerDid = "did:web:demo-buyer") {
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
