import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { audit } from "../common/audit";
import { MintRepository } from "../mint/note.repository";
import { selectHtsAdapter } from "../hts/hts.adapter";
import { selectHcsAdapter } from "../surveillance/hcs.adapter";
import { VenueEventBus } from "../events/venue-events";
import { AuditService } from "../store/audit.service";
import { assertLegacyExternalEffectPathAllowed } from "../runtime/legacy-external-effect.guard";

export interface AmortiseInput {
  principalMinor: string; // principal repaid this cycle
}

@Injectable()
export class AmortiseService {
  constructor(
    private readonly repo: MintRepository,
    private readonly events: VenueEventBus,
    private readonly auditSvc: AuditService,
  ) {}

  /**
   * Partial pro-rata (pass-through) amortisation. When the underlying pool repays principal P, every
   * holder is amortised by their pro-rata share of P (units burned = cash returned, at par) with
   * integer-exact conservation. Supply is partially burned (governed); the event is HCS-anchored,
   * audited, and outboxed. If P retires the last unit, the Note auto-closes REDEEMED (reason "amortised").
   * This is the correct model for a SINGLE-CLASS Note; sequential/waterfall apply only once tranched.
   */
  async amortise(noteId: string, input: AmortiseInput) {
    assertLegacyExternalEffectPathAllowed("legacy.note.amortise");
    const note = await this.repo.getNote(noteId);
    if (!note) throw new NotFoundException("note not found");
    if (await this.repo.isGovernedTokenRepresentation(noteId)) {
      throw new BadRequestException("governed token representation: direct legacy amortisation is disabled; use the case-scoped token action workflow");
    }
    if (note.state === "REDEEMED") throw new BadRequestException("note is redeemed — nothing to amortise");

    let P: bigint;
    try {
      P = BigInt(input.principalMinor);
    } catch {
      throw new BadRequestException("principalMinor must be an integer amount (minor units)");
    }
    if (P <= 0n) throw new BadRequestException("principalMinor must be positive");

    const holdings = await this.repo.listHoldings(noteId);
    const outstanding = holdings.reduce((s, h) => s + BigInt(h.units), 0n);
    if (outstanding === 0n) throw new BadRequestException("note has no outstanding units");
    if (P > outstanding) throw new BadRequestException(`principal ${P} exceeds outstanding ${outstanding}`);

    // Partial burn (supply decreases by P) — the mirror of mint, governed. DEMO fakes; LIVE fail-closed.
    const burn = await selectHtsAdapter().burnAmount(note.tokenId, input.principalMinor);
    // Anchor the amortisation event before the state write (tamper-evident who/what/when).
    const anchor = await selectHcsAdapter().anchor({
      event: "note_amortised",
      noteId,
      tapeHash: note.tapeHash,
      tokenId: note.tokenId,
      principalMinor: input.principalMinor,
      burnTxRef: burn.txRef,
    });
    const anchorRef = `${anchor.topicId}#${anchor.sequenceNumber}`;

    // Atomic: pro-rata guarded debits + outbox + (if fully paid down) auto-close REDEEMED.
    const result = await this.repo.amortiseNote({
      noteId,
      principalMinor: input.principalMinor,
      burnTxRef: burn.txRef,
      anchorRef,
      outbox: {
        event: "note.amortised",
        payload: { tokenId: note.tokenId, principalMinor: input.principalMinor, burnTxRef: burn.txRef },
        billing: { type: "amortise", unitsMinor: input.principalMinor, actor: "system:tokenco" },
      },
    });

    const auditDetail = {
      noteId,
      tokenId: note.tokenId,
      principalMinor: input.principalMinor,
      fullyAmortised: result.fullyAmortised,
      holders: result.allocations.length,
      burnTxRef: burn.txRef,
      anchorRef,
      adapter: burn.adapter,
    };
    audit("note.amortised", auditDetail);
    // amortisation burns supply — a governed action; flag it for anchoring once LIVE.
    await this.auditSvc.append({ actor: "system:tokenco", event: "note.amortised", detail: auditDetail, noteId, governed: true });
    this.events.emit("note.amortised", { eventLogId: result.eventLogId, noteId, tokenId: note.tokenId, principalMinor: input.principalMinor, fullyAmortised: result.fullyAmortised });

    return {
      note: result.note,
      principalMinor: input.principalMinor,
      fullyAmortised: result.fullyAmortised,
      allocations: result.allocations,
      burn: { txRef: burn.txRef, adapter: burn.adapter },
      anchorRef,
    };
  }
}
