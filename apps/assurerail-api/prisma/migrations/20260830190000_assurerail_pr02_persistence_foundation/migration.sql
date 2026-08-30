-- PR-02 is additive to the existing Note runtime. It does not rename/drop a legacy domain table.
-- The only destructive data treatment is deliberate: legacy plaintext webhook signing secrets are
-- cleared and those subscriptions are disabled until an operator re-provisions them in Vault and
-- completes endpoint verification.

-- AlterTable: retain legacy webhook records for operator visibility, but make them inert and remove
-- the plaintext signing secret before any PR-02 worker can select them.
ALTER TABLE "WebhookSubscription"
  ALTER COLUMN "secret" DROP NOT NULL,
  ALTER COLUMN "active" SET DEFAULT false,
  ADD COLUMN "institutionId" TEXT,
  ADD COLUMN "secretVaultRef" TEXT,
  ADD COLUMN "endpointStatus" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  ADD COLUMN "verificationChallengeHash" TEXT,
  ADD COLUMN "verificationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "disabledReason" TEXT,
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "WebhookSubscription"
SET
  "active" = false,
  "endpointStatus" = 'DISABLED',
  "disabledReason" = 'LEGACY_PLAINTEXT_SECRET_CLEARED_REPROVISION_AND_VERIFY',
  "secret" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

CREATE INDEX "WebhookSubscription_institutionId_idx" ON "WebhookSubscription"("institutionId");
CREATE INDEX "WebhookSubscription_active_endpointStatus_idx" ON "WebhookSubscription"("active", "endpointStatus");

-- AlterTable: historical attempts stay visible; new rows become durable jobs with stable IDs, retry
-- state, locks and digest-only response evidence.
ALTER TABLE "WebhookDelivery"
  ALTER COLUMN "statusCode" DROP NOT NULL,
  ALTER COLUMN "ok" SET DEFAULT false,
  ADD COLUMN "outboxMessageId" TEXT,
  ADD COLUMN "payloadDigest" TEXT,
  ADD COLUMN "state" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lockOwner" TEXT,
  ADD COLUMN "errorCode" TEXT,
  ADD COLUMN "errorMessage" TEXT,
  ADD COLUMN "responseDigest" TEXT,
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "terminalAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "WebhookDelivery"
SET
  "state" = CASE WHEN "ok" THEN 'DELIVERED' ELSE 'DEAD_LETTER' END,
  "attempt" = 1,
  "deliveredAt" = CASE WHEN "ok" THEN "createdAt" ELSE NULL END,
  "terminalAt" = "createdAt",
  "nextAttemptAt" = "createdAt",
  "updatedAt" = "createdAt";

CREATE INDEX "WebhookDelivery_state_nextAttemptAt_idx" ON "WebhookDelivery"("state", "nextAttemptAt");
CREATE INDEX "WebhookDelivery_outboxMessageId_idx" ON "WebhookDelivery"("outboxMessageId");
CREATE UNIQUE INDEX "WebhookDelivery_outboxMessageId_subscriptionId_key"
  ON "WebhookDelivery"("outboxMessageId", "subscriptionId");

-- AlterTable: event metadata is nullable for compatibility with every existing lifecycle writer.
ALTER TABLE "EventLog"
  ADD COLUMN "schemaVersion" TEXT,
  ADD COLUMN "aggregateId" TEXT,
  ADD COLUMN "aggregateVersion" INTEGER,
  ADD COLUMN "institutionId" TEXT,
  ADD COLUMN "transactionCaseId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "causationId" TEXT;

CREATE UNIQUE INDEX "EventLog_idempotencyKey_key" ON "EventLog"("idempotencyKey");
CREATE INDEX "EventLog_institutionId_createdAt_idx" ON "EventLog"("institutionId", "createdAt");
CREATE INDEX "EventLog_transactionCaseId_createdAt_idx" ON "EventLog"("transactionCaseId", "createdAt");

