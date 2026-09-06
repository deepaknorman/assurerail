import { Injectable } from "@nestjs/common";
import { IdentityAssuranceProviderService } from "./identity-assurance-provider.service";

export interface IdentityBindingResult {
  ok: boolean;
  providerKey: string;
  subject?: string;
  reason?: string;
}
/**
 * Provider-neutral identity-binding boundary. The deployment, not the caller, selects the provider.
 * A verified binding is neither participant admission nor institutional/transaction authority.
 */
@Injectable()
export class IdentityBindingService {
  constructor(private readonly identityProvider: IdentityAssuranceProviderService) {}

  async verify(input: { email: string; claimedSubject?: string }): Promise<IdentityBindingResult> {
    const result = await this.identityProvider.verify(input.email, input.claimedSubject);
    return {
      ok: result.ok,
      providerKey: result.providerKey,
      subject: result.subject,
      reason: result.reason,
    };
  }
}
