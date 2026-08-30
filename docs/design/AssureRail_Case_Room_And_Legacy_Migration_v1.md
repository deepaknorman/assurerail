# AssureRail case room and legacy migration v1

**Status:** PR-07 implemented behind replay/shadow compare gates, 31 August 2026

**Depends on:** PR-01 contracts, PR-02 persistence, PR-03 participant authority, PR-05 evidence
intake and PR-06 transaction cases

**Not a claim of:** room cutover, new Rail invitation/write authority, commercial negotiation,
matching, PTC capability, live transfer, production readiness or retirement of the legacy room

## 1. Selected boundary

Rail now owns an additive, provider-neutral case-room model and can retain a dark, versioned copy of
an existing transfer room for migration comparison. PR-07 deliberately does not switch a caller,
participant read or write. `ARAIL_ROOM_WRITE_SOURCE` accepts only `legacy`; the module mounts only
when the runtime is REPLAY/SHADOW, the PR-03/05/06 foundations are in shadow and
`ARAIL_ROOM_READ_SOURCE=compare`.

Every old purpose—`DA`, `RECEIVABLES_DA` and `PTC_DATA_ROOM`—maps to
`PASSIVE_DILIGENCE`. This preserves invitation/declaration/evidence semantics without converting an
enum label into route capability. In particular, an imported `PTC_DATA_ROOM` is historical passive
diligence evidence, not a conventional PTC venue or PTC route pack. `COMMERCIAL_NEGOTIATION` is a
known future purpose but fails closed until the separately governed PR-13 series.

The room is a child of `TransactionCase`, not a pool or CLA. Legacy pool/CLA IDs are retained only
as migration provenance. AssurePool remains a DA tape-preparation source and AssureTransfer remains
a parallel product.

## 2. Records and responsibilities

| Record | Selected responsibility | Explicit exclusion |
|---|---|---|
| `CaseRoom` | Case-owned purpose, policy, source/manifest binding, dark/block state and legacy provenance | It is not legal completion, route permission or source-system ownership |
| `RoomGrant` | Explicit institution mapping, passive purpose, classification, declaration/reliance and legacy status | Imported rows stay `MIGRATED_DARK`; legacy `ACTIVE` is evidence only and grants no PR-07 participant read |
| `RoomAccessEvent` | Exact imported sequence/hash/actor/object/time plus separate chain origin and committed legacy room ID | It does not rewrite a legacy hash under a Rail ID |
| `RoomMessage` | Immutable attributable Q&A body/digest/order and legacy message ID | It is not a term, bid, quote or negotiation record |
| `LegacyRoomImport` | One immutable, sealed export snapshot and migration version/high-water/count/digest evidence | It does not overwrite an earlier snapshot |
| `RoomParityRun` | Fresh source-versus-Rail comparison result and observed digest | `MATCHED` does not switch authority |
| `RoomParityBreak` | Blocking mismatch, severity, owner and independent evidence-backed closure | Closure alone does not prove a clean latest parity run |
| `MigrationReceipt` | Batch/source/target counts and digests, operator, case/institution and verified completion receipt | It is not an external legal-authority acknowledgement |

All relations use restrictive deletion. Access sequence is PostgreSQL `BIGINT` and is returned as a
decimal string so a JavaScript response cannot lose precision.

## 3. Deterministic export and exact chain preservation

`assurecla.transfer-room-export.v1` contains:

- source system/version/high-water mark;
- the exact room identity, manifest binding, transferor DID, purpose/status and text versions;
- invitations without invitation tokens;
- access rows with decimal sequence, original room ID, actor/action/object/time, previous hash and
  entry hash;
- attributable messages in deterministic order; and
- manifest plus optional tape/findings/dossier digests.

The source builder sorts invites by ID, messages by time/ID and access rows by exact numeric
sequence, then emits one canonical digest. Import revalidates the digest and every chain entry using
the legacy rule: genesis `GENESIS`, then SHA-256 over the legacy canonical
`{prevHash,payload}`. A token present in an invite is rejected rather than silently retained.
Cross-room child rows, duplicate child identities/transferees, non-positive/duplicate/backward
sequence, a broken link/hash, manifest disagreement or an active invite without
declaration/reliance evidence fail before a database write.

The original access rows are stored with `chainOrigin=LEGACY` and `hashRoomReference` equal to the
exact room ID committed by the old chain. If that ID is free, Rail also preserves it as `CaseRoom.id`.
If it collides, Rail uses a new room ID but never recomputes the imported hash. Future Rail-native
events can use a separate origin and committed room reference; imported evidence remains sealed.

## 4. Versioned refresh while legacy remains authoritative

An open legacy room can gain access events/messages and invitations can advance. Therefore imports
are versioned, not one-shot. An identical source-system/room/export digest is an idempotent replay.
A new digest creates the next `importVersion` and a separate migration receipt only when:

- immutable room/pool/CLA/manifest/transferor/purpose/text-version/creation fields are identical;
- room status moves only forward and a terminal status remains terminal;
- the complete old access and message rows remain an exact prefix;
- no prior invite disappears or changes identity; pre-activation re-invitation attribution may
  advance exactly as the legacy implementation permits, but attribution is frozen after activation;
