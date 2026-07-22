import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../auth/public.decorator";
import { MintRepository } from "../mint/note.repository";

// Liveness (/healthz — the process is up) + readiness (/readyz — the store is reachable). Both @Public.
// The ops LivenessSentinel and the k6 load-test harness consume these. readyz uses the index-only count
// as a cheap store-reachability probe (works in both DB and in-memory modes; 503 when the DB is down).
@Controller()
export class HealthController {
  constructor(private readonly repo: MintRepository) {}

  @Public()
  @Get("healthz")
  healthz() {
    return { ok: true, venue: "AssureRail", uptimeSec: Math.round(process.uptime()) };
  }

  @Public()
  @Get("readyz")
  async readyz(@Res() res: Response) {
    try {
      await this.repo.countNotesByState();
      res.status(200).json({ ready: true });
    } catch (e) {
      res.status(503).json({ ready: false, error: (e as Error).message });
    }
  }
}
