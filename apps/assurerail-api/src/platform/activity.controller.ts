import { Controller, Get, Query } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Roles, ALL_ROLES } from "../auth/roles.decorator";
import { PrismaService } from "../store/prisma.service";
import { auditCanonical } from "../store/prisma-audit.service";

// Viewable activity / audit log — the hash-chained AuditLog surfaced to any onboarded member. Detail is
// already redacted (ids/hashes/aggregates). Returns a chain-verification of the RETURNED window so the UI
// can show a tamper-evident badge without re-scanning the whole table on every request.
@Controller("venue")
export class ActivityController {
  constructor(private readonly db: PrismaService) {}

  @Roles(...ALL_ROLES)
  @Get("activity")
  async activity(@Query("limit") limit?: string, @Query("noteId") noteId?: string) {
    const take = Math.min(limit ? Number(limit) : 50, 200);
    const [rows, total] = await Promise.all([
      this.db.auditLog.findMany({
        where: noteId ? { noteId } : {},
        orderBy: { seq: "desc" },
        take,
        select: { id: true, seq: true, actor: true, event: true, detail: true, noteId: true, governed: true, prevHash: true, hash: true, createdAt: true },
      }),
      this.db.auditLog.count(),
    ]);
    // Verify the returned window links correctly (each row's hash recomputes; each links to the prior).
    const asc = [...rows].sort((a, b) => a.seq - b.seq);
    let windowVerified = true;
    for (let i = 0; i < asc.length; i++) {
      const r = asc[i];
      const expect = createHash("sha256").update(r.prevHash + auditCanonical(r)).digest("hex");
      if (r.hash !== expect) windowVerified = false;
      if (i > 0 && asc[i].prevHash !== asc[i - 1].hash) windowVerified = false;
    }
    // Don't leak the raw hashes to the list view; expose a short fingerprint only.
    const view = rows.map((r) => ({ id: r.id, seq: r.seq, actor: r.actor, event: r.event, detail: r.detail, noteId: r.noteId, governed: r.governed, createdAt: r.createdAt, fingerprint: r.hash.slice(0, 12) }));
    return { total, windowVerified, rows: view };
  }
}
