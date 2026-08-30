import { Injectable } from "@nestjs/common";
import { DigiKycGateService } from "./digikyc-gate.service";

export interface IdentityBindingResult {
  ok: boolean;
  providerKey: string;
  subject?: string;
  reason?: string;
}
/**
 * Provider-neutral identity-binding boundary. AssureLocker DigiKYC is the first adapter, not a Rail
 * admission authority and not a compulsory field in the institution or mandate model.
 */
@Injectable()
export class IdentityBindingService {
  constructor(private readonly assureLockerDigiKyc: DigiKycGateService) {}

  async verify(input: { provider?: string; email: string; claimedSubject?: string }): Promise<IdentityBindingResult> {
    const provider = (input.provider ?? "ASSURELOCKER_DIGIKYC").trim().toUpperCase();
    if (provider !== "ASSURELOCKER_DIGIKYC") {
      return { ok: false, providerKey: provider, reason: "identity-provider-not-configured" };
    }
    const result = await this.assureLockerDigiKyc.verify(input.email, input.claimedSubject);
    return { ok: result.ok, providerKey: provider, subject: result.did, reason: result.reason };
  }
}
