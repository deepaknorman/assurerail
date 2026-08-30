import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { PrismaService } from "../store/prisma.service";
import { SourceCompletionService } from "./source-completion.service";

@Injectable()
export class SourceCompletionWorker {
  private readonly log = new Logger(SourceCompletionWorker.name);
  private running = false;
  constructor(private readonly db: PrismaService, private readonly completions: SourceCompletionService) {}

  @Interval(15_000)
  async tick(): Promise<void> {
    if (this.running || inspectPersistenceFlags(process.env).completionAcknowledgement !== "on") return;
    this.running = true;
    try {
      const instruction = await this.db.externalInstruction.findFirst({
        where: {
          instructionType: "SOURCE_LOCK_PERMANENT",
          OR: [
            { state: { in: ["PENDING", "AMBIGUOUS"] }, nextAttemptAt: { lte: new Date() } },
            { state: "DISPATCHING", lockedAt: { lte: new Date(Date.now() - 5 * 60_000) } },
          ],
        },
        orderBy: { nextAttemptAt: "asc" }, include: { sourceCompletion: true },
      });
      if (!instruction?.sourceCompletion) return;
      const lockOwner = `worker:${process.pid}`;
      const claimed = await this.db.externalInstruction.updateMany({
        where: { id: instruction.id, state: instruction.state, attemptCount: instruction.attemptCount },
        data: { state: "DISPATCHING", attemptCount: { increment: 1 }, lockedAt: new Date(), lockOwner },
      });
      if (claimed.count !== 1) return;
      await this.db.sourceCompletion.update({ where: { id: instruction.sourceCompletion.id }, data: { state: "DISPATCHING" } });
      try { await this.completions.dispatch(instruction.sourceCompletion.id); }
      catch (error) { this.log.warn(`source completion ${instruction.sourceCompletion.id} dispatch failed: ${(error as Error).message}`); await this.completions.markDispatchFailure(instruction.sourceCompletion.id, error); }
    } finally { this.running = false; }
  }
}
