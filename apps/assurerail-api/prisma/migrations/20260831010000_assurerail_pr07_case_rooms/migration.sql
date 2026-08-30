-- PR-07: Rail-owned passive case rooms, exact sealed legacy-room evidence and parity repair queue.
-- Additive. Legacy room write authority remains unchanged and no legacy hash is recomputed.

CREATE TABLE "CaseRoom" (
  "id" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "sourceReferenceId" TEXT,
  "sourceManifestDigest" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DARK_IMPORTED',
  "aggregateVersion" INTEGER NOT NULL DEFAULT 1,
  "legacyRoomId" TEXT,
  "legacyPoolId" TEXT,
  "legacyClaId" TEXT,
  "legacyPurpose" TEXT,
  "legacySourceSystem" TEXT,
  "legacySourceVersion" TEXT,
  "openedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdByMandateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomGrant" (
  "id" TEXT NOT NULL,
  "caseRoomId" TEXT NOT NULL,
  "granteeInstitutionId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "declarationTextVersion" TEXT NOT NULL,
  "relianceTextVersion" TEXT NOT NULL,
  "declarationDigest" TEXT,
  "declarationAt" TIMESTAMP(3),
  "relianceAcceptedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "legacyInviteId" TEXT,
  "legacyTransfereeDid" TEXT,
  "legacyStatus" TEXT,
  "grantedByUserId" TEXT NOT NULL,
  "revokedByUserId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomAccessEvent" (
  "id" TEXT NOT NULL,
  "caseRoomId" TEXT NOT NULL,
  "sequence" BIGINT NOT NULL,
  "chainOrigin" TEXT NOT NULL,
  "hashRoomReference" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actingInstitutionId" TEXT,
  "actorReference" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "objectReference" TEXT,
  "previousHash" TEXT NOT NULL,
  "eventHash" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomAccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomMessage" (
  "id" TEXT NOT NULL,
  "caseRoomId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "authorInstitutionId" TEXT,
  "authorReference" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,
  "messageKind" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "bodyDigest" TEXT NOT NULL,
  "legacyMessageId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegacyRoomImport" (
  "id" TEXT NOT NULL,
  "caseRoomId" TEXT NOT NULL,
  "migrationReceiptId" TEXT NOT NULL,
  "migrationBatchId" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "legacyRoomId" TEXT NOT NULL,
  "importVersion" INTEGER NOT NULL,
  "exportDigest" TEXT NOT NULL,
  "sourceHighWaterMark" TEXT NOT NULL,
  "sourceCounts" JSONB NOT NULL,
  "chainTailHash" TEXT NOT NULL,
  "sealedExport" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IMPORTED_UNVERIFIED',
  "importedByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegacyRoomImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomParityRun" (
  "id" TEXT NOT NULL,
  "legacyRoomImportId" TEXT NOT NULL,
  "expectedExportDigest" TEXT NOT NULL,
  "observedSnapshotDigest" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "comparisons" JSONB NOT NULL,
  "mismatchCount" INTEGER NOT NULL,
  "runByUserId" TEXT NOT NULL,
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "RoomParityRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomParityBreak" (
  "id" TEXT NOT NULL,
  "roomParityRunId" TEXT NOT NULL,
  "dimension" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "expected" JSONB NOT NULL,
  "observed" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "ownerReference" TEXT,
  "resolutionEvidence" JSONB,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomParityBreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseRoom_legacyRoomId_key" ON "CaseRoom"("legacyRoomId");
CREATE INDEX "CaseRoom_case_status_idx" ON "CaseRoom"("transactionCaseId","status");
CREATE INDEX "CaseRoom_source_idx" ON "CaseRoom"("sourceReferenceId");
CREATE UNIQUE INDEX "RoomGrant_room_institution_purpose_key" ON "RoomGrant"("caseRoomId","granteeInstitutionId","purpose");
CREATE UNIQUE INDEX "RoomGrant_room_legacy_invite_key" ON "RoomGrant"("caseRoomId","legacyInviteId");
CREATE INDEX "RoomGrant_institution_status_idx" ON "RoomGrant"("granteeInstitutionId","status");
CREATE INDEX "RoomGrant_room_status_idx" ON "RoomGrant"("caseRoomId","status");
CREATE UNIQUE INDEX "RoomAccessEvent_eventHash_key" ON "RoomAccessEvent"("eventHash");
CREATE UNIQUE INDEX "RoomAccessEvent_room_sequence_key" ON "RoomAccessEvent"("caseRoomId","sequence");
CREATE INDEX "RoomAccessEvent_room_time_idx" ON "RoomAccessEvent"("caseRoomId","occurredAt");
CREATE UNIQUE INDEX "RoomMessage_legacyMessageId_key" ON "RoomMessage"("legacyMessageId");
CREATE INDEX "RoomMessage_room_time_idx" ON "RoomMessage"("caseRoomId","occurredAt");
CREATE UNIQUE INDEX "LegacyRoomImport_migrationReceiptId_key" ON "LegacyRoomImport"("migrationReceiptId");
CREATE UNIQUE INDEX "LegacyRoomImport_source_room_digest_key" ON "LegacyRoomImport"("sourceSystem","legacyRoomId","exportDigest");
CREATE UNIQUE INDEX "LegacyRoomImport_room_version_key" ON "LegacyRoomImport"("caseRoomId","importVersion");
CREATE INDEX "LegacyRoomImport_status_created_idx" ON "LegacyRoomImport"("status","createdAt");
CREATE INDEX "RoomParityRun_import_time_idx" ON "RoomParityRun"("legacyRoomImportId","runAt");
CREATE INDEX "RoomParityRun_result_time_idx" ON "RoomParityRun"("result","runAt");
CREATE INDEX "RoomParityBreak_status_severity_created_idx" ON "RoomParityBreak"("status","severity","createdAt");
CREATE INDEX "RoomParityBreak_run_dimension_idx" ON "RoomParityBreak"("roomParityRunId","dimension");

ALTER TABLE "CaseRoom" ADD CONSTRAINT "CaseRoom_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseRoom" ADD CONSTRAINT "CaseRoom_sourceReferenceId_fkey" FOREIGN KEY ("sourceReferenceId") REFERENCES "SourceReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomGrant" ADD CONSTRAINT "RoomGrant_caseRoomId_fkey" FOREIGN KEY ("caseRoomId") REFERENCES "CaseRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomGrant" ADD CONSTRAINT "RoomGrant_granteeInstitutionId_fkey" FOREIGN KEY ("granteeInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomAccessEvent" ADD CONSTRAINT "RoomAccessEvent_caseRoomId_fkey" FOREIGN KEY ("caseRoomId") REFERENCES "CaseRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_caseRoomId_fkey" FOREIGN KEY ("caseRoomId") REFERENCES "CaseRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegacyRoomImport" ADD CONSTRAINT "LegacyRoomImport_caseRoomId_fkey" FOREIGN KEY ("caseRoomId") REFERENCES "CaseRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegacyRoomImport" ADD CONSTRAINT "LegacyRoomImport_migrationReceiptId_fkey" FOREIGN KEY ("migrationReceiptId") REFERENCES "MigrationReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomParityRun" ADD CONSTRAINT "RoomParityRun_legacyRoomImportId_fkey" FOREIGN KEY ("legacyRoomImportId") REFERENCES "LegacyRoomImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomParityBreak" ADD CONSTRAINT "RoomParityBreak_roomParityRunId_fkey" FOREIGN KEY ("roomParityRunId") REFERENCES "RoomParityRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
