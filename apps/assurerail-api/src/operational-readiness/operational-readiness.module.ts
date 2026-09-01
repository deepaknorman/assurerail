import { Module } from "@nestjs/common";
import { InternalAccessModule } from "../internal-access/internal-access.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { OperationalReadinessController } from "./operational-readiness.controllers";
import { OperationalReadinessService } from "./operational-readiness.service";
import { OperationalActivationGuardService } from "./operational-activation-guard.service";

@Module({
  imports: [StoreModule, SecurityModule, InternalAccessModule],
  controllers: [OperationalReadinessController],
  providers: [OperationalReadinessService, OperationalActivationGuardService],
  exports: [OperationalReadinessService, OperationalActivationGuardService],
})
export class OperationalReadinessModule {}
