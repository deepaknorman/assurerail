CREATE TABLE "ExecutionFeeInvoice" (
  "id" TEXT NOT NULL,
  "sellerInstitutionId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "transactionCaseId" TEXT NOT NULL,
  "invoiceStatementId" TEXT NOT NULL,
  "designPartnerCouponId" TEXT,
  "requestRef" TEXT NOT NULL,
  "closingRef" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "policyVersion" TEXT NOT NULL,
  "policyDigest" TEXT NOT NULL,
  "acceptedMinimumMinor" TEXT NOT NULL,
  "previousCumulativeConsiderationMinor" TEXT NOT NULL,
  "acceptedCumulativeConsiderationMinor" TEXT NOT NULL,
  "considerationAcceptanceDigest" TEXT NOT NULL,
  "sellerAcceptanceEvidenceRef" TEXT NOT NULL,
  "buyerAcceptanceEvidenceRef" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL,
  "cumulativeGrossBaseMinor" TEXT NOT NULL,
  "incrementalGrossBaseMinor" TEXT NOT NULL,
  "eligibleStandalonePremiumMinor" TEXT NOT NULL,
  "previouslyAppliedPremiumMinor" TEXT NOT NULL,
  "appliedPremiumCreditMinor" TEXT NOT NULL,
  "remainingPremiumMinor" TEXT NOT NULL,
  "postPremiumBaseMinor" TEXT NOT NULL,
  "designPartnerProgrammeCode" TEXT,
  "designPartnerDiscountBps" INTEGER,
  "designPartnerCreditBaseMinor" TEXT NOT NULL,
  "netBaseMinor" TEXT NOT NULL,
  "grossTaxMinor" TEXT NOT NULL,
  "premiumTaxCreditMinor" TEXT NOT NULL,
  "designPartnerTaxCreditMinor" TEXT NOT NULL,
  "totalTaxCreditMinor" TEXT NOT NULL,
  "netTaxMinor" TEXT NOT NULL,
  "grossTotalMinor" TEXT NOT NULL,
  "invoiceGrossTotalMinor" TEXT NOT NULL,
  "designPartnerTotalCreditMinor" TEXT NOT NULL,
  "totalCreditMinor" TEXT NOT NULL,
  "netTotalMinor" TEXT NOT NULL,
  "taxRuleSnapshot" JSONB NOT NULL,
  "snapshotDigest" TEXT NOT NULL,
  "preparedByUserId" TEXT NOT NULL,
  "preparationStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExecutionFeeInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExecutionFeeInvoice_invoiceStatementId_key" ON "ExecutionFeeInvoice"("invoiceStatementId");
CREATE UNIQUE INDEX "ExecutionFeeInvoice_engagement_request_key" ON "ExecutionFeeInvoice"("engagementId", "requestRef");
CREATE UNIQUE INDEX "ExecutionFeeInvoice_engagement_case_sequence_key" ON "ExecutionFeeInvoice"("engagementId", "transactionCaseId", "sequence");
CREATE UNIQUE INDEX "ExecutionFeeInvoice_active_closing_key" ON "ExecutionFeeInvoice"("engagementId", "transactionCaseId", "closingRef") WHERE "status" IN ('PROPOSED','APPROVED');
CREATE INDEX "ExecutionFeeInvoice_seller_case_closing_idx" ON "ExecutionFeeInvoice"("sellerInstitutionId", "transactionCaseId", "closingRef");
CREATE INDEX "ExecutionFeeInvoice_engagementId_status_sequence_idx" ON "ExecutionFeeInvoice"("engagementId", "status", "sequence");

ALTER TABLE "ExecutionFeeInvoice" ADD CONSTRAINT "ExecutionFeeInvoice_sellerInstitutionId_fkey" FOREIGN KEY ("sellerInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutionFeeInvoice" ADD CONSTRAINT "ExecutionFeeInvoice_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AssessmentEngagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutionFeeInvoice" ADD CONSTRAINT "ExecutionFeeInvoice_transactionCaseId_fkey" FOREIGN KEY ("transactionCaseId") REFERENCES "TransactionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutionFeeInvoice" ADD CONSTRAINT "ExecutionFeeInvoice_invoiceStatementId_fkey" FOREIGN KEY ("invoiceStatementId") REFERENCES "CustomerInvoiceStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutionFeeInvoice" ADD CONSTRAINT "ExecutionFeeInvoice_designPartnerCouponId_fkey" FOREIGN KEY ("designPartnerCouponId") REFERENCES "CustomerDesignPartnerCoupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExecutionFeeInvoice" ADD CONSTRAINT "Execution_fee_invoice_state" CHECK (
  "sequence" > 0 AND "status" IN ('PROPOSED','APPROVED','REJECTED') AND
  (("status"='PROPOSED' AND "reviewedByUserId" IS NULL AND "reviewStepUpId" IS NULL AND "reviewReason" IS NULL AND "reviewedAt" IS NULL) OR
   ("status" IN ('APPROVED','REJECTED') AND "reviewedByUserId" IS NOT NULL AND "reviewedByUserId"<>"preparedByUserId" AND "reviewStepUpId" IS NOT NULL AND "reviewReason" IS NOT NULL AND "reviewedAt" IS NOT NULL))
);
ALTER TABLE "ExecutionFeeInvoice" ADD CONSTRAINT "Execution_fee_invoice_digests" CHECK (
  "policyDigest" ~ '^sha256:[a-f0-9]{64}$' AND "considerationAcceptanceDigest" ~ '^sha256:[a-f0-9]{64}$' AND "snapshotDigest" ~ '^sha256:[a-f0-9]{64}$'
);
ALTER TABLE "ExecutionFeeInvoice" ADD CONSTRAINT "Execution_fee_invoice_design_partner" CHECK (
  (("designPartnerCouponId" IS NULL AND "designPartnerProgrammeCode" IS NULL AND "designPartnerDiscountBps" IS NULL AND "designPartnerCreditBaseMinor"='0' AND "designPartnerTaxCreditMinor"='0' AND "designPartnerTotalCreditMinor"='0') OR
   ("designPartnerCouponId" IS NOT NULL AND "designPartnerProgrammeCode"='DESIGN_PARTNER_30' AND "designPartnerDiscountBps"=3000))
);
ALTER TABLE "ExecutionFeeInvoice" ADD CONSTRAINT "Execution_fee_invoice_amounts" CHECK (
  "acceptedMinimumMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "previousCumulativeConsiderationMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "acceptedCumulativeConsiderationMinor" ~ '^[1-9][0-9]{0,29}$' AND
  "cumulativeGrossBaseMinor" ~ '^[1-9][0-9]{0,29}$' AND
  "incrementalGrossBaseMinor" ~ '^[1-9][0-9]{0,29}$' AND
  "eligibleStandalonePremiumMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "previouslyAppliedPremiumMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "appliedPremiumCreditMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "remainingPremiumMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "postPremiumBaseMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "designPartnerCreditBaseMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "netBaseMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "grossTaxMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "premiumTaxCreditMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "designPartnerTaxCreditMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "totalTaxCreditMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "netTaxMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "grossTotalMinor" ~ '^[1-9][0-9]{0,29}$' AND
  "invoiceGrossTotalMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "designPartnerTotalCreditMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "totalCreditMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "netTotalMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND
  "previousCumulativeConsiderationMinor"::numeric < "acceptedCumulativeConsiderationMinor"::numeric AND
  "previouslyAppliedPremiumMinor"::numeric + "appliedPremiumCreditMinor"::numeric + "remainingPremiumMinor"::numeric = "eligibleStandalonePremiumMinor"::numeric AND
  "incrementalGrossBaseMinor"::numeric - "appliedPremiumCreditMinor"::numeric = "postPremiumBaseMinor"::numeric AND
  "postPremiumBaseMinor"::numeric - "designPartnerCreditBaseMinor"::numeric = "netBaseMinor"::numeric AND
  "premiumTaxCreditMinor"::numeric + "designPartnerTaxCreditMinor"::numeric = "totalTaxCreditMinor"::numeric AND
  "grossTaxMinor"::numeric - "totalTaxCreditMinor"::numeric = "netTaxMinor"::numeric AND
  "incrementalGrossBaseMinor"::numeric + "grossTaxMinor"::numeric = "grossTotalMinor"::numeric AND
  "grossTotalMinor"::numeric - "appliedPremiumCreditMinor"::numeric - "premiumTaxCreditMinor"::numeric = "invoiceGrossTotalMinor"::numeric AND
  "designPartnerCreditBaseMinor"::numeric + "designPartnerTaxCreditMinor"::numeric = "designPartnerTotalCreditMinor"::numeric AND
  "appliedPremiumCreditMinor"::numeric + "designPartnerCreditBaseMinor"::numeric + "totalTaxCreditMinor"::numeric = "totalCreditMinor"::numeric AND
  "netBaseMinor"::numeric + "netTaxMinor"::numeric = "netTotalMinor"::numeric AND
  "grossTotalMinor"::numeric - "totalCreditMinor"::numeric = "netTotalMinor"::numeric
);

CREATE FUNCTION rail_freeze_execution_fee_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'execution fee invoice evidence is permanent'; END IF;
  IF OLD.status<>'PROPOSED' THEN RAISE EXCEPTION 'reviewed execution fee invoice is immutable'; END IF;
  IF NEW.status NOT IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'execution fee proposal can only be reviewed once'; END IF;
  IF ROW(NEW."sellerInstitutionId",NEW."engagementId",NEW."transactionCaseId",NEW."invoiceStatementId",NEW."designPartnerCouponId",NEW."requestRef",NEW."closingRef",NEW."sequence",NEW."policyVersion",NEW."policyDigest",NEW."acceptedMinimumMinor",NEW."previousCumulativeConsiderationMinor",NEW."acceptedCumulativeConsiderationMinor",NEW."considerationAcceptanceDigest",NEW."sellerAcceptanceEvidenceRef",NEW."buyerAcceptanceEvidenceRef",NEW."acceptedAt",NEW."cumulativeGrossBaseMinor",NEW."incrementalGrossBaseMinor",NEW."eligibleStandalonePremiumMinor",NEW."previouslyAppliedPremiumMinor",NEW."appliedPremiumCreditMinor",NEW."remainingPremiumMinor",NEW."postPremiumBaseMinor",NEW."designPartnerProgrammeCode",NEW."designPartnerDiscountBps",NEW."designPartnerCreditBaseMinor",NEW."netBaseMinor",NEW."grossTaxMinor",NEW."premiumTaxCreditMinor",NEW."designPartnerTaxCreditMinor",NEW."totalTaxCreditMinor",NEW."netTaxMinor",NEW."grossTotalMinor",NEW."invoiceGrossTotalMinor",NEW."designPartnerTotalCreditMinor",NEW."totalCreditMinor",NEW."netTotalMinor",NEW."taxRuleSnapshot",NEW."snapshotDigest",NEW."preparedByUserId",NEW."preparationStepUpId",NEW."createdAt") IS DISTINCT FROM ROW(OLD."sellerInstitutionId",OLD."engagementId",OLD."transactionCaseId",OLD."invoiceStatementId",OLD."designPartnerCouponId",OLD."requestRef",OLD."closingRef",OLD."sequence",OLD."policyVersion",OLD."policyDigest",OLD."acceptedMinimumMinor",OLD."previousCumulativeConsiderationMinor",OLD."acceptedCumulativeConsiderationMinor",OLD."considerationAcceptanceDigest",OLD."sellerAcceptanceEvidenceRef",OLD."buyerAcceptanceEvidenceRef",OLD."acceptedAt",OLD."cumulativeGrossBaseMinor",OLD."incrementalGrossBaseMinor",OLD."eligibleStandalonePremiumMinor",OLD."previouslyAppliedPremiumMinor",OLD."appliedPremiumCreditMinor",OLD."remainingPremiumMinor",OLD."postPremiumBaseMinor",OLD."designPartnerProgrammeCode",OLD."designPartnerDiscountBps",OLD."designPartnerCreditBaseMinor",OLD."netBaseMinor",OLD."grossTaxMinor",OLD."premiumTaxCreditMinor",OLD."designPartnerTaxCreditMinor",OLD."totalTaxCreditMinor",OLD."netTaxMinor",OLD."grossTotalMinor",OLD."invoiceGrossTotalMinor",OLD."designPartnerTotalCreditMinor",OLD."totalCreditMinor",OLD."netTotalMinor",OLD."taxRuleSnapshot",OLD."snapshotDigest",OLD."preparedByUserId",OLD."preparationStepUpId",OLD."createdAt") THEN
    RAISE EXCEPTION 'execution fee proposal scope and arithmetic are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER freeze_execution_fee_invoice BEFORE UPDATE OR DELETE ON "ExecutionFeeInvoice" FOR EACH ROW EXECUTE FUNCTION rail_freeze_execution_fee_invoice();

CREATE FUNCTION rail_freeze_execution_invoice_amounts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ExecutionFeeInvoice" WHERE "invoiceStatementId"=OLD.id) AND
     ROW(NEW."customerContractId",NEW."customerRateCardId",NEW."statementRef",NEW."periodStart",NEW."periodEnd",NEW.currency,NEW."currencyScale",NEW."grossFeeMinor",NEW."creditMinor",NEW."netFeeMinor",NEW."statementDigest",NEW."preparedByUserId",NEW."preparationStepUpId",NEW."createdAt") IS DISTINCT FROM
     ROW(OLD."customerContractId",OLD."customerRateCardId",OLD."statementRef",OLD."periodStart",OLD."periodEnd",OLD.currency,OLD."currencyScale",OLD."grossFeeMinor",OLD."creditMinor",OLD."netFeeMinor",OLD."statementDigest",OLD."preparedByUserId",OLD."preparationStepUpId",OLD."createdAt") THEN
    RAISE EXCEPTION 'execution invoice financial snapshot is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER freeze_execution_invoice_amounts BEFORE UPDATE ON "CustomerInvoiceStatement" FOR EACH ROW EXECUTE FUNCTION rail_freeze_execution_invoice_amounts();
