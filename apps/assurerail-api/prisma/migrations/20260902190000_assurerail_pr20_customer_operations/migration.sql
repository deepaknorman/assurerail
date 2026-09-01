CREATE TABLE "CustomerContract" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "contractRef" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED', "currency" TEXT NOT NULL, "currencyScale" INTEGER NOT NULL, "termsDigest" TEXT NOT NULL, "termsEvidenceRef" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL, "proposalStepUpId" TEXT NOT NULL, "reviewedByUserId" TEXT, "reviewStepUpId" TEXT,
  "reviewReason" TEXT, "reviewedAt" TIMESTAMP(3), "participantAcceptedByUserId" TEXT, "participantMandateId" TEXT,
  "participantStepUpId" TEXT, "participantAcceptedAt" TIMESTAMP(3), "effectiveAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "renewalReviewAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CustomerContract_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerContract_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerContract_institution_ref_version" ON "CustomerContract"("institutionId","contractRef","version");
CREATE INDEX "CustomerContract_scope_status_term" ON "CustomerContract"("institutionId","status","effectiveAt","expiresAt");

CREATE TABLE "CustomerContractChange" (
  "id" TEXT NOT NULL, "customerContractId" TEXT NOT NULL, "changeType" TEXT NOT NULL, "fromStatus" TEXT NOT NULL,
  "proposedValues" JSONB NOT NULL, "reason" TEXT NOT NULL, "evidenceRef" TEXT NOT NULL, "proposalDigest" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED', "proposedByUserId" TEXT NOT NULL, "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT, "reviewStepUpId" TEXT, "reviewReason" TEXT, "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3), "appliedAt" TIMESTAMP(3), CONSTRAINT "CustomerContractChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerContractChange_customerContractId_fkey" FOREIGN KEY ("customerContractId") REFERENCES "CustomerContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CustomerContractChange_customerContractId_status_idx" ON "CustomerContractChange"("customerContractId","status");

CREATE TABLE "CustomerRateCard" (
  "id" TEXT NOT NULL, "customerContractId" TEXT NOT NULL, "version" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "effectiveAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "rateCardDigest" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL, "proposalStepUpId" TEXT NOT NULL, "reviewedByUserId" TEXT, "reviewStepUpId" TEXT,
  "reviewReason" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerRateCard_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerRateCard_customerContractId_fkey" FOREIGN KEY ("customerContractId") REFERENCES "CustomerContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerRateCard_contract_version" ON "CustomerRateCard"("customerContractId","version");
CREATE INDEX "CustomerRateCard_scope_status_term" ON "CustomerRateCard"("customerContractId","status","effectiveAt","expiresAt");

CREATE TABLE "CustomerFeeRule" (
  "id" TEXT NOT NULL, "customerRateCardId" TEXT NOT NULL, "transactionRoute" TEXT NOT NULL, "representation" TEXT NOT NULL,
  "lifecycleLeg" TEXT NOT NULL, "metric" TEXT NOT NULL, "feeBasis" TEXT NOT NULL, "rateValue" TEXT NOT NULL,
  "minimumFeeMinor" TEXT, "maximumFeeMinor" TEXT, "roundingMode" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerFeeRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerFeeRule_customerRateCardId_fkey" FOREIGN KEY ("customerRateCardId") REFERENCES "CustomerRateCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerFeeRule_card_route_metric" ON "CustomerFeeRule"("customerRateCardId","transactionRoute","representation","lifecycleLeg","metric");

CREATE TABLE "CustomerUsageEvent" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "customerContractId" TEXT NOT NULL, "transactionCaseId" TEXT,
  "sourceEventRef" TEXT NOT NULL, "sourceEventDigest" TEXT NOT NULL, "transactionRoute" TEXT NOT NULL, "representation" TEXT NOT NULL,
  "lifecycleLeg" TEXT NOT NULL, "metric" TEXT NOT NULL, "quantityMinor" TEXT NOT NULL, "notionalMinor" TEXT NOT NULL,
  "currency" TEXT NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL DEFAULT 'UNBILLED',
  "recordedByUserId" TEXT NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerUsageEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerUsageEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerUsageEvent_customerContractId_fkey" FOREIGN KEY ("customerContractId") REFERENCES "CustomerContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerUsageEvent_institution_source" ON "CustomerUsageEvent"("institutionId","sourceEventRef");
CREATE INDEX "CustomerUsageEvent_contract_status_time" ON "CustomerUsageEvent"("customerContractId","status","occurredAt");

CREATE TABLE "CustomerInvoiceStatement" (
  "id" TEXT NOT NULL, "customerContractId" TEXT NOT NULL, "customerRateCardId" TEXT NOT NULL, "statementRef" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL, "currency" TEXT NOT NULL, "currencyScale" INTEGER NOT NULL,
  "grossFeeMinor" TEXT NOT NULL, "creditMinor" TEXT NOT NULL, "netFeeMinor" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "statementDigest" TEXT NOT NULL, "preparedByUserId" TEXT NOT NULL, "preparationStepUpId" TEXT NOT NULL,
  "issuedByUserId" TEXT, "issueStepUpId" TEXT, "issueReason" TEXT,
  "issuedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerInvoiceStatement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerInvoiceStatement_customerContractId_fkey" FOREIGN KEY ("customerContractId") REFERENCES "CustomerContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerInvoiceStatement_customerRateCardId_fkey" FOREIGN KEY ("customerRateCardId") REFERENCES "CustomerRateCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerInvoiceStatement_contract_ref" ON "CustomerInvoiceStatement"("customerContractId","statementRef");
CREATE INDEX "CustomerInvoiceStatement_contract_period_idx" ON "CustomerInvoiceStatement"("customerContractId","periodStart","periodEnd");

CREATE TABLE "CustomerInvoiceLine" (
  "id" TEXT NOT NULL, "invoiceStatementId" TEXT NOT NULL, "usageEventId" TEXT NOT NULL, "feeRuleId" TEXT NOT NULL,
  "basisMinor" TEXT NOT NULL, "rateValue" TEXT NOT NULL, "calculatedFeeMinor" TEXT NOT NULL, "calculationDigest" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CustomerInvoiceLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerInvoiceLine_invoiceStatementId_fkey" FOREIGN KEY ("invoiceStatementId") REFERENCES "CustomerInvoiceStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerInvoiceLine_usageEventId_fkey" FOREIGN KEY ("usageEventId") REFERENCES "CustomerUsageEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerInvoiceLine_feeRuleId_fkey" FOREIGN KEY ("feeRuleId") REFERENCES "CustomerFeeRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerInvoiceLine_usageEventId_key" ON "CustomerInvoiceLine"("usageEventId");
CREATE INDEX "CustomerInvoiceLine_invoiceStatementId_idx" ON "CustomerInvoiceLine"("invoiceStatementId");

CREATE TABLE "CustomerCreditCorrection" (
  "id" TEXT NOT NULL, "customerContractId" TEXT NOT NULL, "invoiceStatementId" TEXT NOT NULL, "amountMinor" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "evidenceRef" TEXT NOT NULL, "proposalDigest" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "proposedByUserId" TEXT NOT NULL, "proposalStepUpId" TEXT NOT NULL, "reviewedByUserId" TEXT, "reviewStepUpId" TEXT,
  "reviewReason" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerCreditCorrection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerCreditCorrection_customerContractId_fkey" FOREIGN KEY ("customerContractId") REFERENCES "CustomerContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerCreditCorrection_invoiceStatementId_fkey" FOREIGN KEY ("invoiceStatementId") REFERENCES "CustomerInvoiceStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CustomerCreditCorrection_invoiceStatementId_status_idx" ON "CustomerCreditCorrection"("invoiceStatementId","status");

CREATE TABLE "CustomerImplementationCohort" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "customerContractId" TEXT NOT NULL, "cohortRef" TEXT NOT NULL,
  "operatingMode" TEXT NOT NULL, "routes" JSONB NOT NULL, "gateRefs" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "ownerUserId" TEXT NOT NULL, "changeReason" TEXT NOT NULL,
  "changedByUserId" TEXT NOT NULL, "changeStepUpId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CustomerImplementationCohort_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerImplementationCohort_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerImplementationCohort_customerContractId_fkey" FOREIGN KEY ("customerContractId") REFERENCES "CustomerContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerImplementationCohort_institutionId_cohortRef_key" ON "CustomerImplementationCohort"("institutionId","cohortRef");
CREATE INDEX "CustomerImplementationCohort_scope_status_term" ON "CustomerImplementationCohort"("institutionId","status","startsAt","endsAt");

CREATE TABLE "CustomerServiceRequest" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "transactionCaseId" TEXT, "requestRef" TEXT NOT NULL,
  "requestType" TEXT NOT NULL, "priority" TEXT NOT NULL, "subject" TEXT NOT NULL, "description" TEXT NOT NULL,
  "evidenceRefs" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN', "slaDueAt" TIMESTAMP(3) NOT NULL,
  "escalationLevel" INTEGER NOT NULL DEFAULT 0, "escalationPath" JSONB NOT NULL, "assignedToUserId" TEXT,
  "createdByUserId" TEXT NOT NULL, "createdByMandateId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CustomerServiceRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerServiceRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerServiceRequest_institutionId_requestRef_key" ON "CustomerServiceRequest"("institutionId","requestRef");
CREATE INDEX "CustomerServiceRequest_institutionId_status_slaDueAt_idx" ON "CustomerServiceRequest"("institutionId","status","slaDueAt");

CREATE TABLE "CustomerServiceMessage" (
  "id" TEXT NOT NULL, "customerServiceRequestId" TEXT NOT NULL, "authorType" TEXT NOT NULL, "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL, "evidenceRefs" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerServiceMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerServiceMessage_customerServiceRequestId_fkey" FOREIGN KEY ("customerServiceRequestId") REFERENCES "CustomerServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CustomerServiceMessage_customerServiceRequestId_createdAt_idx" ON "CustomerServiceMessage"("customerServiceRequestId","createdAt");

CREATE TABLE "CustomerOperationalReview" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL,
  "serviceMetrics" JSONB NOT NULL, "openItems" JSONB NOT NULL, "evidenceRefs" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "recordedByUserId" TEXT NOT NULL, "stepUpEvidenceId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerOperationalReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerOperationalReview_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CustomerOperationalReview_institutionId_periodEnd_idx" ON "CustomerOperationalReview"("institutionId","periodEnd");

CREATE TABLE "CustomerDataExitExport" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "exportVersion" TEXT NOT NULL, "highWaterAt" TIMESTAMP(3) NOT NULL,
  "recordCounts" JSONB NOT NULL, "manifestDigest" TEXT NOT NULL, "scope" JSONB NOT NULL, "requestedByUserId" TEXT NOT NULL,
  "requestedByMandateId" TEXT NOT NULL, "stepUpEvidenceId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerDataExitExport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerDataExitExport_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CustomerDataExitExport_institutionId_createdAt_idx" ON "CustomerDataExitExport"("institutionId","createdAt");