CREATE TABLE "ProviderReference" (
  "id" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "providerType" TEXT NOT NULL,
  "displayName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "institutionId" TEXT,
  "transactionCaseId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderReference_providerType_providerKey_key"
  ON "ProviderReference"("providerType", "providerKey");
CREATE INDEX "ProviderReference_institutionId_idx" ON "ProviderReference"("institutionId");
CREATE INDEX "ProviderReference_transactionCaseId_idx" ON "ProviderReference"("transactionCaseId");

CREATE TABLE "SourceReference" (
  "id" TEXT NOT NULL,
  "providerReferenceId" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "sourceObjectType" TEXT NOT NULL,
  "sourceObjectId" TEXT NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "schemaId" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "payloadDigest" TEXT NOT NULL,
  "authoritativeStatus" TEXT NOT NULL DEFAULT 'UNDECLARED',
  "institutionId" TEXT,
  "transactionCaseId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourceReference_source_identity_key"
  ON "SourceReference"("providerReferenceId", "sourceSystem", "sourceObjectType", "sourceObjectId", "sourceVersion");
CREATE INDEX "SourceReference_payloadDigest_idx" ON "SourceReference"("payloadDigest");
CREATE INDEX "SourceReference_institutionId_idx" ON "SourceReference"("institutionId");
CREATE INDEX "SourceReference_transactionCaseId_idx" ON "SourceReference"("transactionCaseId");

CREATE TABLE "IntakeSubmission" (
  "id" TEXT NOT NULL,
  "providerReferenceId" TEXT NOT NULL,
  "sourceReferenceId" TEXT,
  "institutionId" TEXT,
  "transactionCaseId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "carrier" TEXT NOT NULL,
  "schemaId" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "payloadDigest" TEXT NOT NULL,
  "signatureDigest" TEXT,
  "signatureStatus" TEXT NOT NULL,
  "storageRef" TEXT,
  "payload" JSONB,
  "validationStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "validationDetail" JSONB,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntakeSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntakeSubmission_providerReferenceId_idempotencyKey_key"
  ON "IntakeSubmission"("providerReferenceId", "idempotencyKey");
CREATE INDEX "IntakeSubmission_sourceReferenceId_idx" ON "IntakeSubmission"("sourceReferenceId");
CREATE INDEX "IntakeSubmission_payloadDigest_idx" ON "IntakeSubmission"("payloadDigest");
CREATE INDEX "IntakeSubmission_institutionId_receivedAt_idx" ON "IntakeSubmission"("institutionId", "receivedAt");
CREATE INDEX "IntakeSubmission_transactionCaseId_receivedAt_idx" ON "IntakeSubmission"("transactionCaseId", "receivedAt");

CREATE TABLE "IntakeReceipt" (
  "id" TEXT NOT NULL,
  "intakeSubmissionId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "receiptDigest" TEXT NOT NULL,
  "detail" JSONB,
  "institutionId" TEXT,
  "transactionCaseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntakeReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntakeReceipt_intakeSubmissionId_key" ON "IntakeReceipt"("intakeSubmissionId");
CREATE UNIQUE INDEX "IntakeReceipt_receiptDigest_key" ON "IntakeReceipt"("receiptDigest");
CREATE INDEX "IntakeReceipt_institutionId_createdAt_idx" ON "IntakeReceipt"("institutionId", "createdAt");
CREATE INDEX "IntakeReceipt_transactionCaseId_createdAt_idx" ON "IntakeReceipt"("transactionCaseId", "createdAt");

CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "responseDigest" TEXT,
  "response" JSONB,
  "institutionId" TEXT,
  "transactionCaseId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRecord_scope_key_key" ON "IdempotencyRecord"("scope", "key");
CREATE INDEX "IdempotencyRecord_status_createdAt_idx" ON "IdempotencyRecord"("status", "createdAt");
CREATE INDEX "IdempotencyRecord_institutionId_idx" ON "IdempotencyRecord"("institutionId");
CREATE INDEX "IdempotencyRecord_transactionCaseId_idx" ON "IdempotencyRecord"("transactionCaseId");

CREATE TABLE "InboxMessage" (
  "id" TEXT NOT NULL,
  "providerReferenceId" TEXT NOT NULL,
  "externalMessageId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "schemaId" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "payloadDigest" TEXT NOT NULL,
  "payload" JSONB,
  "storageRef" TEXT,
  "signatureStatus" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'RECEIVED',
  "institutionId" TEXT,
  "transactionCaseId" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboxMessage_providerReferenceId_externalMessageId_key"
  ON "InboxMessage"("providerReferenceId", "externalMessageId");
CREATE UNIQUE INDEX "InboxMessage_providerReferenceId_idempotencyKey_key"
  ON "InboxMessage"("providerReferenceId", "idempotencyKey");
CREATE INDEX "InboxMessage_state_createdAt_idx" ON "InboxMessage"("state", "createdAt");
CREATE INDEX "InboxMessage_payloadDigest_idx" ON "InboxMessage"("payloadDigest");
CREATE INDEX "InboxMessage_institutionId_idx" ON "InboxMessage"("institutionId");
CREATE INDEX "InboxMessage_transactionCaseId_idx" ON "InboxMessage"("transactionCaseId");

CREATE TABLE "OutboxMessage" (
  "id" TEXT NOT NULL,
  "eventLogId" TEXT,
  "event" TEXT NOT NULL,
  "schemaId" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "payloadDigest" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "aggregateId" TEXT,
  "aggregateVersion" INTEGER,
  "institutionId" TEXT,
  "transactionCaseId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT,
  "causationId" TEXT,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockOwner" TEXT,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboxMessage_eventLogId_key" ON "OutboxMessage"("eventLogId");
CREATE UNIQUE INDEX "OutboxMessage_idempotencyKey_key" ON "OutboxMessage"("idempotencyKey");
CREATE INDEX "OutboxMessage_state_nextAttemptAt_idx" ON "OutboxMessage"("state", "nextAttemptAt");
CREATE INDEX "OutboxMessage_aggregateId_aggregateVersion_idx" ON "OutboxMessage"("aggregateId", "aggregateVersion");
CREATE INDEX "OutboxMessage_institutionId_createdAt_idx" ON "OutboxMessage"("institutionId", "createdAt");
CREATE INDEX "OutboxMessage_transactionCaseId_createdAt_idx" ON "OutboxMessage"("transactionCaseId", "createdAt");

CREATE TABLE "ExternalInstruction" (
  "id" TEXT NOT NULL,
  "providerReferenceId" TEXT NOT NULL,
  "instructionType" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "request" JSONB,
  "storageRef" TEXT,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "institutionId" TEXT,
  "transactionCaseId" TEXT,
  "sentAt" TIMESTAMP(3),
  "terminalAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalInstruction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalInstruction_providerReferenceId_idempotencyKey_key"
  ON "ExternalInstruction"("providerReferenceId", "idempotencyKey");
CREATE INDEX "ExternalInstruction_state_createdAt_idx" ON "ExternalInstruction"("state", "createdAt");
CREATE INDEX "ExternalInstruction_institutionId_idx" ON "ExternalInstruction"("institutionId");
CREATE INDEX "ExternalInstruction_transactionCaseId_idx" ON "ExternalInstruction"("transactionCaseId");

CREATE TABLE "ExternalAcknowledgement" (
  "id" TEXT NOT NULL,
  "externalInstructionId" TEXT NOT NULL,
  "providerReferenceId" TEXT NOT NULL,
  "externalAcknowledgementId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "finalityClass" TEXT NOT NULL,
  "responseDigest" TEXT NOT NULL,
  "response" JSONB,
  "storageRef" TEXT,
  "signatureStatus" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL,
  "institutionId" TEXT,
  "transactionCaseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalAcknowledgement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalAck_provider_external_id_key"
  ON "ExternalAcknowledgement"("providerReferenceId", "externalAcknowledgementId");
CREATE UNIQUE INDEX "ExternalAck_instruction_response_key"
  ON "ExternalAcknowledgement"("externalInstructionId", "responseDigest");
CREATE INDEX "ExternalAck_instruction_acknowledged_idx"
  ON "ExternalAcknowledgement"("externalInstructionId", "acknowledgedAt");
CREATE INDEX "ExternalAcknowledgement_institutionId_idx" ON "ExternalAcknowledgement"("institutionId");
CREATE INDEX "ExternalAcknowledgement_transactionCaseId_idx" ON "ExternalAcknowledgement"("transactionCaseId");

CREATE TABLE "MigrationReceipt" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "migrationName" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "sourceHighWaterMark" TEXT,
  "sourceCount" INTEGER NOT NULL,
  "targetCount" INTEGER NOT NULL,
  "sourceDigest" TEXT,
  "targetDigest" TEXT,
  "errorObjectRef" TEXT,
  "operatorRef" TEXT NOT NULL,
  "reviewerRef" TEXT,
  "status" TEXT NOT NULL DEFAULT 'STARTED',
  "institutionId" TEXT,
  "transactionCaseId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "receiptDigest" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MigrationReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MigrationReceipt_batchId_migrationName_key" ON "MigrationReceipt"("batchId", "migrationName");
CREATE INDEX "MigrationReceipt_status_startedAt_idx" ON "MigrationReceipt"("status", "startedAt");
CREATE INDEX "MigrationReceipt_institutionId_idx" ON "MigrationReceipt"("institutionId");
CREATE INDEX "MigrationReceipt_transactionCaseId_idx" ON "MigrationReceipt"("transactionCaseId");

-- Same-database integrity only. Institution/case IDs remain intentionally unbound until PR-03/PR-06;
-- no constraint crosses into an AssureLocker/AssureCLA database.
ALTER TABLE "SourceReference"
  ADD CONSTRAINT "SourceReference_providerReferenceId_fkey"
  FOREIGN KEY ("providerReferenceId") REFERENCES "ProviderReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntakeSubmission"
  ADD CONSTRAINT "IntakeSubmission_providerReferenceId_fkey"
  FOREIGN KEY ("providerReferenceId") REFERENCES "ProviderReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "IntakeSubmission_sourceReferenceId_fkey"
  FOREIGN KEY ("sourceReferenceId") REFERENCES "SourceReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntakeReceipt"
  ADD CONSTRAINT "IntakeReceipt_intakeSubmissionId_fkey"
  FOREIGN KEY ("intakeSubmissionId") REFERENCES "IntakeSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InboxMessage"
  ADD CONSTRAINT "InboxMessage_providerReferenceId_fkey"
  FOREIGN KEY ("providerReferenceId") REFERENCES "ProviderReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutboxMessage"
  ADD CONSTRAINT "OutboxMessage_eventLogId_fkey"
  FOREIGN KEY ("eventLogId") REFERENCES "EventLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery"
  ADD CONSTRAINT "WebhookDelivery_outboxMessageId_fkey"
  FOREIGN KEY ("outboxMessageId") REFERENCES "OutboxMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalInstruction"
  ADD CONSTRAINT "ExternalInstruction_providerReferenceId_fkey"
  FOREIGN KEY ("providerReferenceId") REFERENCES "ProviderReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalAcknowledgement"
  ADD CONSTRAINT "ExternalAcknowledgement_externalInstructionId_fkey"
  FOREIGN KEY ("externalInstructionId") REFERENCES "ExternalInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ExternalAcknowledgement_providerReferenceId_fkey"
  FOREIGN KEY ("providerReferenceId") REFERENCES "ProviderReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
