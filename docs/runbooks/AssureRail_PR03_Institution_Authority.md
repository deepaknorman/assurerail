# AssureRail PR-03 institution authority operations

**Status:** engineering/runbook baseline; shadow only. This is not deployment approval, participant
admission, legal permission or evidence of a live DA/PTC route.

## 1. Preconditions

Before enabling the module in any shared environment:

1. identify the release commit and retain the PR-03 QA evidence;
2. run the disposable migration/startup/restore rehearsal from that commit;
3. back up Rail Postgres and verify the backup can be restored;
4. confirm Firebase Admin belongs to the AssureRail project and that token revocation checking works;
5. identify at least two active platform administrators with enrolled TOTP and separated accounts;
6. publish the approved institution terms/rulebook version identifiers used in applications;
7. approve the institution evidence schema, provider registration and expiry policy;
8. record who may propose and review admission and route-entitlement decisions;
9. keep all PR-03 functions in `SHADOW`/`compare`; and
10. do not deploy merely because this runbook exists—use the normal change/EX approval.

## 2. Configuration

The only PR-03 enabling combination is:

```text
DATABASE_URL=<AssureRail database only>
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_ROUTE_ENTITLEMENT_ENFORCE=off|compare
```

Use `off` for schema-only observation. Use `compare` only to exercise route proposal/review and
read-only evaluation. There is no `on`, live or production enforcement value in PR-03.

Do not share the AssureLocker database URL, Firebase project, service credentials or Vault paths.

## 3. Migration preflight and rehearsal

Run from the repository root:

```bash
bash -n scripts/assurerail-pr03-db-rehearsal.sh
npm run db:rehearse:pr03 --workspace=@code/assurerail-api
```

The rehearsal ignores the developer's `DATABASE_URL`, creates a unique temporary Postgres instance
on loopback, applies all Rail migrations, generates a test-only ephemeral Firebase key, starts the
real API module graph in `SHADOW` startup-probe mode without opening a listener, tests the inert
legacy projection and constraints, and proves backup/restore plus Prisma migration status. It
removes only its validated `assurerail-pr03.*` scratch directory.

Expected terminal marker:

```text
[PR03-DB] PASS fresh=11-models startup=shadow legacy=reference-only
admission=none mandates=0 entitlements=0 constraints=bounded restore=11-models
```

## 4. Safe enablement sequence

1. Apply the additive migration while both flags remain `off`.
2. Confirm the migration count and the eleven new models.
3. Reconcile the legacy projection:
   - one reference institution per distinct non-empty legacy `entityDid`;
   - `LEGACY_REFERENCE_ONLY` institution state;
   - `NOT_ADMITTED` participant state;
   - one `LEGACY_PROJECTED` member per legacy user/entity combination;
   - zero mandates and zero route entitlements created by the projection.
4. Start one non-live environment with participant admission `shadow` and route entitlement `off`.
5. Test session exchange with no active institution, identity binding and a two-admin application.
6. Record provider evidence and conduct maker/checker admission using separate accounts, sessions and
   step-up evidence.
7. Have both initial administrators bind identity and accept membership.
8. Test mandate proposal/review, suspension and stale-proposal rejection.
9. Set route entitlement to `compare`; test only `REPLAY` and `SHADOW` route modes.
10. Reconcile API events, database rows and operator evidence before adding another cohort.

## 5. Normal institution operation

### Session and acting institution

The user first calls `POST /venue/auth/session`. To select an institution, repeat the session
exchange with `activeInstitutionId`. Subsequent participant requests carry the matching
`X-AssureRail-Institution-Id` header. Do not instruct users to place an institution ID in a request
unless their session exchange has accepted it.

Changing institution context requires another session exchange. A suspended/revoked/expired
institution, admission or membership cannot be selected.

Identity verification must not be used as a recovery shortcut for suspension. A suspended account
cannot be reactivated or rebound through `/venue/auth/onboard`; use the separately governed account
and participant review process.

### Step-up

Before each governed request, call `POST /venue/auth/mfa/verify/totp` with:

```json
{
  "code": "<current TOTP>",
  "purpose": "<exact purpose from the closed taxonomy>",
  "institutionId": "<target Institution.id>"
}
```

