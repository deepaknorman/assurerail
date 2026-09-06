# AssureRail room cutover and AssurePool source-completion contract v1

**Status:** historical PR-08 design; its online legacy-room proxy was retired by SEP-01 on 7
September 2026. Sealed offline import and provider-neutral source completion remain. This document
is not a live-route approval; any proxy-enable instruction below is superseded and must not be used.
**Implementation tranche:** PR-08
**Date:** 31 August 2026
**Depends on:** PR-01 neutral contracts, PR-02 durable persistence, PR-03 authority, PR-05 evidence, PR-06 cases and PR-07 shadow room migration

## 1. Outcome

PR-08 makes AssureRail the available write authority for an explicitly approved cohort of new DA
diligence rooms while preserving the existing AssurePool/AssureTransfer URLs as compatibility
adapters. It also adds a provider-neutral, idempotent completion acknowledgement through which Rail
can ask a source system to make the exact frozen source reservation permanent and then independently
reconcile the signed result.

Neither capability is active merely because this code exists. The default remains legacy room
writes and no source-completion dispatch. There has been no deployment. A case reaches Rail write
authority only after a step-up-protected maker-checker allocation. Completion remains non-mutating in
`shadow`; the `on` path additionally requires a future live-certified connector and a controlled-live
runtime. The current AssurePool live on-book adapter deliberately throws because its production CBS
implementation has not been certified.

## 2. Decisions selected

1. **Exactly one room write authority per transaction case.** Runtime capability and case allocation
   are separate gates. `ARAIL_ROOM_WRITE_SOURCE=rail` permits the capability; a versioned
   `RoomAuthorityAssignment` determines whether one case is actually allocated to Rail.
2. **Allocation is governed.** `ALLOCATE_RAIL`, `PAUSE_RAIL`, `RESUME_RAIL` and the narrowly allowed
   `RETURN_LEGACY` use a proposal, a different reviewer, separate one-use step-up evidence, exact
   expected version, retained reason/evidence reference and atomic audit evidence.
3. **A Rail-native room is not squeezed back into the legacy schema.** Once a case has a Rail-native
   room, return to legacy is rejected because fields and history could be lost. Safe rollback is to
   pause the case, retain/export its evidence, fix the issue, and resume or exit explicitly.
4. **Old callers migrate without receiving Rail signing secrets.** The existing AssureLocker API
   signs a narrow server-to-server compatibility request. Rail maps the authenticated external
   subject to exactly one admitted Rail institution through a governed connector mapping. A client
   body DID is never accepted as authority on its own.
5. **Fallback is authority-directed, not availability-directed.** New-room creation uses legacy only
   when Rail positively returns `writeSource: LEGACY`. Timeout, signature failure, ambiguity, provider
   outage or an unexpected Rail error does not silently create a second room in the old store.
6. **Legacy identifiers remain recognisable during compatibility.** Existing legacy room IDs and
   invitation tokens stay on the legacy path. Rail-native room IDs use the `room_` prefix and Rail
   invitation tokens are 32 random bytes encoded as 43 base64url characters.
7. **Classification is supplied by the transferee.** The inviter creates a named grant in
   `PENDING_DECLARATION`; the transferee attests its own classification and the exact external
   declaration text during acceptance. The inviter cannot pre-assert the transferee's regulated
   category.
8. **Passive diligence stays passive.** PR-08 keeps commercial-field redaction and does not add
   pricing, bids, matching, solicitation, settlement or PTC capability. The old `PTC_DATA_ROOM`
   label is not accepted as evidence that a PTC route exists.
9. **Completion acknowledgement is provider-neutral.** Canonical Rail persistence and messages name
   a provider, source object, source version, manifest digest, route-specific lock reference and evidence
   digest. AssurePool is one adapter; its product fields do not enter the neutral kernel.
10. **Source permanence is not legal DA completion.** The AssurePool receipt proves that the exact
    source reservation reached `PERMANENT`; PR-09 remains responsible for the transaction saga,
    consideration, legal/source acknowledgements and case completion decision.
11. **The final observation is signed and exact.** Rail compares object ID, source version, manifest,
    source state and lock reference. Any divergence opens a specifically coded break. An exact final
    acknowledgement still requires reconciliation by a different authorised human.
12. **Ambiguous external results are retried, never invented.** The worker retains one instruction,
    uses bounded exponential backoff, reclaims stale leases, caps attempts and records the final
    acknowledgement/inbox/audit trail atomically.

## 3. Approaches rejected

- dual-writing a room to legacy and Rail;
- using an HTTP failure as permission to fall back to legacy;
- treating a connector's external DID string as a Rail mandate;
- sharing database tables, foreign keys or production credentials between AssureLocker and Rail;
- exposing the internal compatibility endpoint without request signing, timestamp and replay checks;
- returning an invitation token after its original creation replay;
- changing imported access hashes or presenting imported history as Rail-native;
- letting the inviter choose the transferee's classification;
- enabling PTC because a legacy room purpose enum contains `PTC_DATA_ROOM`;
- calling `markPoolLockPermanent` before exact version, manifest and lock checks;
- treating a `false`, empty or TODO on-book response as a successful live completion;
- declaring the case completed when only the AssurePool source lock is permanent; and
- switching `ARAIL_COMPLETION_ACK_V1=on` in replay/shadow or with a shadow-certified connector.

## 4. Room authority and active room model

