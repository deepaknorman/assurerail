# AssureRail institutional workspaces v1

**Status:** PR-04 engineering contract, 30 August 2026

**Depends on:** PR-03 institution admission and authority

**Runtime:** AssureRail web and API; no deployment performed

**Not:** public copy, an admission approval, a route permission, connector certification, legal
advice, or proof of a live DA/PTC capability

## 1. Result

PR-04 makes the PR-03 authority model operable without weakening it. It adds three deliberately
different views:

1. a restricted application-status view for applicants and proposed initial administrators;
2. an institution-bound participant workspace whose contents and commands are filtered by the
   viewer's active membership and exact mandates; and
3. a platform approval workspace for admission and route review that explicitly cannot impersonate
   or act for a participant.

The user journey is now:

```text
human login
  → provider-neutral identity binding
  → institution application or invitation
  → restricted application status
  → platform evidence + two-person admission review
  → membership acceptance
  → institution-bound session
  → mandate-limited governance workspace
  → replay/shadow route proposal
  → independent platform route review
```

The UI reflects current state; it does not manufacture authority. Every governed write continues to
use the PR-03 API, transaction, actor, maker/checker and step-up controls.

## 2. Selected decisions and rejected alternatives

### 2.1 Identity wording corrected only where materially false

The old onboarding screen called AssureLocker DigiKYC a venue admission requirement and redirected
the user to the token Note console. That contradicted the selected architecture and `AR-C03` fix.
PR-04 makes the minimum compelling correction:

- the screen is labelled identity binding, not participant onboarding;
- AssureLocker DigiKYC is described as the first configured provider, not the mandatory canonical
  authority;
- successful binding grants no institution admission, mandate or route permission; and
- the next screen is the institution relationship workspace, not the Note console.

No public proposition, marketing page, deck or broader narrative was rewritten.

Rejected:

- preserving materially false text for cosmetic stability;
- suggesting an identity DID is an institutional mandate;
- returning a newly identity-bound person to broad legacy venue data; and
- presenting AssureLocker as a compulsory Rail provider.

### 2.2 Active institution is a session security boundary

The browser stores only the selected Rail institution ID. Selecting an institution repeats the
authenticated session exchange; the API validates that the user has an active membership in an
active, admitted institution and records the institution on that exact server-side session. Later
participant calls carry `X-AssureRail-Institution-Id`, which must match both the path/target and the
session record.

Calls that must not borrow participant authority explicitly suppress the institution header:

- list the user's relationships;
- submit an institution application;
- accept a pre-context membership; and
- use platform administrator work-queue and review endpoints.

If a locally remembered institution has become invalid, the initial session restoration clears it
and retries without a participant context. Explicit selection failures do not silently fall back.

Rejected:

- treating browser local storage as authority;
- sending a previously selected institution on platform-admin requests;
- automatically choosing the first relationship; and
- letting a stale context make login unusable without a fail-closed recovery path.

### 2.3 Workspace disclosure follows capabilities

`GET /v1/rail/institutions/:institutionId` first requires an exact membership. A user cannot discover
another institution by guessing its ID.

An applicant or proposed initial administrator in `PENDING_ADMISSION`/`INVITED` receives only:

- institution/application state and governing terms/rulebook versions;
- evidence provenance metadata and evidence-policy gaps;
- the applicant/initial-admin membership set; and
- explicit empty appointment, route-entitlement and change-proposal collections.

An active participant must additionally pass the exact `VIEW_INSTITUTION` mandate evaluator. The
service independently evaluates `ADMINISTER_MEMBERS`, `PROPOSE_AUTHORITY`, `APPROVE_AUTHORITY` and
`MANAGE_APPOINTMENTS`. Those results determine both commands and read breadth:

- ordinary members see only themselves and their mandates;
- governance viewers may see all members, mandates and pending institution changes;
- appointment managers see outgoing appointments plus appointments incoming to their own
  institution; and
- route entitlements are visibly labelled by state and operating modes.

Incoming appointments are included so an appointed trustee or other institution can actually see
and independently accept the appointment. Provider appointments remain proposals until PR-05
provides a certified provider acknowledgement adapter.

Rejected:

- one broad institution-admin flag in the UI;
- hiding a button while returning the same sensitive data to every member;
- showing outgoing appointments only, which would make independent acceptance impossible; and
- allowing platform admins to bypass participant mandates on participant routes.

### 2.4 Evidence display separates facts that must not collapse

Evidence cards show separately:

