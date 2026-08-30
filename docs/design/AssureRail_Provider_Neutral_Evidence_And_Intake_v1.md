# AssureRail provider-neutral evidence and intake v1

**Status:** PR-05 implemented in replay/shadow only, 30 August 2026

**Depends on:** PR-01 neutral contracts, PR-02 persistence/idempotency, PR-03 participant authority, PR-04 workspaces

**Not a claim of:** live transaction capability, verified assurance, legal completion, route permission or production readiness

## 1. Selected boundary

Rail now owns immutable receipt, classification, version, storage metadata, access policy and access
receipts for evidence submitted to Rail. It does not claim that the submitter is correct, that a
signature is cryptographically verified, or that evidence satisfies a route condition merely because
the bytes were received.

The selected flow is:

1. an admitted institution and an exactly mandated human register a provider/source connector;
2. the connector declares one or more named schema/profile triples;
3. the participant proposes a replay/shadow certification with step-up evidence and a digest of its
   conformance evidence;
4. a different platform administrator reviews it, and approval is impossible unless the stored
   conformance result says `passed=true`, records at least one executed test and has no critical
   failures;
5. only the exact approved, unexpired profile/schema/version can submit;
6. intake creates immutable source, receipt and evidence-version records; and
7. a separately authorised process must later evaluate the evidence. Intake always records
   `REVIEW_REQUIRED`.

AssurePool and AssureTransfer remain optional source adapters. The common-lender-registry template
implements the earlier decision that lenders may create and maintain a common registry they feed
into Rail. That registry is evidentiary: it is not the Rail database, participant admission authority,
legal ownership register or transaction decision-maker.

## 2. Provider profiles

Four v1 profiles are named:

| Profile | Meaning | Hard boundary |
|---|---|---|
| `assurerail.neutral-intake.v1` | Provider-neutral envelope without a source-specific adapter claim | Cannot carry a conflicting source profile |
| `assurepool.frozen-da-tape` | Frozen AssurePool DA tape | DA and `FROZEN_ASSET_TAPE` only; AssurePool does not own tokenisation or PTC |
| `common-lender-registry.v1` | Versioned lender-maintained common registry snapshot | Requires record count/digest and the exact registry source type |
| `assuretransfer.receivables-da` | AssureTransfer receivables facts/manifest | DA evidence only; does not become the Rail case authority |

A profile is part of connector certification, not an informal payload label. A source-specific
payload cannot enter under the generic or another source profile. Additional providers require an
additive profile and tests; no vendor is mandatory in the canonical contract.

## 3. Document handling

Raw document intake is a streamed `application/octet-stream` request with bounded metadata. The
service:

- writes to a private `0600` temporary file while enforcing a 25 MiB limit and calculating SHA-256;
- rejects traversal/control characters in names, executable magic, unapproved types and claimed
  type/magic mismatches;
- accepts PDF, text/CSV, PNG/JPEG and DOCX/XLSX containers; structured JSON uses the canonical JSON
  intake API rather than an ambiguously truncated document check;
- sends the complete file to ClamAV using its bounded `INSTREAM` protocol;
- treats an absent scanner, scanner failure or malware result as quarantine, never availability;
- uploads only a clean file to S3-compatible storage using an exact checksum, `private` object
  access and SSE-KMS; endpoint credentials are never embedded in storage references;
- stores immutable evidence and document versions and advances the object/family version with an
  optimistic compare-and-set; and
- removes a newly uploaded object if persistence fails or if the bytes duplicate an existing
  version, but never removes an object after the evidence database commit has succeeded.

`ARAIL_OBJECT_STORE_ALLOW_HTTP=true` exists only for isolated local development. Controlled
environments require HTTPS. Object-store access/secret keys must appear together; production secret
delivery remains an infrastructure responsibility, not a value stored in evidence records.

## 4. Access, retention and compatibility

Evidence reads require an active session institution plus `VIEW_EVIDENCE`. Owners see their own
objects. Another admitted institution sees an object only through an exact, active, unexpired grant
whose purpose and classification match the object. Listing and object lookup share this boundary;
unauthorised object lookup returns not found. View and download requests create digested access
receipts.

Legal hold is a platform-administered, step-up-bound operation with an append-only retention event.
Releasing a hold requires `SUPERADMIN`; a participant cannot erase or silently release a hold. No
purge path is introduced in PR-05.

Legacy inline `Document.data` becomes nullable and receives an optional neutral-version link.
Existing bytes are retained unchanged. Legacy `IngestedPool` receives an optional neutral-intake
link. PR-05 does not publish new neutral evidence into the broad legacy Note APIs because those APIs
still have the AR-C01 global-scope finding. Projection/caller cutover occurs only after the PR-06 case
ACL exists. This is deliberate compatibility without widening disclosure.

## 5. Deliberately rejected or deferred

- A participant-supplied `VERIFIED` result is rejected. Reception, syntactic validation, malware
  cleanliness and assurance verification are different states.
- A signature marked `PRESENT` is stored as `PRESENT_UNVERIFIED` until an approved verifier proves
  it. Provider capability or catalogue expectation is not achieved evidence.
- Connector registration does not equal certification, and certification grants neither admission,
  route entitlement nor transaction authority.
- Certification is limited to `REPLAY` and `SHADOW`; `CONTROLLED_LIVE` and `PRODUCTION` are rejected.
- API connector URLs use the existing HTTPS-only/internal-host/URL-credential/query/fragment
  rejection policy. Registration does not create egress; connect-time DNS pinning remains mandatory
  for a later connector caller.
- Files are not kept inline in Postgres, served from a public bucket, accepted on MIME declaration
  alone, or made available when malware scanning is unavailable.
- The Rail database is not made the legal source of ownership. `transactionCaseId` is carried as an
  opaque scope reference until PR-06 creates and validates the case relation.
- AssureLocker, AssurePlane, IDBI Trusteeship, AssurePool and AssureTransfer are not compulsory
  providers and receive no privileged evidence status.
- New neutral documents are not projected automatically into the globally readable legacy
  document list. That convenience would recreate the exact cross-institution exposure the programme
  is eliminating.

## 6. Known limitations passed forward

- Case existence/party/appointment ACL becomes enforceable in PR-06; PR-05 uses institution ownership
  and exact grants.
- JSON receipt, source-reference linking and evidence versioning are idempotent but span more than
  one database transaction. A later repair worker should complete partially linked receipts.
- DOCX/XLSX are checked as matching ZIP containers and malware-scanned; deeper package conformance is
  a connector-profile test responsibility before approval.
- ClamAV and object-store integration tests require controlled external fixtures. Absence is reported
  as unavailable/quarantined and is not counted as passed production evidence.
- Legacy compatibility links exist, but participant-facing projection waits for case-scoped adapters.

## 7. Feature and claim rule

The module mounts only when both `ARAIL_PARTICIPANT_ADMISSION_V1=shadow` and
`ARAIL_NEUTRAL_INGRESS_V1=shadow`. The web workspace consistently calls it immutable replay/shadow
intake. No public copy or product claim changes in PR-05.
