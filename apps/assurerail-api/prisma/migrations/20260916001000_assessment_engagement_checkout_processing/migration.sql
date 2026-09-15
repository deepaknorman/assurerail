-- CreateTable
CREATE TABLE "EngagementCheckout" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "mode" TEXT NOT NULL DEFAULT 'TEST',
    "merchantAccountRef" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountMinor" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATING',
    "providerLinkId" TEXT,
    "checkoutUrl" TEXT,
    "providerPaymentId" TEXT,
    "verifiedPaidMinor" TEXT NOT NULL DEFAULT '0',
    "reconciliationDigest" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookInbox" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "merchantAccountRef" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payloadDigest" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "providerLinkId" TEXT,
    "providerPaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentEngagement" (
    "id" TEXT NOT NULL,
    "customerContractId" TEXT NOT NULL,
    "requestRef" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "billingProfile" JSONB NOT NULL,
    "scope" JSONB NOT NULL,
    "quote" JSONB NOT NULL,
    "quoteDigest" TEXT NOT NULL,
    "termsDigest" TEXT NOT NULL,
    "rateCardId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFERED',
    "route" TEXT,
    "acceptedByUserId" TEXT,
    "acceptanceStepUpId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "preparationAcceptedBy" TEXT,
    "preparationStepUpId" TEXT,
    "preparationAcceptedAt" TIMESTAMP(3),
    "offerExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentEngagementStage" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "expectedMinor" TEXT NOT NULL,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentEngagementStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPaymentAdjustment" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "requestRef" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountMinor" TEXT NOT NULL,
    "evidenceRef" TEXT NOT NULL,
    "evidenceDigest" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "proposedByUserId" TEXT NOT NULL,
    "proposalStepUpId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewStepUpId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPaymentAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentProcessingJob" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "requestRef" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "evidenceVersionIds" JSONB NOT NULL,
    "sourceManifest" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "result" JSONB,
    "resultDigest" TEXT,
    "errorCode" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewEvidenceRef" TEXT,
    "reviewSnapshot" JSONB,
    "reviewStepUpId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EngagementCheckout_invoiceId_key" ON "EngagementCheckout"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementCheckout_reference_key" ON "EngagementCheckout"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementCheckout_providerLinkId_key" ON "EngagementCheckout"("providerLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementCheckout_providerPaymentId_key" ON "EngagementCheckout"("providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentWebhookInbox_status_createdAt_idx" ON "PaymentWebhookInbox"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookInbox_provider_merchantAccountRef_eventId_key" ON "PaymentWebhookInbox"("provider", "merchantAccountRef", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentEngagement_customerContractId_requestRef_key" ON "AssessmentEngagement"("customerContractId", "requestRef");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentEngagementStage_invoiceId_key" ON "AssessmentEngagementStage"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentEngagementStage_engagementId_stage_key" ON "AssessmentEngagementStage"("engagementId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPaymentAdjustment_requestRef_key" ON "CustomerPaymentAdjustment"("requestRef");

-- CreateIndex
CREATE INDEX "CustomerPaymentAdjustment_receiptId_status_idx" ON "CustomerPaymentAdjustment"("receiptId", "status");

-- CreateIndex
CREATE INDEX "AssessmentProcessingJob_status_createdAt_idx" ON "AssessmentProcessingJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentProcessingJob_engagementId_requestRef_key" ON "AssessmentProcessingJob"("engagementId", "requestRef");

-- AddForeignKey
ALTER TABLE "EngagementCheckout" ADD CONSTRAINT "EngagementCheckout_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoiceStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentEngagement" ADD CONSTRAINT "AssessmentEngagement_customerContractId_fkey" FOREIGN KEY ("customerContractId") REFERENCES "CustomerContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentEngagementStage" ADD CONSTRAINT "AssessmentEngagementStage_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AssessmentEngagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentEngagementStage" ADD CONSTRAINT "AssessmentEngagementStage_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoiceStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPaymentAdjustment" ADD CONSTRAINT "CustomerPaymentAdjustment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CustomerPaymentReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentProcessingJob" ADD CONSTRAINT "AssessmentProcessingJob_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AssessmentEngagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Application checks are backed by storage constraints for payment and acceptance authority.
ALTER TABLE "AssessmentEngagement" ADD CONSTRAINT "Engagement_status" CHECK (status IN ('OFFERED','ACCEPTED_SHADOW','SUSPENDED','CANCELLED'));
ALTER TABLE "AssessmentEngagement" ADD CONSTRAINT "Engagement_route" CHECK (route IS NULL OR route IN ('COMMITTED','STANDALONE'));
ALTER TABLE "AssessmentEngagement" ADD CONSTRAINT "Engagement_acceptance_complete" CHECK (status <> 'ACCEPTED_SHADOW' OR ("acceptedByUserId" IS NOT NULL AND "acceptanceStepUpId" IS NOT NULL AND "acceptedAt" IS NOT NULL));
ALTER TABLE "AssessmentEngagement" ADD CONSTRAINT "Engagement_preparation_complete" CHECK (route IS NULL OR ("preparationAcceptedBy" IS NOT NULL AND "preparationStepUpId" IS NOT NULL AND "preparationAcceptedAt" IS NOT NULL));
ALTER TABLE "AssessmentEngagement" ADD CONSTRAINT "Engagement_ratecard_fk" FOREIGN KEY ("rateCardId") REFERENCES "CustomerRateCard"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentEngagementStage" ADD CONSTRAINT "Engagement_stage" CHECK (stage IN ('INITIAL','PREPARATION') AND "expectedMinor" ~ '^[1-9][0-9]{0,29}$');
ALTER TABLE "EngagementCheckout" ADD CONSTRAINT "Checkout_mode" CHECK (provider='RAZORPAY' AND mode='TEST');
ALTER TABLE "EngagementCheckout" ADD CONSTRAINT "Checkout_status" CHECK (status IN ('CREATING','OPEN','UNKNOWN','PAID_TEST','HOLD'));
ALTER TABLE "EngagementCheckout" ADD CONSTRAINT "Checkout_amounts" CHECK ("amountMinor" ~ '^[1-9][0-9]{0,29}$' AND "verifiedPaidMinor" ~ '^(0|[1-9][0-9]{0,29})$');
ALTER TABLE "EngagementCheckout" ADD CONSTRAINT "Checkout_paid_evidence" CHECK (status <> 'PAID_TEST' OR ("verifiedPaidMinor"="amountMinor" AND "providerPaymentId" IS NOT NULL AND "providerLinkId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "reconciliationDigest" IS NOT NULL));
ALTER TABLE "CustomerPaymentAdjustment" ADD CONSTRAINT "Payment_adjustment_amount" CHECK ("amountMinor" ~ '^[1-9][0-9]{0,29}$');
ALTER TABLE "CustomerPaymentAdjustment" ADD CONSTRAINT "Payment_adjustment_state" CHECK (kind IN ('REFUND','REVERSAL') AND status IN ('PROPOSED','APPROVED','REJECTED'));
ALTER TABLE "CustomerPaymentAdjustment" ADD CONSTRAINT "Payment_adjustment_review" CHECK (status='PROPOSED' OR ("reviewedByUserId" IS NOT NULL AND "reviewedByUserId"<>"proposedByUserId" AND "reviewStepUpId" IS NOT NULL AND "reviewedAt" IS NOT NULL));
ALTER TABLE "AssessmentProcessingJob" ADD CONSTRAINT "Processing_state" CHECK (stage IN ('INITIAL','PREPARATION') AND status IN ('QUEUED','RUNNING','REVIEW_REQUIRED','RELEASED','REJECTED','FAILED'));
ALTER TABLE "AssessmentProcessingJob" ADD CONSTRAINT "Processing_release" CHECK (status NOT IN ('RELEASED','REJECTED') OR (result IS NOT NULL AND "resultDigest" IS NOT NULL AND "reviewedByUserId" IS NOT NULL AND "reviewedByUserId"<>"requestedByUserId" AND "reviewStepUpId" IS NOT NULL AND "reviewEvidenceRef" IS NOT NULL AND "reviewSnapshot" IS NOT NULL AND "reviewedAt" IS NOT NULL));
CREATE FUNCTION rail_freeze_engagement_quote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status <> 'OFFERED' AND (NEW."quoteDigest",NEW.quote,NEW.scope,NEW."billingProfile",NEW."termsDigest",NEW."customerContractId",NEW."rateCardId",NEW."acceptedByUserId",NEW."acceptanceStepUpId",NEW."acceptedAt") IS DISTINCT FROM (OLD."quoteDigest",OLD.quote,OLD.scope,OLD."billingProfile",OLD."termsDigest",OLD."customerContractId",OLD."rateCardId",OLD."acceptedByUserId",OLD."acceptanceStepUpId",OLD."acceptedAt") THEN RAISE EXCEPTION 'accepted engagement is immutable'; END IF;
 IF OLD.status <> 'OFFERED' AND NEW.status='OFFERED' THEN RAISE EXCEPTION 'accepted engagement cannot return to offered'; END IF;
 IF OLD.route IS NOT NULL AND (NEW.route,NEW."preparationAcceptedBy",NEW."preparationStepUpId",NEW."preparationAcceptedAt") IS DISTINCT FROM (OLD.route,OLD."preparationAcceptedBy",OLD."preparationStepUpId",OLD."preparationAcceptedAt") THEN RAISE EXCEPTION 'accepted preparation route requires a separate amendment'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER freeze_engagement_quote BEFORE UPDATE ON "AssessmentEngagement" FOR EACH ROW EXECUTE FUNCTION rail_freeze_engagement_quote();
