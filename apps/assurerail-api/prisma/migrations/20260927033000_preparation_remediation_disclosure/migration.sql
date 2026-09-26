-- Bind each new Portfolio Preparation acceptance to the open remediation scope shown to the seller.
ALTER TABLE "AssessmentEngagement"
  ADD COLUMN "preparationRemediationScopeDigest" TEXT;

ALTER TABLE "AssessmentEngagement"
  ADD CONSTRAINT "Engagement_preparation_remediation_digest"
  CHECK ("preparationRemediationScopeDigest" IS NULL OR "preparationRemediationScopeDigest" ~ '^sha256:[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION rail_freeze_engagement_quote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status <> 'OFFERED' AND (NEW."quoteDigest",NEW.quote,NEW.scope,NEW."billingProfile",NEW."termsDigest",NEW."customerContractId",NEW."rateCardId",NEW."acceptedByUserId",NEW."acceptanceStepUpId",NEW."acceptedAt") IS DISTINCT FROM (OLD."quoteDigest",OLD.quote,OLD.scope,OLD."billingProfile",OLD."termsDigest",OLD."customerContractId",OLD."rateCardId",OLD."acceptedByUserId",OLD."acceptanceStepUpId",OLD."acceptedAt") THEN RAISE EXCEPTION 'accepted engagement is immutable'; END IF;
 IF OLD.status <> 'OFFERED' AND NEW.status='OFFERED' THEN RAISE EXCEPTION 'accepted engagement cannot return to offered'; END IF;
 IF OLD.route IS NOT NULL AND (NEW.route,NEW."preparationRemediationScopeDigest",NEW."preparationAcceptedBy",NEW."preparationStepUpId",NEW."preparationAcceptedAt") IS DISTINCT FROM (OLD.route,OLD."preparationRemediationScopeDigest",OLD."preparationAcceptedBy",OLD."preparationStepUpId",OLD."preparationAcceptedAt") THEN RAISE EXCEPTION 'accepted preparation route requires a separate amendment'; END IF;
 RETURN NEW;
END $$;
