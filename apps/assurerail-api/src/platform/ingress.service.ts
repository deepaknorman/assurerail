import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { PrismaService } from "../store/prisma.service";

export interface IngestSpec {
  originator?: string;
  sector?: string;
  loanCount?: number;
  principalMinor?: string;
  vintage?: string;
  [k: string]: unknown;
}

// Data-feed ingress: an originator/LMS registers a pool + its high-level spec ahead of tape build.
// This is the intake ledger (source of record for "what pools were fed in"); the tape/verification
// pipeline still gates whether a registered pool becomes mint-ready. Idempotent per poolId.
@Injectable()
export class IngressService {
  constructor(private readonly db: PrismaService) {}

  async ingest(poolId: string, source: string, spec: IngestSpec) {
    if (!poolId?.trim()) throw new BadRequestException("poolId is required");
    if (!source?.trim()) throw new BadRequestException("source is required");
    const p = await this.db.ingestedPool.upsert({
      where: { poolId },
      create: { id: `ing_${randomUUID()}`, poolId: poolId.trim(), source: source.trim(), spec: (spec ?? {}) as Prisma.InputJsonValue },
      update: { source: source.trim(), spec: (spec ?? {}) as Prisma.InputJsonValue },
    });
    return { id: p.id, poolId: p.poolId, source: p.source, minted: p.minted, spec: p.spec, createdAt: p.createdAt };
  }

  list() {
    return this.db.ingestedPool.findMany({ orderBy: { createdAt: "desc" } });
  }

  /** Marks a registered pool minted once a Note references it (called by the sink or a reconcile sweep). */
  async markMinted(poolId: string) {
    await this.db.ingestedPool.updateMany({ where: { poolId }, data: { minted: true } });
  }
}