- invitation state moves only `INVITED -> ACTIVE/REVOKED` or `ACTIVE -> REVOKED`; and
- recorded declaration/reliance evidence is never rewritten.

Only new access/messages are inserted; dark grants are refreshed from the new sealed version. A
caller-supplied migration batch may contain multiple rooms: Rail retains that root batch on each
import and derives a unique per-room/version receipt identity, avoiding a false uniqueness conflict.
Each DID must map one-to-one to the same active case-party institution in every import. Changed
mappings, source reference, case owner or case identity conflict. Database uniqueness protects concurrent
snapshot/version and row imports; an identical race returns the retained snapshot.

## 5. No access gain through migration

PR-07 reads are owner-operated migration reads only. A caller needs authenticated session and
institution context, case ownership, active admission/membership, and exact `VIEW_CASE_ROOM` or
`REVIEW_ROOM_MIGRATION` authority. Platform employment, DigiKYC, a global role, an evidence grant,
a proposed case party or a legacy DID does not qualify.

Every transferor and invited transferee DID needs an explicit one-to-one mapping. The transferor
must map to the case owner; each transferee must map to an active case party; refreshes cannot change
that mapping. Historical `ACTIVE` is retained only in `legacyStatus`; the Rail grant is
`MIGRATED_DARK` and its parent room is `DARK_IMPORTED`, so neither is a new participant entitlement.
PR-07 exposes no create-room, invite/grant, declaration, message-post or close endpoint.

## 6. Provider-neutral source views

The room references a PR-05 `SourceReference` belonging to the same case. For an AssurePool source,
the object must identify the same pool, and `FROZEN_ASSET_TAPE` is accepted only for a DA case. This
prevents a DA tape or `PTC_DATA_ROOM` label from establishing PTC capability.

Views read the retained neutral intake payload; they do not call `CoLendingService`, delegate under
the transferor's CLA identity or require AssureLocker. The AssurePool profile is one adapter beside
the generic provider-neutral profile. Summary/tape/findings/dossier-metadata responses expose
provider/source/digest/validation facts and recursively redact price, bid, yield, coupon, spread,
margin and related commercial keys. A missing source-profile section is reported as not supplied,
not fabricated.

## 7. Parity and repair

A parity run accepts a fresh independently exported/digested snapshot and compares:

1. complete export digest;
2. room status;
3. room/pool/CLA/manifest/purpose binding;
4. grants, classifications, status and declaration/reliance evidence;
5. message order, attribution, time and body digest;
6. access count, exact ordered hashes and tail;
7. source manifest; and
8. the set of explicitly mapped transferee DIDs.

Any mismatch creates an open `RoomParityBreak`, marks the import `BREAK_OPEN` and blocks the Rail
room. A separate user from the parity runner must close a break with purpose-bound step-up,
accountable owner/reference and retained resolution evidence. A room returns from `BLOCKED` to
`DARK_IMPORTED` only when no open break remains and the latest imported version has a clean latest
parity run. Even then, legacy read/write authority remains unchanged.

## 8. API and UI

Ten endpoints live below `/v1/rail/cases/:caseId/rooms`: list/get, sealed legacy import, case break
queue, independent break resolution, legacy compatibility view, four typed source views through one
route, messages, access events and parity run. The UI adds `/cases` and
`/cases/[caseId]/rooms` for the case owner to inspect dark copies, run parity and resolve breaks.

The compatibility response keeps old identifiers/status/text versions visible while labelling
`readSource=compare` and `writeSource=legacy`. It is an evidence aid, not the PR-08 proxy/cutover.

## 9. Rejected and deferred alternatives

- Rejected: move AssurePool into Rail or let `poolId`/`claId` define the room.
- Rejected: treat `PTC_DATA_ROOM` as PTC capability.
- Rejected: recompute imported hashes under a Rail room ID or flatten old/new chains.
- Rejected: migrate invite tokens, infer institution identity from a DID, or auto-admit a legacy
  transferee.
- Rejected: one mutable import row; open-room evidence needs immutable refresh versions.
- Rejected: dual-write legacy and Rail rooms in PR-07.
- Rejected: clear a parity break by the same person who ran it or by a reason without evidence.
- Rejected: call source code directly under the transferor's CLA identity.
- Deferred to PR-08: allow-listed new Rail writes, legacy caller proxy, UI navigation cutover,
  completion acknowledgement and AssurePool permanent-lock reconciliation.
- Deferred to PR-09: conventional DA saga/replay and legally required payment/source/register
  reconciliation.
- Deferred to PR-10 review: conventional PTC route semantics.
- Deferred to PR-13+: permitted commercial negotiation, matching and secondary functions.

## 10. Claim rule

The current shared box remains explicitly DEMO and was not changed or deployed. No branch push is
part of this checkpoint. A model, screen, imported room or clean comparator is engineering evidence
only; it is not live capability, production acceptance or authority to retire the old room.
