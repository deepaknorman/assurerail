import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { StoreModule } from "../store/store.module";
import { HostedAlphaController } from "./hosted-alpha.controller";
import { HostedAlphaService } from "./hosted-alpha.service";

@Module({
  imports: [StoreModule, InstitutionsModule],
  controllers: [HostedAlphaController],
  providers: [HostedAlphaService],
})
export class HostedAlphaModule {}
