# AssureRail governed buyer SFTP export foundation

**Status:** implemented as a sandbox-only domain foundation; no production buyer connection is activated  
**Date:** 17 September 2026

## Purpose and boundary

This component prepares buyer-specific outbound SFTP delivery without making a generic file transfer
an authority for a loan transfer, buyer acceptance or settlement. It sits behind AssureRail's
engagement and buyer-onboarding controls. The transport boundary is provider-neutral, so a future
OpenSSH, managed SFTP or bank adapter can implement the same contract.

Only SFTP over SSH v2 is in scope. Each buyer has a versioned profile with a pinned host-key
fingerprint, dedicated key reference, buyer-approved outbound and acknowledgement folders, schema,
document-family allow-list, per-file and aggregate batch limits, retention and retry policy. Profiles contain opaque
`vault://`, `kms://` or `secret://` references. They never contain a private key, passphrase or
password. Password and keyboard-interactive fallback are outside the contract.

The implementation is deliberately fail-closed:

- only `SANDBOX` profiles validate;
- production dispatch is disabled;
- buyer acceptance evidence and an independent profile checker are required;
- every batch needs a seller maker and a different AssureRail checker;
- an integration operator can dispatch only the exact approved bytes;
- profile suspension or pending host-key rotation safe-pauses approved but undispatched batches;
- an upload awaits a buyer acknowledgement and never implies settlement; and
- an ambiguous result cannot be retried until inspection proves that the final manifest is absent.

## Folder and publication contract

For a profile rooted at `/assurerail/outbound`, AssureRail derives the complete batch folder:

```text
/assurerail/outbound/<sellerInstitutionId>/<engagementId>/<batchRef>/
```

That folder contains allow-listed payload files and `<batchRef>.manifest.json`. A production adapter
must upload payloads under temporary names and publish the manifest last, using the buyer-agreed
rename/visibility semantics. The buyer must ignore temporary files and any payload without its final
manifest. Folder names and filenames accept bounded identifiers only; traversal, absolute payload
names and duplicate filenames are rejected.

The canonical manifest binds:

- buyer, seller, engagement and optional case;
- profile identity, version, configuration digest and schema version;
- idempotency key, creation time and retention deadline; and
- every filename, document family, media type, byte length and SHA-256 content digest.

The approved manifest digest and the bytes are checked again immediately before transport. A reused
idempotency key returns the existing batch only when its request digest is identical. Reuse with
different content fails.

## State and reconciliation

```text
PROPOSED -> APPROVED -> DISPATCHING
                          |-> AWAITING_ACKNOWLEDGEMENT -> BUYER_ACCEPTED
                          |                             -> BUYER_REJECTED
                          |                             -> PARTIAL_REQUIRES_RECONCILIATION
                          |-> RETRYABLE -> DISPATCHING
                          |-> AMBIGUOUS_REQUIRES_RECONCILIATION
                          |       |-> AWAITING_ACKNOWLEDGEMENT (matching manifest is present)
                          |       |-> RETRYABLE (manifest is proven absent)
                          |-> FAILED_FINAL
```

Automatic retry is limited to explicit pre-acceptance/retriable failures and uses capped exponential
backoff. Network timeout, connection loss after send, process interruption and indeterminate provider
responses are ambiguous. Operations must inspect the buyer folder using the same pinned profile. An
unknown or conflicting inspection remains open for human reconciliation.

The buyer acknowledgement binds the buyer, batch and manifest digest and accounts for every file by
its digest. A partial acknowledgement carries structured rejection reasons and remains open. The
acknowledgement is evidence of buyer receipt/validation only.

## Access, audit and retention

The domain checks both role and buyer/seller scope:

| Role | Permitted operation |
|---|---|
| `SELLER_EXPORT_MAKER` | Propose a batch for its own seller institution |
| `ASSURERAIL_EXPORT_CHECKER` | Independently approve an unchanged profile or manifest |
| `ASSURERAIL_INTEGRATION_OPERATOR` | Propose profiles, dispatch approved batches and reconcile transport outcomes |
| `BUYER_ACKNOWLEDGER` | Record acknowledgements only for its own buyer institution |

Every state-changing operation appends an event with actor, tenant scopes, profile/batch references
and a digest of bounded detail. Audit events do not contain payloads, credential references or
credentials. Production persistence must append these events transactionally with each state change.

The profile's retention deadline is carried in the manifest. A production adapter and object-store
worker must delete staged payload bytes after acknowledged completion or expiry under the agreed
record-retention schedule. Batch metadata, manifest digests, acknowledgement evidence and audit
records follow AssureRail's legal/audit retention schedule and must not be silently erased with the
transport copy.

## Delivered software evidence

The implementation lives in `apps/assurerail-api/src/buyer-sftp/`:

- `buyer-sftp.policy.ts`: profile validation, host pinning, scopes, allow-list and folder rules;
- `buyer-sftp.adapter.ts`: provider-neutral transport contract and a no-network fake sandbox;
- `buyer-sftp.domain.ts`: manifest, idempotency, maker-checker, state machine, retries,
  reconciliation, acknowledgements and audit events; and
- `buyer-sftp.test.ts`: sandbox tests for secrets, tenant isolation, byte binding, idempotency,
  acknowledgement completeness, backoff and ambiguous-success recovery.

The fake adapter proves domain behaviour only. It does not establish buyer connectivity, SSH
interoperability, cryptographic key custody, network controls, malware safety, production
persistence, operational acceptance or bank acceptance.

## Remaining activation gates

Before any production connection, AssureRail needs the named buyer's approved schema and folder
contract, endpoint and host key obtained through an independently authenticated channel, dedicated
key generation/custody/rotation, IP/network policy, durable transactional repository/outbox,
temporary-file publication behaviour, signed acknowledgement format/channel, malware and DLP
controls, retention/deletion job, monitoring, customer and buyer UAT, failure/rotation/exit rehearsal,
security approval and written operating acceptance. A separate production-capable adapter must keep
strict host-key checking and password fallback disabled.
