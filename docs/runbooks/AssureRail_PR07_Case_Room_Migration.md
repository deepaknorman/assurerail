# AssureRail PR-07 case-room migration runbook

**Mode:** replay/shadow compare only; legacy is the sole room write/read authority

**Owners:** case owner, legacy-room data owner, migration operator, independent parity checker,
evidence/source owner, security/IAM and database/platform operations

## Enablement prerequisites

1. Apply migrations through `20260831010000_assurerail_pr07_case_rooms` only in an approved non-live
   Rail database. Retain fresh/upgrade/backup/restore evidence.
2. Declare REPLAY or SHADOW. Enable participant admission, neutral ingress and transaction cases in
   shadow; set room read to `compare` and room write to `legacy`. `rail` read and Rail writes are
   rejected in PR-07.
3. Admit and activate the case owner and all mapped counterparties. Approve exact `VIEW_CASE_ROOM`
   and `REVIEW_ROOM_MIGRATION` mandates. Do not give platform support staff participant authority.
4. Create the neutral case and active case-party records. For an AssurePool frozen tape, the case
   must be DA and the PR-05 source reference must identify the exact pool.
5. Nominate separate migration operator and parity/repair checker. Record source database/version,
   extraction owner, high-water convention, retention and rollback owner.

## Export and import

1. Run the read-only legacy adapter at a declared high-water mark. Use
   `assurecla.transfer-room-export.v1`; include the complete room, invites, access log, messages and
   source digests. Never include invitation tokens or unrelated CLA/pool data.
2. Generate the deterministic bundle through the source builder. Retain row counts, export digest,
   source/version/high-water, operator and extraction log outside Rail as source evidence.
3. Verify the room is bound to the intended case/source reference. Explicitly map every transferor
   and transferee DID one-to-one to an active case-party institution. Stop on ambiguity.
4. Obtain `ROOM_LEGACY_IMPORT` step-up and import with a declared root batch ID. The same root batch
   may cover multiple rooms; Rail derives a unique receipt identity for each room/version while
   retaining the root batch on `LegacyRoomImport`. Confirm the room is `DARK_IMPORTED`, every
   imported grant is `MIGRATED_DARK`, the legacy ID or collision mapping is retained, counts match
   and the migration receipt is `VERIFIED`.
5. For a refreshed open room, repeat with a new batch. Stop if the old access/message history is not
   an exact prefix, any immutable binding changes, status moves backwards or a DID mapping changes.
   Never edit the previous import version.

## Parity

1. Produce a fresh bundle at a new declared high-water mark after the import transaction commits.
2. A mandated checker obtains `ROOM_PARITY_REVIEW` step-up and runs comparison. Review every one of
   the eight dimensions; do not accept only the total count or tail hash.
3. For `MATCHED`, retain the parity run ID/digests and confirm the room is still dark and legacy is
   still the write authority.
4. For `BREAK_OPEN`, stop cohort/cutover work. Assign an owner/SLA, compare the sealed source and
   Rail row/digest, and classify extraction drift, source mutation, mapping error, import defect or
   unauthorised change.
5. A checker other than the parity runner records repair evidence and closes the break. Run a fresh
   full parity afterwards. Closure without a clean latest parity does not unblock the room.

## Least-disclosure review

- Use the source-view endpoints rather than a direct CLA call. Confirm profile, source object,
  payload digest, signature/validation status, receipt time and manifest binding.
- Treat `NOT_SUPPLIED_BY_SOURCE_PROFILE` as missing; do not display a fabricated empty assurance.
- Confirm commercial-key redaction on every source adapter payload. Do not widen passive diligence
  merely because a future commercial field exists in a source record.
- Export no invite token. Restrict DID/email mapping files to the migration team and retain them
  under the approved evidence/retention classification.

## Safe stop and rollback

- Set room read back to `legacy` to unmount the PR-07 comparison module. Rail dark data and receipts
  remain immutable/exportable; legacy behaviour is unchanged.
- Do not delete an import, recompute its chain or force a case room from `BLOCKED`.
- A failed refresh leaves the prior import/version intact because import and step-up consumption are
  transactional.
- If an identical concurrent import wins, use its retained snapshot/receipt. If content, batch,
  version or mapping conflicts, investigate; do not retry under changed identifiers.
- Do not set read source to `rail`, enable a Rail write, deploy to the shared DEMO box, or retire an
  old route under this runbook.

## Daily evidence

Retain import/version count, source/target counts, high-water and digests, chain verification,
mapping review, latest parity result/age, open-break owner/SLA/age, independent closures, source-view
missing sections, flag changes and any failed/skipped/unavailable check. A clean comparison is not a
live or production claim.