Use the returned `stepUp.id` once in the governed request. It expires after five minutes and cannot
cross a user, session, institution or purpose boundary. Never retry a failed governed command with
the same step-up ID; obtain a new proof and first inspect whether the original command committed.
The service commits step-up consumption and the corresponding proposal/review in one database
transaction, so a failed write cannot strand the proof as consumed; the inspection rule remains
necessary for network/client ambiguity after a successful server commit.

### Admission

- Do not admit an application with fewer than two initial administrators.
- Confirm every evidence snapshot belongs to the institution and the digest matches the retained
  provider artefact.
- Treat `crossCheckExpected` as a policy requirement only. Confirm every named expected check appears
  with a verified/achieved result in `crossCheckAchieved`.
- Use a different platform administrator for review.
- Recheck evidence freshness at review time.
- Record substantive reasons. Do not use “approved” or ticket-only shorthand.

### Mandates and route entitlements

- Keep action and scope as narrow as the operational duty.
- Put monetary/volume limits and conditions in canonical JSON; absence means no coded limit and must
  be justified, not assumed unlimited.
- Name the delegation/authority evidence.
- Use effective expiries where a mandate is temporary.
- Require a different participant checker for mandates.
- Require platform review for route entitlement.
- Verify `routePackRef` and `permissionEvidenceRef`; their presence is not proof of legal sufficiency.
- Reject `CONTROLLED_LIVE` or `PRODUCTION` requests; the service does this automatically in PR-03.

## 6. Suspension and incident response

For an institution-level risk event:

1. a platform administrator proposes `SUSPEND` through the admission-decision API;
2. a different platform administrator reviews with a new step-up;
3. confirm `Institution.status=SUSPENDED` and `ParticipantAdmission.status=SUSPENDED`;
4. verify participant authority and route evaluation now deny immediately;
5. notify the accountable operations/risk owner; and
6. retain the decision, reason, sessions, evidence and follow-up review.

For a member, mandate, appointment, route entitlement or service principal:

1. create a target-specific `InstitutionChangeProposal`;
2. use a separate checker;
3. confirm the compare-and-set applied to the recorded original state;
4. for member suspension/revocation, confirm the member's active mandates are also suspended; and
5. do not assume member reinstatement reactivates mandates.

If immediate containment is necessary and the normal two-person ceremony cannot complete, stop the
affected shadow cohort or disable the module flag through the established emergency-change process.
Do not directly edit authority rows without a separately approved, evidence-retaining break-glass
procedure.

## 7. Monitoring and reconciliation

Until PR-04 provides operational screens, query/report at least:

- applications by admission status and age;
- evidence expiring within policy windows;
- pending decisions and changes by age;
- memberships/mandates/entitlements expiring soon;
- failed step-up consumption and institution-context mismatch counts;
- concurrent/stale proposal conflicts;
- suspended/revoked institutions with any apparently active dependent record;
- legacy projection counts and any non-zero mandate/entitlement attached to
  `LEGACY_REFERENCE_ONLY`; and
- route comparison by requested dimension and denial code.

An apparently active dependent record under a suspended parent is not authority—the evaluator still
denies—but it should be reviewed and corrected through the governed status process.

## 8. Rollback and safe pause

Application rollback:

1. set `ARAIL_ROUTE_ENTITLEMENT_ENFORCE=off`;
2. set `ARAIL_PARTICIPANT_ADMISSION_V1=off`;
3. restart through the controlled release process; and
4. confirm the 16 versioned institution endpoints are no longer mounted/available.

Keep the migration and all additive records. Do not delete applications, evidence, decisions,
memberships, mandates, appointments, entitlements, sessions, step-up evidence or change proposals.
The legacy Note path remains technically available under its existing controls; disabling PR-03 does
not cure or change its documented scope risks.

If any shadow data must be corrected, create a new evidence version or governed proposal. Do not
rewrite a historical provider result, decision actor, proposal digest or consumed step-up record.

## 9. Exit criteria for PR-04/PR-05

Before exposing an institutional UI or automated provider intake, require:

- no unresolved critical/high defect in identity/admission/mandate isolation;
- negative access tests for every UI/API action and tenant pairing;
- approved evidence display semantics for source, as-of, expiry, qualifications and achieved checks;
- immutable object/document handling and connector certification from PR-05;
- an operator queue for evidence gaps, pending decisions, expiries and stale conflicts;
- documented recertification and participant exit ownership; and
- explicit confirmation that public capability copy remains bounded to accepted evidence.
