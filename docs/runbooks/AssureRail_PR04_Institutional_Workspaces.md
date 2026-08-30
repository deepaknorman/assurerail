# AssureRail PR-04 institutional workspace operations

**Status:** engineering/runbook baseline; shadow/compare only. This does not authorise deployment,
admission, a route, a transaction, connector use or production operation.

## Preconditions

1. Complete the PR-03 migration/rehearsal and retain its evidence.
2. Configure `ARAIL_PARTICIPANT_ADMISSION_V1=shadow`.
3. Keep `ARAIL_ROUTE_ENTITLEMENT_ENFORCE=off` unless an approved non-live comparison cohort exists;
   use only `compare` for that cohort.
4. Enrol two separate platform reviewers and two separate initial institution administrators in
   TOTP with independent accounts.
5. Approve exact terms/rulebook versions and evidence metadata policy.
6. Confirm the API and web origins use the AssureRail identity project and credentials.
7. Do not deploy under this task; use the separate EX/change approval when released.

## Applicant journey

1. Bind the human identity. Confirm `allowlisted=false` and no institution is selected.
2. Open `/institutions` and submit legal name, institution type, jurisdiction, legal identifiers,
   exact terms/rulebook versions and at least one additional administrator.
3. Confirm the response and UI state say application, not admission.
4. Confirm `/institutions/:id` shows only application state, evidence metadata/gaps and initial
   administrators. It must not show route, appointment or unrelated member governance.
5. Record evidence through the platform workspace. Never paste raw KYB documents or secrets into
   JSON metadata fields.
6. Have one platform administrator propose and another review admission. Both must use fresh,
   target-institution-bound step-up evidence.
7. Each approved initial administrator completes identity binding and membership acceptance.
8. Explicitly select the admitted institution; verify the active institution appears in the header.

## Participant governance

- Use the shared authenticator-code field immediately before each action. Proofs expire in five
  minutes and are one-use.
- Invite members only through a member with `ADMINISTER_MEMBERS`.
- Share the returned invitation token out of band. The token is not retained by Rail in plaintext.
- Propose authority only through `PROPOSE_AUTHORITY`; review it through a different member with
  `APPROVE_AUTHORITY`.
- State a specific delegation basis and retained authority-evidence reference.
- Propose appointments only through `MANAGE_APPOINTMENTS`. The appointee institution must view the
  incoming appointment under its own active context and accept with its own authority.
- Do not mark provider appointments active manually. Await the PR-05 certified acknowledgement.
- Route proposals may contain only `REPLAY` or `SHADOW`; platform review does not make them live.
- Use governed status-change proposals for suspension, revocation and reinstatement. Do not edit
  statuses directly.

## Platform review

1. Use `/admin/institutions` without selecting or acting through a participant context.
2. Confirm the displayed operator boundary says `mayActForInstitution=false` and
   `supportImpersonationAvailable=false`.
3. For evidence, validate the retained provider artefact independently, then record only its
   schema, digest, signature/result, source/as-of/expiry, achieved checks and qualifications.
4. Never turn an expected check into an achieved check unless the evidence for this institution
   proves it.
5. For admission, select exact evidence IDs, state the reason/risk/review period, and have a
   different platform user review it.
6. For route entitlement, verify the route-pack and permission-evidence references and approved
   non-live modes; a different platform user reviews the participant proposal.
7. Investigate aged applications, evidence expiry, stale pending decisions and concurrent-change
   conflicts before accepting another cohort.

## Incident and suspension

If a membership, mandate, appointment or route permission appears overbroad, stop the affected
shadow activity and use the target-specific two-person status change. If the institution itself is
at risk, use the two-person participant-admission suspension. Confirm a fresh authority evaluation
denies immediately.

Do not use the platform approval workspace to act for the participant during an incident. A future
break-glass process must be explicitly scoped, approved, time-bound and receipt-logged; PR-04 does
not provide it.

## Rollback

1. Hide/remove the three institutional UI routes from navigation.
2. Set route comparison to `off` and participant admission to `off` through normal change control.
3. Restart only under the approved change process.
4. Retain all applications, evidence metadata, decisions, memberships, mandates, appointments,
   entitlements, sessions and step-up evidence.
5. Do not delete or rewrite historical decisions to make rollback appear clean.

Because PR-04 has no schema migration, rollback is application-only. It does not remedy the known
legacy Note/global endpoint isolation gaps and must not be represented as production readiness.
