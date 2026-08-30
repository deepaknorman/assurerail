# AssureRail institution admission and authority v1

**Status:** PR-03 engineering contract; shadow-only foundation, 30 August 2026

**Controlling scope:** `docs/design/AssureRail_Code_Capability_Baseline_And_Implementation_Register.md`

**Runtime:** AssureRail API and its own Postgres database

**Not:** public copy, a legal opinion, a licence conclusion, a participant admission decision, a
route approval, or evidence that any DA/PTC function is live

## 1. Result and boundary

PR-03 introduces a Rail-local institutional authority model. A request can be attributed separately
to a human account, an authenticated session, an acting institution, an active membership, an exact
mandate and—where relevant—a platform-approved route entitlement. These are additive records. They
do not rename or reinterpret a legacy global `VenueUser.role`, `entityRole`, `entityDid` or
`allowlisted` field.

The selected boundary is:

```text
external identity assertion
    → Rail identity binding
    → Rail session
    → institution application
    → retained provider evidence
    → two-person participant-admission decision
    → membership acceptance
    → two-person scoped mandate
    → participant route proposal
    → platform route review
    → compare-only authority result
```

Every arrow is a distinct state change. None implies the next. In particular:

- identity verification does not admit an institution or person to a Rail transaction;
- admission does not create a DA/PTC route permission;
- membership does not create a mandate;
- a mandate does not create a route entitlement;
- a route entitlement does not create a transaction case or legal power beyond its approved route
  pack and permission evidence; and
- the presence of these models does not make any route `CONTROLLED_LIVE` or `PRODUCTION`.

## 2. Decisions selected and alternatives rejected

### 2.1 Identity and admission are separate

Selected:

- `IdentityBindingService` is the neutral boundary.
- AssureLocker DigiKYC is the first configured identity adapter.
- Rail stores a provider key, provider subject reference and verification time; it does not copy the
  provider's identity/KYC payload.
- successful binding sets the account identity state to `ACTIVE` but explicitly leaves the legacy
  `allowlisted` value `false`;
- rebinding cannot reactivate a suspended account or replace an existing binding with a different
  provider subject;
- `/venue/auth/session` determines `needsOnboarding` from identity binding, not from a global market
  role; and
- institutional admission is decided later from retained, scoped evidence.

Rejected:

- treating an AssureLocker DID as a Rail mandate;
- setting `ACTIVE + allowlisted` when DigiKYC succeeds;
- making AssureLocker the canonical institution or authority database;
- assuming a provider's declared capability or expected cross-check was used for this institution;
  and
- allowing an unconfigured provider name to fall back to AssureLocker or to a successful result.

The old field name `VenueUser.status` remains for compatibility. In PR-03 it is an account/identity
validity field, not participant admission. The authoritative participant state is
`ParticipantAdmission.status`.

### 2.2 Rail owns the institutional relationship

Selected Rail-local records:

| Record | Selected responsibility |
|---|---|
| `Institution` | Stable Rail institution ID, legal name/type, jurisdiction, legal identifiers and Rail relationship state |
| `InstitutionEvidenceSnapshot` | Immutable provider assertion with provider/source reference, digest, signature verification, method, independence, expected/achieved cross-checks, qualifications and expiry |
| `ParticipantAdmission` | Current terms/rulebook acceptance, risk class, review/expiry and relationship state |
| `ParticipantAdmissionDecision` | Proposed decision, original state, evidence IDs, maker/checker step-up evidence, reason and applied result |
| `InstitutionMember` | Human-to-institution binding, invitation/acceptance, role, effective period and status |
| `AuthorityMandate` | Exact action, scope, optional scope reference, limits, conditions, delegation/evidence, version, maker/checker and effective period |
| `Appointment` | Appointer, appointee institution or provider, role, case/scope, conflict disclosure, acceptance and validity |
| `RouteEntitlement` | Route/representation/asset/leg/function/performer/modes plus route-pack and permission evidence references |
| `InstitutionServicePrincipal` | Rail-local service client, Vault credential reference, allowed actions and validity state |
| `StepUpEvidence` | Five-minute, one-use TOTP proof bound to user, session, institution and exact purpose |
| `InstitutionChangeProposal` | Two-person suspension/revocation/reinstatement proposal with original target state and immutable digest |

