import { Module } from "@nestjs/common";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { InstitutionAccessService } from "./institution-access.service";
import { InstitutionApplicationService } from "./institution-application.service";
import { InstitutionAdminController, InstitutionController } from "./institution.controllers";
import { InstitutionGovernanceService } from "./institution-governance.service";

@Module({
  imports: [StoreModule, SecurityModule],
  controllers: [InstitutionController, InstitutionAdminController],
  providers: [InstitutionAccessService, InstitutionApplicationService, InstitutionGovernanceService],
  exports: [InstitutionAccessService],
})
export class InstitutionsModule {}
