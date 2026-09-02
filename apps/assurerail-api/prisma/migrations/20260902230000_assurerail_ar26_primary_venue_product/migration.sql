-- AR-26: immutable accepted-allocation handoff into the already-associated transaction case.
-- The receipt proposes a counterparty case role; it cannot accept that role or perform an external act.
CREATE TABLE "CommercialCaseHandoff" (
  "id" TEXT NOT NULL,
  "commercialOpportunityId" TEXT NOT NULL,
  "commercialAllocationId" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "termVersionId" TEXT NOT NULL,
  "audienceGrantId" TEXT NOT NULL,
  "casePartyId" TEXT NOT NULL,
  "ownerInstitutionId" TEXT NOT NULL,
  "counterpartyInstitutionId" TEXT NOT NULL,
  "counterpartyPartyRole" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'HANDOFF_RECORDED',
  "termDigest" TEXT NOT NULL,
  "audienceGrantDigest" TEXT NOT NULL,
  "allocationDigest" TEXT NOT NULL,
  "eligibilityDecisionCode" TEXT NOT NULL,
  "eligibilityCheckedAt" TIMESTAMP(3) NOT NULL,
  "handoffDigest" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdByMandateId" TEXT NOT NULL,
  "stepUpEvidenceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialCaseHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercialCaseHandoff_commercialAllocationId_key" ON "CommercialCaseHandoff"("commercialAllocationId");
CREATE UNIQUE INDEX "CommercialCaseHandoff_handoffDigest_key" ON "CommercialCaseHandoff"("handoffDigest");
CREATE UNIQUE INDEX "CommercialCaseHandoff_opportunity_idempotency_key" ON "CommercialCaseHandoff"("commercialOpportunityId", "idempotencyKey");
CREATE INDEX "CommercialCaseHandoff_case_status_created_idx" ON "CommercialCaseHandoff"("transactionCaseId", "status", "createdAt");
CREATE INDEX "CommercialCaseHandoff_counterparty_status_created_idx" ON "CommercialCaseHandoff"("counterpartyInstitutionId", "status", "createdAt");

ALTER TABLE "CommercialCaseHandoff" ADD CONSTRAINT "CommercialCaseHandoff_opportunity_fkey" FOREIGN KEY ("commercialOpportunityId") REFERENCES "CommercialOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialCaseHandoff" ADD CONSTRAINT "CommercialCaseHandoff_allocation_fkey" FOREIGN KEY ("commercialAllocationId") REFERENCES "CommercialAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialCaseHandoff" ADD CONSTRAINT "CommercialCaseHandoff_case_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialCaseHandoff" ADD CONSTRAINT "CommercialCaseHandoff_term_fkey" FOREIGN KEY ("termVersionId") REFERENCES "CommercialTermVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialCaseHandoff" ADD CONSTRAINT "CommercialCaseHandoff_audience_grant_fkey" FOREIGN KEY ("audienceGrantId") REFERENCES "CommercialAudienceGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialCaseHandoff" ADD CONSTRAINT "CommercialCaseHandoff_party_fkey" FOREIGN KEY ("casePartyId") REFERENCES "CaseParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialCaseHandoff" ADD CONSTRAINT "CommercialCaseHandoff_owner_fkey" FOREIGN KEY ("ownerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialCaseHandoff" ADD CONSTRAINT "CommercialCaseHandoff_counterparty_fkey" FOREIGN KEY ("counterpartyInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