Rejected:

- cross-database foreign keys to AssureLocker or AssureCLA;
- copying the central entity service's product tiers, wallet policy or role names;
- using a platform employee's global admin flag as authority to act for a participant;
- letting an institution self-approve its Rail route entitlement; and
- placing all institutional state or authorities in an unversioned JSON blob.

### 2.3 Initial two-person governance

An application must name the applicant plus at least one additional initial administrator. This is
required because a single admitted founder with both propose and approve permissions would either
deadlock or be forced into unsafe self-approval.

The application digest binds the sorted initial-admin email list. Admission requires two different
active platform administrators with two separate, single-use step-up records. If approved:

1. the applicant membership becomes active;
2. initial proposed administrators retain `PENDING_ADMISSION` until their own identity binding and
   acceptance;
3. each initial administrator receives a `bootstrapApprovedDecisionId`; and
4. only those admission-approved initial administrators receive the five bootstrap mandates when
   they become active.

The bootstrap actions are:

```text
VIEW_INSTITUTION
ADMINISTER_MEMBERS
PROPOSE_AUTHORITY
APPROVE_AUTHORITY
MANAGE_APPOINTMENTS
```

`OPERATE_ROUTE` is deliberately excluded. Later administrators invited after admission do not
inherit bootstrap authority. Their mandates require a separate proposal and a different checker.

Rejected:

- one-person bootstrap;
- permanent platform-admin power to act for the institution;
- granting every administrator every future action;
- granting route operation in the admission decision; and
- silently bootstrapping later invited administrators during recertification.

### 2.4 Session and step-up binding

`POST /venue/auth/session` creates or refreshes a Rail `VenueSession`. Its ID is derived from a
SHA-256 digest of the Firebase bearer token; the bearer token is not stored. The record retains user,
expiry, credential-assurance label, bounded network/client context and an optional active
institution. An active institution is accepted only when the user has an active, unexpired
membership in an active, admitted, unexpired institution.

Subsequent requests may send:

```text
X-AssureRail-Institution-Id: <Rail Institution.id>
```

The authentication guard requires that the requested institution is both currently valid for the
user and the institution recorded on that exact active session. Participant governance controllers
also require the path/target institution to match the active session context.

TOTP verification can issue a `StepUpEvidence` only for a closed purpose taxonomy. It is bound to:

- the Rail user;
- the exact Rail session;
- the exact institution;
- the exact governance purpose;
- the TOTP method and assurance context;
- an issue time and five-minute expiry; and
- a one-use `consumedAt` compare-and-set.

The evidence cannot be consumed by another user, session, institution or action, after expiry, after
revocation or a second time. Membership acceptance is the one participant ceremony allowed before
the session has an active institution, because the membership does not become active until that
ceremony succeeds. Platform admission/route-review ceremonies similarly do not require the
platform employee to be a member of the target institution, but the evidence is still bound to that
target institution.

For a governed proposal or review, consuming the one-use step-up record and writing the governed
record occur in the same database transaction. A rejected or failed write therefore does not leave
an otherwise unused proof consumed without its corresponding proposal. This atomicity does not yet
resolve `AR-H10`: the legacy hash-chain audit append remains outside several governance transactions
and is explicitly deferred.

WebAuthn registration remains available, but PR-03 does not claim that a WebAuthn assertion is yet a
governance step-up ceremony. TOTP seed encryption, recovery and last-factor protections remain part
of `AR-M18` and the production security programme.

### 2.5 Evidence and provider neutrality

Evidence snapshots separate all of the following:

- provider registration and provider-side institution reference;
- evidence type/schema/version;
- payload digest and optional immutable storage reference;
- signature status;
- verification result and method;
- provider independence classification;
- assertions;
- checks expected from the provider;
- checks actually achieved for this institution;
- qualifications;
- source as-of, expiry and supersession; and
- the Rail actor who recorded the snapshot.

