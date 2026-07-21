import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/assurerail-client";

// Client for AssureRail's OWN database (its named client — never AssureLocker's). Only instantiated
// when DATABASE_URL is set (see StoreModule); with no DB the venue falls back to the in-memory store.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("VenueDB");

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.log.log("connected to the venue database");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
