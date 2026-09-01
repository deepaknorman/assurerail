import { BadRequestException, Injectable } from "@nestjs/common";
import { audit } from "../common/audit";
import { ISSUER_DID } from "../common/constants";
import { TapeService } from "../tape/tape.service";
import { selectHtsAdapter } from "../hts/hts.adapter";
import { checkKAnon } from "./kanon";
import { isReceivablesPool } from "../tape/receivables-demo-tape";
import { verifyTrusteeAuthorisation, type TrusteeAuthorisation } from "../trustee/trustee-authorisation";
import { MintRepository } from "./note.repository";
import { VenueEventBus } from "../events/venue-events";
import { AuditService } from "../store/audit.service";
import { assertLegacyExternalEffectPathAllowed } from "../runtime/legacy-external-effect.guard";

@Injectable()
export class MintService {
  constructor(
    private readonly tape: TapeService,
    private readonly repo: MintRepository,
    private readonly events: VenueEventBus,
    private readonly auditSvc: AuditService,
  ) {}

  /**
   * The mint flow: verified + mint-ready tape → trustee authorisation (receivables pools) → k-anon gate
   * → HTS mint → Note + MintLog.
   *
   * MODEL B: for a receivables pool the mint is the TRUSTEE's issuance act, not AssureRail's. The
   * trustee's signed authorisation is therefore a GATE, not a parallel artefact — without one, or with
   * one that does not bind this exact (pool, tape, mintable amount), the mint is refused. The Note is
   * then issued to the TRUSTEE's DID rather than the venue's own, so the opening 100% holding sits with
   * the issuing trust. Previously the authorisation was merely emitted alongside an unconditional mint
   * under AssureRail's hardcoded ISSUER_DID — which reads as sequencing theatre to anyone who inspects
   * the code or calls this endpoint directly, and is the opposite of what the demo is meant to prove.
   */
  async mint(poolId: string, authorisation?: TrusteeAuthorisation) {
    assertLegacyExternalEffectPathAllowed("legacy.note.mint");
    const { tape, verification } = await this.tape.load(poolId);
    if (!verification.ok) throw new BadRequestException(`tape failed verification: ${verification.reasons.join("; ")}`);
    if (!verification.mintReady) throw new BadRequestException(`not mint-ready: ${verification.reasons.join("; ")}`);

    const requiresTrustee = isReceivablesPool(poolId);
    let issuerDid = ISSUER_DID;
    if (requiresTrustee) {
      if (!authorisation) {
        throw new BadRequestException(
          "receivables-pool mint requires a trustee issuance authorisation — the mint is the trustee's act (Model B)",
        );
      }
      const verified = verifyTrusteeAuthorisation(authorisation);
      if (!verified.ok) {
        throw new BadRequestException(`trustee authorisation invalid: ${verified.reason ?? "unverified"}`);
      }
      // Bind the authorisation to THIS issuance. A valid signature over a different pool, a stale tape,
      // or a different amount must not authorise this mint.
      const mismatches: string[] = [];
      if (authorisation.poolId !== poolId) mismatches.push("poolId");
      if (authorisation.tapeHash !== tape.tapeHash) mismatches.push("tapeHash");
      if (authorisation.mintableMinor !== String(tape.aggregates.mintableMinor)) mismatches.push("mintableMinor");
      if (mismatches.length > 0) {
        throw new BadRequestException(
          `trustee authorisation does not bind this issuance (mismatched: ${mismatches.join(", ")})`,
        );
      }
      issuerDid = authorisation.trusteeDid;
    }

    const kanon = checkKAnon(tape);
    if (!kanon.ok) {
      // Append-only: a blocked attempt is still recorded.
      await this.repo.saveMintLog({ poolId, tapeHash: tape.tapeHash, kAnonPassed: false, kAnonDetail: kanon.detail, lockRef: tape.lock?.reference ?? "", htsTxRef: "", actor: requiresTrustee ? issuerDid : "system:tokenco" });
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
      // actor = the party whose act this mint IS. For a trustee-authorised issuance that is the trustee.
      mintLog: { poolId, tapeHash: tape.tapeHash, kAnonPassed: true, kAnonDetail: kanon.detail, lockRef: tape.lock?.reference ?? "", htsTxRef: mintRes.tokenId, actor: requiresTrustee ? issuerDid : "system:tokenco" },
      issuerDid,
      issuerUnits: BigInt(tape.aggregates.mintableMinor),
      outbox: {
        event: "note.minted",
        payload: { poolId, tokenId: mintRes.tokenId, mintableMinor },
        billing: { type: "mint", unitsMinor: mintableMinor, actor: "system:tokenco" },
      },
    });
    const auditDetail = { poolId, tokenId: mintRes.tokenId, serials: mintRes.serials.length, adapter: mintRes.adapter, issuerDid, trusteeAuthorised: requiresTrustee, trusteeNonce: authorisation?.nonce ?? null };
    audit("mint.issued", auditDetail);
    await this.auditSvc.append({ actor: requiresTrustee ? issuerDid : "system:tokenco", event: "mint.issued", detail: auditDetail, noteId: note.id });
    this.events.emit("note.minted", { eventLogId, noteId: note.id, poolId, tokenId: mintRes.tokenId, mintableMinor });
    return { note, kanon: kanon.detail, adapter: mintRes.adapter, issuerDid, trusteeAuthorised: requiresTrustee };
  }
}
