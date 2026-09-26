-- Document intake previously persisted the object-store's internal bare hex checksum in the
-- externally consumed EvidenceVersion digest field. Only the founder-demo institution contains
-- those rows. Refuse to rewrite non-demo evidence if this migration is reused elsewhere.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "EvidenceVersion"
    WHERE "payloadDigest" !~ '^sha256:[a-f0-9]{64}$'
      AND "payloadDigest" !~ '^[a-f0-9]{64}$'
  ) THEN
    RAISE EXCEPTION 'refusing evidence-digest migration with an invalid existing digest';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "EvidenceVersion" version
    JOIN "EvidenceObject" object ON object.id = version."evidenceObjectId"
    WHERE version."payloadDigest" ~ '^[a-f0-9]{64}$'
      AND object."institutionId" NOT LIKE 'demo-%'
  ) THEN
    RAISE EXCEPTION 'refusing bare evidence-digest backfill for a non-demo institution';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "EvidenceVersion" bare
    JOIN "EvidenceVersion" canonical
      ON canonical."evidenceObjectId" = bare."evidenceObjectId"
     AND canonical."payloadDigest" = 'sha256:' || bare."payloadDigest"
    WHERE bare."payloadDigest" ~ '^[a-f0-9]{64}$'
  ) THEN
    RAISE EXCEPTION 'refusing evidence-digest backfill that would merge distinct versions';
  END IF;
END $$;

UPDATE "EvidenceVersion"
SET "payloadDigest" = 'sha256:' || "payloadDigest"
WHERE "payloadDigest" ~ '^[a-f0-9]{64}$';

ALTER TABLE "EvidenceVersion"
  ADD CONSTRAINT "EvidenceVersion_payload_digest_canonical"
  CHECK ("payloadDigest" ~ '^sha256:[a-f0-9]{64}$');
