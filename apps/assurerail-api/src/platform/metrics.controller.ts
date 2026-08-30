import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../auth/public.decorator";
import { MintRepository } from "../mint/note.repository";

// Prometheus metrics (public scrape endpoint). This controller deliberately lives outside
// platform.controllers.ts: MetricsModule is always-on, while that DB-only controller bundle imports
// PrismaService. Keeping the import boundary clean is what lets an explicit in-memory DEMO boot
// without accidentally loading local database configuration through Prisma's dependency chain.
//
// The endpoint uses the index-only countNotesByState() (never a full listNotes() hydration of every
// t1Aggregates blob) and caches the tally for 30s so a scrape burst cannot become a DoS amplifier.
const METRICS_TTL_MS = 30_000;

@Controller("metrics")
export class MetricsController {
  constructor(private readonly repo: MintRepository) {}
  private countCache: { at: number; c: Record<string, number> } | null = null;

  @Public()
  @Get()
  async metrics(@Res() res: Response) {
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    const now = Date.now();
    let c = this.countCache && now - this.countCache.at < METRICS_TTL_MS ? this.countCache.c : null;
    if (!c) {
      c = await this.repo.countNotesByState().catch(() => ({ ISSUED: 0, ACTIVE: 0, REDEEMED: 0, total: 0 }));
      this.countCache = { at: now, c };
    }
    const mem = process.memoryUsage();
    const states = ["ISSUED", "ACTIVE", "REDEEMED"];
    const lines = [
      "# HELP arail_notes_total Total notes on the venue.",
      "# TYPE arail_notes_total gauge",
      `arail_notes_total ${c.total ?? 0}`,
      "# HELP arail_notes_by_state Notes by lifecycle state.",
      "# TYPE arail_notes_by_state gauge",
      ...states.map((s) => `arail_notes_by_state{state="${s}"} ${c[s] ?? 0}`),
      "# HELP arail_process_uptime_seconds Process uptime.",
      "# TYPE arail_process_uptime_seconds gauge",
      `arail_process_uptime_seconds ${Math.round(process.uptime())}`,
      "# HELP arail_process_resident_memory_bytes Resident memory.",
      "# TYPE arail_process_resident_memory_bytes gauge",
      `arail_process_resident_memory_bytes ${mem.rss}`,
    ];
    res.send(lines.join("\n") + "\n");
  }
}