`crossCheckExpected` is a list of named checks. `crossCheckAchieved` is a result object. Every
expected name must have an achieved value of `true`, `VERIFIED`, `ACHIEVED`, or a nested result with
one of those successful values. An unrelated achieved check cannot satisfy an expected check.

A retained, signature-verified, `VERIFIED` snapshot remains usable if a provider is temporarily
unavailable, because a network outage does not rewrite historical evidence. It fails when expired,
when its signature is not verified, when the result is qualified/non-verified, or when an expected
cross-check is absent. Evidence is re-evaluated both when an admission decision is proposed and
immediately before an approval is applied.

Provider references may represent an AssureLocker service, a lender common registry, a specialist
KYB provider or another certified provider. The canonical institution/evidence/decision schema has
no mandatory AssureLocker, AssurePlane, IDBI, trustee-vendor, CLA, pool or token field.

### 2.6 Admission decision state machine

Allowed proposals are intentionally narrow:

| Decision | Allowed current admission state | Successful applied state |
|---|---|---|
| `ADMIT` | `APPLIED` | `ADMITTED` |
| `REJECT` | `APPLIED` | `REJECTED` |
| `SUSPEND` | `ADMITTED` | `SUSPENDED` |
| `REVOKE` | `ADMITTED`, `SUSPENDED` | `REVOKED` |
| `RECERTIFY` | `ADMITTED` | `ADMITTED` with refreshed review/effective fields |
| `REINSTATE` | `SUSPENDED` | `ADMITTED` |

`ADMIT`, `RECERTIFY` and `REINSTATE` require at least one currently acceptable evidence snapshot.
The decision stores `fromAdmissionStatus`. Approval updates only if the admission is still in that
state. A partial unique database index permits only one pending decision per admission. These rules
prevent an old approval from overwriting an intervening suspension or review.

The maker cannot review their own proposal. Both maker and checker must be active platform
administrators and must consume different step-up records. Rejection remains possible when evidence
has become stale; approval does not.

### 2.7 Membership and mandate state

Normal invitation uses a 256-bit random token. Only its canonical SHA-256 digest is stored, and the
raw token is returned once to the caller for out-of-band delivery. The named user must bind identity
and consume a membership-acceptance step-up. Initial administrators approved in the admission
decision use that decision evidence instead of a later invitation token.

A member performs a participant action only when all layers pass on that request:

```text
Institution.status == ACTIVE
ParticipantAdmission.status == ADMITTED and within effective period
InstitutionMember.status == ACTIVE and within effective period
AuthorityMandate.status == ACTIVE and within effective period
AuthorityMandate.action == requested action
AuthorityMandate.scopeType == requested scope type
AuthorityMandate.scopeRef is null (all of scope) or equals the requested reference
```

Mandate changes are versioned. A proposal names the target member, action, scope, limits,
conditions, delegation basis, authority evidence and expiry. A different active member with
`APPROVE_AUTHORITY` reviews it using a distinct step-up. Activating a replacement marks its previous
active version `SUPERSEDED`. A proposal cannot be approved if the target member has stopped being
active or the proposed mandate has expired.

Platform administrators do not bypass this evaluator on participant endpoints.

### 2.8 Appointment semantics

An institution member with `MANAGE_APPOINTMENTS` can propose an appointment to exactly one:

- admitted Rail institution; or
- active registered provider reference.

The appointment stores scope, optional transaction-case reference, role, conflict disclosure and
expiry. A Rail institution appointee accepts through a different human with its own active
institution context and `MANAGE_APPOINTMENTS` mandate. The appointing maker cannot accept.

Provider acceptance is deliberately not simulated. It remains `PROPOSED` until a later certified
provider acknowledgement adapter exists. The model does not hard-code a trustee, RTA, depository,
AssurePlane or assurance-provider name.

### 2.9 Route entitlement semantics

The route dimensions use the PR-01 governed taxonomies:

```text
transactionRoute + representation + assetClass + lifecycleLeg
+ materialFunction + functionPerformer + operatingModes
```

Every proposal also requires `routePackRef` and `permissionEvidenceRef`. A participant with
`PROPOSE_AUTHORITY` can request the entitlement, but only a different active platform administrator
can approve it. This prevents participant self-grant and distinguishes participant internal
authority from Rail's regulatory/operating perimeter decision.

