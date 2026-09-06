import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { config } from "../config";

export interface IdentityAssuranceResult {
  ok: boolean;
  providerKey: string;
  subject?: string;
  evidenceRef?: string;
  assuranceLevel?: string;
  expiresAt?: string;
  reason?: string;
}

function boundedText(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  return result && result.length <= maximum ? result : undefined;
}

/**
 * Provider-neutral human identity-assurance boundary.
 *
 * AssureRail owns authentication, institutional membership, mandates and authorisation. This
 * adapter only asks the deployment-selected provider whether a human subject has current identity
 * evidence. A successful response binds a provider subject; it never admits an institution or
 * grants a transaction action. Any provider, including a customer's chosen provider, may implement
 * the small HTTPS contract without sharing source code, databases or credentials with Rail.
 */
@Injectable()
export class IdentityAssuranceProviderService {
  private readonly log = new Logger("IdentityAssuranceProvider");
  private readonly mode = (process.env.IDENTITY_ASSURANCE_ADAPTER ?? "demo").trim().toLowerCase();
  private readonly providerKey = (process.env.IDENTITY_PROVIDER_KEY ?? "ASSURERAIL_DEMO_IDENTITY")
    .trim().toUpperCase();

  async verify(email: string, claimedSubject?: string): Promise<IdentityAssuranceResult> {
    const normalisedEmail = email.trim().toLowerCase();
    if (!normalisedEmail || !normalisedEmail.includes("@")) {
      return { ok: false, providerKey: this.providerKey, reason: "invalid-email" };
    }

    if (this.mode === "off") {
      return { ok: false, providerKey: this.providerKey, reason: "identity-assurance-disabled" };
    }

    if (this.mode === "demo") {
      const digest = createHash("sha256").update(normalisedEmail, "utf8").digest("hex").slice(0, 24);
      return {
        ok: true,
        providerKey: "ASSURERAIL_DEMO_IDENTITY",
        subject: claimedSubject?.trim() || `urn:assurerail:demo-subject:${digest}`,
        assuranceLevel: "DEMO_ONLY",
        reason: "demo",
      };
    }

    if (this.mode !== "live") {
      return { ok: false, providerKey: this.providerKey, reason: "identity-assurance-mode-invalid" };
    }

    if (!this.providerKey || this.providerKey === "ASSURERAIL_DEMO_IDENTITY") {
      return { ok: false, providerKey: this.providerKey, reason: "identity-provider-key-unset" };
    }
    if (!config.identityProviderApiKey) {
      return { ok: false, providerKey: this.providerKey, reason: "identity-provider-credential-unset" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.identityProviderTimeoutMs);
    try {
      const endpoint = new URL(config.identityProviderStatusPath, `${config.identityProviderApiUrl}/`);
      const response = await fetch(endpoint, {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${config.identityProviderApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: normalisedEmail, claimedSubject: claimedSubject?.trim() || undefined }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return { ok: false, providerKey: this.providerKey, reason: `identity-provider-${response.status}` };
      }
      const raw = (await response.json()) as Record<string, unknown>;
      const subject = boundedText(raw.subject, 500);
      if (raw.active !== true || !subject) {
        return { ok: false, providerKey: this.providerKey, reason: "identity-not-current" };
      }
      if (claimedSubject?.trim() && claimedSubject.trim() !== subject) {
        return { ok: false, providerKey: this.providerKey, reason: "identity-subject-mismatch" };
      }
      const expiresAt = boundedText(raw.expiresAt, 80);
      if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
        return { ok: false, providerKey: this.providerKey, reason: "identity-evidence-expired" };
      }
      return {
        ok: true,
        providerKey: this.providerKey,
        subject,
        evidenceRef: boundedText(raw.evidenceRef, 500),
        assuranceLevel: boundedText(raw.assuranceLevel, 80),
        expiresAt,
      };
    } catch (error) {
      this.log.warn(`identity assurance check failed: ${(error as Error).name}`);
      return { ok: false, providerKey: this.providerKey, reason: "identity-provider-error" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
