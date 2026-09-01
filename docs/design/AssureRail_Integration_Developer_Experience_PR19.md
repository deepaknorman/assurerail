# AssureRail integration and developer experience — PR-19

**Status:** implemented under EX-27 for review; not deployed or activated  
**Boundary:** institution-scoped replay/shadow integration tooling

## Outcome

PR-19 adds an institution-owned developer boundary rather than extending the platform-admin
webhook surface. It provides:

- a versioned contract catalogue for neutral intake, acknowledgements and events;
- explicit authentication, idempotency and event-envelope conventions;
- synthetic sandbox fixtures conspicuously marked `sandboxNonEvidence`;
- institution-owned shadow client registrations with allow-listed actions;
- append-only credential versions containing only opaque Vault references and SHA-256
  fingerprints;
- connector-scoped software-conformance runs;
- institution-scoped webhook registration, challenge/verification, delivery health and terminal
  replay;
- a customer developer-centre UI; and
- a digest-bound integration exit package whose secret material and Vault references are excluded.

`ARAIL_DEVELOPER_PORTAL_V1=shadow` is valid only in `REPLAY` or `SHADOW`, with participant
admission, neutral ingress and durable relay all in shadow. It does not add a live capability ID.

## Authority and isolation

Every route requires the path institution to equal the active session institution. The backing
service separately checks an action-specific mandate: view, connector operation, developer
integration management, delivery-health view or integration export. Registration, credential
rotation, conformance execution, webhook registration/verification/replay and exit export consume
purpose-specific single-use step-up evidence.

Webhook list, delivery and replay paths resolve institution ownership before returning or changing
a record. Existing global platform-admin routes remain separate support surfaces. API-client
records are `SHADOW_ONLY`; they are not accepted as live service credentials by this work.

## Conformance semantics

The server publishes five exact fixtures covering idempotent replay, conflicting idempotency,
unknown taxonomy, stale evidence and duplicate events. A run is:

- `PASSED_SOFTWARE` only when every exact fixture has one expected result and a valid response
  digest;
- `FAILED_SOFTWARE` for an explicit wrong or extra result; or
- `REVIEW_REQUIRED` for missing/ambiguous observations.

Even `PASSED_SOFTWARE` is not connector certification, transaction evidence, legal evidence,
trustee acceptance, authoritative-record confirmation or an activation gate decision.

## Credential and exit rules

Raw API credentials never enter Postgres or an exit response. Rotation advances an optimistic
version, supersedes the prior version and retains its immutable fingerprint/timing history. The
caller must provision the new secret in the approved Vault namespace and submit only its opaque
reference and fingerprint.

Exit output contains integration metadata, conformance history and a bounded delivery window. It
retains a manifest digest and record counts. Transaction/evidence/document exports remain owned by
their existing case/evidence processes; PR-19 does not silently combine them.

## Rejected shortcuts

- treating sandbox success as external certification;
- returning raw secrets or Vault references in list/exit responses;
- global webhook reads from a participant route;
- arbitrary client actions or unversioned contracts;
- replaying a non-terminal delivery;
- permitting a client registration to authenticate live traffic; or
- enabling this module in controlled-live/production.

