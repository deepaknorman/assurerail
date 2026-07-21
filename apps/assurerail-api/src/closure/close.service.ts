import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { audit } from "../common/audit";
import { MintRepository } from "../mint/note.repository";
import { selectHtsAdapter } from "../hts/hts.adapter";
import { selectHcsAdapter } from "../surveillance/hcs.adapter";

export interface CloseInput {
  reason?: string; // maturity | clean_up_call | call | amortised | manual
}

const VALID_REASONS = ["maturity", "clean_up_call", "call", "amortised", "manual"];

@Injectable()
export class CloseService {
  constructor(private readonly repo: MintRepository) {}

  /**
   * Close / redeem a Note — mint's mirror. Burns the HTS tokens (supply → 0), zeroes every holding, sets
   * the Note REDEEMED, and anchors the closure event (tamper-evident who/what/when). The MANUAL trigger
   * models a governed call / clean-up call (issuer/trustee right); the AUTOMATIC path (fully amortised,
   * from surveillance) drives the same operation with reason="amortised". Idempotent guard: a REDEEMED
   * Note cannot be closed again.
   */
  async close(noteId: string, input: CloseInput) {
    const note = await this.repo.getNote(noteId);
    if (!note) throw new NotFoundException("note not found");
    if (note.state === "REDEEMED") throw new BadRequestException("note is already redeemed");

    const reason = (input.reason ?? "manual").toLowerCase();
    if (!VALID_REASONS.includes(reason)) throw new BadRequestException(`reason must be one of: ${VALID_REASONS.join(", ")}`);

    // Burn the tokens (supply retired) — the mirror of mint. The venue holds no ledger keys; DEMO fakes
    // the burn, LIVE calls plaza's HTS TokenBurn (fail-closed until wired).
    const burn = await selectHtsAdapter().burn(note.tokenId, note.serials);

    // Anchor the closure event before the state write so the tamper-evident record exists.
    const anchor = await selectHcsAdapter().anchor({ event: "note_closed", noteId, tapeHash: note.tapeHash, tokenId: note.tokenId, reason, burnTxRef: burn.txRef });
    const anchorRef = `${anchor.topicId}#${anchor.sequenceNumber}`;

    // Atomic: zero holdings + flip REDEEMED with the burn/anchor refs.
    const { note: closed, burnedUnits } = await this.repo.closeNote({ noteId, burnTxRef: burn.txRef, closeAnchorRef: anchorRef, closeReason: reason });
    audit("note.closed", { noteId, tokenId: note.tokenId, reason, burnedUnits, burnTxRef: burn.txRef, anchorRef, adapter: burn.adapter });

    return {
      note: closed,
      burn: { txRef: burn.txRef, burnedSerials: burn.burnedSerials, burnedUnits, adapter: burn.adapter },
      anchorRef,
    };
  }
}
