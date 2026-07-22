import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { PrismaService } from "../store/prisma.service";
import { OpsService } from "./ops.service";

// The venue's missing clock — drives the periodic ops sweep. A Postgres advisory lock elects a single
// leader so the design is correct the day a second API node exists (never double-sweeps). Reasons
// nothing; it only schedules. First tick fires after the interval (never during the boot seed).
const OPS_LEADER_LOCK = 918273645;
const SWEEP_MS = 5 * 60 * 1000;

@Injectable()
export class OpsClockService {
  private readonly log = new Logger("OpsClock");
  private running = false;

  constructor(
    private readonly db: PrismaService,
    private readonly ops: OpsService,
  ) {}

  @Interval("ops-sweep", SWEEP_MS)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.db.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${OPS_LEADER_LOCK}) AS locked`;
      if (!rows[0]?.locked) return; // another node is the leader this tick
      try {
        const r = await this.ops.sweep();
        if (r.halted) this.log.warn("ops sweep skipped — kill-switch engaged");
        else if (r.created > 0 || r.resolved > 0) this.log.warn(`ops sweep: +${r.created} new, -${r.resolved} resolved, ${r.open} open`);
      } finally {
        await this.db.$queryRaw`SELECT pg_advisory_unlock(${OPS_LEADER_LOCK})`;
      }
    } catch (e) {
      this.log.warn(`ops sweep failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
