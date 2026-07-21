import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { MintRepository } from "../mint/note.repository";
import { DemoService, type SeedTarget } from "./demo.service";

// A varied demo portfolio — different lenders/sectors and lifecycle states — so the console looks real.
const SEED_POOLS: { id: string; target: SeedTarget }[] = [
  { id: "HDFC-MSME-2026Q2", target: "redeemed" },
  { id: "ICICI-RETAIL-2026Q2", target: "traded" },
  { id: "AXIS-HOUSING-2026Q1", target: "traded" },
  { id: "SBI-AGRI-2026Q2", target: "active" },
  { id: "KOTAK-VEHICLE-2026Q2", target: "issued" },
  { id: "BAJAJ-MSME-2026Q1", target: "redeemed" },
  { id: "YESBANK-RETAIL-2026Q1", target: "active" },
  { id: "IDFC-VEHICLE-2026Q2", target: "traded" },
];

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

    for (const p of SEED_POOLS) {
      try {
        const r = await this.demo.seedPool(p.id, p.target);
        this.log.log(`seeded ${p.id} → ${r.state}`);
      } catch (e) {
        this.log.warn(`seed ${p.id} failed: ${(e as Error).message}`);
      }
    }
  }
}
