# @assurerail/api — AssureRail API

> **PRODUCT SCOPE AMENDED — 30 August 2026.** The canonical target is
> `docs/design/AssureRail_Generic_Transfer_Infrastructure_Scope.md`: provider-neutral DA/PTC
> infrastructure supporting conventional and authorised-tokenised modes. This application is the
> existing tokenised-DA/Note implementation and a candidate adapter/kernel source, not the complete
> generic product. Its AssurePool-tape, Note, issuer, trustee, HTS and DvP assumptions are not
> automatically valid for PTC or conventional routes. Do not add PTC by renaming the existing Note
> flow; follow the as-built disposition and staged migration in that scope before route work.

Current implementation began as a permissioned **tokenised-DA demo/application slice** and now lives
in the standalone AssureRail repository with its own DB, environment, containers, ports (**api
:3006**, web :3007), access management, screens and APIs. Its legacy demo path can consume an
optional **AssurePool tape profile** and mints/administers an object named the **AssurePool Note**.
That name and the
trustee-related demo code do not constitute PTC support; they are current-code facts to re-baseline,
not the generic intake or instrument contract.

## Current deployment/separation assumptions — not final corporate architecture

- The app already has its own database, environment, ports and access surface. Preserve that useful
  isolation while the final company, IP licence, funding and outsourcing structure is decided.
- The **current live-source coupling** is the AssurePool tape API over HTTP/2
  (`GET /v1/co-lending/pools/:id/tape.json`); that is one adapter, not the target Rail intake
  contract. Stage 1 adds provider-neutral file/API intake and provider-exit continuity.
- The current code does not reach into the AssureLocker database. Future integrations must also use
  versioned, authenticated contracts and retain enough signed evidence for Rail continuity.
- Segregation must be anchored on function, appointments, access, fees, decisions, reconciliation
  and incident accountability; a company or division label cannot provide it by itself.
- The current slice holds no ledger keys; a future token-service integration must use a separately
  certified provider contract. It is designed not to hold borrower
  PII (T2). Those controls must survive generalisation.

## Historical tokenised-DA build sequence
- **2a (done)** — scaffold + tape client with **independent integrity verification** (recompute
  `tapeHash` through the versioned provider-boundary profile; trust the math not the transport) + mint-readiness gate (lock must be
  CONFIRMED) + ring-fenced data model + own access management.
- **2b** — HTS adapter (DEMO; LIVE remains blocked) + mint gate (lock CONFIRMED + k-anon) → Note + MintLog.
- **2c** — surveillance mirror + optional evidence anchoring. **T4** — DvP + settlement-provider adapter. **T5** — e2e.

## Run (DEMO — standalone, no AssureLocker needed)
```bash
npm run build --workspace=@assurerail/api
npm test  --workspace=@assurerail/api      # tape integrity + mint-readiness
npm start --workspace=@assurerail/api      # http://localhost:3006
```

Runtime evidence is explicit: `ASSURERAIL_OPERATING_MODE` is one of `DEMO`, `REPLAY`, `SHADOW`,
`SANDBOX`, `CONTROLLED_LIVE`, or `PRODUCTION`. `NODE_ENV` only controls Node/framework optimisation.
The current container/Hetzner demonstration therefore runs `NODE_ENV=production` with
`ASSURERAIL_OPERATING_MODE=DEMO`. Every non-demo mode requires the persistent store and Firebase
auth; controlled-live/production additionally refuse demo routes/adapters, fail-soft reCAPTCHA and
insecure provider transport. `DEMO` refuses live adapters; `REPLAY` and `SHADOW` refuse live mutating
HTS/HCS/settlement adapters. `SANDBOX` is the pre-live mode for provider test-environment mutations.
See `src/runtime/runtime-profile.ts` and its executable tests.

### Neutral contract package (PR-01)

`src/contracts/v1` defines the provider-neutral DA/PTC transaction taxonomy, provenance envelopes,
strict canonical serialization, exact money/unit values, additive schema compatibility and
read-only AssurePool/AssureTransfer mappings. It is not imported by `AppModule`, creates no endpoint
or database write, and defaults to `ARAIL_NEUTRAL_TAXONOMY_V1=off`; the only other accepted flag
value is `read_only`. `DEMO` remains a runtime/test label and is intentionally invalid as canonical
transaction evidence. See `docs/design/AssureRail_Neutral_Contracts_v1.md`.

### Persistence and durable integration foundation (PR-02)

The Rail database now has additive provider/source, immutable intake/receipt, idempotency,
inbox/outbox, external-instruction/acknowledgement and migration-receipt records. Existing Note
lifecycle writes commit their legacy `EventLog`, billing event and a digest-bound `OutboxMessage` in
one Postgres transaction. This does not make the current external mint/settlement sequence safe; the
external-action saga remains PR-09/PR-11 work.

