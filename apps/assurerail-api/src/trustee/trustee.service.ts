import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { DEMO_TRUSTEE_DID } from "../common/constants";
import { AuditService } from "../store/audit.service";
import { VenueEventBus } from "../events/venue-events";
import { signTrusteeAuthorisation, verifyTrusteeAuthorisation, type TrusteeAuthorisation } from "./trustee-authorisation";

@Injectable()
export class TrusteeService {
  constructor(
    private readonly auditSvc: AuditService,
    private readonly events: VenueEventBus,
  ) {}

  /**
   * Emit the trustee's issuance authorisation — a distinct, signed event that stands BEFORE the mint's
   * own records. This is the evidence that the mint is the trustee's act (§7.4 step 2 / §8.5.3).
   */
  async authoriseMint(poolId: string, tapeHash: string, mintableMinor: string): Promise<TrusteeAuthorisation> {
    const auth = signTrusteeAuthorisation({
      trusteeDid: DEMO_TRUSTEE_DID,
      poolId,
      tapeHash,
      mintableMinor,
      authorisedAt: new Date().toISOString(),
      nonce: randomBytes(8).toString("hex"),
    });
    await this.auditSvc.append({
      actor: DEMO_TRUSTEE_DID,
      event: "trustee.authorised_issuance",
      detail: { poolId, tapeHash, mintableMinor, nonce: auth.nonce, scheme: auth.scheme, signature: auth.signature },
      noteId: null,
    });
    this.events.emit("trustee.authorised_issuance", { poolId, tapeHash, trusteeDid: DEMO_TRUSTEE_DID });
    return auth;
  }

  verify(auth: TrusteeAuthorisation): { ok: boolean; reason?: string } {
    return verifyTrusteeAuthorisation(auth);
  }
}
