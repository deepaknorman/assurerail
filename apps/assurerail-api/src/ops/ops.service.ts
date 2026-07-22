import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { PrismaService } from "../store/prisma.service";
import { IntegrityEngineService, type Finding } from "./integrity-engine.service";

const j = (v: unknown): Prisma.InputJsonValue | undefined => (v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue));
const fingerprintOf = (checkKey: string, scopeRef?: string) => createHash("sha256").update(`${checkKey}|${scopeRef ?? ""}`).digest("hex");

// The ops sweep — runs the deterministic detectors, turns breaks into deduped OpsFindings (dedupe by
// fingerprint = sha256(checkKey|scopeRef)), auto-resolves findings that no longer reproduce, and updates
// the OpsControl heartbeat. Read-only w.r.t. domain data; obeys the out-of-band kill-switch.
@Injectable()
export class OpsService {
  constructor(
    private readonly db: PrismaService,
    private readonly engine: IntegrityEngineService,
  ) {}

  async control() {
    return this.db.opsControl.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
  }

  async setControl(patch: { killSwitch?: boolean; agentMode?: string }) {
    const data: { killSwitch?: boolean; agentMode?: string } = {};
    if (patch.killSwitch !== undefined) data.killSwitch = patch.killSwitch;
    if (patch.agentMode !== undefined) data.agentMode = patch.agentMode;
    return this.db.opsControl.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
  }

  /** Liveness dead-man's switch: a lifecycle row newer than the newest EventLog means the outbox/sink lagged. */
  async liveness(): Promise<Finding[]> {
    const [lastEvent, lastNote, lastDvp] = await Promise.all([
      this.db.eventLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      this.db.note.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      this.db.dvp.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    const newestLifecycle = Math.max(lastNote?.createdAt.getTime() ?? 0, lastDvp?.createdAt.getTime() ?? 0);
    const newestEvent = lastEvent?.createdAt.getTime() ?? 0;
    if (newestLifecycle > 0 && newestLifecycle - newestEvent > 60_000) {
      return [{ checkKey: "liveness.eventlog_deadman", severity: "CRITICAL", scopeType: "GLOBAL", summary: "lifecycle advanced but EventLog did not — the outbox/sink may be dead" }];
    }
    return [];
  }

  async sweep(): Promise<{ halted?: boolean; open: number; created: number; resolved: number }> {
    const ctrl = await this.control();
    if (ctrl.killSwitch) return { halted: true, open: 0, created: 0, resolved: 0 };

    const raw = [...(await this.engine.run()), ...(await this.liveness())];
    const now = new Date();
    const seen = new Set<string>();
    let created = 0;

    for (const finding of raw) {
      const fingerprint = fingerprintOf(finding.checkKey, finding.scopeRef);
      seen.add(fingerprint);
      const source = finding.checkKey.startsWith("liveness") ? "sentinel" : "integrity";
      const existing = await this.db.opsFinding.findUnique({ where: { fingerprint }, select: { id: true } });
      if (existing) {
        await this.db.opsFinding.update({
          where: { fingerprint },
          data: { lastSeenAt: now, seenCount: { increment: 1 }, status: "OPEN", resolvedAt: null, severity: finding.severity, summary: finding.summary, observed: j(finding.observed), expected: j(finding.expected) },
        });
      } else {
        created++;
        await this.db.opsFinding.create({
          data: { source, checkKey: finding.checkKey, fingerprint, severity: finding.severity, status: "OPEN", scopeType: finding.scopeType, scopeRef: finding.scopeRef ?? null, summary: finding.summary, observed: j(finding.observed), expected: j(finding.expected) },
        });
      }
    }

    // auto-resolve OPEN findings that didn't reproduce this sweep
    const open = await this.db.opsFinding.findMany({ where: { status: "OPEN" }, select: { fingerprint: true } });
    const stale = open.filter((o) => !seen.has(o.fingerprint)).map((o) => o.fingerprint);
    let resolved = 0;
    if (stale.length) {
      const r = await this.db.opsFinding.updateMany({ where: { fingerprint: { in: stale } }, data: { status: "RESOLVED", resolvedAt: now } });
      resolved = r.count;
    }

    const openCount = await this.db.opsFinding.count({ where: { status: "OPEN" } });
    await this.db.opsControl.update({ where: { id: "singleton" }, data: { lastSweepAt: now, lastFindingCount: openCount } });
    return { open: openCount, created, resolved };
  }

  async findings(status = "OPEN") {
    return this.db.opsFinding.findMany({
      where: status === "ALL" ? {} : { status },
      orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
      take: 200,
    });
  }

  async health() {
    const ctrl = await this.control();
    const [open, critical] = await Promise.all([
      this.db.opsFinding.count({ where: { status: "OPEN" } }),
      this.db.opsFinding.count({ where: { status: "OPEN", severity: "CRITICAL" } }),
    ]);
    return {
      status: critical > 0 ? "critical" : open > 0 ? "degraded" : "ok",
      open,
      critical,
      killSwitch: ctrl.killSwitch,
      agentMode: ctrl.agentMode,
      lastSweepAt: ctrl.lastSweepAt,
      uptimeSec: Math.round(process.uptime()),
    };
  }
}
