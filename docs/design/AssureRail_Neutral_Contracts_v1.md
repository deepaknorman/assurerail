# AssureRail neutral contracts v1

**Version:** 1.0.0

**Stage:** PR-01 contract package; read-only and not connected to runtime writes

**Product scope:** generic DA and PTC infrastructure, conventional or authorised-tokenised

**Legal posture:** data and interoperability vocabulary, not a legal opinion or permission to perform a function

**Code:** `apps/assurerail-api/src/contracts/v1`

## 1. Why this package exists

The current AssureRail application is a useful tokenised-DA slice whose intake, objects and labels
are coupled to an AssurePool tape, an AssurePool Note, HTS/HCS and a DvP demonstration. Separately,
the existing Transfer Room lives under the AssureCLA/co-lending application, and AssureTransfer is
an incomplete evidence/rules product for receivables transfers. None of those current filesystem
locations is the intended generic AssureRail contract.

PR-01 creates the common language required before persistence, onboarding or transaction-room
migration. It allows current products and future third-party systems to be mapped to one governed
shape without making any of them mandatory or silently treating a product result as Rail authority.

This package is deliberately inert:

- it is not imported by `AppModule`;
- it adds no endpoint, database model, migration, worker or external call;
- it cannot write, settle, mint, issue, match, complete or update a register;
- the feature flag defaults to `off` and accepts only `read_only`; and
- its mappings preserve current source records for comparison but do not change the current source
  or destination runtime.

PR-02 may use these contracts to design durable inbox/outbox and persistence. PR-03 and later stages
may use them for participant admission and transaction cases only after their own gates and approvals.

## 2. Decisions selected

### 2.1 Transaction route and representation are separate axes

Every transaction discriminator carries both:

- `transactionRoute = DA | PTC`; and
- `representation = CONVENTIONAL | TOKENISED`.

This produces four legitimate product modes without building four unrelated platforms. A PTC is not
inferred from the existence of a token, and a tokenised DA is not relabelled as securitisation. A
conventional transaction may still be fully digital, API-led and tamper-evident.

### 2.2 Demonstration is not transaction evidence

The PR-00 runtime profile supports `DEMO` so an isolated synthetic application can run honestly. The
canonical transaction operating-mode taxonomy does not. Its values are:

`REPLAY | SHADOW | SANDBOX | CONTROLLED_LIVE | PRODUCTION`.

An attempt to serialize `DEMO` in a neutral transaction envelope fails validation. This is an
intentional claim and evidence boundary: demonstration output cannot later be presented as shadow,
pilot or production transaction evidence merely because it has the same JSON shape.

### 2.3 Unknown is never converted to an apparently successful value

Unknown or missing taxonomy values fail validation. In particular:

- unknown evidence does not become `NOT_APPLICABLE`;
- an unknown source is `UNDECLARED`, not `AUTHORITATIVE`;
- an unknown reconciliation result does not become `MATCHED`;
- an unknown function assignment does not become `PARTICIPANT_OWNED`; and
- `OTHER_APPROVED` values require a future approved, versioned extension profile. They are not a
  catch-all for spelling differences or an unmapped provider value.

### 2.4 Evidence limitations are data, not prose outside the record

Every envelope contains all of the following explicitly:

- contract and schema version;
- provider and source-system identity;
- source object and source schema version;
- source/payload/content/response digest as applicable;
- `asOfAt`;
- `expiresAt`, including explicit `null` where no expiry is asserted;
- a qualifications array, including an explicit empty array; and
- a structured signature object.

Signature presence identifies exactly which digest is signed: source payload, neutral intake payload,
evidence content, acknowledgement response or event payload. A scope that does not apply to the
envelope, or a signed digest that differs from the scoped digest, fails validation. Signature
absence is represented as `NOT_PROVIDED` or `NOT_APPLICABLE`, with all signature-material
and scope fields set to `null`. Omitting the signature object fails validation. This preserves the difference
between a signed provider statement, an unsigned submission and a statement for which signatures do
not apply.

### 2.5 Exact financial values are strings plus an explicit scale

Money and quantities use integer strings for their smallest declared unit. They reject floats,
exponent notation, plus signs and leading zeroes. A value is therefore carried as, for example:

```json
{ "currency": "INR", "units": "125000", "scale": 2 }
```

This means INR 1,250.00 if the applicable profile declares scale 2. The contract never parses a
JavaScript floating-point rupee value and never infers scale from formatting. Negative values are
off by default and must be expressly enabled for a typed adjustment use case.