PR-03 accepts only `REPLAY` and `SHADOW` in `operatingModes`. `SANDBOX`, `CONTROLLED_LIVE` and
`PRODUCTION` are rejected at the service boundary. `PROHIBITED` always evaluates to denial. The
public API is available only when `ARAIL_ROUTE_ENTITLEMENT_ENFORCE=compare`; `off` fails closed.

The evaluator is compare-only. It does not yet guard legacy Note routes, create a case or infer a
legal permission from a configuration value. Enforcement remains a later, explicitly gated step.

### 2.10 Suspension, revocation and reinstatement

Membership, mandate, appointment, route-entitlement and service-principal status changes use
`InstitutionChangeProposal`:

1. maker proves their exact participant mandate and step-up;
2. Rail verifies the target belongs to the acting institution and the transition is valid;
3. the proposal records target type/ID, original state, change, reason, canonical payload digest,
   actor/session evidence and time;
4. a partial unique index permits only one pending change for a target;
5. a different checker proves the required mandate and step-up; and
6. the compare-and-set applies only if the target remains in the recorded original state.

Allowed changes are:

- `SUSPEND` from `ACTIVE`;
- `REVOKE` from `ACTIVE`, `SUSPENDED` or `PROPOSED`; and
- `REINSTATE` from `SUSPENDED`.

Revocation is not automatically reversible. Suspending/revoking a member immediately prevents the
authority evaluator from passing and suspends that member's active mandates. Reinstating the member
does not silently reactivate those mandates; each requires its own governed reinstatement. The same
read-time status/expiry pattern applies to service-principal evaluation.

Institution-level suspension/revocation uses the two-person participant-admission decision because
that is the Rail relationship authority. A suspended institution or admission fails before any
membership or mandate is considered.

## 3. API surface

The module is mounted only in DB mode with `ARAIL_PARTICIPANT_ADMISSION_V1=shadow`. All routes require
a valid Firebase token and active Rail session. Participant governance routes additionally perform
service-level institution/mandate checks; platform routes carry `@AdminOnly` and repeat the active
platform-role check inside the service.

| Method and path | Authority |
|---|---|
| `GET /v1/rail/institutions` | authenticated user; returns only their membership contexts |
| `POST /v1/rail/institutions` | identity-bound applicant; no admission implied |
| `POST /v1/rail/institutions/:institutionId/members/invitations` | active context + `ADMINISTER_MEMBERS` + step-up |
| `POST /v1/rail/institutions/memberships/:memberId/accept` | named identity-bound invitee + token/admission evidence + step-up |
| `POST /v1/rail/institutions/:institutionId/mandates` | active context + `PROPOSE_AUTHORITY` + step-up |
| `POST /v1/rail/institutions/mandates/:mandateId/review` | same active context + different `APPROVE_AUTHORITY` checker + step-up |
| `POST /v1/rail/institutions/:institutionId/appointments` | active context + `MANAGE_APPOINTMENTS` + step-up |
| `POST /v1/rail/institutions/appointments/:appointmentId/accept` | appointee active context + different appointee authority + step-up |
| `POST /v1/rail/institutions/:institutionId/route-entitlements` | active context + `PROPOSE_AUTHORITY` + compare flag + step-up |
| `POST /v1/rail/institutions/:institutionId/route-entitlements/evaluate` | active context + `VIEW_INSTITUTION` + compare flag |
| `POST /v1/rail/institutions/:institutionId/status-changes` | active context + target-specific maker authority + step-up |
| `POST /v1/rail/institutions/status-changes/:proposalId/review` | same active context + different checker authority + step-up |
| `POST /v1/rail/admin/institutions/:institutionId/evidence` | active platform administrator |
| `POST /v1/rail/admin/institutions/:institutionId/admission-decisions` | active platform administrator + step-up |
| `POST /v1/rail/admin/admission-decisions/:decisionId/review` | different active platform administrator + step-up |
| `POST /v1/rail/admin/route-entitlements/:entitlementId/review` | different active platform administrator + compare flag + step-up |

