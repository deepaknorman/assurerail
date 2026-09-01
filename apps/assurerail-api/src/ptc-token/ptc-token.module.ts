import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { PtcTokenController } from "./ptc-token.controllers";
import { PtcTokenService } from "./ptc-token.service";
@Module({ imports: [StoreModule, SecurityModule, InstitutionsModule], controllers: [PtcTokenController], providers: [PtcTokenService], exports: [PtcTokenService] })
export class PtcTokenModule {}
