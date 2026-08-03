import { Injectable } from "@nestjs/common";
import { MintService } from "../mint/mint.service";
import { SurveillanceService } from "../surveillance/surveillance.service";
import { DvpService } from "../dvp/dvp.service";
import { CloseService } from "../closure/close.service";
import { TapeService } from "../tape/tape.service";
import { TrusteeService } from "../trustee/trustee.service";
import { buildReceivablesRecords } from "../tape/receivables-demo-tape";
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
    private readonly tape: TapeService,
    private readonly trustee: TrusteeService,
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

  /**
   * Model B — the receivables-pool loop with the TRUSTEE in the chain: assemble → TRUSTEE AUTHORISES
   * (a distinct, signed, pre-mint event) → mint under that authorisation → surveillance (buyer payment)
   * → PRIMARY subscription (atomic DvP). Returns a step-by-step, narratable trace for a slide / live
   * walkthrough (§8.5.6). Reuses the loan-pool engine; the trustee authorisation + receivables framing
   * are the Model-B additions.
   */
  async runReceivablesModelB(poolId: string, buyerDid = DEMO_BUYER_DIDS[0]) {
    const receivables = buildReceivablesRecords(poolId);
    const anchor = receivables[0];

    // 0) assemble the receivables pool tape (receivables-shaped records → mint-compatible aggregate)
    const { tape, verification } = await this.tape.load(poolId);
    const faceValueMinor = String(tape.aggregates.mintableMinor);

    // 1) TRUSTEE AUTHORISES — the Model-B proof: a distinct, signed event BEFORE any mint
    const authorisation = await this.trustee.authoriseMint(poolId, tape.tapeHash, faceValueMinor);
    const authVerify = this.trustee.verify(authorisation);

    // 2) mint — executes UNDER the trustee's authorisation
    const minted = await this.mint.mint(poolId);
    const noteId = minted.note.id;

    // 3) surveillance — a buyer payment posted against the pool (receivables-shaped cycle)
    const surveillance = await this.surveillance.sync(noteId);

    // 4) PRIMARY subscription — buyer subscribes → atomic DvP (primary issuance, not a resale)
    const mintable = BigInt(minted.kanon.mintableMinor);
    const units = (mintable * 30n) / 100n;
    const price = (units * 102n) / 100n;
    const dvp = await this.dvp.execute(noteId, { buyerDid, unitsMinor: units.toString(), priceMinor: price.toString() });

    const acceptanceMix = receivables.reduce<Record<string, number>>((m, r) => {
      m[r.acceptanceState] = (m[r.acceptanceState] ?? 0) + 1;
      return m;
    }, {});

    return {
      model: "B — trustee-authorised primary issuance",
      poolId,
      receivablesPool: {
        anchorBuyer: anchor?.buyerName,
        anchorDid: anchor?.buyerDid,
        receivableCount: receivables.length,
        faceValueMinor,
        acceptanceMix,
        tapeVerified: verification.ok,
        receivables: receivables.map((r) => ({
          ref: r.receivableRef,
          sellerName: r.sellerName,
          irn: `${r.irn.slice(0, 12)}…`,
          acceptanceState: r.acceptanceState,
          acceptedAt: r.acceptedAt,
          invoiceAmountMinor: r.invoiceAmountMinor,
          dueDate: r.dueDate,
        })),
      },
      steps: [
        { step: 1, event: "pool.assembled", label: "Receivables pool assembled & frozen", detail: { receivableCount: receivables.length, faceValueMinor, tapeHash: tape.tapeHash, verified: verification.ok } },
        { step: 2, event: "trustee.authorised_issuance", label: "Trustee authorises the issuance (BEFORE mint)", detail: { trusteeDid: authorisation.trusteeDid, authorisedAt: authorisation.authorisedAt, scheme: authorisation.scheme, signature: `${authorisation.signature.slice(0, 16)}…`, verified: authVerify.ok }, note: "The mint is the trustee's act — AssureRail is infrastructure executing the trustee's instruction, not the issuer." },
        { step: 3, event: "note.minted", label: "Mint under trustee authorisation", detail: { noteId, tokenId: minted.note.tokenId, mintableMinor: minted.kanon.mintableMinor, kAnonPassed: true, adapter: minted.adapter } },
        { step: 4, event: "surveillance.cycle", label: "Surveillance cycle — buyer payment posted", detail: { poolStatus: surveillance.poolStatus, ok: surveillance.ok, cycles: surveillance.mirrored.length } },
        { step: 5, event: "dvp.primary", label: "Primary subscription — atomic DvP", detail: { buyerDid, units: dvp.dvp.units, settlementMinor: dvp.dvp.settlementMinor, token: dvp.dvp.settlementToken, settlementRef: dvp.dvp.settlementRef }, note: "A buyer's subscription triggers settlement against freshly issued units — primary issuance, not a resale." },
      ],
      trusteeAuthorisation: authorisation,
      note: minted.note,
      kAnon: minted.kanon,
    };
  }
}
