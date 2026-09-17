-- Append-only, PII-safe document review and extraction attempt provenance.
CREATE TABLE "AssessmentDocumentReview" (
  "id" TEXT NOT NULL,
  "processingJobId" TEXT NOT NULL,
  "evidenceVersionId" TEXT NOT NULL,
  "evidenceObjectId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "sourceDigest" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "routingReasons" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "envelope" JSONB NOT NULL,
  "envelopeDigest" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentDocumentReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentDocumentExtractionAttempt" (
  "id" TEXT NOT NULL,
  "documentReviewId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "method" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "modelTier" TEXT,
  "extractorVersion" TEXT,
  "promptVersion" TEXT,
  "preprocessingVersion" TEXT NOT NULL,
  "requestedLocators" JSONB NOT NULL,
  "usage" JSONB,
  "failureCode" TEXT,
  "resultDigest" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentDocumentExtractionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentDocumentReview_job_evidence_key" ON "AssessmentDocumentReview"("processingJobId", "evidenceVersionId");
CREATE INDEX "AssessmentDocumentReview_processingJobId_status_idx" ON "AssessmentDocumentReview"("processingJobId", "status");
CREATE INDEX "AssessmentDocumentReview_evidenceVersionId_idx" ON "AssessmentDocumentReview"("evidenceVersionId");
CREATE UNIQUE INDEX "AssessmentDocumentExtractionAttempt_review_ordinal_key" ON "AssessmentDocumentExtractionAttempt"("documentReviewId", "ordinal");
CREATE INDEX "AssessmentDocumentExtractionAttempt_provider_model_status_idx" ON "AssessmentDocumentExtractionAttempt"("provider", "model", "status");

ALTER TABLE "AssessmentDocumentReview" ADD CONSTRAINT "AssessmentDocumentReview_processingJobId_fkey" FOREIGN KEY ("processingJobId") REFERENCES "AssessmentProcessingJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentDocumentReview" ADD CONSTRAINT "AssessmentDocumentReview_evidenceVersionId_fkey" FOREIGN KEY ("evidenceVersionId") REFERENCES "EvidenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentDocumentExtractionAttempt" ADD CONSTRAINT "AssessmentDocumentExtractionAttempt_documentReviewId_fkey" FOREIGN KEY ("documentReviewId") REFERENCES "AssessmentDocumentReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentDocumentReview" ADD CONSTRAINT "AssessmentDocumentReview_controlled_values" CHECK (
  "sourceDigest" ~ '^sha256:[a-f0-9]{64}$' AND
  "envelopeDigest" ~ '^sha256:[a-f0-9]{64}$' AND
  "route" IN ('DETERMINISTIC_STRUCTURED','NATIVE','VISUAL','HYBRID') AND
  "status" IN ('ACCEPTED','EXCEPTION')
);

ALTER TABLE "AssessmentDocumentExtractionAttempt" ADD CONSTRAINT "AssessmentDocumentExtractionAttempt_controlled_values" CHECK (
  "ordinal" > 0 AND
  "method" IN ('NATIVE_LIBRARY','VISUAL_MODEL','VISUAL_VALIDATION') AND
  "status" IN ('COMPLETED','FAILED_AVAILABILITY') AND
  "preprocessingVersion" <> '' AND
  ("resultDigest" IS NULL OR "resultDigest" ~ '^sha256:[a-f0-9]{64}$') AND
  (("status"='COMPLETED' AND "failureCode" IS NULL) OR ("status"='FAILED_AVAILABILITY' AND "failureCode" IS NOT NULL))
);

CREATE FUNCTION rail_freeze_assessment_document_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'assessment document review provenance is append-only';
END $$;
CREATE TRIGGER freeze_assessment_document_review BEFORE UPDATE OR DELETE ON "AssessmentDocumentReview" FOR EACH ROW EXECUTE FUNCTION rail_freeze_assessment_document_review();
CREATE TRIGGER freeze_assessment_document_attempt BEFORE UPDATE OR DELETE ON "AssessmentDocumentExtractionAttempt" FOR EACH ROW EXECUTE FUNCTION rail_freeze_assessment_document_review();

-- Rollback guidance: drop the attempt table first, then the review table. Both are additive and no
-- earlier AssureRail record depends on them.