### 2.6 Current products are source profiles, not canonical dependencies

AssurePool and AssureTransfer mapping code places source-specific fields under:

```text
payload.extensions.profileId
payload.extensions.profileVersion
payload.extensions.sourceRecord
```

The provider-neutral normalized portion contains only common facts such as asset count, exact gross
amount and source digests. Tests compare canonical bytes of the preserved source record against the
original JSON-wire record.

AssurePool remains:

- DA-only;
- an optional tape/preparation source within AssureCLA;
- evidentiary, not the authoritative ownership record; and
- replaceable by a lender registry, LMS/LOS, trustee platform or another provider through the same
  neutral envelope.

AssureTransfer remains:

- an optional evidence/rules product for its scoped receivables-transfer facts;
- separate from AssurePool;
- unable by itself to open, authorise, settle or complete a Rail case; and
- represented by a mapping profile rather than moved into the Rail kernel in PR-01.

## 3. Decisions rejected or deferred

The following approaches were considered and explicitly not selected:

| Approach | Disposition and reason |
| --- | --- |
| Make the AssurePool tape the Rail canonical intake | Rejected. It would make a DA-only AssureCLA product mandatory, exclude PTC and frustrate lender/trustee/incumbent-system adoption. |
| Rename the current Note lifecycle as generic DA/PTC | Rejected. Note, mint, token, holder and HTS concepts belong to a representation adapter and cannot stand in for conventional DA or PTC. |
| Move all AssureTransfer logic into Rail immediately | Rejected. Its evidence/rule logic is separately usable and does not own transaction-case authority. Only its source mapping is added. |
| Treat `traditional` as a third representation value | Rejected. `CONVENTIONAL` includes digitally orchestrated non-token transactions; aliases must map at adapter boundaries, not expand the canonical enum. |
| Put `DEMO` in transaction operating modes | Rejected. Synthetic/demo execution must never be serialized as transaction evidence. |
| Permit `UNKNOWN` or arbitrary strings in governed enums | Rejected. Unknown and missing values fail closed; approved extensions require a new version/profile. |
| Use decimal numbers for money or token/certificate units | Rejected. Floating-point values cannot support watertight reconciliation. |
| Make a digital signature optional by omission | Rejected. The signature object is mandatory; absence has an explicit status and null material fields. |
| Require an AssureLocker, IDBI, trustee, token or CLA identifier | Rejected. Provider/source references are neutral. A named provider appears only in its adapter profile or transaction appointment. |
| Hard-code trustee, depository or token ledger as universal authority | Rejected. Authority is declared per case under the effective route pack and preserved in acknowledgements/reconciliation. |
| Turn the read-only flag into a write or enforcement switch | Deferred to later PRs. PR-01 has no persistence, ingress or authorisation boundary to operate safely. |

## 4. Governed taxonomies

All taxonomy registries use version `1.0.0`. Each term in code has a code, display label, definition,
governance owner and an allowed-transition list. An empty transition list means immutable
classification, not “any transition allowed.”

### 4.1 Core transaction classification

| Taxonomy | Values | Owner and important rule |
| --- | --- | --- |
| Transaction route | `DA`, `PTC` | Legal and compliance; immutable after the evidence-lock boundary. |
| Representation | `CONVENTIONAL`, `TOKENISED` | Legal and compliance; a token is only authoritative if the route pack and declared record say so. |
| Lifecycle leg | `INITIAL_TRANSFER_OR_ISSUE`, `SECONDARY_TRANSFER_OR_TRADE` | Legal and compliance; avoids pretending primary issuance and secondary trading have identical rules. |
| Market context | `DOMESTIC`, `IFSC`, `OTHER_APPROVED` | Domestic India is the selected first establishment; IFSC is not inferred from an address or provider. |
| Placement/listing | `BILATERAL`, `PRIVATE_PLACEMENT`, `LISTED`, `OTHER_APPROVED` | Legal and compliance; a route pack decides which combinations are supported. |

### 4.2 Asset class

V1 distinguishes:

`CORPORATE_LOAN`, `MSME_LOAN`, `RESIDENTIAL_MORTGAGE`,
`COMMERCIAL_REAL_ESTATE_LOAN`, `VEHICLE_LOAN`, `GOLD_LOAN`, `MICROFINANCE_LOAN`,
`CONSUMER_LOAN`, `EDUCATION_LOAN`, `CREDIT_CARD_RECEIVABLE`, `TRADE_RECEIVABLE`,
`LEASE_RECEIVABLE`, and `OTHER_APPROVED_EXPOSURE`.

