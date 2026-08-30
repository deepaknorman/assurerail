import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { sha256Digest, toCanonicalValue } from "../contracts/v1";
import { PrismaService } from "../store/prisma.service";
import { WebhookEgressError, WebhookEgressService } from "./webhook-egress.service";
import { WebhookSecretVaultService } from "./webhook-secret-vault.service";

export interface WebhookDeliveryOutcome {
  readonly delivered: boolean;
  readonly retryable: boolean;
  readonly blocked: boolean;
  readonly statusCode: number | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly responseDigest: string | null;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value) as unknown as Prisma.InputJsonValue;
}

function responseDigest(body: string): string {
  return `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function eventList(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function webhookMatchesEvent(events: Prisma.JsonValue, event: string): boolean {
  const allowed = eventList(events);
  return allowed.includes("*") || allowed.includes(event);
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly db: PrismaService,
    private readonly vault: WebhookSecretVaultService,
    private readonly egress: WebhookEgressService,
  ) {}

  list() {
    return this.db.webhookSubscription.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        institutionId: true,
        url: true,
        events: true,
        active: true,
        endpointStatus: true,
        verifiedAt: true,
        disabledReason: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async subscribe(url: string, events: string[], institutionId?: string) {
    await this.egress.validateEndpoint(url);
    const normalizedEvents = [...new Set(events.map((event) => event.trim()).filter(Boolean))];
    if (normalizedEvents.length === 0 || normalizedEvents.length > 100) {
      throw new BadRequestException("between 1 and 100 webhook event names are required");
    }
    if (normalizedEvents.some((event) => event.length > 120 || !/^[a-zA-Z0-9.*_-]+$/.test(event))) {
      throw new BadRequestException("webhook event names contain an invalid value");
    }
    const id = `whs_${randomUUID()}`;
    const secret = randomBytes(32).toString("base64url");
    // Persist the identity first so a Vault/DB split failure always leaves an operator-visible row
    // at the same stable ID as the Vault path, rather than an undiscoverable orphaned secret.
    await this.db.webhookSubscription.create({
      data: {
        id,
        institutionId: institutionId?.trim() || null,
        url,
        secret: null,
        secretVaultRef: null,
        events: normalizedEvents as Prisma.InputJsonValue,
        active: false,
        endpointStatus: "PENDING_VERIFICATION",
        disabledReason: "VAULT_PROVISIONING_IN_PROGRESS",
      },
    });
    let secretVaultRef: string;
    try {
      secretVaultRef = await this.vault.put(id, secret);
      const provisioned = await this.db.webhookSubscription.updateMany({
        where: { id, secretVaultRef: null, revokedAt: null },
        data: { secretVaultRef, disabledReason: null },
      });
      if (provisioned.count !== 1) throw new ConflictException("webhook subscription changed during Vault provisioning");
    } catch (error) {
      await this.db.webhookSubscription.updateMany({
        where: { id, secretVaultRef: null },
        data: {
          active: false,
          endpointStatus: "DISABLED",
          disabledReason: "VAULT_PROVISIONING_FAILED_REQUIRES_OPERATOR_REPAIR",
        },
      }).catch(() => undefined);
      throw error;
    }
    const subscription = await this.db.webhookSubscription.findUniqueOrThrow({ where: { id } });
    return {
      id: subscription.id,
      institutionId: subscription.institutionId,
      url: subscription.url,
      events: subscription.events,
      active: subscription.active,
      endpointStatus: subscription.endpointStatus,
      secret,
    };
  }

  async verify(id: string) {
    const subscription = await this.db.webhookSubscription.findUnique({ where: { id } });
    if (!subscription) throw new NotFoundException("webhook subscription not found");
    if (subscription.endpointStatus === "REVOKED" || subscription.revokedAt) {
      throw new ConflictException("revoked webhook subscriptions cannot be re-verified");
    }
    if (!subscription.secretVaultRef) {
      throw new ConflictException("webhook subscription has no Vault secret; re-provision it instead of activating legacy data");
    }
    await this.egress.validateEndpoint(subscription.url);
    const challenge = randomBytes(32).toString("base64url");
    const challengeHash = responseDigest(challenge);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1_000);
    await this.db.webhookSubscription.update({
      where: { id },
      data: {
        active: false,
        endpointStatus: "PENDING_VERIFICATION",
        verificationChallengeHash: challengeHash,
        verificationExpiresAt: expiresAt,
        disabledReason: null,
      },
    });
    const secret = await this.vault.get(subscription.secretVaultRef);
    const payload = JSON.stringify({
      event: "assurerail.webhook.challenge",
      subscriptionId: id,
      challenge,
      expiresAt: expiresAt.toISOString(),
    });
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    const result = await this.egress.post(subscription.url, payload, {
      "Content-Type": "application/json",
      "X-ARAIL-Event": "assurerail.webhook.challenge",
      "X-ARAIL-Signature": `sha256=${signature}`,
      "X-ARAIL-Subscription-Id": id,
    });
    if (!result.ok) throw new BadRequestException(`webhook endpoint verification returned HTTP ${result.status}`);
    let returnedChallenge: unknown;
    try {
      returnedChallenge = (JSON.parse(result.body) as { challenge?: unknown }).challenge;
    } catch {
      throw new BadRequestException("webhook endpoint verification response must be JSON");
    }
    if (typeof returnedChallenge !== "string" || !safeEqual(returnedChallenge, challenge)) {
      throw new BadRequestException("webhook endpoint verification challenge did not match");
    }
    const expectedResponseSignature = `sha256=${createHmac("sha256", secret).update(challenge).digest("hex")}`;
    if (!result.challengeSignature || !safeEqual(result.challengeSignature, expectedResponseSignature)) {
      throw new BadRequestException("webhook endpoint verification did not prove possession of the HMAC secret");
    }
    const updated = await this.db.webhookSubscription.updateMany({
      where: {
        id,
        endpointStatus: "PENDING_VERIFICATION",
        verificationChallengeHash: challengeHash,
        verificationExpiresAt: { gt: new Date() },
      },
      data: {
        active: true,
        endpointStatus: "VERIFIED",
        verificationChallengeHash: null,
        verificationExpiresAt: null,
        verifiedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new ConflictException("webhook verification challenge expired or was superseded");
    return { ok: true, id, endpointStatus: "VERIFIED" as const, active: true };
  }

  async remove(id: string) {
    const updated = await this.db.webhookSubscription.updateMany({
      where: { id, revokedAt: null },
      data: {
        active: false,
        endpointStatus: "REVOKED",
        disabledReason: "REVOKED_BY_PLATFORM_OPERATOR",
        verificationChallengeHash: null,
        verificationExpiresAt: null,
        revokedAt: new Date(),
      },
    });
    if (updated.count === 0) throw new NotFoundException("active webhook subscription not found");
    return { ok: true };
  }

  deliveries(limit = 50) {
    return this.db.webhookDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        subscriptionId: true,
        outboxMessageId: true,
        event: true,
        payloadDigest: true,
        state: true,
        attempt: true,
        statusCode: true,
        ok: true,
        nextAttemptAt: true,
        errorCode: true,
        responseDigest: true,
        deliveredAt: true,
        terminalAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async replayDelivery(id: string): Promise<{ ok: true; id: string }> {
    const updated = await this.db.webhookDelivery.updateMany({
      where: { id, state: { in: ["DEAD_LETTER", "BLOCKED"] }, outboxMessageId: { not: null } },
      data: {
        state: "PENDING",
        attempt: 0,
        nextAttemptAt: new Date(),
        lockedAt: null,
        lockOwner: null,
        errorCode: null,
        errorMessage: null,
        statusCode: null,
        ok: false,
        deliveredAt: null,
        terminalAt: null,
      },
    });
    if (updated.count !== 1) throw new ConflictException("only terminal durable delivery jobs can be replayed");
    return { ok: true, id };
  }

  /** Transitional legacy relay. Durable mode never calls this in-process path. */
  async dispatch(event: string, payload: Record<string, unknown>): Promise<void> {
    const subscriptions = await this.db.webhookSubscription.findMany({
      where: { active: true, endpointStatus: "VERIFIED", revokedAt: null },
    });
    const canonicalPayload = asJson(payload);
    const digest = sha256Digest(canonicalPayload);
    for (const subscription of subscriptions) {
      if (!webhookMatchesEvent(subscription.events, event)) continue;
      const id = `whd_${randomUUID()}`;
      await this.db.webhookDelivery.create({
        data: {
          id,
          subscriptionId: subscription.id,
          event,
          payloadDigest: digest,
          state: "IN_FLIGHT",
          attempt: 1,
          lockedAt: new Date(),
          lockOwner: "legacy-in-process",
        },
      });
      const outcome = await this.deliver(subscription, id, 1, event, canonicalPayload, digest, new Date());
      await this.db.webhookDelivery.update({
        where: { id },
        data: {
          state: outcome.delivered ? "DELIVERED" : outcome.blocked ? "BLOCKED" : "DEAD_LETTER",
          statusCode: outcome.statusCode,
          ok: outcome.delivered,
          errorCode: outcome.errorCode,
          errorMessage: outcome.errorMessage,
          responseDigest: outcome.responseDigest,
          deliveredAt: outcome.delivered ? new Date() : null,
          terminalAt: new Date(),
          lockedAt: null,
          lockOwner: null,
        },
      });
    }
  }

  async deliverDurable(deliveryId: string): Promise<WebhookDeliveryOutcome> {
    const delivery = await this.db.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery?.outboxMessageId) return this.failure("DELIVERY_NOT_DURABLE", "delivery has no outbox message", false, true);
    const [subscription, outbox] = await Promise.all([
      this.db.webhookSubscription.findUnique({ where: { id: delivery.subscriptionId } }),
      this.db.outboxMessage.findUnique({ where: { id: delivery.outboxMessageId } }),
    ]);
    if (!subscription || !subscription.active || subscription.endpointStatus !== "VERIFIED" || subscription.revokedAt) {
      return this.failure("SUBSCRIPTION_NOT_ACTIVE", "subscription is absent, unverified, disabled or revoked", false, true);
    }
    if (!outbox) return this.failure("OUTBOX_NOT_FOUND", "outbox message is absent", false, true);
    const digest = sha256Digest(outbox.payload);
    if (digest !== outbox.payloadDigest || delivery.payloadDigest !== outbox.payloadDigest) {
      return this.failure("PAYLOAD_DIGEST_MISMATCH", "outbox payload digest does not reconcile", false, true);
    }
    return this.deliver(subscription, delivery.id, delivery.attempt, outbox.event, outbox.payload, digest, outbox.createdAt);
  }

  private async deliver(
    subscription: { id: string; url: string; secretVaultRef: string | null },
    deliveryId: string,
    attempt: number,
    event: string,
    payload: Prisma.JsonValue | Prisma.InputJsonValue,
    payloadDigest: string,
    occurredAt: Date,
  ): Promise<WebhookDeliveryOutcome> {
    if (!subscription.secretVaultRef) {
      return this.failure("VAULT_REFERENCE_MISSING", "subscription has no Vault secret reference", false, true);
    }
    try {
      const secret = await this.vault.get(subscription.secretVaultRef);
      const body = JSON.stringify({
        event,
        payload,
        payloadDigest,
        occurredAt: occurredAt.toISOString(),
        delivery: { idempotencyKey: deliveryId, attempt },
      });
      const signature = createHmac("sha256", secret).update(body).digest("hex");
      const result = await this.egress.post(subscription.url, body, {
        "Content-Type": "application/json",
        "X-ARAIL-Event": event,
        "X-ARAIL-Delivery-Id": deliveryId,
        "X-ARAIL-Signature": `sha256=${signature}`,
      });
      const digest = responseDigest(result.body);
      if (result.ok) {
        return {
          delivered: true,
          retryable: false,
          blocked: false,
          statusCode: result.status,
          errorCode: null,
          errorMessage: null,
          responseDigest: digest,
        };
      }
      const retryable = result.status === 408 || result.status === 425 || result.status === 429 || result.status >= 500;
      return {
        delivered: false,
        retryable,
        blocked: false,
        statusCode: result.status,
        errorCode: `HTTP_${result.status}`,
        errorMessage: `webhook endpoint returned HTTP ${result.status}`,
        responseDigest: digest,
      };
    } catch (error) {
      const code = error instanceof WebhookEgressError
        ? error.code
        : (error as { code?: string } | null)?.code ?? "DELIVERY_ERROR";
      const blocked = [
        "SSRF_BLOCKED",
        "HTTPS_REQUIRED",
        "REDIRECT_BLOCKED",
        "URL_CREDENTIALS_BLOCKED",
        "URL_QUERY_BLOCKED",
        "URL_FRAGMENT_BLOCKED",
      ].includes(code);
      return this.failure(code, (error as Error).message || "webhook delivery failed", !blocked, blocked);
    }
  }

  private failure(code: string, message: string, retryable: boolean, blocked: boolean): WebhookDeliveryOutcome {
    return {
      delivered: false,
      retryable,
      blocked,
      statusCode: null,
      errorCode: code.slice(0, 120),
      errorMessage: message.slice(0, 500),
      responseDigest: null,
    };
  }
}
