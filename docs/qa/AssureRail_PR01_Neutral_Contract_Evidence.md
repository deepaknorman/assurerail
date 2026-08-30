# AssureRail PR-01 neutral-contract evidence

**Executed:** 30 August 2026, Asia/Kolkata

**Branch:** `codex/assurerail-pr01-neutral-taxonomy`

**Latest mainline parent:** `220afb53b01d50a955b77e00b1ac8f4fccd3da78`

**Published PR-00 checkpoint:** `acc9d8b73d53202726190ce40ff9f778922ef364` (EX-23 record included)

**Implementation commit:** `8b0f7bef077028aae89453239bb3e3baa89e864b`

**Status:** implementation and local verification complete; freeze-gated publication not yet approved/logged

**Synthetic data only:** yes

## 1. Delivered boundary

PR-01 adds a read-only contract package at `apps/assurerail-api/src/contracts/v1`:

- versioned route, representation, transaction operating mode, lifecycle-leg, asset-class,
  evidence-result, reconciliation, function-performer, material-function, market/placement and
  source-authority taxonomies;
- provider-neutral institution and source references;
- intake, evidence, acknowledgement and event envelopes;
- a full transaction discriminator with route-pack and authoritative-record declaration;
- explicit signature absence, evidence qualifications, as-of/expiry and source authority;
- deterministic canonical serialization and SHA-256 digest;
- exact money and unit quantities with integer strings and explicit scales;
- an exact-version schema registry and additive-compatibility check;
- lossless JSON-wire comparison mappings for the current AssurePool DA tape and the current
  AssureTransfer receivables transaction/manifest; and
- an `ARAIL_NEUTRAL_TAXONOMY_V1=off|read_only` configuration contract.

The detailed code/design dictionary, selected decisions, rejected alternatives and PR-02 handoff are
in `docs/design/AssureRail_Neutral_Contracts_v1.md`.

## 2. Negative scope proved by inspection and gates

PR-01 does **not** add or change:

- an HTTP route or controller;
- an AppModule import;
- a database schema, migration, repository or write;
- a worker, inbox/outbox relay or external call;
- a legal route rule or function permission;
- participant onboarding or case authorisation;
- transaction-room runtime;
- matching, pricing, settlement, minting, issuance or register update;
- any existing AssurePool, AssureTransfer or tokenised-DA runtime behavior; or
- public website/customer copy.

The static invariant explicitly checks that the neutral package remains disconnected from AppModule
and that its only feature-flag states are off and read-only.

## 3. Acceptance evidence

| PR-01 acceptance statement | Evidence |
| --- | --- |
| No mandatory AssurePool, AssureLocker, IDBI, trustee, token or CLA field | Schema-neutrality test enumerates every required field and rejects the forbidden product/provider names. |
| Unknown or missing values fail closed | Taxonomy and schema tests reject missing representation, unknown values, `TRADITIONAL`, runtime-only `DEMO`, unknown top-level fields and unknown schema versions. |
| Version/digest/signature/provider/as-of/expiry/qualification explicit | Schema tests remove each mandatory provenance field, require a structured signature even when not provided, and bind a present signature to the digest selected by its declared scope. |
| Provider/source identity bound | Validator requires `source.providerInstitutionRef` to equal the envelope provider reference. |
| Digest integrity | Intake/event digest mismatch tests fail; canonical serialization is deterministic across object-key order. |
| Exact financial values | Tests reject floats, exponent notation, unsafe numbers, plus signs, leading zeroes and undeclared negative amounts. |
| Extension values controlled | `OTHER_APPROVED` market/placement/asset values fail without a named `extensionProfileRef`. |
| Legal-record authority not implied | `UNDECLARED` requires null declaration fields; `DECLARED` requires record type, recordkeeper and designation evidence. |
| Schema compatibility | Optional additions pass; removal, kind change, optional-to-required, enum narrowing and a new required field are classified breaking. |
| AssurePool mapping without loss | Test compares canonical JSON-wire bytes of the preserved source record with the original tape and binds its digest. |
| AssureTransfer mapping without loss | Test preserves the transaction plus manifest, binds tenant/transfer identity and records that it is evidence—not Rail case authority. |
| No runtime switch | `AppModule` has no contract-package import; flag parser accepts only `off`/`read_only`. |

