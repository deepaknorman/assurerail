-- Persist one bounded, PII-safe language-model outcome per document-review batch.
ALTER TABLE "AssessmentDocumentExtractionAttempt"
  ADD COLUMN "batchIndex" INTEGER,
  ADD COLUMN "batchDigest" TEXT,
  ADD COLUMN "batchEvidenceVersionIds" JSONB,
  ADD COLUMN "inputCharacters" INTEGER,
  ADD COLUMN "documentCount" INTEGER,
  ADD COLUMN "requestCount" INTEGER,
  ADD COLUMN "fallbackUsed" BOOLEAN,
  ADD COLUMN "result" JSONB;

ALTER TABLE "AssessmentDocumentExtractionAttempt"
  DROP CONSTRAINT "AssessmentDocumentExtractionAttempt_controlled_values";

ALTER TABLE "AssessmentDocumentExtractionAttempt"
  ADD CONSTRAINT "AssessmentDocumentExtractionAttempt_controlled_values" CHECK (
    "ordinal" > 0 AND
    "preprocessingVersion" <> '' AND
    ("resultDigest" IS NULL OR "resultDigest" ~ '^sha256:[a-f0-9]{64}$') AND
    (
      (
        "method" IN ('NATIVE_LIBRARY','VISUAL_MODEL','VISUAL_VALIDATION') AND
        "status" IN ('COMPLETED','FAILED_AVAILABILITY') AND
        "batchIndex" IS NULL AND "batchDigest" IS NULL AND "batchEvidenceVersionIds" IS NULL AND
        "inputCharacters" IS NULL AND "documentCount" IS NULL AND "requestCount" IS NULL AND "fallbackUsed" IS NULL AND "result" IS NULL AND
        (("status"='COMPLETED' AND "failureCode" IS NULL) OR ("status"='FAILED_AVAILABILITY' AND "failureCode" IS NOT NULL))
      ) OR (
        "method"='LANGUAGE_MODEL' AND
        "status" IN ('COMPLETED','INCOMPLETE') AND
        "batchIndex" > 0 AND
        "batchDigest" ~ '^sha256:[a-f0-9]{64}$' AND
        jsonb_typeof("batchEvidenceVersionIds")='array' AND
        jsonb_array_length("batchEvidenceVersionIds")="documentCount" AND
        "inputCharacters" > 0 AND "inputCharacters" <= 4000000 AND
        "documentCount" > 0 AND "documentCount" <= 100 AND
        "requestCount" > 0 AND "requestCount" <= 3 AND
        "fallbackUsed" IS NOT NULL AND
        "requestedLocators"='[]'::jsonb AND
        (
          ("status"='COMPLETED' AND "inputCharacters" <= 120000 AND "provider" IS NOT NULL AND "model" IS NOT NULL AND "modelTier" IS NOT NULL AND "failureCode" IS NULL AND "result" IS NOT NULL AND "resultDigest" IS NOT NULL) OR
          ("status"='INCOMPLETE' AND "failureCode" IN ('MODEL_TIMEOUT','MODEL_RATE_LIMITED','MODEL_UNAVAILABLE','MODEL_REQUEST_REJECTED','MODEL_SCHEMA_INVALID','MODEL_OUTPUT_TRUNCATED','MODEL_INPUT_BUDGET_EXCEEDED','BATCH_MEMBERSHIP_MISMATCH') AND "result" IS NULL AND "resultDigest" IS NULL)
        )
      )
    )
  );

CREATE UNIQUE INDEX "AssessmentDocumentExtractionAttempt_review_batch_key"
  ON "AssessmentDocumentExtractionAttempt"("documentReviewId", "batchIndex")
  WHERE "method"='LANGUAGE_MODEL';

CREATE INDEX "AssessmentDocumentExtractionAttempt_batch_status_idx"
  ON "AssessmentDocumentExtractionAttempt"("batchDigest", "status");

-- Rollback guidance: drop the two indexes and the replaced CHECK, drop the eight batch columns,
-- then restore the original controlled-values CHECK from 20260917163000_document_review_provenance.
