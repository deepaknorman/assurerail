import { BadRequestException, Injectable } from "@nestjs/common";
import { audit } from "../common/audit";
import { ISSUER_DID } from "../common/constants";
import { TapeService } from "../tape/tape.service";
import { selectHtsAdapter } from "../hts/hts.adapter";
import { checkKAnon } from "./kanon";
import { MintRepository } from "./note.repository";
import { VenueEventBus } from "../events/venue-events";

@Injectable()
export class MintService {
  constructor(
    private readonly tape: TapeService,
    private readonly repo: MintRepository,
    private readonly events: VenueEventBus,
  ) {}

  /** The mint flow: verified + mint-ready tape → k-anon gate → HTS mint → Note + MintLog. */
  async mint(poolId: string) {
    const { tape, verification } = await this.tape.load(poolId);
    if (!verification.ok) throw new BadRequestException(`tape failed verification: ${verification.reasons.join("; ")}`);
    if (!verification.mintReady) throw new BadRequestException(`not mint-ready: ${verification.reasons.join("; ")}`);

    const kanon = checkKAnon(tape);
    if (!kanon.ok) {
      // Append-only: a blocked attempt is still recorded.
      await this.repo.saveMintLog({ poolId, tapeHash: tape.tapeHash, kAnonPassed: false, kAnonDetail: kanon.detail, lockRef: tape.lock?.reference ?? "", htsTxRef: "", actor: "system:tokenco" });
      audit("mint.blocked", { poolId, reasons: kanon.reasons });
      throw new BadRequestException(`k-anon gate failed: ${kanon.reasons.join("; ")}`);
    }

    const mintRes = await selectHtsAdapter().mint(tape.tapeHash, tape.aggregates.mintableCount);
    // Note + MintLog + the issuer's opening 100%-by-value holding commit atomically (one transaction):
    // a crash can never leave a queryable Note with no issuer holding or no mint-audit record.
    const mintableMinor = String(tape.aggregates.mintableMinor);
    // The EventLog + BillingEvent are written INSIDE this transaction (transactional outbox) — durable
    // with the mint itself, not dependent on the fire-and-forget sink.
    const { note, eventLogId } = await this.repo.commitMint({
      note: {
        poolId,
        tapeHash: tape.tapeHash,
        manifestHash: tape.manifestHash,
        tokenId: mintRes.tokenId,
        serials: mintRes.serials,
        t1Aggregates: tape.aggregates,
        state: "ISSUED",
      },
      mintLog: { poolId, tapeHash: tape.tapeHash, kAnonPassed: true, kAnonDetail: kanon.detail, lockRef: tape.lock?.reference ?? "", htsTxRef: mintRes.tokenId, actor: "system:tokenco" },
      issuerDid: ISSUER_DID,
      issuerUnits: BigInt(tape.aggregates.mintableMinor),
      outbox: {
        event: "note.minted",
        payload: { poolId, tokenId: mintRes.tokenId, mintableMinor },
        billing: { type: "mint", unitsMinor: mintableMinor, actor: "system:tokenco" },
      },
    });
    audit("mint.issued", { poolId, tokenId: mintRes.tokenId, serials: mintRes.serials.length, adapter: mintRes.adapter });
    this.events.emit("note.minted", { eventLogId, noteId: note.id, poolId, tokenId: mintRes.tokenId, mintableMinor });
    return { note, kanon: kanon.detail, adapter: mintRes.adapter };
  }
}
