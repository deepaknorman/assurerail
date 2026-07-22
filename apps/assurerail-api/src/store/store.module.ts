import { Module, type Provider } from "@nestjs/common";
import { InMemoryMintRepository, MintRepository } from "../mint/note.repository";
import { AuditService, NoopAuditService } from "./audit.service";

// Single shared store, injected everywhere as `MintRepository` / `AuditService`. When DATABASE_URL is
// set it binds the Prisma-backed stores over the venue's OWN Postgres (persistent); with no DB it falls
// back to in-memory / no-op (ephemeral DEMO). The Prisma service + generated client + Prisma-backed
// impls are lazy-`require`d ONLY in DB mode, so the in-memory DEMO can boot with no generated client and
// never triggers $connect(). (audit.service.ts holds NO Prisma import, so it can load in both modes.)
const useDb = !!process.env.DATABASE_URL;

function storeProviders(): Provider[] {
  if (!useDb) {
    return [
      { provide: MintRepository, useClass: InMemoryMintRepository },
      { provide: AuditService, useClass: NoopAuditService },
    ];
  }
  const { PrismaService } = require("./prisma.service");
  const { PrismaMintRepository } = require("./prisma-mint.repository");
  const { PrismaAuditService } = require("./prisma-audit.service");
  return [
    PrismaService,
    { provide: MintRepository, useClass: PrismaMintRepository },
    { provide: AuditService, useClass: PrismaAuditService },
  ];
}

// Export PrismaService too (DB mode only) so AuthModule can share the single connection.
function storeExports(): any[] {
  if (!useDb) return [MintRepository, AuditService];
  const { PrismaService } = require("./prisma.service");
  return [MintRepository, PrismaService, AuditService];
}

@Module({
  providers: storeProviders(),
  exports: storeExports(),
})
export class StoreModule {}
