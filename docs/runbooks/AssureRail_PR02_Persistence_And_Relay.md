# AssureRail PR-02 persistence and relay operations

**Status:** implementation runbook; not a deployment approval or evidence that any DA/PTC route is
live. **Baseline:** PR-02 on `codex/assurerail-pr01-neutral-taxonomy`, 30 August 2026.

## What PR-02 changes

PR-02 adds the storage and delivery mechanics required by later institutional, intake, case and saga
work. It does not create an institution, admit a participant, open a transaction case, authorise a
route, cure the current external-action sequencing findings, or make a demo adapter live.

The additive models are:

- `ProviderReference` and `SourceReference` for stable provider/source identities and digests;
- `IntakeSubmission` and `IntakeReceipt` for immutable, versioned receipt evidence;
- `IdempotencyRecord` for request-digest-bound command replay;
- `InboxMessage` and `OutboxMessage` for durable, deduplicated integration work;
- `ExternalInstruction` and `ExternalAcknowledgement` for requested external effects and their
  authenticated results; and
- `MigrationReceipt` for counted, reviewed and digest-backed backfills.

Every neutral record is ready to carry `institutionId` and `transactionCaseId`. Those fields remain
nullable until PR-03 and PR-06 create their authoritative local records. No foreign key or query
crosses into an AssureLocker/AssureCLA database. Foreign keys within the Rail database protect the
provider/source/intake/outbox/instruction graph.

## Event and billing atomicity

The legacy Note repository now writes, in the same Postgres transaction as its domain change:

1. the existing `EventLog` row;
2. the existing `BillingEvent`, where billable; and
3. a canonical, SHA-256-bound `OutboxMessage` referencing that event.

If any one of those writes fails, the local domain transaction fails. The in-process event bus is
only a transitional wake-up/legacy-relay signal; it is not the event source of record. This does not
yet move external HTS/HCS/payment calls behind the database boundary. Findings `AR-C04`, `AR-C05` and
`AR-H10` remain open for the later saga/audit work.

## Relay modes and permitted use

| `ARAIL_DURABLE_RELAY_MODE` | Database behavior | Network behavior | Intended use |
|---|---|---|---|
| `legacy` | lifecycle outbox is committed | current in-process relay remains | rollback/observation only |
| `shadow` | outbox is claimed and delivery rows become `SHADOW_SUPPRESSED` | none | replay/shadow comparison |
| `durable` | outbox fanout plus claimed delivery jobs | verified HTTPS endpoints only | sandbox and later controlled/live operation |

`CONTROLLED_LIVE` and `PRODUCTION` startup require `durable`. `REPLAY` and `SHADOW` reject `durable`
to prevent a shadow run from notifying a real participant. A stable delivery ID is retained across
attempts and sent as `X-ARAIL-Delivery-Id`; receivers must deduplicate it. Network delivery is
at-least-once: a process can fail after the receiver accepted the request but before Rail records the
acknowledgement. No distributed system should claim exactly-once HTTP.

Claims use `FOR UPDATE SKIP LOCKED`. A job left `PROCESSING`/`IN_FLIGHT` for more than two minutes is
eligible for another worker to reclaim. Retriable timeout, `408`, `425`, `429` and `5xx` outcomes use
bounded exponential backoff. Unsafe egress and payload-digest drift become `BLOCKED`; exhausted or
non-retriable outcomes become `DEAD_LETTER`. Operator replay uses
`POST /venue/webhooks/deliveries/:id/replay` and preserves the delivery ID.

## Endpoint and secret ceremony

1. `POST /venue/webhooks` accepts an HTTPS endpoint and event list.
2. Rail rejects URL credentials/fragments, internal hostnames, loopback, RFC1918, link-local,
   metadata, CGNAT, reserved/test ranges, and any DNS name with even one blocked answer.
