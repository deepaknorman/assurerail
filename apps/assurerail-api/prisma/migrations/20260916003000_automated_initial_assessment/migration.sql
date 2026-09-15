-- Initial Assessment is an automated, unsigned screening product. Qualified human review is
-- reserved for Portfolio Preparation. Preserve legacy shadow releases while enforcing the new
-- automated-release evidence on all new AUTO_RELEASED rows.
ALTER TABLE "AssessmentProcessingJob"
  ADD COLUMN "automatedReleaseSnapshot" JSONB,
  ADD COLUMN "releasedAt" TIMESTAMP(3);

UPDATE "AssessmentProcessingJob"
SET "releasedAt" = COALESCE("reviewedAt", "completedAt", "createdAt")
WHERE status IN ('RELEASED', 'REJECTED');

ALTER TABLE "AssessmentProcessingJob" DROP CONSTRAINT "Processing_state";
ALTER TABLE "AssessmentProcessingJob" DROP CONSTRAINT "Processing_release";

ALTER TABLE "AssessmentProcessingJob" ADD CONSTRAINT "Processing_state"
CHECK (stage IN ('INITIAL','PREPARATION') AND status IN ('QUEUED','RUNNING','REVIEW_REQUIRED','AUTO_RELEASED','RELEASED','REJECTED','FAILED'));

ALTER TABLE "AssessmentProcessingJob" ADD CONSTRAINT "Processing_release" CHECK (
  (status = 'AUTO_RELEASED' AND stage = 'INITIAL' AND result IS NOT NULL AND "resultDigest" IS NOT NULL
    AND "automatedReleaseSnapshot" IS NOT NULL AND "releasedAt" IS NOT NULL
    AND "reviewedByUserId" IS NULL AND "reviewEvidenceRef" IS NULL AND "reviewSnapshot" IS NULL
    AND "reviewStepUpId" IS NULL AND "reviewedAt" IS NULL)
  OR
  (status IN ('RELEASED','REJECTED') AND result IS NOT NULL AND "resultDigest" IS NOT NULL
    AND "reviewedByUserId" IS NOT NULL AND "reviewedByUserId"<>"requestedByUserId"
    AND "reviewStepUpId" IS NOT NULL AND "reviewEvidenceRef" IS NOT NULL
    AND "reviewSnapshot" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "releasedAt" IS NOT NULL)
  OR status NOT IN ('AUTO_RELEASED','RELEASED','REJECTED')
);
