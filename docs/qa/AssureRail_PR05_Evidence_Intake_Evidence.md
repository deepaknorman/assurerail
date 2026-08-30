# AssureRail PR-05 evidence/intake verification record

**Executed:** 30 August 2026

**Classification:** engineering evidence for replay/shadow capability; not production acceptance

## Results

| Check | Result |
|---|---|
| Prisma format/validate/client generation | Pass |
| AssureRail API TypeScript build and test suite | Pass: 146 tests, 0 failed, 0 skipped |
| PR-05 provider profile/conformance tests | Pass |
| PR-05 file type/trust-boundary tests | Pass |
| PR-05 endpoint/schema/migration tests | Pass |
| Disposable PostgreSQL fresh migration | Pass: 11 migrations, 9 PR-05 tables |
| Database uniqueness/foreign-key rehearsal | Pass: duplicate evidence version and storage reference rejected |
| Legacy upgrade rehearsal | Pass: existing inline document bytes remained byte-identical |
| PostgreSQL custom-format backup/restore and migration status | Pass |
| AssureRail web TypeScript/build | Pass: 12 static routes and 2 dynamic institution routes |
| Shell syntax for PR-05 rehearsal | Pass |

The first database attempt inside the restricted sandbox failed because local PostgreSQL could not
allocate a System V shared-memory segment. It was rerun outside that sandbox against a disposable
temporary cluster only; the corrected rehearsal passed. No configured database, deployment or
external customer system was contacted.

## Controls directly exercised

- connector declarations accept only bounded known profiles and reject duplicates;
- approval fails if conformance did not pass, has a critical failure or executed no tests;
- source-specific profiles cannot be relabelled as another connector profile;
- executable magic, MIME confusion and unapproved ZIP containers fail before storage;
- participant intake cannot self-assert `VERIFIED` for JSON or documents;
- common lender registry mapping retains the provider snapshot and evidentiary authority class;
- evidence/document version, storage-reference, grant and retention-event constraints exist;
- legacy bytes are retained when their column becomes nullable; and
- web workspace builds with active-institution routing and explicit replay/shadow language.

## Not executed or not claimed

- no live S3/MinIO/KMS, ClamAV, provider API or institutional signature service was used;
- no malware sample was transmitted outside pure/local policy tests;
- no controlled-live or production flag was enabled;
- case/party/appointment ACL awaits PR-06;
- no legacy broad-surface cutover was performed; and
- no deployment or push was performed under the current hold.
