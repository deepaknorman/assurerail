import { Injectable, Logger } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { PrismaService } from "./prisma.service";
import { AuditService, type AuditEntry } from "./audit.service";

// A fixed advisory-lock key for the audit-chain appender. Serialises appenders so the prevHash→hash
// chain can never fork under concurrency (single-writer append).
const AUDIT_LOCK_KEY = 47362718;

/**
 * Deterministic, key-sorted JSON — the canonical form the chain hash is computed over. Postgres JSONB
 * does NOT preserve object key order, so a verifier re-deriving the hash from the stored `detail` must
 * sort keys the same way. Using stable stringify makes the hash reproducible from the persisted row
 * (that's what makes the tamper-evidence checkable).
 */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",") + "}";
}

/** The exact preimage hashed for a row (excluding prevHash, which is prepended at hash time). */
export function auditCanonical(r: { actor: string; event: string; detail: unknown; noteId?: string | null; governed?: boolean }): string {
  return stableStringify({ actor: r.actor, event: r.event, detail: r.detail, noteId: r.noteId ?? null, governed: !!r.governed });
}

@Injectable()
export class PrismaAuditService extends AuditService {
  private readonly log = new Logger("Audit");
  constructor(private readonly db: PrismaService) {
    super();
  }

  /**
   * Append one row to the hash-chained AuditLog under a Postgres advisory lock (single-writer):
   * hash = sha256(prevHash + canonical(record)); a deleted/edited row breaks the chain and is detectable.
   * Best-effort: a failure logs a warning and does NOT throw — the EventLog outbox is the atomic
   * durability guarantee; this is the tamper-evident trail (audit-completeness is checked by the ops
   * IntegrityEngine). Detail is expected pre-redacted by the caller.
   */
  async append(entry: AuditEntry): Promise<void> {
    try {
      await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY})`;
        const last = await tx.auditLog.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
        const prevHash = last?.hash ?? "genesis";
        const hash = createHash("sha256").update(prevHash + auditCanonical(entry)).digest("hex");
        await tx.auditLog.create({
          data: {
            id: `aud_${randomUUID()}`,
            actor: entry.actor,
            event: entry.event,
            detail: entry.detail as Prisma.InputJsonValue,
            noteId: entry.noteId ?? null,
            governed: !!entry.governed,
            prevHash,
            hash,
          },
        });
      });
    } catch (e) {
      this.log.warn(`audit append failed (event=${entry.event}): ${(e as Error).message}`);
    }
  }
}