`RoomAuthorityAssignment` is the current case-level write pointer. `RoomAuthorityChange` preserves
every proposal and decision. There is no global database switch that silently reallocates existing
cases. The assignment is valid only while it says `RAIL/ACTIVE`; `RAIL/PAUSED` blocks new Rail room
writes without altering history.

Active Rail rooms add immutable command identity to `CaseRoom`, `RoomGrant` and `RoomMessage`.
Create, invite, accept, message and close operations compare the idempotency key and canonical
request digest. Reusing a key with different content or scope fails. Room access is limited to the
case owner or an active named grantee and produces a chained `RoomAccessEvent`. Export writes the
final dossier digest to the access/audit evidence before the bytes are returned through the old API.

The human API is under `/v1/rail/cases/:caseId/rooms`. Separate surfaces govern write authority and
one-time invitation acceptance. The old `/v1/transfer-rooms` and pool room creation URLs remain
unchanged for current web clients; their server routes distinguish Rail and legacy identifiers.

## 5. Connector identity boundary

The compatibility connector must be registered against the institution that owns the external
caller, use schema profile `assurerail.legacy-room-proxy.v1`, be `CERTIFIED_SHADOW`, and reference a
Vault secret. A maker proposes the external-subject mapping and a different checker approves it.
The mapping contains bounded actions and may be institution-wide or restricted to one case.

Every internal request is HMAC-SHA256 signed over:

```text
HTTP method
request path
millisecond timestamp
request ID
sha256(canonical request body)
```

Rail rejects stale timestamps, reused external message IDs with a different digest, an inactive
connector, absent Vault material, an absent/expired/ambiguous mapping, a disallowed action or a
case-scope mismatch. The inbox retains the external request ID, digest, verified signature status,
connector/provider and resulting processing state.

Operational emergency disablement is by connector suspension/revocation; mapping expiry supplies a
bounded planned end. A future mapping replacement/revocation workflow must not be inferred from the
currently reserved status fields.

## 6. Source-completion lifecycle

The Rail command is available only for a domestic conventional DA case in `COMPLETION_PENDING`, an
exact retained AssurePool tape source with a `CONFIRMED` lock and exact lock reference, an approved connector profile
`assurepool.completion-ack.v1`, and an authorised case operator with one-use step-up evidence.

In `shadow`, Rail writes a `SourceCompletion`, a cancelled external instruction carrying
`SHADOW_MODE_NO_EXTERNAL_MUTATION`, an outbox event and governed audit evidence. It makes no HTTP
request and changes no AssurePool lock.

In a future approved `on` cohort, a durable worker claims the instruction, signs the exact request
using Vault material and uses the egress guard. AssurePool authenticates the request, records an
`AssurePoolCompletionReceipt`, and atomically claims `CONFIRMED -> COMPLETION_PENDING` before calling
the on-book adapter. It verifies the frozen pool/source version, manifest and optional lock reference.
Only an exact successful adapter result changes the lock to `PERMANENT`. The same instruction returns
the same stored final acknowledgement; changed content under the same identity conflicts.

AssurePool signs the final observation over its canonical digest. Rail validates the signature,
builds a neutral acknowledgement envelope and stores the acknowledgement, inbox record, instruction
terminal state, observed values and audit evidence. A mismatch enters `BREAK_OPEN`; an exact result
enters `ACKNOWLEDGED/PENDING` until a different human independently reconciles it to
`RECONCILED/MATCHED`.

## 7. Runtime controls

| Control | Default | Meaning |
|---|---:|---|
| `ARAIL_ROOM_READ_SOURCE` | `legacy` | `compare` retains shadow comparison; `rail` permits active Rail reads only with the full neutral foundation |
| `ARAIL_ROOM_WRITE_SOURCE` | `legacy` | `rail` exposes write capability but does not allocate a case |
| `ARAIL_LEGACY_ROOM_PROXY_V1` | `off` | Off-only SEP-01 tombstone; the signed compatibility endpoint is retired |
| `ARAIL_COMPLETION_ACK_V1` | `off` | `shadow` records intent only; `on` is external mutation and is prohibited in replay/shadow |
| `ASSURERAIL_LEGACY_ROOM_PROXY_ENABLED` | false/unset | Enables the AssureLocker server compatibility client |
| `ASSUREPOOL_RAIL_COMPLETION_ENABLED` | false/unset | Enables the signed AssurePool provider endpoint; it does not make the live adapter available |

The AssureLocker caller also requires the Rail origin, connector ID and an injected connector
secret. The AssurePool provider requires a separately injected completion secret. Production
credentials must be supplied by the approved secret system; they are not committed configuration.

## 8. Telemetry and retirement evidence

The central API exports
`code_api_assurerail_room_compatibility_routes_total{source,action}`. Labels are deliberately bounded:
`source` is `legacy|rail`, and `action` is one of the compatibility operations. Rail also retains
every signed proxy request in its inbox and every case allocation/change in its authority tables.

Legacy retirement is allowed only after the agreed observation window shows no required legacy
consumer, all allocated cohorts have zero unresolved parity/access/reconciliation breaks, old-client
contract tests pass through the proxy, evidence export is rehearsed and an accountable operator has
approved the retirement receipt. The date alone is not a gate.

## 9. Explicit non-capabilities after PR-08

- No customer or case has been allocated or migrated by this commit.
- No production or box configuration has been changed.
- No money, legal ownership or source lock is changed in shadow.
- No certified live AssurePool on-book adapter exists in this tranche.
- No conventional DA completion saga exists until PR-09.
- No PTC route, issuance, register or trustee workflow exists until PR-10.
- No matching, pricing, primary placement or secondary market function is exposed.
