# AssureRail PR-05 evidence/intake operating runbook

**Mode:** replay/shadow only

**Owners:** participant integration operator, platform connector reviewer, evidence operations,
security operations and database/platform operations

## Enablement prerequisites

1. Deploy all Rail migrations through `20260830220000_assurerail_pr05_evidence_intake` and retain the
   migration/restore evidence.
2. Set `ARAIL_PARTICIPANT_ADMISSION_V1=shadow` and `ARAIL_NEUTRAL_INGRESS_V1=shadow`. Do not enable
   neutral ingress without participant admission.
3. Configure a private S3-compatible bucket, HTTPS endpoint, region, KMS key and workload
   credentials. Permit HTTP only in an isolated developer environment.
4. Configure and health-check ClamAV. If it is absent or unreachable, document intake will quarantine
   and must not be represented as available.
5. Issue only the exact institution mandates required: `OPERATE_CONNECTORS`, `MANAGE_EVIDENCE` and/or
   `VIEW_EVIDENCE`. Do not substitute platform admin or legacy global roles.

## Connector ceremony

1. Participant registers an opaque provider key, display/type, `FILE` or HTTPS `API` transport, and
   bounded schema/profile declarations. Store only a `vault://` credential reference.
2. For an API endpoint, separately verify endpoint ownership and run connect-time public-DNS/SSRF
   controls before any future egress. PR-05 registration itself does not call it.
3. Run the profile conformance corpus. Retain executed/failed/skipped counts and its SHA-256 digest.
4. Participant operator obtains purpose-bound step-up evidence and proposes replay/shadow
   certification.
5. A different platform administrator reviews. Approval requires a passed result, at least one
   executed test and zero critical failures. Qualifications and expiry remain visible.
6. Suspension/revocation or expiry stops new intake. It does not delete historical evidence.

## JSON intake

1. Use the PR-01 canonical envelope and the exact certified source profile.
2. Confirm idempotency key, provider/source object/version, source digest, as-of/expiry,
   qualifications and signature state are explicit.
3. Do not submit an assurance result other than `REVIEW_REQUIRED`; the service rejects it.
4. On a conflict for the same provider source version with different content, stop and investigate.
   Do not overwrite, renumber or relabel the original receipt.
5. If a receipt exists without a completed evidence/source link, place it in the repair queue; do not
   resubmit under a fabricated new source version.

## Document intake and quarantine

1. Use the participant evidence workspace or the raw endpoint with bounded base64url JSON metadata.
2. Confirm file size, declared type, retention, purpose, classification and source-as-of date.
3. A clean scan plus successful KMS-encrypted upload and database commit produces `AVAILABLE`.
4. `INFECTED`, `NOT_SCANNED` or `SCAN_FAILED` produces `QUARANTINED`; no object is uploaded for
   participant download. Escalate scanner health separately from the content investigation.
5. A repeated idempotency key with identical content returns the retained response. A changed request
   conflicts. A new idempotency key with duplicate bytes does not create a second version and the
   redundant object is removed.
6. If storage succeeded but persistence did not, verify cleanup. If persistence succeeded but command
   completion failed, retain the object and repair the command record—never delete referenced bytes.

## Access, grants and legal hold

1. Grant only to an active admitted institution and copy the evidence object's exact purpose and
   classification. Use the shortest practical expiry.
2. Review access receipts for views/download requests. A receipt proves the request was authorised
   and recorded; it does not prove what a downstream user later did with the exported file.
3. Set legal hold through an administrator step-up ceremony with a specific reason. Release requires
   a superadministrator, a new step-up and a new append-only event.
4. There is no PR-05 deletion/purge operation. Retention expiry or released hold is not permission to
   delete until a later approved retention job and SOP exist.

## Incident and safe stop

- Disable `ARAIL_NEUTRAL_INGRESS_V1` to stop new neutral connector/intake routes. Retained evidence
  remains readable under its existing ACL.
- Suspend the connector for a provider-specific incident; suspend the institution/mandate for an
  authority incident.
- On suspected object disclosure, revoke grants, preserve legal hold/access receipts, rotate storage
  credentials, inspect bucket/audit logs and follow the security incident runbook.
- On digest or immutable-version conflict, stop the affected connector cohort. Do not repair by
  overwriting history.
- Rollback is feature disablement plus safe repair. It is never a destructive schema or object-store
  rollback.
