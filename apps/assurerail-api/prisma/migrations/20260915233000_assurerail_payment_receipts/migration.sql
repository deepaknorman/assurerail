-- Additive shadow reconciliation ledger; does not issue invoices or authorise settlement.
CREATE TABLE "CustomerPaymentReceipt" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "invoiceStatementId" TEXT NOT NULL REFERENCES "CustomerInvoiceStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "collectionAccountRef" TEXT NOT NULL, "bankTransferRef" TEXT NOT NULL,
 "amountMinor" TEXT NOT NULL CHECK ("amountMinor" ~ '^[1-9][0-9]{0,29}$'),
 "currency" TEXT NOT NULL CHECK ("currency" = 'INR'),
 "evidenceRef" TEXT NOT NULL, "evidenceDigest" TEXT NOT NULL,
 "receivedAt" TIMESTAMP(3) NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PROPOSED' CHECK ("status" IN ('PROPOSED','VERIFIED_SHADOW','REJECTED')),
 "proposedByUserId" TEXT NOT NULL, "proposalStepUpId" TEXT NOT NULL,
 "reviewedByUserId" TEXT, "reviewStepUpId" TEXT, "reviewedAt" TIMESTAMP(3), "reviewReason" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CustomerPaymentReceipt_independent_review" CHECK ("reviewedByUserId" IS NULL OR "reviewedByUserId" <> "proposedByUserId"),
 CONSTRAINT "CustomerPaymentReceipt_review_complete" CHECK ("status" = 'PROPOSED' OR ("reviewedByUserId" IS NOT NULL AND "reviewStepUpId" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "reviewReason" IS NOT NULL))
);
CREATE UNIQUE INDEX "CustomerPaymentReceipt_collectionAccountRef_bankTransferRef_key" ON "CustomerPaymentReceipt"("collectionAccountRef", "bankTransferRef");
CREATE INDEX "CustomerPaymentReceipt_invoiceStatementId_status_idx" ON "CustomerPaymentReceipt"("invoiceStatementId", "status");