Webhook egress has three explicit modes: `legacy` (transitional in-process relay), `shadow` (durable
fanout records with network suppression) and `durable` (claimed jobs, exponential retry,
dead-letter/replay and stable delivery IDs). New endpoints are HTTPS/public-DNS checked at write and
connect time, challenge-verified, and use an HMAC secret held in HashiCorp Vault KV-v2; Postgres stores
only its opaque reference. The PR-02 migration disables every legacy subscription and clears its
plaintext secret, so it must be re-provisioned and verified. See
`docs/runbooks/AssureRail_PR02_Persistence_And_Relay.md`.

Run the disposable database evidence rehearsal (never a configured database):

```bash
npm run db:rehearse:pr02 --workspace=@assurerail/api
```

### Tokenised-DA representation adapter (PR-11)

The case-scoped PR-11 adapter links an existing legacy Note to a neutral DA/TOKENISED transaction
case and active authoritative-record declaration. The token is always a `MIRROR`; governed actions
are durable `OBSERVE_ONLY` instructions with authenticated observations and exact reconciliation.
It is off by default (`ARAIL_TOKENISED_DA_V1=off`), can be allow-listed only in `REPLAY`/`SHADOW`,
and exposes no external dispatch. Linked Notes are removed from the global legacy read/mutation
paths. See `docs/design/AssureRail_Tokenised_DA_Representation_PR11.md`.

Run its disposable database evidence rehearsal:

```bash
npm run db:rehearse:pr11 --workspace=@assurerail/api
```

### Controlled-pilot and production gate (PR-12)

`CONTROLLED_LIVE` and `PRODUCTION` no longer become valid merely because credentials and live
adapter names are present. They require an Ed25519-signed, expiring activation manifest bound to
the exact environment and Git build, a non-empty route/function/cohort allow-list, five distinct
approvers and the complete mode-specific readiness evidence set. External gates—including legal
permission, independent security review, connector certification, participant export and operating
acceptance—must reference independently reviewed external evidence; synthetic/demo/fixture records
cannot close them.

The database retains versioned readiness requirements, immutable independent decisions, the signed
activation proposal, a separate release approval and exact gate-decision bindings. Live startup
also requires `ARAIL_INTERNAL_RBAC_V1=enforce`; that mode disables legacy platform-admin bypasses
and verifies real, separated staff coverage. Every future mutating live command must call the
operational activation guard for its exact manifest capability ID. The implemented-live capability
registry is deliberately empty in PR-12, so even a correctly signed manifest cannot activate a
function absent from the build. Legacy mint, DvP, amortisation, closure, surveillance anchoring and
break-glass anchoring also reject `CONTROLLED_LIVE` and `PRODUCTION` directly. No live route is
enabled by PR-12 itself.

See `docs/design/AssureRail_Controlled_Pilot_And_Production_Gate_PR12.md` and
`docs/runbooks/AssureRail_PR12_Activation_And_Deployer_Handoff.md`. Run the disposable database
rehearsal with:

```bash
npm run db:rehearse:pr12 --workspace=@assurerail/api
```

### Permissioned primary commercial venue (PR-13)

PR-13 adds a case- and institution-scoped record layer for named opportunities, immutable term
versions, invitation grants, interest indications, RFQs, private negotiation messages and
maker-checker allocations. It is not an order book or execution venue: there is no anonymous
discovery, automatic matching, external solicitation, trade execution, settlement, issuance,
ownership mutation or connector dispatch.

The module defaults off. `ARAIL_PRIMARY_COMMERCIAL_V1=shadow` is accepted only in `REPLAY` or
`SHADOW`, and only when participant admission, neutral ingress and transaction cases are also in
shadow. Every action requires an active institution context, scoped human authority, applicable
route/function entitlement and step-up evidence. Publication and allocation are two-person
decisions. Exact amounts use canonical integer units; pricing values use canonical decimal strings.
No PR-13 capability is registered as implemented-live, and all external activation gates remain
open.

See `docs/design/AssureRail_Permissioned_Primary_Commercial_Venue_PR13.md` and
`docs/runbooks/AssureRail_PR13_Deployer_Handoff.md`. Run its disposable database rehearsal with:

```bash
npm run db:rehearse:pr13 --workspace=@assurerail/api
```

### Conventional secondary DA/PTC replay (PR-14)