- provider reference and provider-side institution reference;
- evidence type and digest;
- source as-of and expiry;
- signature status and verification result;
- verification method and independence class;
- expected cross-checks and achieved cross-checks; and
- qualifications.

The application and operator views show explicit gap codes from the PR-03 fail-closed evidence
policy. An empty gap list means the current retained metadata passes that policy; it does not mean a
route, case, transaction or legal condition is satisfied.

PR-04 platform operators may record immutable evidence metadata through the existing PR-03 API.
They do not upload evidence bytes. Encrypted object storage, content sniffing, malware quarantine,
immutable document versions, retention/legal hold and certified file/API carriers remain PR-05.

Rejected:

- presenting `crossCheckExpected` as a check actually performed;
- a single green “KYC complete” badge without provenance and qualification;
- accepting mutable document bytes into the legacy `Document` model; and
- claiming connector certification because a provider reference or URL exists.

### 2.5 Connector panel is intentionally non-authoritative

PR-04 shows a connector-readiness slot because institutional users need to understand why a route
cannot yet proceed. Its values are limited to:

- `NOT_AVAILABLE_PRE_ADMISSION`; or
- `AWAITING_PR05_CERTIFICATION`.

The response includes `grantsAuthority: false`. The UI repeats that connector registration and
certification arrive in PR-05. This is an honest dependency marker, not a simulated connector.

Rejected:

- creating a decorative “connected” toggle;
- using connectivity as an institution or route permission; and
- copying the AssureCLA connector catalogue as the universal Rail connector schema.

### 2.6 Platform operators review but do not impersonate

The platform work queue returns application count, pending admission reviews, pending route reviews,
evidence/member/route counts and bounded institution summaries. The detail response carries an
explicit machine-readable operator boundary:

```json
{
  "mayReviewAdmission": true,
  "mayReviewRouteEntitlement": true,
  "mayActForInstitution": false,
  "supportImpersonationAvailable": false
}
```

Admission and route writes still require purpose-bound, target-institution-bound, one-use step-up
evidence. Makers cannot review their own proposals. The UI does not offer impersonation, session
context switching into the participant, silent editing of decisions, or direct status mutation.

Rejected:

- a combined participant/platform admin console;
- an “act as customer” support feature;
- admission through a one-click direct state change;
- treating a platform reviewer as the participant's mandate holder; and
- auto-approving route entitlement when participant admission is approved.

## 3. New API reads

| Endpoint | Boundary | Purpose |
|---|---|---|
| `GET /v1/rail/institutions/:institutionId` | Exact membership; active users also require exact `VIEW_INSTITUTION` mandate | Restricted application, self or governance workspace |
| `GET /v1/rail/admin/institutions` | Active platform administrator | Bounded application/admission/route review queue |
| `GET /v1/rail/admin/institutions/:institutionId` | Active platform administrator | Evidence and approval detail without participant impersonation |

The module now exposes 19 versioned institutional endpoints, six platform-only. No legacy Note,
document, report, room, billing or operations endpoint was reclassified by this PR.

## 4. UI routes

| Route | Responsibility |
|---|---|
| `/institutions` | Relationship list, explicit active-institution selection, membership acceptance and application |
| `/institutions/[institutionId]` | Application/self/governance view, evidence provenance, members/mandates, incoming/outgoing appointments and replay/shadow entitlement proposals |
| `/admin/institutions` | Platform queue, evidence metadata, two-person admission and route review |

The legacy `/admin` remains available for existing platform operations. The new approval workspace
is separately linked as `Approvals` so its participant-admission purpose is not confused with global
legacy role administration.

## 5. Accessibility and disclosure rules

- native headings, sections, lists, labels, buttons and details/summary controls are used;
- operational errors use `role="alert"`; status messages use an `aria-live` region;
- all governed text inputs have visible labels;
- layouts collapse to one column without changing information order;
- keyboard focus retains the global high-contrast focus ring;
- evidence IDs/digests wrap instead of forcing horizontal loss; and
- no borrower PII, evidence assertion payload or credential is rendered by these pages.

PR-04 does not introduce a new export endpoint. Existing legacy export risks remain listed in the
implementation register. Later case/evidence exports must be watermarked and access-receipt logged.

## 6. Rollback and non-claims

The three UI routes can be hidden and the institution module flag returned to `off`. Existing PR-03
data remains retained. No migration or data rollback is required because PR-04 adds no database
model.

PR-04 does not claim:

- connector registration or certification;
- immutable object/document storage;
- a transaction case, room, settlement or authoritative-record workflow;
- enforcement on legacy Note/global data routes;
- live or production permission;
- external-provider or customer acceptance; or
- deployment.
