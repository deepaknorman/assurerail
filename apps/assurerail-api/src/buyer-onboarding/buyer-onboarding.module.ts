import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { InternalAccessModule } from "../internal-access/internal-access.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { BuyerOnboardingService } from "./buyer-onboarding.service";
import { BuyerOnboardingController, BuyerMsaController } from "./buyer-onboarding.controllers";
@Module({imports:[StoreModule,InstitutionsModule,InternalAccessModule,SecurityModule],providers:[BuyerOnboardingService],controllers:[BuyerOnboardingController,BuyerMsaController]})
export class BuyerOnboardingModule {}
