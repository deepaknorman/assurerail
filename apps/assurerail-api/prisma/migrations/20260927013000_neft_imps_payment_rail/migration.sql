-- Every pre-existing receipt is synthetic/shadow. Refuse to stamp a rail or synthetic label
-- onto any receipt state outside the shadow workflow if this migration is reused elsewhere.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "CustomerPaymentReceipt"
    WHERE status NOT IN ('PROPOSED', 'VERIFIED_SHADOW', 'REJECTED')
  ) THEN
    RAISE EXCEPTION 'refusing payment-rail backfill for a non-shadow receipt';
  END IF;
END $$;

ALTER TABLE "CustomerPaymentReceipt" ADD COLUMN "transferRail" TEXT;
ALTER TABLE "CustomerPaymentReceipt" ADD COLUMN "syntheticOnly" BOOLEAN;

-- Existing rows are shadow-only bank receipts created before the payment rail was explicit.
-- Preserve them as NEFT rather than inferring a rail from their free-text transfer reference.
UPDATE "CustomerPaymentReceipt"
SET "transferRail" = 'NEFT', "syntheticOnly" = TRUE
WHERE "transferRail" IS NULL OR "syntheticOnly" IS NULL;

ALTER TABLE "CustomerPaymentReceipt" ALTER COLUMN "transferRail" SET NOT NULL;
ALTER TABLE "CustomerPaymentReceipt" ALTER COLUMN "syntheticOnly" SET NOT NULL;
ALTER TABLE "CustomerPaymentReceipt" ADD CONSTRAINT "CustomerPaymentReceipt_transfer_rail"
  CHECK ("transferRail" IN ('NEFT', 'RTGS', 'IMPS'));

CREATE FUNCTION "protect_payment_receipt_facts"() RETURNS trigger AS $$
BEGIN
  IF OLD."invoiceStatementId" IS DISTINCT FROM NEW."invoiceStatementId"
    OR OLD."collectionAccountRef" IS DISTINCT FROM NEW."collectionAccountRef"
    OR OLD."transferRail" IS DISTINCT FROM NEW."transferRail"
    OR OLD."syntheticOnly" IS DISTINCT FROM NEW."syntheticOnly"
    OR OLD."bankTransferRef" IS DISTINCT FROM NEW."bankTransferRef"
    OR OLD."amountMinor" IS DISTINCT FROM NEW."amountMinor"
    OR OLD."currency" IS DISTINCT FROM NEW."currency"
    OR OLD."evidenceRef" IS DISTINCT FROM NEW."evidenceRef"
    OR OLD."evidenceDigest" IS DISTINCT FROM NEW."evidenceDigest"
    OR OLD."receivedAt" IS DISTINCT FROM NEW."receivedAt"
    OR OLD."proposedByUserId" IS DISTINCT FROM NEW."proposedByUserId"
    OR OLD."proposalStepUpId" IS DISTINCT FROM NEW."proposalStepUpId"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN
    RAISE EXCEPTION 'payment receipt facts are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "CustomerPaymentReceipt_facts_immutable"
BEFORE UPDATE ON "CustomerPaymentReceipt"
FOR EACH ROW EXECUTE FUNCTION "protect_payment_receipt_facts"();

ALTER TABLE "EngagementCheckout" DROP CONSTRAINT "Checkout_status";
ALTER TABLE "EngagementCheckout" ADD CONSTRAINT "Checkout_status"
  CHECK (status IN ('CREATING','OPEN','UNKNOWN','PAID_TEST','HOLD','CANCELLED'));