PR-14 adds separate domestic conventional DA and PTC secondary route packs. A case-owning seller
can assemble an observation-only historic dossier covering the current holder, prior chain, seller
authority, transfer restrictions, executed document, notices/consents, cash and authoritative
record before/after evidence. PTC additionally requires trustee transaction-control evidence. Every
item must be current, case-scoped, provider-attributed and `VERIFIED`; unavailable evidence remains
an open gate.

The module defaults off. `ARAIL_CONVENTIONAL_SECONDARY_V1=shadow` is accepted only with the neutral
case and required saga foundation in a `REPLAY` or `SHADOW` runtime. It has no execute, settle,
register-update, token or dispatch endpoint. For PTC, the trustee conclusion and recordkeeper result
remain separate; disagreement creates a critical break. Rail never infers ownership from its own
projection, and no PR-14 capability is registered as implemented-live.

See `docs/design/AssureRail_Conventional_Secondary_DA_PTC_PR14.md` and
`docs/runbooks/AssureRail_PR14_Deployer_Handoff.md`. Run its disposable database rehearsal with:

```bash
npm run db:rehearse:pr14 --workspace=@assurerail/api
```

### Tokenised-DA connector and custody boundary (PR-15)

PR-15 builds the provider-neutral controlled-live command path around the PR-11 token mirror. A
two-person `TokenConnectorBinding` names the certified connector, custody institution/model,
external signing-key reference, signing-policy digest, supported actions and three independently
verified evidence objects: key custody, legal/finality analysis and operating acceptance. Private
keys are never stored by Rail.

Live commands remain case-, institution-, mandate-, entitlement-, function- and step-up-scoped.
They create a durable idempotent external instruction before egress. A restart-safe worker uses a
Vault-referenced HMAC credential and SSRF-protected HTTPS transport, accepts only a signed final
acknowledgement bound to the exact instruction and expected result, and leaves the representation
`BREAK_OPEN` until the existing supply/holdings/economics/authoritative-record reconciliation passes.
Ambiguous outcomes retry the same idempotency key; safe pause cancels only instructions proven not
to have been dispatched.

Cash/payment is not routed through the custody/token connector; it requires its own settlement
provider binding and saga. `ARAIL_TOKENISED_DA_V1=live` is syntactically available only with the fully enforced live
foundation and PR-12 activation manifest. The five candidate action IDs deliberately remain absent
from the implemented-live registry because independent external evidence is not yet available.
Therefore this commit cannot activate mint, transfer, payment, anchor or burn in any environment.
The deployment default remains `off`.

See `docs/design/AssureRail_Tokenised_DA_Live_Connector_And_Custody_PR15.md` and
`docs/runbooks/AssureRail_PR15_Deployer_Handoff.md`. Run the disposable structural rehearsal with:

```bash
npm run db:rehearse:pr15 --workspace=@assurerail/api
```

### Separate tokenised PTC shadow route (PR-16)

PR-16 adds a PTC/TOKENISED representation independently of the DA `Note`. It binds programme,
trust, class/tranche, trustee, assurance provider, subscription/allotment evidence and the
route-defined depository/RTA/register to a mirror-only token record. Fourteen external evidence
gates remain explicit and open when unavailable. Five issue/transfer/distribution/lifecycle/burn
plans are shadow records only; no external instruction or live capability is created.

`ARAIL_TOKENISED_PTC_V1=shadow` is accepted only in `REPLAY`/`SHADOW` with PR-10 replay and the
neutral saga foundation. It defaults `off`. See
`docs/design/AssureRail_Tokenised_PTC_Shadow_Route_PR16.md` and
`docs/runbooks/AssureRail_PR16_Deployer_Handoff.md`. Rehearse with:

```bash
npm run db:rehearse:pr16 --workspace=@assurerail/api
```

### Venue conduct, complaints and scale controls (PR-17)

PR-17 adds a shadow-only internal control plane for versioned conduct policy, immutable conflict/
related-party/fair-access/allocation/communications signals, review-required alerts,
investigation/legal hold, complaints, append-only corrections, maker-checker safe pauses/sanctions
and exact route/cohort capacity budgets. Outputs are evidence for human review, never autonomous
legal conclusions.

`ARAIL_VENUE_CONDUCT_V1=shadow` requires PR-13 commercial shadow, neutral transaction-case shadow
and OP-01 internal RBAC, and is accepted only in `REPLAY`/`SHADOW`. It defaults `off`; there is no
live value or live capability ID. See
`docs/design/AssureRail_Venue_Conduct_Complaints_And_Scale_PR17.md` and
`docs/runbooks/AssureRail_PR17_Deployer_Handoff.md`. Rehearse with:

```bash
npm run db:rehearse:pr17 --workspace=@assurerail/api
```