3. Rail first creates an inactive, operator-visible provisioning record, then generates 256-bit HMAC
   material, writes it to configured HashiCorp Vault KV-v2, stores only a
   `vault-kv-v2://...#hmacSecret` reference and shows the raw secret once. A split Vault/DB failure
   leaves the subscription disabled with an explicit repair reason at the same stable ID as the
   Vault path; it cannot become an invisible active endpoint.
4. The subscription remains inactive and `PENDING_VERIFICATION`.
5. `POST /venue/webhooks/:id/verify` sends a five-minute signed challenge. The endpoint must return
   JSON `{ "challenge": "<exact challenge>" }` and
   `X-ARAIL-Challenge-Signature: sha256=<HMAC(secret, challenge)>`, proving both endpoint control and
   possession of the provisioned secret.
6. Rail activates the endpoint only through a compare-and-set on the unexpired challenge hash.
7. Delete soft-revokes the subscription and retains its audit/attempt evidence.

The egress check runs both before the request and in the socket's actual DNS lookup; redirects are
refused. Response content is bounded and only a digest is retained for normal deliveries.

### Vault minimum configuration

```text
VAULT_ADDR=https://vault.internal.example
VAULT_APPROLE_ROLE_ID=<box secret>
VAULT_APPROLE_SECRET_ID=<box secret>
ARAIL_WEBHOOK_VAULT_MOUNT=secret
ARAIL_WEBHOOK_VAULT_PREFIX=assurerail/webhooks
```

Grant the Rail AppRole read/create/update only below the configured prefix. It should not list or
read other product paths. `VAULT_TOKEN` exists only as a development/legacy fallback.
`CONTROLLED_LIVE` and `PRODUCTION` require AppRole credentials and reject a static Vault token as the
sole authentication method. Production configuration rejects durable relay without Vault address
and authentication.

## Migration preflight and effect

Before deploying the migration:

- export the current subscription list, owners and event scopes without exporting signing secrets;
- notify owners that endpoints must be re-provisioned and re-verified;
- confirm Vault/AppRole policy and round-trip from the Rail subnet;
- take a database backup and record its restore test; and
- run the disposable rehearsal below with the exact commit intended for release.

The migration preserves legacy subscription/delivery rows for operator visibility, but deliberately
sets every legacy subscription inactive/`DISABLED`, records
`LEGACY_PLAINTEXT_SECRET_CLEARED_REPROVISION_AND_VERIFY`, and clears the plaintext `secret`. This is
not silently reversible: old HMAC material is intentionally not recoverable from Rail Postgres.

## Verification and performance rehearsal

Run from the repository root:

```bash
npm run db:rehearse:pr02 --workspace=@code/assurerail-api
```

The script ignores `DATABASE_URL`, creates a unique scratch directory and isolated local Postgres,
then proves:

- all migrations apply to an empty database;
- the old schema upgrades with Note/EventLog intact and legacy secrets disabled/cleared;
- unique constraints reject duplicate command, billing and external-instruction effects;
- a stale worker claim is reclaimable with the same durable row;
- the due-outbox query uses `OutboxMessage_state_nextAttemptAt_idx` at 50,000 rows; and
- a custom-format backup restores with all rows and an up-to-date Prisma migration ledger.

The script stops Postgres and deletes only its validated `assurerail-pr02.*` scratch directory.

## Observation, cutover and rollback

1. Deploy schema/code with relay `legacy`; verify new outbox rows reconcile one-for-one to new
   lifecycle `EventLog` rows.
2. Re-provision selected subscriptions into Vault and complete endpoint challenges.
3. Use `shadow` in a non-live environment; confirm fanout counts, event scopes and zero network calls.
4. Rehearse retry, ambiguous success, process kill, stale-claim recovery, dead letter and operator
   replay with a certified receiver.
5. Change to `durable` only under the normal feature/config change authority.

To roll back application behavior, set the mode to `legacy` and restart through the controlled
release process. Do not delete additive records or try to restore cleared plaintext secrets. If the
durable worker has already sent an event, application rollback cannot unsend it; reconcile using the
stable delivery ID. Keep PR-02 tables and migration applied so older lifecycle reads/writes remain
intact.
