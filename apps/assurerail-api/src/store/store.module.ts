import { Module, type Provider } from "@nestjs/common";
import { InMemoryMintRepository, MintRepository } from "../mint/note.repository";

// Single shared store, injected everywhere as `MintRepository`. When DATABASE_URL is set it binds to
// the Prisma-backed store over the venue's OWN Postgres (persistent); with no DB it falls back to the
// in-memory store (ephemeral DEMO). The Prisma service + generated client are lazy-`require`d ONLY in
// DB mode, so the in-memory DEMO can boot with no generated client and never triggers $connect().
const useDb = !!process.env.DATABASE_URL;

function storeProviders(): Provider[] {
  if (!useDb) {
    return [{ provide: MintRepository, useClass: InMemoryMintRepository }];
  }
  const { PrismaService } = require("./prisma.service");
  const { PrismaMintRepository } = require("./prisma-mint.repository");
  return [PrismaService, { provide: MintRepository, useClass: PrismaMintRepository }];
}

// Export PrismaService too (DB mode only) so AuthModule can share the single connection.
function storeExports(): any[] {
  if (!useDb) return [MintRepository];
  const { PrismaService } = require("./prisma.service");
  return [MintRepository, PrismaService];
}

@Module({
  providers: storeProviders(),
  exports: storeExports(),
})
export class StoreModule {}
