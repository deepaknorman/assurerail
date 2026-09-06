# AssureRail PR-08 room cutover and source-completion runbook

**Scope:** pre-deployment rehearsal and future allow-listed shadow operation
**Not authority:** this runbook does not approve controlled-live use, a customer cohort, legal
completion, a connector or a production credential.

> **SEP-01 retirement notice (7 September 2026):** the online legacy-room proxy, its subject-mapping
> API and its connector profile have been removed. Do not execute proxy registration, enablement or
> old-caller cutover steps in this historical runbook. Use Rail-native rooms or deterministic sealed
> offline import. The source-completion portions remain applicable only behind their own gates.

## 1. Preconditions

Do not enable any PR-08 flag until all of the following are evidenced:

- the PR-01 through PR-07 migrations are applied and migration/restore receipts are retained;
- the Rail runtime is explicitly `REPLAY` or `SHADOW`, uses its durable database and authenticated
  sessions, and demo endpoints/adapters are disabled;
- the institution, admission, member, mandate, route entitlement, transaction case and retained
  frozen AssurePool source version are exact and active;
- the compatibility connector is shadow-certified for
  `assurerail.legacy-room-proxy.v1`, has a Vault reference and has passed request-signing tests;
- each external subject has exactly one approved, unexpired mapping for the required action/scope;
- PR-07 legacy-chain/parity checks have no unresolved break for any migrated room in the cohort;
- maker, checker, operations owner, security owner and rollback decision owner are named; and
- no uncommitted workspace configuration is treated as deployment evidence.

## 2. Recommended shadow sequence

1. Apply and verify both additive migrations. Run `npm run db:rehearse:pr08` in the Rail API and
   central API workspaces against disposable databases. Retain output and database backup/restore
   evidence.
2. Keep `ARAIL_ROOM_WRITE_SOURCE=legacy`, `ARAIL_ROOM_READ_SOURCE=compare`,
   `ARAIL_LEGACY_ROOM_PROXY_V1=off` and `ARAIL_COMPLETION_ACK_V1=off` for the first post-migration
   observation.
3. Register/certify the compatibility connector and provision its secret in Vault. Configure the
   central API with the matching connector ID and injected secret, but leave its client disabled.
4. Propose and independently approve the smallest possible external-subject/action/case mapping.
   Test stale time, changed replay, missing action, wrong institution and ambiguous mapping refusal.
5. Set Rail room write capability to `rail`, Rail read source to `rail`, and proxy mode to `shadow`.
   This still allocates no case.
6. Enable the central compatibility client. Confirm existing legacy rooms remain legacy and that a
   non-allocated new case receives Rail's explicit `writeSource: LEGACY` before legacy creation.
7. Propose `ALLOCATE_RAIL` for one test case. A different authorised person reviews it with fresh
   step-up evidence. Confirm the assignment is `RAIL/ACTIVE` and versioned.
8. Create one new room through the old URL. Verify one Rail row only, no legacy room row, one inbox
   request, one governed audit chain and `source=rail` telemetry.
9. Exercise invite, declaration, summary, tape, findings, Q&A, dossier and close. Test wrong subject,
   expired token, changed idempotency payload, other-tenant object ID and revoked connector.
10. Leave `ARAIL_COMPLETION_ACK_V1=shadow`. Initiate a source completion for an eligible case and
    verify the external instruction is cancelled with `SHADOW_MODE_NO_EXTERNAL_MUTATION`, the source
    lock is unchanged and the audit/outbox/completion records agree.

## 3. Daily checks during an approved cohort

- exactly one `RoomAuthorityAssignment` per allocated case and no unexplained version change;
- no case in `RAIL/PAUSED` receiving a write;
- no duplicate room, grant, message or completion for one idempotency identity;
- proxy inbox failures, replay conflicts and subject-mapping denials reviewed by the named owner;
- legacy/Rail compatibility counters by action compared with the cohort register;
- room access-chain continuity and dossier digest receipts verified;
- connector status, certificate/profile, secret availability and mapping expiry monitored;
- completion instructions grouped by pending, dispatching, ambiguous, failed, acknowledged, break
  open and reconciled; and
- all reconciliation breaks have owner, SLA and retained repair evidence.

## 4. Safe pause and rollback

For a Rail-native case, do not write a second legacy room. Propose and approve `PAUSE_RAIL`, block
new room mutations, retain the Rail evidence, export it for the participants and repair/resume under
the same case. `RETURN_LEGACY` is accepted only from `RAIL/PAUSED` when the case has no Rail-native
room history.

For a systemic compatibility problem, disable the central client and Rail proxy flag after pausing
allocated cases. Existing legacy IDs continue in the legacy store. Never interpret a proxy timeout
as authority for fallback.

For source completion, set the Rail flag to `off` to stop new commands and worker claims. Do not
delete a pending/ambiguous instruction. Determine from the provider using the stable instruction ID
whether an external change occurred, capture the signed observation, reconcile or open a break, and
only then retry or repair. A confirmed external `PERMANENT` state is not rolled back by database
restoration.

## 5. Incident rules

- **Signature/replay failure:** reject, retain the inbox failure, rotate/investigate the connector
  credential, and do not bypass through a human-supplied DID.
- **Ambiguous subject mapping:** suspend the connector or expire the mapping; never choose the first
  result.
- **Duplicate legacy and Rail room:** block both for mutation, preserve both histories, determine the
  approved authority at creation time, and close/repair through an evidenced operator decision.
- **Access-chain failure:** close access, preserve raw rows, compare to the last accepted chain tail,
  and do not recompute hashes to hide the difference.
- **AssurePool instruction timeout:** query by the same instruction ID; do not issue a new identity.
- **Source mismatch:** keep the completion `BREAK_OPEN`, block dependent case completion, assign an
  owner/SLA and retain the exact expected/observed values.
- **Database restore:** reconcile restored instruction/acknowledgement state with the source before
  any worker resumes.

## 6. Controlled-live prohibition

The current tranche must not be switched to source-completion `on`: the AssurePool live on-book
adapter is intentionally unavailable and Rail does not issue `CERTIFIED_LIVE` connectors. A later
approval requires connector conformance, real key custody, network and provider finality tests,
fault injection, restore/reconciliation rehearsal, an approved DA route pack and signed operating
acceptance. PR-09 replay remains non-mutating.
