import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { PrismaService } from "../store/prisma.service";
import { TokenConnectorService } from "./token-connector.service";

const INTERVAL_MS = 5_000;
const CLAIM_LIMIT = 10;

interface ClaimedAction { readonly id: string }

/** Durable at-least-once dispatcher. The provider must honour the supplied instruction idempotency key. */
@Injectable()
export class TokenConnectorWorker implements OnModuleInit {
  private readonly log = new Logger("TokenConnectorWorker");
  private readonly workerId = `token_${process.pid}_${randomUUID()}`;
  private running = false;

  constructor(private readonly db: PrismaService, private readonly connector: TokenConnectorService) {}

  onModuleInit(): void {
    this.log.log(`mode=${inspectPersistenceFlags(process.env).tokenisedDa}; worker=${this.workerId}`);
  }

  @Interval("assurerail-token-connector", INTERVAL_MS)
  async tick(): Promise<void> {
    if (inspectPersistenceFlags(process.env).tokenisedDa !== "live" || this.running) return;
    this.running = true;
    try { await this.runOnce(); }
    catch (error) { this.log.warn(`token connector tick failed: ${(error as Error).message}`); }
    finally { this.running = false; }
  }

  async runOnce(): Promise<number> {
    if (inspectPersistenceFlags(process.env).tokenisedDa !== "live") return 0;
    const actions = await this.claim(CLAIM_LIMIT);
    for (const action of actions) {
      try { await this.connector.dispatch(action.id); }
      catch (error) { await this.connector.markDispatchFailure(action.id, error); }
    }
    return actions.length;
  }

  private claim(limit: number): Promise<ClaimedAction[]> {
    return this.db.$queryRaw<ClaimedAction[]>(Prisma.sql`
      WITH candidates AS (
        SELECT action."id", instruction."id" AS "instructionId"
        FROM "TokenAction" action
        JOIN "ExternalInstruction" instruction ON instruction."id" = action."externalInstructionId"
        JOIN "TokenConnectorBinding" binding ON binding."id" = action."connectorBindingId"
        WHERE binding."status" = 'ACTIVE' AND action."state" IN ('PREPARED', 'BREAK_OPEN') AND (
          (instruction."state" IN ('PENDING', 'AMBIGUOUS') AND instruction."nextAttemptAt" <= CURRENT_TIMESTAMP)
          OR (instruction."state" = 'DISPATCHING' AND instruction."lockedAt" < CURRENT_TIMESTAMP - INTERVAL '2 minutes')
        )
        ORDER BY instruction."createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE OF instruction SKIP LOCKED
      )
      UPDATE "ExternalInstruction" instruction
      SET "state" = 'DISPATCHING', "attemptCount" = instruction."attemptCount" + 1,
          "lockedAt" = CURRENT_TIMESTAMP, "lockOwner" = ${this.workerId}, "sentAt" = COALESCE(instruction."sentAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      FROM candidates
      WHERE instruction."id" = candidates."instructionId"
      RETURNING candidates."id"
    `);
  }
}