These values classify; they do not assert eligibility for DA, securitisation, listing or a particular
investor. Product subtypes, secured/unsecured attributes, obligor sectors and regulatory exclusions
belong in governed route/asset profiles rather than being inferred from this high-level code.

### 4.3 Evidence result

| Code | Meaning |
| --- | --- |
| `VERIFIED` | Every check declared in the exact evidence scope completed successfully using the stated method. |
| `PARTIALLY_VERIFIED` | Only a named subset completed; at least one qualification is required. |
| `UNVERIFIED` | Material exists but the declared verification did not complete. |
| `FAILED` | A declared check returned an adverse result. |
| `EXPIRED` | Evidence is beyond its explicit validity or applicable freshness policy. |
| `NOT_APPLICABLE` | A governed rule determined the evidence is outside this exact scope; absence cannot earn it. |
| `REVIEW_REQUIRED` | No safe result is possible without an authorised review or approved rule release. |

Evidence records are immutable. A later result supersedes with a new evidence/version record rather
than mutating `FAILED` or `EXPIRED` into `VERIFIED`.

### 4.4 Reconciliation state

The selected state sequence is:

```text
PENDING -> MATCHED
PENDING -> BREAK_OPEN -> REPAIR_IN_PROGRESS -> RESOLVED
MATCHED -> BREAK_OPEN
RESOLVED -> BREAK_OPEN    # a later contradiction reopens the break
```

`RESOLVED` remains distinct from `MATCHED` so repair history cannot be erased. Unsupported jumps are
rejected by the transition helper.

### 4.5 Function performer

Every material function can be assigned one of:

- `OWNED_AUTHORISED`;
- `LICENSED_PARTNER`;
- `PARTICIPANT_OWNED`;
- `EXTERNAL_AUTHORITY`; or
- `PROHIBITED`.

The material-function catalogue covers participant and asset admission, disclosure, term display,
solicitation, recommendation/ranking, quote invitation, negotiation, matching, allocation,
execution, issuance/allotment, clearing, cash settlement, authoritative-register update, custody,
secondary transfer/trading, lifecycle calculation, surveillance, complaints, default handling and
regulatory reporting.

This is the practical answer to organisational separation: a company or division boundary alone
does not allocate regulated functions. The case must say who performs each act, under what authority,
for what effective period, and with which evidence. `PROHIBITED` must ultimately disable the API and
UI path; PR-01 records the vocabulary but does not yet enforce it at runtime.

### 4.6 Source authority

| Code | Treatment |
| --- | --- |
| `AUTHORITATIVE` | The approved legal/operative source of truth for the scoped fact. |
| `EVIDENTIARY` | Contributes evidence but does not create or conclusively determine the operative result. |
| `RECONCILED_MIRROR` | A copy explicitly reconciled to the authoritative source. |
| `UNDECLARED` | No authority classification is approved; it cannot be treated as operative or matched. |

For conventional PTC, the selected operating rule remains that the trustee's determination is final
for AssureRail. If the trustee directs Rail to a depository/RTA record, the depository/RTA may be the
declared record source while the trustee's designation and acknowledgement remain the completion
authority evidence. The neutral contract can represent both; it does not flatten them into one role.

## 5. Transaction discriminator

Every neutral intake carries:

```text
transactionRoute
representation
jurisdiction
marketContext
placementOrListing
lifecycleLeg
assetClass
operatingMode
extensionProfileRef
routePack { routePackId, version, status, effectiveAt }
legalRecord { status, recordType, recordkeeperInstitutionRef, designationEvidenceRef }
```

`extensionProfileRef` is mandatory whenever market context, placement/listing or asset class uses an
`OTHER_APPROVED` value; otherwise it is explicit `null` or a named approved refinement profile.
`routePack.status` is `REVIEW_PENDING` or `APPROVED`. This status is explicit so a technical schema
cannot masquerade as approved legal logic; `APPROVED` also requires `effectiveAt`. `legalRecord.status = UNDECLARED` requires the other legal
record fields to be null. `DECLARED` requires all of them, including the evidence that appointed or
designated the recordkeeper.

## 6. Common envelope provenance

All four envelope types share:

