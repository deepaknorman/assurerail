import { Injectable } from "@nestjs/common";

export interface AuditEntry {
  actor: string; // system:tokenco (lifecycle) | system:tokenco-ops (remediation) | did:...
  event: string;
  detail: Record<string, unknown>; // redacted — hashes/row-ids/aggregates, never raw holder/pool/tape data
  noteId?: string | null;
  governed?: boolean; // burn / break-glass / LIVE writes — anchored once LIVE
}

/**
 * The venue's durable audit sink. StoreModule binds the Prisma-backed hash-chained appender in DB mode
 * and the no-op below in the ephemeral in-memory DEMO (nothing queries AuditLog there). This file holds
 * NO Prisma import so the in-memory DEMO can boot without the generated client (mirrors how
 * MintRepository / InMemoryMintRepository live apart from the Prisma impl).
 */
export abstract class AuditService {
  abstract append(entry: AuditEntry): Promise<void>;
}

@Injectable()
export class NoopAuditService extends AuditService {
  async append(): Promise<void> {
    /* DEMO in-memory: no AuditLog store; the console line still comes from common/audit.ts */
  }
}
