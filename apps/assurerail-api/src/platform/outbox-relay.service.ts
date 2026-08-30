import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { inspectPersistenceFlags, type DurableRelayMode } from "../persistence/feature-flags";
import { PrismaService } from "../store/prisma.service";
import { WebhooksService, webhookMatchesEvent } from "./webhooks.service";

const RELAY_INTERVAL_MS = 5_000;
const CLAIM_BATCH = 25;

interface ClaimedOutbox {
  readonly id: string;
  readonly event: string;
  readonly payloadDigest: string;
}

interface ClaimedDelivery {
  readonly id: string;
  readonly attempt: number;
}

export type DeliveryJobState = "DELIVERED" | "BLOCKED" | "RETRY" | "DEAD_LETTER";

export function deliveryJobState(
  outcome: { delivered: boolean; retryable: boolean; blocked: boolean },
  attempt: number,
  maxAttempts: number,
): DeliveryJobState {
  if (outcome.delivered) return "DELIVERED";
  if (outcome.blocked) return "BLOCKED";
  if (outcome.retryable && attempt < maxAttempts) return "RETRY";
  return "DEAD_LETTER";
}

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) return fallback;
  return value;
}

/** Durable DB-backed relay. Claims survive restarts; network acknowledgement remains at-least-once. */
@Injectable()
export class OutboxRelayService implements OnModuleInit {
  private readonly log = new Logger("OutboxRelay");
  private readonly workerId = `relay_${process.pid}_${randomUUID()}`;
  private readonly mode: DurableRelayMode = inspectPersistenceFlags(process.env).durableRelay;
  private readonly maxAttempts = boundedInteger(process.env.ARAIL_WEBHOOK_MAX_ATTEMPTS, 8, 1, 50);
  private readonly baseRetryMs = boundedInteger(process.env.ARAIL_WEBHOOK_RETRY_BASE_MS, 1_000, 250, 60_000);
  private running = false;

  constructor(
    private readonly db: PrismaService,
    private readonly webhooks: WebhooksService,
  ) {}

  onModuleInit(): void {
    this.log.log(`relay mode=${this.mode}; worker=${this.workerId}`);
  }

  @Interval("assurerail-durable-outbox", RELAY_INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.mode === "legacy" || this.running) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (error) {
      this.log.warn(`relay tick failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async runOnce(): Promise<{ fanout: number; delivered: number }> {
    if (this.mode === "legacy") return { fanout: 0, delivered: 0 };
    const outbox = await this.claimOutbox(CLAIM_BATCH);
    let fanout = 0;
    for (const message of outbox) {
      try {
        await this.fanOut(message);
        fanout += 1;
      } catch (error) {
        await this.releaseOutboxForRetry(message.id, error);
      }
    }
    if (this.mode === "shadow") return { fanout, delivered: 0 };

    const deliveries = await this.claimDeliveries(CLAIM_BATCH);
    let delivered = 0;
    for (const delivery of deliveries) {
      const outcome = await this.webhooks.deliverDurable(delivery.id);
      const now = new Date();
      const state = deliveryJobState(outcome, delivery.attempt, this.maxAttempts);
      const terminal = state !== "RETRY";
      const nextAttemptAt = state === "RETRY"
        ? new Date(now.getTime() + this.retryDelayMs(delivery.attempt))
        : now;
      const updated = await this.db.webhookDelivery.updateMany({
        where: { id: delivery.id, state: "IN_FLIGHT", lockOwner: this.workerId },
        data: {
          state,
          statusCode: outcome.statusCode,
          ok: outcome.delivered,
          errorCode: outcome.errorCode,
          errorMessage: outcome.errorMessage,
          responseDigest: outcome.responseDigest,
          nextAttemptAt,
          deliveredAt: outcome.delivered ? now : null,
          terminalAt: terminal ? now : null,
          lockedAt: null,
          lockOwner: null,
        },
      });
      if (updated.count === 1 && outcome.delivered) delivered += 1;
    }
    return { fanout, delivered };
  }

  private async claimOutbox(limit: number): Promise<ClaimedOutbox[]> {
    return this.db.$queryRaw<ClaimedOutbox[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "OutboxMessage"
        WHERE (
          ("state" IN ('PENDING', 'RETRY') AND "nextAttemptAt" <= CURRENT_TIMESTAMP)
          OR ("state" = 'PROCESSING' AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '2 minutes')
        )
        ORDER BY "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "OutboxMessage" AS message
      SET
        "state" = 'PROCESSING',
        "attemptCount" = message."attemptCount" + 1,
        "lockedAt" = CURRENT_TIMESTAMP,
        "lockOwner" = ${this.workerId},
        "updatedAt" = CURRENT_TIMESTAMP
      FROM candidates
      WHERE message."id" = candidates."id"
      RETURNING message."id", message."event", message."payloadDigest"
    `);
  }

