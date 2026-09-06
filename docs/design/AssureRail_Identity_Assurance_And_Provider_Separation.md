# AssureRail identity assurance and provider separation

**Status:** selected architecture and SEP-01 implementation record, 7 September 2026

## Decision

AssureRail requires attributable human identity for institutional membership and material actions,
but it does **not** require AssureLocker or DigiKYC. The platform owns authentication, sessions,
institution records, participant admission, membership, mandates, appointments, entitlements,
step-up and action authorisation. A deployment-selected identity provider supplies only a current
identity-evidence assertion through a provider-neutral HTTPS adapter.

This distinction matters:

| Control | Rail owner | External input |
|---|---|---|
| Login credential and session | AssureRail | Rail-specific Firebase/SSO identity token |
| Human identity evidence | AssureRail policy and binding record | Selected provider's subject, evidence reference, level and expiry |
| Institution KYB/admission | AssureRail governance | One or more signed provider/customer evidence snapshots |
| Membership and authority | AssureRail | Institution appointment/mandate evidence |
| Material action | AssureRail authorisation and step-up | Route/performer evidence where applicable |

Identity evidence cannot admit an institution, create membership, grant a mandate, approve a route
or authorise a transaction. Conversely, a verified email alone is insufficient for high-assurance
staff or participant authority.

## Provider contract

The deployment sets:

- `IDENTITY_ASSURANCE_ADAPTER=off|demo|live` (controlled-live and production require `live`);
- `IDENTITY_PROVIDER_KEY`;
- a distinct `IDENTITY_PROVIDER_API_URL`, credential, status path and timeout.

The authenticated request contains the normalised email and optional claimed subject. A successful
response must state `active: true` and a non-empty `subject`; it may also carry an `evidenceRef`,
`assuranceLevel` and `expiresAt`. Malformed, expired, mismatched, unavailable and unauthenticated
responses fail closed. Rail stores the provider key/subject reference, not the provider's underlying
identity dossier.

AssureLocker DigiKYC may be procured later only by implementing this same contract behind its own
scoped credentials. It receives no privileged code path, default endpoint, special header,
database access or admission power. An institution-selected identity service can be substituted
without changing the Rail domain model.

## Other product/provider boundaries

- AssurePool remains an optional DA source profile for the legacy Note adapter. Generic DA intake
  and all PTC intake use the neutral evidence/intake contracts; AssurePool is not a platform
  prerequisite.
- AssurePlane is an optional assurance provider when appointed by the trustee or other accountable
  party. It is not a Rail runtime, ownership or evidence-status dependency.
- AssureTransfer logic is not imported into the Rail runtime. Only explicitly neutral contracts and
  historical mapping semantics belong here.
- Rail has its own repository, packages, database/schema, containers, environment, secrets,
  signing key and target Azure workload identities. Provider interaction is over narrow versioned
  contracts, never shared source, shared database tables or shared production credentials.
- Anchor and settlement adapters have deployment-selected endpoints, paths and credentials. The
  previous hard-coded Plaza paths/default hosts have been removed. Plaza can be selected later as
  a provider through the same governed adapter boundary; it is not a hidden in-process component.
  An unused provider adapter is `off`; registering a future live capability must declare the exact
  adapters it requires.
- The branded online legacy-room proxy and its subject-mapping administration API are retired. Its
  flag is retained only as an `off`-only configuration tombstone, so stale attempts to enable it
  fail startup/release validation. Deterministic sealed legacy-room import remains an offline/data
  migration facility and creates no network dependency.

## Plaza organisational and technical boundary

The selected interim organisational home for Plaza is **AssureLocker Private Limited**. Plaza is a
separate AssureLocker product/service, not an AssureRail product, AssureRail-owned gateway or shared
library. AssureLocker may consume Plaza for KYC/KYB and related trust services. AssureRail may later
consume Plaza for an approved tokenised/HTS route. The AssureLocker--AssureRail MSA must contain a
specific Plaza services schedule before that consumption starts.

Organisational ownership does not collapse the technical boundary. Plaza is to run as a physically
separate deployable and security domain with its own runtime, datastore, workload identities,
service credentials, encryption/key scope, logs, backup/restore and release process. AssureLocker
and AssureRail are separate Plaza tenants and API clients. There is no shared database, shared
session, credential reuse, implicit cross-tenant trust or lateral application-network route between
the two consumers. Each consumer sees only purpose-limited results and its own request,
acknowledgement and audit records.

