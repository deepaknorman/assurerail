CREATE TABLE "CustomerDesignPartnerCoupon" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programmeCode" TEXT NOT NULL DEFAULT 'DESIGN_PARTNER_30',
    "discountBps" INTEGER NOT NULL DEFAULT 3000,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "slot" INTEGER,
    "evidenceRef" TEXT NOT NULL,
    "signedScopeAt" TIMESTAMP(3) NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "proposalStepUpId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewStepUpId" TEXT,
    "reviewReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerDesignPartnerCoupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerInvoiceDiscount" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "programmeCode" TEXT NOT NULL,
    "discountBps" INTEGER NOT NULL,
    "standardBaseMinor" TEXT NOT NULL,
    "standardTaxMinor" TEXT NOT NULL,
    "standardTotalMinor" TEXT NOT NULL,
    "discountedBaseMinor" TEXT NOT NULL,
    "discountedTaxMinor" TEXT NOT NULL,
    "discountedTotalMinor" TEXT NOT NULL,
    "baseCreditMinor" TEXT NOT NULL,
    "taxCreditMinor" TEXT NOT NULL,
    "totalCreditMinor" TEXT NOT NULL,
    "snapshotDigest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerInvoiceDiscount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerDesignPartnerCoupon_approved_institution_key" ON "CustomerDesignPartnerCoupon"("institutionId") WHERE "status"='APPROVED';
CREATE UNIQUE INDEX "CustomerDesignPartnerCoupon_slot_key" ON "CustomerDesignPartnerCoupon"("slot");
CREATE INDEX "CustomerDesignPartnerCoupon_status_createdAt_idx" ON "CustomerDesignPartnerCoupon"("status", "createdAt");
CREATE INDEX "CustomerDesignPartnerCoupon_institutionId_status_idx" ON "CustomerDesignPartnerCoupon"("institutionId", "status");
CREATE INDEX "CustomerDesignPartnerCoupon_signedScopeAt_createdAt_idx" ON "CustomerDesignPartnerCoupon"("signedScopeAt", "createdAt");
CREATE UNIQUE INDEX "CustomerInvoiceDiscount_invoiceId_key" ON "CustomerInvoiceDiscount"("invoiceId");
CREATE INDEX "CustomerInvoiceDiscount_couponId_createdAt_idx" ON "CustomerInvoiceDiscount"("couponId", "createdAt");

ALTER TABLE "CustomerDesignPartnerCoupon" ADD CONSTRAINT "CustomerDesignPartnerCoupon_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoiceDiscount" ADD CONSTRAINT "CustomerInvoiceDiscount_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoiceStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoiceDiscount" ADD CONSTRAINT "CustomerInvoiceDiscount_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "CustomerDesignPartnerCoupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerDesignPartnerCoupon" ADD CONSTRAINT "Design_partner_programme" CHECK ("programmeCode"='DESIGN_PARTNER_30' AND "discountBps"=3000);
ALTER TABLE "CustomerDesignPartnerCoupon" ADD CONSTRAINT "Design_partner_state" CHECK (
  "status" IN ('PROPOSED','APPROVED','REJECTED') AND
  (("status"='PROPOSED' AND "slot" IS NULL AND "reviewedByUserId" IS NULL AND "reviewStepUpId" IS NULL AND "reviewReason" IS NULL AND "reviewedAt" IS NULL) OR
   ("status"='REJECTED' AND "slot" IS NULL AND "reviewedByUserId" IS NOT NULL AND "reviewedByUserId"<>"proposedByUserId" AND "reviewStepUpId" IS NOT NULL AND "reviewReason" IS NOT NULL AND "reviewedAt" IS NOT NULL) OR
   ("status"='APPROVED' AND "slot" IN (1,2) AND "reviewedByUserId" IS NOT NULL AND "reviewedByUserId"<>"proposedByUserId" AND "reviewStepUpId" IS NOT NULL AND "reviewReason" IS NOT NULL AND "reviewedAt" IS NOT NULL))
);
ALTER TABLE "CustomerInvoiceDiscount" ADD CONSTRAINT "Invoice_design_partner_programme" CHECK ("programmeCode"='DESIGN_PARTNER_30' AND "discountBps"=3000);
ALTER TABLE "CustomerInvoiceDiscount" ADD CONSTRAINT "Invoice_design_partner_amounts" CHECK (
  "standardBaseMinor" ~ '^[1-9][0-9]{0,29}$' AND "standardTaxMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND "standardTotalMinor" ~ '^[1-9][0-9]{0,29}$' AND
  "discountedBaseMinor" ~ '^[1-9][0-9]{0,29}$' AND "discountedTaxMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND "discountedTotalMinor" ~ '^[1-9][0-9]{0,29}$' AND
  "baseCreditMinor" ~ '^[1-9][0-9]{0,29}$' AND "taxCreditMinor" ~ '^(0|[1-9][0-9]{0,29})$' AND "totalCreditMinor" ~ '^[1-9][0-9]{0,29}$' AND
  "standardBaseMinor"::numeric + "standardTaxMinor"::numeric = "standardTotalMinor"::numeric AND
  "discountedBaseMinor"::numeric + "discountedTaxMinor"::numeric = "discountedTotalMinor"::numeric AND
  "baseCreditMinor"::numeric + "taxCreditMinor"::numeric = "totalCreditMinor"::numeric AND
  "discountedTotalMinor"::numeric + "totalCreditMinor"::numeric = "standardTotalMinor"::numeric
);

-- An approved lifetime slot is permanent. Rejected/proposed rows remain audit records as well.
CREATE FUNCTION rail_freeze_design_partner_coupon() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'design-partner coupon records are permanent'; END IF;
  IF OLD.status<>'PROPOSED' THEN RAISE EXCEPTION 'reviewed design-partner coupon is immutable'; END IF;
  IF (NEW."institutionId",NEW."programmeCode",NEW."discountBps",NEW."evidenceRef",NEW."signedScopeAt",NEW."proposedByUserId",NEW."proposalStepUpId") IS DISTINCT FROM (OLD."institutionId",OLD."programmeCode",OLD."discountBps",OLD."evidenceRef",OLD."signedScopeAt",OLD."proposedByUserId",OLD."proposalStepUpId") THEN RAISE EXCEPTION 'design-partner proposal scope is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER freeze_design_partner_coupon BEFORE UPDATE OR DELETE ON "CustomerDesignPartnerCoupon" FOR EACH ROW EXECUTE FUNCTION rail_freeze_design_partner_coupon();

CREATE FUNCTION rail_freeze_invoice_discount() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'invoice discount snapshot is immutable'; END $$;
CREATE TRIGGER freeze_invoice_discount BEFORE UPDATE OR DELETE ON "CustomerInvoiceDiscount" FOR EACH ROW EXECUTE FUNCTION rail_freeze_invoice_discount();
