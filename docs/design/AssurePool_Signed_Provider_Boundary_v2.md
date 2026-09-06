# AssurePool signed provider boundary v2

**Status:** implemented, feature-dark provider adapter; 7 September 2026
**Products:** AssurePool remains a DA tape-preparation product outside AssureRail. AssureRail is an
independent consumer.
**Purpose:** define the only supported live AssurePool-to-AssureRail evidence contract and preserve
the legal, logical, data and network separation between the products.

## Decision

AssurePool's original `tape.json` contract remains available as version `1.0` for existing callers,
but it is not accepted by AssureRail's live provider adapter. The old contract accumulated new
fields without changing its version and its manifest did not bind all of those fields. It is kept
for compatibility, not promoted into controlled-live evidence.

The replacement profile is `assurepool.frozen-da-evidence/2.0`. It is a signed evidence package,
not a shared library, database relationship, transaction instruction or authority grant.

## Provider package

The provider emits:

- a frozen DA tape whose v2 manifest binds every published loan field;
- representation-neutral `includedInTransferSet` terminology;
- exact integer amounts and basis points;
- PSL tag plus explicit evidence state, with a tag only when evidence is `VERIFIED`;
- interest-rate, product, state, resolution and structured encumbrance facts;
- aggregate reconciliation for value, inclusion, PSL, WAC coverage, product/state mix and
  restructured value;
- a point-in-time performance snapshot, its source cycle and result digest;
- tape, package and envelope payload digests; and
- an Ed25519 signature under a configured provider identity and fingerprinted key.

Borrower identity and raw borrower documents do not cross this boundary. AssurePool evidence does
not open, approve, settle or complete an AssureRail case.

### Performance coupling

The signed v2 package deliberately pins `DISBURSED_VALUE` performance semantics. At export time the
AssurePool service calls its persisted performance projection over the pool's stored bureau-cycle
history, records `sourceAsOfCycle`, and signs the resulting snapshot. Internal extraction or cycle
storage may evolve without changing this wire contract.

If AssurePool later wants to export the `OUTSTANDING_PREFERRED` basis ladder, it requires an explicit
new compatible profile/version and independent Rail conformance work. It must not silently place
new optional basis fields or different denominator semantics inside this v2 package.

## AssureRail validation

Rail independently parses the JSON and rejects it before use if any of these checks fail:

1. exact schema and enumerations, with missing and unknown fields rejected;
2. configured provider identity;
3. trusted key ID, derived again from the Ed25519 SPKI public key;
4. provider signature;
5. envelope payload, package, performance-result, tape and complete-manifest digests;
6. loan-row uniqueness, inclusion derivation and aggregate recomputation;
7. performance pool, generation-time and source-cycle consistency; or
8. source-lock count reconciliation.

In `CONTROLLED_LIVE` and `PRODUCTION`, the validator additionally requires a confirmed source lock
and, for every included exposure:

- `ELIGIBLE` or `WARNING` source verdict—an override alone cannot carry a failed or missing-evidence
  verdict into live operation;
- current `LIVE` encumbrance evidence;
- on-book and regulatory-reporting status both explicitly `ON_BOOK`;
- no cross-pool observation; and
- written-off and OTS flags explicitly clear.

These checks establish package integrity and minimum input fitness. They do not replace Rail's case,
mandate, route-pack, evidence, reconciliation or activation gates.

## Compatibility path

The current tokenised-Note demonstration still expects v1 field names such as `mintableMinor`.
After successful v2 verification, Rail creates an explicitly labelled in-memory compatibility
projection from `included*` to those legacy names. The original signed envelope remains the evidence
record and supplies its tape hash, manifest and provider receipts. The projection is not signed,
persisted as a provider assertion or treated as a general Rail domain.

The neutral intake mapper retains the complete signed source envelope inside the provider extension,
maps only provider-neutral summary fields, and marks its authority as `EVIDENTIARY`.

## Configuration and key operation

`TAPE_SOURCE=live` requires all of:

```text
TAPE_PROVIDER_API_URL=https://<approved-provider-host>
TAPE_PROVIDER_API_KEY=<least-privilege-secret>
TAPE_PROVIDER_TIMEOUT_MS=10000
TAPE_PROVIDER_MAX_RESPONSE_BYTES=52428800
TAPE_PROVIDER_EXPECTED_ID=<contracted-provider-id>
TAPE_PROVIDER_PUBLIC_KEYS_JSON={"<32-hex-key-id>":"<Ed25519 public PEM>"}
```

AssurePool holds only its private signing key. AssureRail holds only separately configured public
keys. Keys and credentials must come from the respective deployment secret stores; neither product
shares a runtime secret, database, internal hostname or source package.

Rail refuses redirects, non-JSON responses, responses over the configured limit and calls exceeding
the configured timeout before schema/signature processing.

Rotation is additive: install and verify the new public key in Rail, switch AssurePool signing to the
new private key/key ID, observe successful receipt, then remove the old public key after the agreed
verification and replay window. Historical envelopes retain the original key ID and signature.

## Activation posture

- demo continues to use deterministic local v1 fixtures and makes no provider call;
- replay/shadow may read real signed v2 evidence over HTTPS under NDA and participant authority;
- deployment leaves `TAPE_SOURCE=demo` or `off` unless the provider configuration is deliberately
  installed; and
- a successful provider-v2 test or deployment is not permission to activate any transaction,
  token, settlement or completion function.
