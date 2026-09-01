import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { audit } from "../common/audit";
import { MintRepository } from "../mint/note.repository";
import { selectHcsAdapter } from "../surveillance/hcs.adapter";

export interface BreakGlassInput {
  regulatorDid: string;
  lawfulPurpose: string;
}

@Injectable()
export class BreakGlassService {
  constructor(private readonly repo: MintRepository) {}

  /**
   * Regulator break-glass for T2 (loan-level/PII). The venue holds no T2 — that stays off-chain and
   * encrypted at AssureLocker. What the venue does is ANCHOR the access event (tamper-evident
   * who-saw-what-when), gated by a lawful-purpose attestation. The regulator gets more access than any
   * market participant, on lawful terms, with an audit trail no one can alter (§8.2).
   */
  async request(noteId: string, input: BreakGlassInput) {
    const note = await this.repo.getNote(noteId);
    if (!note) throw new NotFoundException("note not found");
    if (await this.repo.isGovernedTokenRepresentation(noteId)) {
      throw new BadRequestException("governed token representation: direct legacy break-glass anchoring is disabled; use the case-scoped governed access workflow");
    }
    if (!input.regulatorDid) throw new BadRequestException("regulatorDid required");
    if (!input.lawfulPurpose || input.lawfulPurpose.trim().length < 10) throw new BadRequestException("a lawful-purpose attestation (≥10 chars) is required");

    const anchor = await selectHcsAdapter().anchor({ event: "t2_break_glass", noteId, tapeHash: note.tapeHash, regulatorDid: input.regulatorDid, lawfulPurpose: input.lawfulPurpose });
    const grant = await this.repo.saveBreakGlass({ noteId, regulatorDid: input.regulatorDid, lawfulPurpose: input.lawfulPurpose, anchorRef: `${anchor.topicId}#${anchor.sequenceNumber}` });
    audit("breakglass.requested", { noteId, regulatorDid: input.regulatorDid, anchorRef: grant.anchorRef });

    return {
      grant,
      note: "T2 (loan-level/PII) is served by AssureLocker under its own regulator break-glass; this venue anchors the ACCESS event only.",
    };
  }

  async list(noteId: string) {
    if (!(await this.repo.getNote(noteId))) throw new NotFoundException("note not found");
    if (await this.repo.isGovernedTokenRepresentation(noteId)) throw new NotFoundException("note not found");
    return this.repo.listBreakGlass(noteId);
  }
}
