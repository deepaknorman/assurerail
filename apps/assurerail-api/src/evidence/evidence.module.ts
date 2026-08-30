import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { EvidenceAdminController, EvidenceController } from "./evidence.controllers";
import { EvidenceIntakeService } from "./evidence-intake.service";
import { ClamAvMalwareScanner, MalwareScanner } from "./malware-scanner.service";
import { EvidenceObjectStore, S3EvidenceObjectStore } from "./object-store.service";

@Module({
  imports: [StoreModule, PersistenceModule, SecurityModule, InstitutionsModule],
  controllers: [EvidenceController, EvidenceAdminController],
  providers: [
    EvidenceIntakeService,
    { provide: MalwareScanner, useClass: ClamAvMalwareScanner },
    { provide: EvidenceObjectStore, useClass: S3EvidenceObjectStore },
  ],
  exports: [EvidenceIntakeService],
})
export class EvidenceModule {}