### Institution integration and developer centre (PR-19)

PR-19 adds shadow-only, institution-scoped contract documentation, synthetic conformance fixtures,
API-client credential-version metadata, connector conformance records, webhook challenge/replay and
delivery health, plus digest-bound integration exit export. Raw credentials and Vault references
are excluded from list and exit responses. `PASSED_SOFTWARE` never means certified or live.

`ARAIL_DEVELOPER_PORTAL_V1=shadow` requires participant admission, neutral ingress and durable
relay all in shadow, and is valid only in `REPLAY`/`SHADOW`. It defaults off and has no live
capability ID. See `docs/design/AssureRail_Integration_Developer_Experience_PR19.md` and rehearse
with:

```bash
npm run db:rehearse:pr19 --workspace=@assurerail/api
```

### Customer operations and commercial administration (PR-20)

PR-20 adds shadow-only contracts/customer acceptance, effective-dated rate cards, exact usage
metering, maker-checker statements and credits, implementation cohorts, service/SLA escalation,
operational reviews and a digest-bound customer evidence/data exit. Pricing is contract-scoped and
supports fixed, per-unit and notional-basis-point terms; the 30-bps conventional PTC and 50-bps
tokenised PTC examples are tests, not hard-coded defaults. Commercial records cannot mutate route
authority, evidence, ownership, reconciliation or completion.

`ARAIL_CUSTOMER_OPERATIONS_V1=shadow` requires PR-19 integration shadow, participant admission and
internal RBAC, and is valid only in `REPLAY`/`SHADOW`. It defaults off and has no live capability ID.
See `docs/design/AssureRail_Customer_Operations_And_Commercial_Admin_PR20.md` and rehearse with:

```bash
npm run db:rehearse:pr20 --workspace=@assurerail/api
```

### Endpoints
```
GET  /health
GET  /venue/tape/:poolId                       # fetch + independently verify a tape (2a)
POST /venue/mint/:poolId                       # k-anon gate → HTS mint → Note (2b)
GET  /venue/notes
POST /venue/notes/:id/surveillance/sync        # mirror + HCS-anchor cycles; Note→ACTIVE (2c)
GET  /venue/notes/:id/surveillance
POST /venue/notes/:id/dvp                       # atomic DvP (asset ↔ e₹ settlement) (T4)
GET  /venue/notes/:id/dvp | /holdings
POST /venue/notes/:id/break-glass              # regulator T2 access — anchored (T4)
POST /venue/demo/run/:poolId                    # ONE-CALL end-to-end: mint→surveillance→DvP (T5)
```
### One-call demo
```bash
curl -sX POST http://localhost:3006/venue/demo/run/POOL-DEMO-1 -H 'content-type: application/json' -d '{}'
# → mint → k-anon → 2 HCS-anchored surveillance cycles → Note ACTIVE → atomic DvP (30% sold, e₹) → holdings
```
`TAPE_SOURCE=live` plus `TAPE_PROVIDER_API_URL`, `TAPE_PROVIDER_API_KEY`,
`TAPE_PROVIDER_EXPECTED_ID` and `TAPE_PROVIDER_PUBLIC_KEYS_JSON` switches to the independently
signed, manifest-complete `assurepool.frozen-da-evidence/2.0` provider contract (HTTP/2 where
negotiated). AssurePool can be configured as one provider; Rail validates the schema, provider,
Ed25519 key/signature, nested digests, complete v2 manifest and aggregates before creating a
legacy-Note compatibility projection. The API and credential contract is not bound to AssureLocker.
`HTS_ADAPTER` / `HCS_ANCHOR` / `SETTLEMENT_ADAPTER=live` are gated until their provider-neutral
contracts, credentials, conformance evidence and deferred external smoke tests land. Unused
adapters remain `off` in controlled-live and production deployments.

## Next generic-infrastructure sequence

1. **Stage 1A:** adapt/extract existing institution, membership/SAML, maker-checker, evidence-case
   and connector-certification controls; add Rail-local participant, mandate, appointment and
   route-entitlement records.
2. **Stage 1B:** add a neutral transaction case/room and migrate the tested room currently under
   from the legacy co-lending service, preserving an AssurePool adapter and legacy compatibility.
3. **Stage 1C:** add neutral evidence/state/document/reconciliation/deadline services and replay one
   completed conventional DA and one completed conventional PTC.
4. Keep this Note/mint/DvP path behind the tokenised-representation adapter boundary throughout.

The detailed file disposition, migration rules, onboarding acceptance tests and rejected shortcuts
are in `docs/design/AssureRail_Generic_Transfer_Infrastructure_Scope.md` §§0.2–0.3 and 9.