| Field | Purpose |
| --- | --- |
| `envelopeId` | Stable identity for this exact envelope. |
| `envelopeType` | `INTAKE`, `EVIDENCE`, `ACKNOWLEDGEMENT` or `EVENT`. |
| `contractVersion` | Version of the neutral contract semantics. |
| `schemaId`, `schemaVersion` | Exact registered schema used to validate the envelope. |
| `transactionCaseId` | Stable Rail case reference; not a pool ID or source-system ID. |
| `provider` | Neutral institution reference, institution kind, jurisdiction and zero or more declared identifiers. |
| `source` | Provider, source system/object, source schema, source payload digest and authority class. |
| `asOfAt` | Date/instant to which the represented facts apply. |
| `expiresAt` | Explicit UTC/date expiry or explicit `null`. |
| `qualifications` | Structured limitations/exceptions, even when the array is empty. |
| `signature` | Explicit present/absent/not-applicable state plus signed scope and digest when present. |

The source provider reference must equal the envelope provider reference. V1 rejects unknown
top-level fields so a typo cannot silently weaken provenance. Future additive optional fields require
a new registered version.

## 7. Envelope-specific contracts

### 7.1 Intake

Adds an idempotency key, receipt time, transaction discriminator, canonical payload and payload
digest. PR-01 computes and validates the digest but does not persist or deduplicate it; PR-02 owns
durable idempotency and inbox semantics.

### 7.2 Evidence

Adds evidence type, exact subject/claim/time scope, evidence result, provider-independence class,
restricted content reference and content digest. Independence values distinguish independent
appointment, disclosed related party, participant-supplied evidence, authority source and not-yet-
assessed. `PARTIALLY_VERIFIED` without a qualification fails validation.

This supports the trustee-led assurance decision. AssurePlane may be an appointed provider, another
firm may be appointed, or the trustee may use its own permitted process. The schema does not require
AssurePlane or AssureLocker.

### 7.3 Acknowledgement

Adds instruction ID, provider status, finality, occurrence time, external reference, reconciliation
state and response digest. An acknowledgement is not automatically completion. Route rules must say
which provider/status/finality/evidence combination can satisfy a leg.

### 7.4 Event

Adds event type, occurred/observed times, causation/correlation, performer/authority references,
canonical payload and digest. It is suitable for an inbox/outbox in PR-02 but does not itself create
durable or exactly-once delivery in PR-01.

## 8. Canonical serialization and digest rules

The serializer:

- sorts object keys recursively by their JavaScript/UTF-16 string order;
- emits no insignificant whitespace;
- accepts null, booleans, strings, safe integer numbers, arrays and plain objects;
- rejects fractional, unsafe, non-finite and negative-zero numbers;
- rejects BigInt and requires exact integers to be decimal strings;
- rejects Dates, class instances, functions, symbols, cycles and undefined array entries; and
- omits undefined object properties only in the explicit JSON-source conversion step, matching what
  can actually cross a JSON interface.

Digests are lowercase `sha256:<64 hex>` over UTF-8 canonical bytes. This is an AssureRail v1
canonical contract, not an unqualified claim of full RFC 8785 implementation. A future algorithm
change requires a new contract/schema version; it cannot silently change stored digests.

## 9. Schema evolution rules

The registry is exact by `schemaId@version`. Unknown schemas fail closed. Within an additive line:

- an optional field may be added;
- an existing field may not be removed;
- field kind may not change;
- optional may not become required;
- existing enum values may not be removed; and
- a new required field is breaking.

The compatibility checker reports each breaking reason. This is structural compatibility only;
semantic changes to a definition, authority or digest rule still require governance and a version.

## 10. Read-only flag and operating procedure

`ARAIL_NEUTRAL_TAXONOMY_V1` accepts:

| Value | Meaning |
| --- | --- |
| `off` | Default. No adopter should rely on neutral mappings from runtime. |
| `read_only` | May serialize, compare and produce migration evidence; may not write canonical rows, enforce a gate or trigger an external action. |

Values such as `true`, `write`, `enforce` and `live` are invalid and resolve fail-closed to `off` with
an error. There is no AppModule integration in PR-01, so even `read_only` currently documents and
tests the only permitted adoption posture rather than activating an API.

## 11. Mapping guarantees and limits

### AssurePool mapping

- route is DA because AssurePool is DA-only;
- representation, asset class, jurisdiction and operating context must be supplied by the Rail case
  context rather than inferred from the tape;