The existing 58-route PR-00 inventory remains its frozen legacy/current-risk contract. The 16 new
versioned endpoints have a separate PR-03 contract test so adding this shadow module does not
pretend that legacy resource-scoping findings have been cured.

## 4. Feature flags and allowed environment

| Flag | PR-03 values | Effect |
|---|---|---|
| `ARAIL_PARTICIPANT_ADMISSION_V1` | `off`, `shadow` | `off` does not mount the institution module; `shadow` mounts versioned APIs |
| `ARAIL_ROUTE_ENTITLEMENT_ENFORCE` | `off`, `compare` | `off` blocks entitlement routes; `compare` records/evaluates without guarding legacy execution |

Truthy aliases such as `true`, `enabled` and `on` are invalid. Neither flag has an enforcement or
live value in PR-03. Existing `DEMO`, Note, transfer-room and provider flows are not switched by
these flags.

## 5. Legacy projection and compatibility

The migration is additive. It preserves all existing user/session/security/domain columns and adds
the PR-03 records. Existing users with `entityDid` become:

```text
Institution.status                 = LEGACY_REFERENCE_ONLY
ParticipantAdmission.status        = NOT_ADMITTED
InstitutionMember.status           = LEGACY_PROJECTED
AuthorityMandate count             = 0
RouteEntitlement count             = 0
```

The deterministic projection IDs use PostgreSQL SHA-256. Users sharing an `entityDid` map to one
reference institution. Their original `entityRole`, `entityDid`, access state and history remain
unchanged for compatibility. No migration creates participant power from those fields.

Existing users with a `did` receive an identity-provider/subject/verification-time backfill. This
recognises the historical identity binding only; it does not alter their Rail admission projection.

The legacy Note role/allow-list path remains present during the strangler migration. The one direct
security correction is that a matching legacy `entityRole` no longer admits a suspended or
non-allowlisted user. New identity binding never adds a user to that legacy allow-list.

## 6. Failure and concurrency behavior

- Unknown taxonomy/action/purpose/status values fail rather than defaulting.
- Missing institution/session context fails before participant governance code runs.
- Expiry comparison is strict: equality to `now` is expired.
- Reused step-up evidence updates zero rows and fails.
- Self-review fails before state change.
- Concurrent reviewers use compare-and-set updates; one succeeds at most.
- Pending admission and target-status proposals have database-level partial uniqueness.
- A non-null mandate `scopeKey` closes PostgreSQL's nullable-unique gap, and only one proposed
  mandate may exist for the same member/action/scope at a time.
- Governed proposal/review writes and their step-up consumption commit or roll back together.
- Re-running identity binding cannot clear a suspension or silently change the provider subject.
- State changes carry `fromStatus`; stale approval rolls back the whole transaction.
- Suspended members cannot receive a newly approved mandate.
- Expired mandates, appointments or entitlements cannot be approved/accepted.
- Replacement mandate activation supersedes the previous active version in the same transaction.
- An identity-provider outage does not delete retained evidence; stale evidence still fails.
- A provider appointment cannot be accepted through a fake local human path.
- A route cannot be recorded for controlled-live/production in this release.

## 7. Explicitly deferred work

PR-03 does not include:

- PR-04 institutional onboarding/administration screens, approval inbox or accessibility evidence;
- PR-05 immutable file/object intake, malware scanning, provider connector certification or
  automated evidence submission;
- PR-06 transaction cases, case parties, conditions, decisions or state engine;
- enforcement on current legacy Note/room/document/report routes;
- service-principal credential issuance/authentication endpoints;
- a provider-acknowledgement ceremony for provider appointments;
- WebAuthn assertion as step-up, recovery ceremony or TOTP-secret encryption remediation;
- atomic integration of the legacy hash-chain `AuditLog` with every new governance transaction;
- case-scoped appointments or route action, because `TransactionCase` does not yet exist;
- any customer-facing UI or narrative/copy change;
- licence, counsel or route approval; or
- deployment.

These deferrals are not silent gaps. The feature flags stay shadow/compare-only, the runtime accepts
no PR-03 live-entitlement mode, and the code/capability register continues to treat production as a
separate evidence-backed gate.
