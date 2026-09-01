import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { audit } from "../common/audit";
import { ISSUER_DID } from "../common/constants";
import { config } from "../config";
import { InsufficientUnitsError, MintRepository, type DvpRecord, type HoldingRecord } from "../mint/note.repository";
import { selectHcsAdapter } from "../surveillance/hcs.adapter";
import { selectSettlementAdapter } from "../settlement/settlement.adapter";
import { VenueEventBus } from "../events/venue-events";
import { AuditService } from "../store/audit.service";

export interface DvpInput {
  buyerDid: string;
  unitsMinor: string; // asset units (by value) the buyer acquires
  priceMinor: string; // settlement amount the buyer pays
  /**
   * Selling side. Defaults to the venue's own ISSUER_DID (loan pools, where the venue holds the
   * opening position). A trustee-authorised receivables issuance (Model B) opens its 100% holding
   * under the TRUSTEE's DID instead — the trust is the issuer — so that flow must name the trustee
   * here or the seller would hold nothing.
   */
  sellerDid?: string;
}

@Injectable()
export class DvpService {
  constructor(
    private readonly repo: MintRepository,
    private readonly events: VenueEventBus,
    private readonly auditSvc: AuditService,
  ) {}

  /**
   * Atomic delivery-vs-payment. Asset units (issuer→buyer) and the settlement token (buyer→issuer)
   * move together — the venue OPERATES the swap and holds NEITHER leg (no custody/payment licence).
   * The settlement leg runs first; only if it succeeds does the asset leg move → no settlement risk.
   */
  async execute(noteId: string, input: DvpInput) {
    const note = await this.repo.getNote(noteId);
    if (!note) throw new NotFoundException("note not found");
    if (await this.repo.isGovernedTokenRepresentation(noteId)) {
      throw new BadRequestException("governed token representation: direct legacy DvP is disabled; use the case-scoped token action workflow");
    }
    if (note.state === "REDEEMED") throw new BadRequestException("note is redeemed — not tradeable");

    const sellerDid = input.sellerDid?.trim() || ISSUER_DID;
    const units = BigInt(input.unitsMinor);
    if (units <= 0n) throw new BadRequestException("units must be positive");
    if (!input.buyerDid || input.buyerDid === sellerDid) throw new BadRequestException("a distinct buyer is required");
    const available = BigInt((await this.repo.getHolding(noteId, sellerDid))?.units ?? "0");
    if (units > available) throw new BadRequestException(`seller ${sellerDid} holds ${available} < requested ${units}`);

    // Settlement leg first (buyer → issuer). If it throws, NO asset units move (atomicity preserved).
    const settlement = await selectSettlementAdapter().settle(input.buyerDid, sellerDid, input.priceMinor, config.settlementToken);

    const anchor = await selectHcsAdapter().anchor({
      event: "dvp",
      noteId,
      seller: sellerDid,
      buyer: input.buyerDid,
      units: input.unitsMinor,
      settlementMinor: input.priceMinor,
      settlementToken: config.settlementToken,
      settlementRef: settlement.settlementRef,
    });

    // Asset leg + record — ONE atomic transaction: guarded seller-debit (no oversell/negative),
    // buyer-credit, and the Dvp row commit together or not at all. The pre-check above is a fast fail;
    // settleDvp re-checks the balance atomically inside the tx (authoritative under concurrency).
    let result: { dvp: DvpRecord; holdings: HoldingRecord[]; eventLogId: string };
    try {
      result = await this.repo.settleDvp({
        noteId,
        sellerDid,
        buyerDid: input.buyerDid,
        units,
        dvp: {
          noteId,
          sellerDid,
          buyerDid: input.buyerDid,
          units: input.unitsMinor,
          settlementMinor: input.priceMinor,
          settlementToken: config.settlementToken,
          settlementRef: settlement.settlementRef,
          anchorRef: `${anchor.topicId}#${anchor.sequenceNumber}`,
          actor: "system:tokenco",
        },
        // EventLog + BillingEvent written in the same tx as the asset leg (transactional outbox).
        outbox: {
          event: "dvp.settled",
          payload: { buyer: input.buyerDid, units: input.unitsMinor, price: input.priceMinor, token: config.settlementToken },
          billing: { type: "dvp", unitsMinor: input.unitsMinor, actor: "system:tokenco" },
        },
      });
    } catch (e) {
      if (e instanceof InsufficientUnitsError) throw new BadRequestException(`issuer holds insufficient units (concurrent trade?) — ${e.message}`);
      throw e;
    }
    const auditDetail = { noteId, buyer: input.buyerDid, units: input.unitsMinor, token: config.settlementToken, adapter: settlement.adapter };
    audit("dvp.settled", auditDetail);
    await this.auditSvc.append({ actor: "system:tokenco", event: "dvp.settled", detail: auditDetail, noteId });
    this.events.emit("dvp.settled", { eventLogId: result.eventLogId, noteId, buyer: input.buyerDid, units: input.unitsMinor, price: input.priceMinor, token: config.settlementToken });
    return { dvp: result.dvp, settlement, holdings: result.holdings };
  }

  async listDvp(noteId: string) {
    if (!(await this.repo.getNote(noteId))) throw new NotFoundException("note not found");
    if (await this.repo.isGovernedTokenRepresentation(noteId)) throw new NotFoundException("note not found");
    return this.repo.listDvp(noteId);
  }
  async holdings(noteId: string) {
    if (!(await this.repo.getNote(noteId))) throw new NotFoundException("note not found");
    if (await this.repo.isGovernedTokenRepresentation(noteId)) throw new NotFoundException("note not found");
    return this.repo.listHoldings(noteId);
  }
}
