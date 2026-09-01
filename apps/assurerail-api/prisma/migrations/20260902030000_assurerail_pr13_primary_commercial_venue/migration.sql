-- PR-13: additive, permissioned primary commercial venue records.
-- No model below executes, settles, issues, transfers ownership, sends external solicitation,
-- or activates a route. All historical/evidentiary relations are restrictive.

CREATE TABLE "CommercialOpportunity" (
  "id" TEXT NOT NULL, "transactionCaseId" TEXT NOT NULL, "ownerInstitutionId" TEXT NOT NULL,
  "opportunityReference" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "audienceMode" TEXT NOT NULL DEFAULT 'NAMED_INSTITUTIONS', "currentTermVersion" INTEGER,
  "aggregateVersion" INTEGER NOT NULL DEFAULT 1, "opensAt" TIMESTAMP(3), "closesAt" TIMESTAMP(3),
  "creationIdempotencyKey" TEXT NOT NULL, "creationRequestDigest" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL, "createdByMandateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialTermVersion" (
  "id" TEXT NOT NULL, "commercialOpportunityId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "currency" TEXT NOT NULL, "amountUnits" TEXT NOT NULL, "amountScale" INTEGER NOT NULL,
  "minimumParticipationUnits" TEXT NOT NULL, "maximumParticipationUnits" TEXT,
  "pricingType" TEXT NOT NULL, "pricingValue" TEXT NOT NULL, "commercialTerms" JSONB NOT NULL,
  "termSheetEvidenceObjectId" TEXT, "validFrom" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "termDigest" TEXT NOT NULL, "reason" TEXT NOT NULL, "createdByUserId" TEXT NOT NULL,
  "createdByMandateId" TEXT NOT NULL, "stepUpEvidenceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialTermVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialAudienceGrant" (
  "id" TEXT NOT NULL, "commercialOpportunityId" TEXT NOT NULL, "institutionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE', "purpose" TEXT NOT NULL, "conflictDisclosure" JSONB NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "invitationDigest" TEXT NOT NULL, "invitedByUserId" TEXT NOT NULL, "invitedByMandateId" TEXT NOT NULL,
  "stepUpEvidenceId" TEXT NOT NULL, "revokedByUserId" TEXT, "revocationReason" TEXT, "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialAudienceGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialOpportunityChange" (
  "id" TEXT NOT NULL, "commercialOpportunityId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "expectedVersion" INTEGER NOT NULL, "fromStatus" TEXT NOT NULL, "toStatus" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "proposalDigest" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "proposedByUserId" TEXT NOT NULL, "proposedByMandateId" TEXT NOT NULL, "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT, "reviewedByMandateId" TEXT, "reviewStepUpId" TEXT, "reviewReason" TEXT,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3), "appliedAt" TIMESTAMP(3),
  CONSTRAINT "CommercialOpportunityChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialInterestIndication" (
  "id" TEXT NOT NULL, "commercialOpportunityId" TEXT NOT NULL, "institutionId" TEXT NOT NULL,
  "termVersionId" TEXT NOT NULL, "currency" TEXT NOT NULL, "amountUnits" TEXT NOT NULL,
  "amountScale" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'SUBMITTED', "qualifications" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "requestDigest" TEXT NOT NULL, "submittedByUserId" TEXT NOT NULL,
  "submittedByMandateId" TEXT NOT NULL, "submissionStepUpId" TEXT NOT NULL, "withdrawnByUserId" TEXT,
  "withdrawalStepUpId" TEXT, "withdrawalReason" TEXT, "withdrawnAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialInterestIndication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialRfq" (
  "id" TEXT NOT NULL, "commercialOpportunityId" TEXT NOT NULL, "requesterInstitutionId" TEXT NOT NULL,
  "termVersionId" TEXT NOT NULL, "currency" TEXT NOT NULL, "amountUnits" TEXT NOT NULL,
  "amountScale" INTEGER NOT NULL, "requestedTerms" JSONB NOT NULL, "requestedTermsDigest" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN', "responseTerms" JSONB, "responseTermsDigest" TEXT,
  "responseReason" TEXT, "idempotencyKey" TEXT NOT NULL, "requestDigest" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL, "requestedByMandateId" TEXT NOT NULL, "requestStepUpId" TEXT NOT NULL,
  "respondedByUserId" TEXT, "respondedByMandateId" TEXT, "responseStepUpId" TEXT,
  "respondedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialRfq_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialNegotiationThread" (
  "id" TEXT NOT NULL, "commercialOpportunityId" TEXT NOT NULL, "commercialRfqId" TEXT,
  "ownerInstitutionId" TEXT NOT NULL, "counterpartyInstitutionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialNegotiationThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialNegotiationMessage" (
  "id" TEXT NOT NULL, "negotiationThreadId" TEXT NOT NULL, "senderInstitutionId" TEXT NOT NULL,
  "messageKind" TEXT NOT NULL, "body" TEXT NOT NULL, "termSnapshot" JSONB, "termSnapshotDigest" TEXT,
  "previousMessageId" TEXT, "idempotencyKey" TEXT NOT NULL, "requestDigest" TEXT NOT NULL,
  "sentByUserId" TEXT NOT NULL, "sentByMandateId" TEXT NOT NULL, "stepUpEvidenceId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialNegotiationMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialAllocation" (
  "id" TEXT NOT NULL, "commercialOpportunityId" TEXT NOT NULL, "allocationReference" TEXT NOT NULL,
  "offereeInstitutionId" TEXT NOT NULL, "termVersionId" TEXT NOT NULL, "basisType" TEXT NOT NULL,
  "basisId" TEXT NOT NULL, "currency" TEXT NOT NULL, "amountUnits" TEXT NOT NULL,
  "amountScale" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'PROPOSED', "idempotencyKey" TEXT NOT NULL,
  "proposalDigest" TEXT NOT NULL, "proposedByUserId" TEXT NOT NULL, "proposedByMandateId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL, "reviewedByUserId" TEXT, "reviewedByMandateId" TEXT,
  "reviewStepUpId" TEXT, "reviewReason" TEXT, "reviewedAt" TIMESTAMP(3), "respondedByUserId" TEXT,
  "respondedByMandateId" TEXT, "responseStepUpId" TEXT, "responseReason" TEXT,
  "respondedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercialOpportunity_transactionCaseId_opportunityReferenc_key" ON "CommercialOpportunity"("transactionCaseId", "opportunityReference");
CREATE UNIQUE INDEX "CommercialOpportunity_ownerInstitutionId_creationIdempotenc_key" ON "CommercialOpportunity"("ownerInstitutionId", "creationIdempotencyKey");
CREATE INDEX "CommercialOpportunity_ownerInstitutionId_status_createdAt_idx" ON "CommercialOpportunity"("ownerInstitutionId", "status", "createdAt");
CREATE INDEX "CommercialOpportunity_transactionCaseId_status_idx" ON "CommercialOpportunity"("transactionCaseId", "status");
CREATE UNIQUE INDEX "CommercialTermVersion_commercialOpportunityId_version_key" ON "CommercialTermVersion"("commercialOpportunityId", "version");
CREATE UNIQUE INDEX "CommercialTermVersion_commercialOpportunityId_termDigest_key" ON "CommercialTermVersion"("commercialOpportunityId", "termDigest");
CREATE INDEX "CommercialTermVersion_commercialOpportunityId_expiresAt_idx" ON "CommercialTermVersion"("commercialOpportunityId", "expiresAt");
CREATE UNIQUE INDEX "CommercialAudienceGrant_invitationDigest_key" ON "CommercialAudienceGrant"("invitationDigest");
CREATE UNIQUE INDEX "CommercialAudienceGrant_commercialOpportunityId_institution_key" ON "CommercialAudienceGrant"("commercialOpportunityId", "institutionId");
CREATE INDEX "CommercialAudienceGrant_institutionId_status_expiresAt_idx" ON "CommercialAudienceGrant"("institutionId", "status", "expiresAt");
CREATE UNIQUE INDEX "CommercialOpportunityChange_commercialOpportunityId_proposa_key" ON "CommercialOpportunityChange"("commercialOpportunityId", "proposalDigest");
CREATE INDEX "CommercialOpportunityChange_commercialOpportunityId_status__idx" ON "CommercialOpportunityChange"("commercialOpportunityId", "status", "proposedAt");
CREATE UNIQUE INDEX "CommercialInterestIndication_commercialOpportunityId_instit_key" ON "CommercialInterestIndication"("commercialOpportunityId", "institutionId", "idempotencyKey");
CREATE INDEX "CommercialInterestIndication_commercialOpportunityId_status_idx" ON "CommercialInterestIndication"("commercialOpportunityId", "status", "createdAt");
CREATE INDEX "CommercialInterestIndication_institutionId_status_createdAt_idx" ON "CommercialInterestIndication"("institutionId", "status", "createdAt");
CREATE UNIQUE INDEX "CommercialRfq_commercialOpportunityId_requesterInstitutionI_key" ON "CommercialRfq"("commercialOpportunityId", "requesterInstitutionId", "idempotencyKey");
CREATE INDEX "CommercialRfq_commercialOpportunityId_status_createdAt_idx" ON "CommercialRfq"("commercialOpportunityId", "status", "createdAt");
CREATE INDEX "CommercialRfq_requesterInstitutionId_status_createdAt_idx" ON "CommercialRfq"("requesterInstitutionId", "status", "createdAt");
CREATE UNIQUE INDEX "CommercialNegotiationThread_commercialOpportunityId_counter_key" ON "CommercialNegotiationThread"("commercialOpportunityId", "counterpartyInstitutionId", "commercialRfqId");
CREATE INDEX "CommercialNegotiationThread_ownerInstitutionId_status_idx" ON "CommercialNegotiationThread"("ownerInstitutionId", "status");
CREATE INDEX "CommercialNegotiationThread_counterpartyInstitutionId_statu_idx" ON "CommercialNegotiationThread"("counterpartyInstitutionId", "status");
CREATE UNIQUE INDEX "CommercialNegotiationMessage_negotiationThreadId_idempotenc_key" ON "CommercialNegotiationMessage"("negotiationThreadId", "idempotencyKey");
CREATE INDEX "CommercialNegotiationMessage_negotiationThreadId_occurredAt_idx" ON "CommercialNegotiationMessage"("negotiationThreadId", "occurredAt");
CREATE UNIQUE INDEX "CommercialAllocation_commercialOpportunityId_allocationRefe_key" ON "CommercialAllocation"("commercialOpportunityId", "allocationReference");
CREATE UNIQUE INDEX "CommercialAllocation_commercialOpportunityId_idempotencyKey_key" ON "CommercialAllocation"("commercialOpportunityId", "idempotencyKey");
CREATE INDEX "CommercialAllocation_commercialOpportunityId_status_created_idx" ON "CommercialAllocation"("commercialOpportunityId", "status", "createdAt");
CREATE INDEX "CommercialAllocation_offereeInstitutionId_status_createdAt_idx" ON "CommercialAllocation"("offereeInstitutionId", "status", "createdAt");

ALTER TABLE "CommercialOpportunity" ADD CONSTRAINT "CommercialOpportunity_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialOpportunity" ADD CONSTRAINT "CommercialOpportunity_ownerInstitutionId_fkey" FOREIGN KEY ("ownerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialTermVersion" ADD CONSTRAINT "CommercialTermVersion_commercialOpportunityId_fkey" FOREIGN KEY ("commercialOpportunityId") REFERENCES "CommercialOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialAudienceGrant" ADD CONSTRAINT "CommercialAudienceGrant_commercialOpportunityId_fkey" FOREIGN KEY ("commercialOpportunityId") REFERENCES "CommercialOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialAudienceGrant" ADD CONSTRAINT "CommercialAudienceGrant_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialOpportunityChange" ADD CONSTRAINT "CommercialOpportunityChange_commercialOpportunityId_fkey" FOREIGN KEY ("commercialOpportunityId") REFERENCES "CommercialOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialInterestIndication" ADD CONSTRAINT "CommercialInterestIndication_commercialOpportunityId_fkey" FOREIGN KEY ("commercialOpportunityId") REFERENCES "CommercialOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialInterestIndication" ADD CONSTRAINT "CommercialInterestIndication_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialInterestIndication" ADD CONSTRAINT "CommercialInterestIndication_termVersionId_fkey" FOREIGN KEY ("termVersionId") REFERENCES "CommercialTermVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialRfq" ADD CONSTRAINT "CommercialRfq_commercialOpportunityId_fkey" FOREIGN KEY ("commercialOpportunityId") REFERENCES "CommercialOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialRfq" ADD CONSTRAINT "CommercialRfq_requesterInstitutionId_fkey" FOREIGN KEY ("requesterInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialRfq" ADD CONSTRAINT "CommercialRfq_termVersionId_fkey" FOREIGN KEY ("termVersionId") REFERENCES "CommercialTermVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialNegotiationThread" ADD CONSTRAINT "CommercialNegotiationThread_commercialOpportunityId_fkey" FOREIGN KEY ("commercialOpportunityId") REFERENCES "CommercialOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialNegotiationThread" ADD CONSTRAINT "CommercialNegotiationThread_commercialRfqId_fkey" FOREIGN KEY ("commercialRfqId") REFERENCES "CommercialRfq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialNegotiationThread" ADD CONSTRAINT "CommercialNegotiationThread_ownerInstitutionId_fkey" FOREIGN KEY ("ownerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialNegotiationThread" ADD CONSTRAINT "CommercialNegotiationThread_counterpartyInstitutionId_fkey" FOREIGN KEY ("counterpartyInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialNegotiationMessage" ADD CONSTRAINT "CommercialNegotiationMessage_negotiationThreadId_fkey" FOREIGN KEY ("negotiationThreadId") REFERENCES "CommercialNegotiationThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialNegotiationMessage" ADD CONSTRAINT "CommercialNegotiationMessage_senderInstitutionId_fkey" FOREIGN KEY ("senderInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialAllocation" ADD CONSTRAINT "CommercialAllocation_commercialOpportunityId_fkey" FOREIGN KEY ("commercialOpportunityId") REFERENCES "CommercialOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialAllocation" ADD CONSTRAINT "CommercialAllocation_offereeInstitutionId_fkey" FOREIGN KEY ("offereeInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialAllocation" ADD CONSTRAINT "CommercialAllocation_termVersionId_fkey" FOREIGN KEY ("termVersionId") REFERENCES "CommercialTermVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