- the tape is classified `EVIDENTIARY`;
- its exclusions are retained as an explicit qualification; and
- the complete JSON-wire tape is preserved in the source-profile extension.

### AssureTransfer mapping

- route is DA and asset class is trade receivable because the current profile is the receipts-
  transfer contract;
- transaction and manifest tenant/transfer identities must match;
- exact face amounts are summed with integers;
- the source is `EVIDENTIARY`; and
- a standing qualification says the product cannot open, settle, complete or authorise the case.

No adapter currently maps PTC because there is no existing PTC product/system contract in the code.
That is an honest gap, not a missing alias. The first conventional PTC shadow design must add a new
provider profile against the trustee/originator source records while leaving the neutral envelope
unchanged where possible.

## 12. Security, privacy and claims controls

- Fixtures contain synthetic identifiers only.
- The contract can carry identifiers, but an adapter must still apply data-classification,
  minimisation, access and retention rules before persistence.
- Source records are included in PR-01 mappings only to prove lossless read-only compatibility. PR-02
  must decide encrypted object storage versus restricted references; it must not indiscriminately
  put full provider payloads in an event row.
- A digest proves byte integrity under the declared algorithm; it does not prove truth, authority,
  signature, freshness, independence or legal effect.
- PR-01 validates that signature metadata is complete and bound to the declared digest; it does not
  cryptographically verify provider signatures. Provider trust stores, algorithms, revocation and
  verification receipts belong to authenticated ingress in PR-02 and later connector certification.
- `VERIFIED` is scoped to named checks and methods. It is not a general transaction approval.
- `TOKENISED` describes a representation, not legal title, custody, settlement finality or regulatory
  permission.

## 13. Verification matrix

| Requirement | Executable evidence |
| --- | --- |
| Every taxonomy term has metadata and valid transitions | `taxonomy.test.ts` |
| Missing, unknown and `DEMO` transaction values fail | `taxonomy.test.ts`, `schema-registry.test.ts` |
| Deterministic canonical bytes and digests | `canonical.test.ts` |
| Unsafe/lossy JavaScript values rejected | `canonical.test.ts` |
| Exact money/quantity validation | `canonical.test.ts` |
| Explicit signature, expiry, qualifications and version | `schema-registry.test.ts` |
| All four neutral envelope schemas validate | `schema-registry.test.ts` |
| Additive compatibility and breaking-change detection | `schema-registry.test.ts` |
| No named product/provider/token/trustee field is mandatory | `schema-registry.test.ts` |
| AssurePool JSON-wire record preserved | `mappings.test.ts` |
| AssureTransfer transaction/manifest preserved and identity-bound | `mappings.test.ts` |
| Flag is off/read-only only | `mappings.test.ts` |

## 14. Handoff to PR-02

PR-02 must not reinterpret PR-01 as permission to turn the mapped payload into live truth. It must
add, at minimum:

1. additive Rail-owned persistence for submissions, receipts, idempotency, inbox/outbox,
   instructions and acknowledgements;
2. tenant and future case-ownership keys on every neutral row;
3. authenticated provider submission and webhook verification;
4. duplicate/replay handling under database constraints and locks;
5. encrypted/restricted source-payload storage with retention and export rules;
6. durable relay with backoff, dead letter and operator replay;
7. SSRF-safe outbound connectors and vault references; and
8. comparison-mode evidence showing current reads/writes remain unchanged.

PR-02 must remain behind its own shadow/cohort flags. It may not claim that an acknowledgement is
completion, that a mirror is authoritative, or that schema-valid evidence is verified.

## 15. Unresolved governance inputs

Before a controlled-live route, accountable owners still need to ratify:

- detailed asset/product sub-taxonomies and aliases from lender registries;
- route-specific authoritative record types for conventional DA;
- the PTC trustee/depository/RTA acknowledgement and exception protocol;
- effective DA and PTC route packs, including primary and secondary legs;
- which material functions are owned, partner-performed, participant-owned, external or prohibited;
- approved identifier schemes and jurisdiction codes;
- signature algorithms, trust anchors, key rotation and revocation;
- evidence freshness/expiry by type;
- currency/unit registries and scale rules; and
- source-payload storage, PII minimisation, retention and provider-exit procedure.

Until those are approved, the neutral contracts are useful for mapping, comparison and design—but
not evidence that AssureRail may perform a regulated act or that a live transaction is complete.
