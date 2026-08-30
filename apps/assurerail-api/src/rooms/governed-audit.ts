import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { auditCanonical } from "../store/prisma-audit.service";

const GOVERNED_AUDIT_LOCK_KEY = 47_362_718;

/** Append a governed audit row inside the caller's domain transaction; failure aborts the command. */
export async function appendGovernedAudit(
  tx: Prisma.TransactionClient,
  entry: { actor: string; event: string; detail: Record<string, unknown> },
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GOVERNED_AUDIT_LOCK_KEY})`;
  const last = await tx.auditLog.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
  const prevHash = last?.hash ?? "genesis";
  const canonical = auditCanonical({ ...entry, governed: true });
  const hash = createHash("sha256").update(prevHash + canonical).digest("hex");
  await tx.auditLog.create({ data: {
    id: `aud_${randomUUID()}`,
    actor: entry.actor,
    event: entry.event,
    detail: entry.detail as Prisma.InputJsonValue,
    governed: true,
    prevHash,
    hash,
  } });
}