The Plaza MSA schedule must cover, at minimum:

- the exact APIs/functions and permitted purposes for each AssureRail route;
- tenant, data, identity, key, log and operator segregation;
- data minimisation, location, retention, return/deletion and legal-hold responsibilities;
- authentication, request signing, idempotency, finality classes and reconciliation;
- availability, support, RTO/RPO, capacity, incident notification and evidence retention;
- security assurance, audit/regulatory cooperation and approved subprocessors;
- arm's-length fees, service credits/liability, conflicts and related-party governance;
- version/change control, deprecation notice and tested business-continuity arrangements; and
- termination, export, transition assistance, portability and assignment/novation if Plaza is
  later transferred or spun out.

Plaza evidence or execution acknowledgements do not grant Rail admission, membership, mandates,
route entitlement, legal title or an assurance conclusion. They are inputs evaluated by the
relevant Rail route and authority controls. Conventional DA/PTC has no Plaza runtime dependency.
Tokenised routes remain disabled until their legal, provider, connector, custody/key, participant,
operational and external-evidence gates are satisfied.

Any later five-to-seven-node HashSphere/HTS topology sits behind the Plaza service boundary, not in
the AssureRail API or database. Its cloud/location design remains a later decision. AssureRail must
integrate through a versioned, replaceable provider contract and must not assume that those nodes
run on AssureRail's Azure estate.

## Compatibility and historical evidence

The already-applied PR-03 migration labelled certain imported legacy identity references
`ASSURELOCKER_DIGIKYC`. That immutable migration and its rehearsal assertion remain as historical
provenance; editing an applied migration would be unsafe and would falsify what was imported. New
bindings use the configured neutral provider key. Existing historical labels grant no admission,
membership, mandate or route authority and can be recertified through the new provider contract.

The `/venue/auth/onboard` request temporarily accepts the old `did` field as an alias for `subject`
so deployed clients do not break. The server ignores caller-selected providers: provider selection
is an operator-controlled deployment decision.

## Rejected approaches

- Removing identity assurance entirely. Authentication is not proof of institutional identity or
  authority and would weaken the maker-checker and privileged-action model.
- Treating a DigiKYC result as participant admission. Identity, institution and transaction powers
  are separate records and gates.
- Hard-coding AssureLocker as the first/default provider. That would recreate operational and exit
  dependency after repository separation.
- Copying any provider's KYC dossier into Rail by default. Rail retains the minimum reference and
  governed evidence needed for attribution, expiry and audit.
- Allowing the browser/caller to choose a provider. That creates downgrade and routing risk; the
  reviewed deployment configuration selects the provider.

## Activation gate

`demo` evidence is never production evidence. Before shadow use with real people, the provider
contract needs conformance, privacy/retention and failure-mode tests. Before controlled live, the
adapter must be `live`, use HTTPS and scoped secret-store credentials, and the provider evidence
must be included in authenticated two-tenant E2E, DAST and independent VAPT scope. No capability is
activated by this separation tranche.

## Separation assurance status

| Plane | SEP-01 result | Evidence still required before an unqualified production confirmation |
|---|---|---|
| Logical/code | Rail-owned identity, authority and database clients; no AssureLocker application import; branded online proxy retired | Re-run source/import and dependency scans on the signed release |
| API/network design | No AssureLocker or Plaza default host; optional provider contracts have distinct endpoint, path, credential and mode; Plaza is a separately deployed, tenant-isolated provider boundary | Approved egress allow-list, Plaza MSA/service schedule and authenticated provider conformance records |
| Physical Azure | Baseline requires distinct data, key, identity, backup and logging boundaries | Azure Hyderabad/Pune as-built resource inventory and policy/export evidence |
| Operational | Separate repository/signing/release controls; provider results never grant Rail authority | Named Rail operators, MSA boundaries, access review and incident/BCP rehearsal |
| Independent assurance | Local code/security/browser gates | Authenticated two-tenant E2E/DAST and external VAPT closure |

Accordingly, SEP-01 can prove code-level and configuration-level separation. “Complete physical
and network separation” becomes a production fact only after the as-built Azure and independent
test evidence in the last column exists; it must not be inferred from repository separation alone.
