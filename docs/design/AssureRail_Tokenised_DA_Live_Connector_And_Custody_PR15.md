# AssureRail tokenised-DA live connector and custody boundary — PR-15 as built

**Status:** implemented for review; not deployed; external actions remain unactivatable

**Date:** 2 September 2026

**Authority:** EX-27

## 1. Outcome

PR-15 builds the controlled-live command boundary around the PR-11 tokenised DA mirror without
making a token, Note or Rail database the legal record. It separates five facts that must never be
collapsed:

1. the case owner is authorised to request a governed token action;
2. a named custody institution is assigned the `CUSTODY` function for that case;
3. a certified provider connector performs the external instruction;
4. an authenticated provider acknowledgement describes the technical outcome; and
5. a later reconciliation proves token supply/positions, economics and the route-defined
   authoritative record agree.

The code path is complete but dormant. Independent connector, custody, legal/finality, operating,
security and pilot evidence does not exist in this repository and is not replaced with synthetic
fixtures. Candidate capability IDs therefore remain outside the implemented-live registry.

## 2. Selected design

- `TokenConnectorBinding` is versioned, proposed and independently reviewed.
- The binding names connector registration/certification, custody institution/model, external
  signing-key reference, signing-policy digest, supported actions and evidence object/version
  digests.
- Rail stores no token private key, seed or signing secret. Connector authentication is read at
  dispatch time from a constrained Vault KV-v2 reference.
- Every command first passes institution membership/mandate, route entitlement, case function,
  step-up and exact PR-12 capability checks.
- Command preparation atomically creates `ExternalInstruction`, `TokenAction`, audit and durable
  event evidence before network egress.
- A database worker claims due instructions with `FOR UPDATE SKIP LOCKED`, preserves the same
  provider idempotency key across retries and reclaims stale leases after a process failure.
- Egress permits HTTPS only, rejects redirects, bounds responses and blocks private, loopback,
  link-local, metadata and rebinding destinations.
- The provider HMAC covers instruction ID, timestamp and canonical request bytes. Its response HMAC
  covers the canonical acknowledgement fields.
- Only `SUCCEEDED + FINAL` acknowledgements bound to the exact instruction request digest and
  expected-action digest are recorded as observations.
- Even a valid final acknowledgement sets the representation to `BREAK_OPEN`; the pre-existing
  PR-11 reconciliation must subsequently prove supply, positions, economics and authoritative
  record before another action is possible.
- Safe pause cancels only `PENDING` instructions. `DISPATCHING` or `AMBIGUOUS` instructions remain
  explicit breaks because Rail cannot safely assume that no external mutation occurred.

## 3. Candidate capabilities and activation state

The code assigns distinct candidate IDs:

```text
assurerail.da.token.mint.v1
assurerail.da.token.transfer.v1
assurerail.da.token.anchor.v1
assurerail.da.token.amortise-burn.v1
assurerail.da.token.close-burn.v1
```

None is in `IMPLEMENTED_LIVE_CAPABILITY_IDS`. This is deliberate. The PR-12 guard therefore rejects
all five before an instruction can be created. Payment is explicitly excluded from this custody/
token connector and must use a separately certified settlement connector and saga. Adding an ID later requires a separately reviewed
change after the corresponding external gates below close; a manifest may narrow an implemented
set but cannot make a missing ID executable.

## 4. External evidence gates left open

For each proposed connector/network/custody route:

- independent connector conformance, timeout/duplicate/ambiguous-success and finality tests;
- custody appointment and authority, key-generation ceremony, HSM/MPC policy, quorum, rotation,
  recovery, compromise and revocation evidence;
- route-specific counsel conclusion on token legal effect, legal record and correction/reversal;
- payment finality and reversal evidence for the payment capability;
- authoritative recordkeeper/trustee operating acceptance and reconciliation procedure;
- independent penetration/security review and remediation closure;
- participant-authorised controlled-pilot evidence, incident/BCP/DR rehearsal and signed operating
  acceptance; and
- PR-12 mode-specific gate decisions and activation manifest for the exact build/environment/
  capability/cohort.

Synthetic fixtures can prove schema and software behaviour only. They cannot close any item above.

## 5. Runtime and API

Replay remains:

```text
ARAIL_TOKENISED_DA_V1=allow_list
ARAIL_TRANSACTION_CASE_V1=shadow
ASSURERAIL_OPERATING_MODE=REPLAY|SHADOW
```

The future connector path requires `ARAIL_TOKENISED_DA_V1=live`, enforced admission/ingress/
entitlements/internal RBAC, transaction cases `on`, durable relay, required saga, live runtime and
an exact PR-12 activation. Current registry state makes this deliberately non-activatable.

Case-scoped connector endpoints list/propose/review/safe-pause bindings and prepare a live action.
No callback accepts an unauthenticated body-supplied authority. Provider responses are consumed by
the signed synchronous connector exchange and retained as external acknowledgements.

## 6. Failure and recovery rules

- no instruction exists if capability/authority/evidence checks fail;
- no network call occurs until a durable worker claim exists;
- timeout, transport error, malformed response, bad signature or uncertain result becomes
  `AMBIGUOUS` and retries the same instruction/idempotency key;
- eight unsuccessful attempts become `FAILED`, with the token representation still blocked;
- a valid observation still needs full reconciliation;
- a binding expiry, suspension, provider suspension, certification expiry or activation revocation
  prevents dispatch; and
- confirmed external state is never reversed by rolling back a database or migration.

## 7. Rejected shortcuts

- storing a private signing key in Rail or an environment variable;
- treating `CERTIFIED_LIVE`, a provider claim or an internal fixture as independent evidence;
- adding capability IDs to the live registry before the external gates close;
- accepting empty/non-final/unsigned acknowledgements;
- treating retry as a new instruction;
- cancelling an ambiguous instruction as if it never reached the provider;
- allowing a second action before reconciliation; or
- changing `authorityMode` from `MIRROR` merely because a connector succeeds.

## 8. Verification boundary

Internal tests cover acknowledgement binding/tamper, candidate capability separation, runtime
invariants, durable worker/egress/Vault boundaries, additive schema and migration properties. The
disposable database rehearsal applies all migrations, binds an observe-only action to a synthetic
connector record, proves restrictive history, schema parity and backup/restore. It executes no
external mutation and claims no external evidence.