  private async fanOut(message: ClaimedOutbox): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const current = await tx.outboxMessage.findFirst({
        where: { id: message.id, state: "PROCESSING", lockOwner: this.workerId },
      });
      if (!current) return;
      const subscriptions = await tx.webhookSubscription.findMany({
        where: {
          active: true,
          endpointStatus: "VERIFIED",
          revokedAt: null,
          // A newly verified subscriber must not receive historical events that
          // predate its verified ownership of the endpoint.
          verifiedAt: { lte: current.createdAt },
        },
        select: { id: true, events: true },
      });
      const matching = subscriptions.filter((subscription) => webhookMatchesEvent(subscription.events, current.event));
      if (matching.length > 0) {
        await tx.webhookDelivery.createMany({
          data: matching.map((subscription) => ({
            id: `whd_${randomUUID()}`,
            subscriptionId: subscription.id,
            outboxMessageId: current.id,
            event: current.event,
            payloadDigest: current.payloadDigest,
            state: this.mode === "shadow" ? "SHADOW_SUPPRESSED" : "PENDING",
            ok: false,
            nextAttemptAt: new Date(),
            terminalAt: this.mode === "shadow" ? new Date() : null,
          })),
          skipDuplicates: true,
        });
      }
      const completed = await tx.outboxMessage.updateMany({
        where: { id: current.id, state: "PROCESSING", lockOwner: this.workerId },
        data: {
          state: "FANOUT_COMPLETE",
          completedAt: new Date(),
          lockedAt: null,
          lockOwner: null,
          lastError: null,
        },
      });
      if (completed.count !== 1) throw new Error("outbox lease was lost before fanout completion");
    });
  }

  private async releaseOutboxForRetry(messageId: string, error: unknown): Promise<void> {
    const existing = await this.db.outboxMessage.findUnique({ where: { id: messageId }, select: { attemptCount: true } });
    const exhausted = (existing?.attemptCount ?? this.maxAttempts) >= this.maxAttempts;
    const message = error instanceof Error ? error.message : String(error);
    await this.db.outboxMessage.updateMany({
      where: { id: messageId, state: "PROCESSING", lockOwner: this.workerId },
      data: {
        state: exhausted ? "DEAD_LETTER" : "RETRY",
        nextAttemptAt: exhausted ? new Date() : new Date(Date.now() + this.retryDelayMs(existing?.attemptCount ?? 1)),
        lockedAt: null,
        lockOwner: null,
        lastError: message.slice(0, 500),
        completedAt: exhausted ? new Date() : null,
      },
    });
  }

  private async claimDeliveries(limit: number): Promise<ClaimedDelivery[]> {
    return this.db.$queryRaw<ClaimedDelivery[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "WebhookDelivery"
        WHERE "outboxMessageId" IS NOT NULL AND (
          ("state" IN ('PENDING', 'RETRY') AND "nextAttemptAt" <= CURRENT_TIMESTAMP)
          OR ("state" = 'IN_FLIGHT' AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '2 minutes')
        )
        ORDER BY "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "WebhookDelivery" AS delivery
      SET
        "state" = 'IN_FLIGHT',
        "attempt" = delivery."attempt" + 1,
        "lockedAt" = CURRENT_TIMESTAMP,
        "lockOwner" = ${this.workerId},
        "updatedAt" = CURRENT_TIMESTAMP
      FROM candidates
      WHERE delivery."id" = candidates."id"
      RETURNING delivery."id", delivery."attempt"
    `);
  }

  private retryDelayMs(attempt: number): number {
    return Math.min(15 * 60_000, this.baseRetryMs * (2 ** Math.max(0, attempt - 1)));
  }
}