## 4. Commands and results

### Focused type and test checks

```text
cd apps/assurerail-api && npm run typecheck
PASS — Prisma generation and TypeScript --noEmit

cd apps/assurerail-api && npm test
PASS — 85 tests, 0 failed, 0 skipped
      — 24 PR-01 contract/mapping tests
```

An intermediate run correctly failed one assertion because a missing `schemaVersion` returned the
more general non-empty-string diagnostic before a required-field diagnostic. The registry was made
more precise so it now records the required-field failure before returning; the full suite then
passed. This was test/diagnostic behavior, not a runtime regression.

### Full AssureRail gate

```text
bash scripts/assurerail-build-check.sh
PASS
```

The gate produced:

- shell syntax: pass;
- AssureRail Prisma schema validation: pass;
- PR-00 and PR-01 static invariants: pass;
- no-egress AssureRail API production build: pass;
- AssureRail API tests at the full-gate checkpoint: 80 pass, 0 fail, 0 skip;
- Transfer Room golden characterization: 26 pass;
- AssureRail Next.js production build: pass, 10 static routes;
- quick secret scan: no leaks; and
- report-first Semgrep: 0 findings.

Because the new branch had no remote tracking ref at the time of the gate, the quick gitleaks command
scanned repository history rather than a small outgoing range (5,661 commits, approximately 927.81
MB) and found no leak. The new untracked contract directory was therefore also scanned directly:

```text
gitleaks detect --source apps/assurerail-api/src/contracts/v1 --no-git ...
PASS — final scan approximately 69.27 KB, no leaks

semgrep scan <seven local rule packs> apps/assurerail-api/src/contracts/v1 \
  scripts/check-assurerail-invariants.mjs
PASS — 13 targets, 128 rules, 0 findings, approximately 100% parsed lines
```

`shellcheck` was not applicable: PR-01 edits no shell script. `bash -n` still passed the repository's
AssureRail shell gate.

After that full gate, final contract review tightened undefined handling at the canonical boundary,
calendar/time validation and the effective-date requirement for an approved route pack. The full
API build/test suite was rerun at the final state: 85 pass, 0 fail, 0 skip. The static invariant and
targeted secret/SAST scans were also rerun at the final state; the web and Transfer Room inputs were
unchanged from their successful full-gate runs.

## 5. Review notes and known limits

1. Canonical v1 is deliberately stricter than ordinary JSON. It allows safe integer JavaScript
   numbers for structural counters but requires exact decimal financial values as strings. It is
   not labelled as a complete RFC 8785 implementation.
2. Source-profile mappings carry full current JSON-wire source records to prove lossless comparison.
   PR-02 must decide encrypted object storage versus restricted references and must not copy
   unrestricted provider payloads into event rows.
3. `VERIFIED` proves only the declared evidence scope/method. A digest proves integrity, not truth,
   independence, authority, freshness or legal effect.
4. PR-01 validates signature structure, scope and digest binding but does not cryptographically
   verify a provider signature; authenticated ingress/trust-store verification remains PR-02+ work.
5. No current PTC source mapping exists because the repository has no existing PTC system contract.
   The first PTC shadow adapter must be designed with trustee/originator data rather than invented
   from the current tokenised-DA Note model.
6. For conventional PTC, the trustee remains the final AssureRail completion authority under the
   selected operating model. A depository/RTA may be the record source when the trustee designates
   it; those two roles remain separately recordable.
7. The detailed asset aliases, identifier registry, route packs, signature algorithms, evidence
   freshness and legal-record types still require the accountable domain/counsel/operations owners.
8. The shared worktree contains unrelated modified and untracked documents owned by other work.
   They were neither edited for PR-01 nor included in its intended commits.

## 6. Publication gate

PR-01 adds frozen product-code files even though they are runtime-inert. The product freeze therefore
requires a separately numbered, explicit founder exception before commit publication/push. No
exception should be inferred from EX-23, which is limited to PR-00.
