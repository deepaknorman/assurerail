import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { MintRepository } from "../mint/note.repository";
import { DemoService } from "./demo.service";

// Idempotent boot seed: run a couple of pools through the full loop (mint → surveillance → DvP) so the
// console has data. Gating:
//   • ephemeral in-memory store  → seed by DEFAULT (harmless; keeps the DEMO console populated)
//   • persistent Postgres        → seed only on EXPLICIT opt-in (SEED_ON_BOOT=true), so a real database
//                                   is never auto-filled with demo pools
//   • SEED_ON_BOOT=false          → disabled everywhere
// The existing-notes guard makes it idempotent (never re-seeds / double-books on restart). Note: the
// guard is check-then-act, so concurrent first-boots of multiple instances against one empty DB could
// double-seed — acceptable for a dev/DEMO-only seed; a real init job would take a DB advisory lock.
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly log = new Logger("Seed");
  constructor(
    private readonly demo: DemoService,
    private readonly repo: MintRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const usingDb = !!process.env.DATABASE_URL;
    const flag = process.env.SEED_ON_BOOT;
    const enabled = flag === "true" ? true : flag === "false" ? false : !usingDb;
    if (!enabled) {
      this.log.log(`seed disabled (SEED_ON_BOOT=${flag ?? "unset"}, store=${usingDb ? "postgres" : "in-memory"})`);
      return;
    }

    const existing = await this.repo.listNotes();
    if (existing.length > 0) {
      this.log.log(`store already has ${existing.length} note(s) — skipping demo seed`);
      return;
    }

    for (const pool of ["POOL-DEMO-1", "POOL-DEMO-2"]) {
      try {
        await this.demo.run(pool, "did:web:demo-buyer");
        this.log.log(`seeded ${pool}`);
      } catch (e) {
        this.log.warn(`seed ${pool} failed: ${(e as Error).message}`);
      }
    }
  }
}
