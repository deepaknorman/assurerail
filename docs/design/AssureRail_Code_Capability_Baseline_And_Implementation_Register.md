# AssureRail code/capability baseline and implementation register

**Status:** internal engineering execution baseline, 30 August 2026
**Repository baseline:** deep inventory at `ad99675dec6a3c2148de9eca97d9a0891cd02b54`;
refreshed and verified through `220afb53b01d50a955b77e00b1ac8f4fccd3da78` (`origin/main` on
30 August 2026)
**Controlling product scope:** `docs/design/AssureRail_Generic_Transfer_Infrastructure_Scope.md`
**Purpose:** convert the agreed AssureRail product boundary into a code-level disposition and a
dependency-ordered implementation programme. This document is not public copy, a regulatory
opinion, launch approval, or an assertion that any live route is currently available.

---

## 1. Outcome and non-negotiable decisions

This audit supports an additive, strangler-style build. AssureRail already contains useful
security, audit, exact-value, lifecycle, adapter and operations code, but its current primary domain
is a tokenised `Note` demonstration sourced from an AssurePool tape. It is not yet generic DA/PTC
infrastructure, and it is not safe to obtain that result by renaming the existing models.

The following decisions are binding for implementation:

1. **AssureRail is the end-to-end transaction infrastructure.** Its target covers DA and PTC,
   conventional and authorised-tokenised representations, primary completion/issuance, lifecycle,
   and eventually permitted discovery, term display, RFQ/negotiation, matching and secondary
   transfer/trading.
2. **Domestic India is the initial establishment.** GIFT IFSC is a later, separately researched and
   gated expansion. Old IFSC discussion is retained as decision history, not the current launch
   choice.
3. **Conventional DA and conventional PTC proceed in parallel shadow workstreams.** Neither is
   treated as an afterthought or as a renamed token flow.
4. **AssurePool remains a DA-only tape-preparation product in the AssureCLA suite.** It performs pool
   selection, evaluation, freeze, manifest/tape preparation and source-side evidence. It does not
   become a PTC product, venue, matching system, settlement system or token registry.
5. **The phrase “tokenised AssurePool DA demonstration” is rejected.** The code is an AssureRail
   tokenised-DA demonstration slice whose current sample/source contract is an AssurePool tape.
   AssurePool does not own tokenisation.
6. **AssureTransfer remains parallel product logic, not the Rail kernel and not part of AssurePool.**
   Its receivables-transfer rules/evidence logic remain product-specific; its final suite placement
   remains open. Neutral manifest, provenance, PII and state-machine primitives may be extracted
   only when there is a genuine second consumer.
7. **The transfer/diligence room moves to AssureRail runtime ownership.** Its invitation, declaration,
   least-disclosure, manifest-drift, access-chain, dossier and Q&A controls are retained. Its current
   `poolId`/CLA persistence is replaced by a neutral `transactionCaseId`, with an AssurePool source
   adapter and reversible legacy compatibility.
8. **Institutional onboarding is a first-class Rail capability.** Individual DigiKYC activation and
   manually assigned global roles are not institutional admission. Rail needs institutions,
   memberships, mandates, appointments, route entitlements, limits, connector certification,
   suspension/revocation and maker-checker control.
9. **Identity, KYB and assurance providers are provider-neutral.** AssureLocker/AssureCLA services may
   be used through adapters, but are not a compulsory runtime dependency and receive no privileged
   evidence status. A lender may supply a common registry/data feed. IDBI Trusteeship may be an early
   co-design/pilot integration and its people may help define a mapping, but the resulting contract
   must remain portable to other trustees and providers.
10. **PTC assurance is arranged by the trustee or other accountable appointing party.** The provider
    may be AssurePlane or someone else; it may not use AssureLocker. Rail validates the signed,
    scoped evidence object and appointment without marking its own transaction.
11. **AssurePlane—not “AssureLocker assurance”—is the assurance product under the AssureCLA suite.**
    Product names and code ownership must preserve this correction.
12. **For PTC, the trustee is the final transaction-control authority in the Rail workflow.** The
    legally operative record remains the route-defined depository/RTA/register where applicable.
    If the trustee relies on the depository, Rail records both the trustee decision and referenced
    external acknowledgement. Disagreement is a blocking reconciliation break.
13. **Full-stack matching is the destination, not the first live permission assumption.** Bilateral
    or externally arranged orchestration is the lower-perimeter initial mode and remains supported.
    Discovery/matching and secondary trading are added only through function-by-function route packs
    and licensed/authorised performer assignments.
14. **A separate AssureRail company can have real legal and organisational benefits, but a label does
    not solve the risk.** The company/IP/funding/outsourcing structure remains open until supported by
    substance: decision rights, people, keys, data, contracts, capital, controls, audit, incident
    accountability and related-party terms. Fixed-fee pricing is not the only potential benefit and
    not a substitute for those controls.
15. **Production means the highest assurance grade, not a configuration name.** No route is
    production merely because a feature flag says `production`, an API works, or a demo adapter is
    disabled. Production requires evidence-backed accuracy, independent reconciliation, operational
    segregation, counsel/permission gates, recovery tests and signed operating acceptance.
16. **No unsupported “tenfold in six years” public claim.** The strategic goal of serving MSME supply
    chain credit remains valid, and approximately 9% historic trade-receivables transfer incidence
    may be an internal economics assumption if sourced and qualified, but neither figure is a product
    capability or an unqualified public fact.
17. **Narrative changes are out of scope for this implementation pass.** Copy, decks, articles and web
    pages should change only where a current statement is materially false, unsafe or likely to cause
    a customer to misunderstand available capability. Engineering capability, SOPs, pilots,
    resourcing, costs, licences and fundraising evidence take priority.

### 1.1 Deliberately rejected implementation shortcuts

The following approaches must not appear in a pull request without an explicit reversal:

- rename `Note` to `PTC` and treat the existing mint/DvP flow as PTC support;
- add `PTC_DATA_ROOM` to an enum and claim a PTC venue exists;
- move AssurePool itself into AssureRail or expand AssurePool to PTC;
- treat an AssureLocker DigiKYC DID, entity badge or global role as route admission;
- require a customer to buy AssureLocker, AssurePool, AssureTransfer or AssurePlane to use Rail;
- hard-code IDBI Trusteeship, AssureLocker or AssurePlane into the canonical intake/evidence schema;
- make the Rail database, a token, or an email from a trustee the legal source of ownership without
  the approved route pack and authoritative-register acknowledgement;
- copy the central entity/onboarding code wholesale and create two divergent identity systems;
- dual-write legacy and Rail rooms without idempotency, reconciliation and a repair queue;
- rewrite imported evidence/access history so it looks Rail-native;
- expose matching, distribution, solicitation or secondary trading before the performer, licence,
  conduct and operating gates for that function are approved; or
- call demo, replay, sandbox or shadow activity “live” or “production”.

---

## 2. Audit method and classification

The audit inspected the current `origin/main`, the canonical scope document, Rail API/web
applications and schema, AssurePool, the co-lending transfer room, AssureTransfer shared/API/worker
code, CLA onboarding, central entity/membership capability, connector utilities and relevant tests.
Unrelated modified files in the shared working tree were not altered or treated as this audit's work.

Disposition codes used below:

| Code | Meaning |
|---|---|
| `KEEP` | Sound capability remains in its current product and needs no ownership change |
| `ADAPT` | Keep implementation, but add neutral ownership, scope, policy or interface |
| `EXTRACT` | Move only a genuinely reusable primitive behind a neutral contract |
| `MOVE` | Migrate runtime ownership/data/API to Rail with compatibility and rollback |
| `COMPAT` | Retain temporarily as an adapter/proxy/alias while consumers migrate |
| `NEW` | Capability is materially absent and must be designed/built |
| `RETIRE` | Stop new use after parity/cutover; preserve historical evidence |
| `BLOCK` | Existing behaviour must not reach controlled live/production without correction |

An item may have more than one code, for example `ADAPT/BLOCK` when code is reusable but unsafe for
production in its current form.

---

## 3. Current AssureRail runtime inventory

### 3.1 Application topology

| Component | Current fact | Disposition |
|---|---|---|
| `apps/assurerail` | Separate Next.js web app with landing, login, individual onboarding, Note console, activity, admin and settings | `ADAPT`; retain shell/security UX, add institution/case/route workspaces; keep current Note console as token-adapter console during migration |
| `apps/assurerail-api` | Separate NestJS API, own Prisma client/database, optional DB-mode auth/security/platform modules and in-memory demo mode | `ADAPT`; this remains the Rail runtime, with a new neutral domain alongside legacy Note modules |
| `apps/assurerail-api/prisma` | Rail-owned schema, migrations and named Prisma client | `KEEP/ADAPT`; add neutral tables additively; do not import AssureLocker tables or create cross-database foreign keys |
| AssureLocker API calls | DigiKYC status, AssurePool tape/surveillance and placeholder plaza/HCS/settlement URLs use `ASSURELOCKER_API_URL` | `ADAPT/BLOCK`; separate provider/identity/source/ledger/payment endpoints and credentials; eliminate compulsory dependency |
| Demo/in-memory mode | Core modules always load; DB-only modules add global auth/roles. Without `DATABASE_URL`, role decorators have no global guards | `KEEP` for isolated demo, `BLOCK` for any shared environment; enforce an explicit demo-only boot gate and production startup invariant |

### 3.2 Current API endpoints and code disposition

This is the complete controller endpoint surface found in `apps/assurerail-api/src` at the audited
baseline. “Current access” describes code, not a judgement that the access is sufficient.

| Current endpoint | Current access/purpose | Disposition |
|---|---|---|
| `GET /health` | Public tape module health | `KEEP`; separate liveness from dependency readiness |
| `GET /healthz` | Public process health | `KEEP` |
| `GET /readyz` | Public readiness | `ADAPT`; include migrations, durable store, critical provider state and demo-mode prohibition |
| `GET /metrics` | Public Prometheus metrics | `ADAPT`; retain bounded/cache behaviour, review exposure/auth at deployment perimeter |
| `POST /venue/auth/session` | Public Firebase/reCAPTCHA session resolution | `ADAPT`; keep identity-provider adapter, add session/audience/tenant security and provider-neutral auth policy |
| `GET /venue/auth/me` | Authenticated current user | `ADAPT`; return active institution context, mandates and route entitlements, not only global roles |
| `POST /venue/auth/onboard` | Authenticated DigiKYC verification, then `ACTIVE + allowlisted` | `BLOCK/ADAPT`; rename as identity binding and prevent it from granting institutional/route access |
| `GET /venue/auth/mfa/status` | Authenticated MFA status | `KEEP/ADAPT`; require step-up for governed actions |
| `POST /venue/auth/mfa/enroll/totp` | Authenticated TOTP enrolment | `KEEP` |
| `POST /venue/auth/mfa/verify/totp` | Authenticated TOTP verification | `KEEP/ADAPT`; issue bounded step-up evidence, not only enrolment state |
| `DELETE /venue/auth/mfa/:method` | Authenticated MFA removal | `ADAPT`; require recent step-up and recovery/notification control |
| `GET /venue/auth/webauthn/credentials` | Authenticated passkey list | `KEEP` |
| `POST /venue/auth/webauthn/register/options` | Authenticated registration challenge | `KEEP` |
| `POST /venue/auth/webauthn/register/verify` | Authenticated credential registration | `KEEP/ADAPT`; bind ceremony/audience and governed-action use |
| `DELETE /venue/auth/webauthn/credentials/:id` | Authenticated credential removal | `ADAPT`; require step-up and last-credential/recovery rules |
| `GET /venue/admin/users` | Platform admin user list | `ADAPT`; platform support view only, never substitute for institution membership administration |
| `PATCH /venue/admin/users/:id` | Platform admin changes global function/status/allow-list/entity fields | `BLOCK/RETIRE`; replace institution assignments with scoped, effective-dated, maker-checker records; retain break-glass support path with audit |
| `PATCH /venue/admin/users/:id/platform-role` | Superadmin changes platform role | `ADAPT`; enforce two-person control for highest privilege and immutable approval evidence |
| `POST /venue/admin/users/invite` | Platform admin pre-registers email/global role | `BLOCK/COMPAT`; new institutional invite/mandate route owns participant access |
| `GET /venue/admin/status` | Admin app/store/count status | `KEEP/ADAPT`; expand neutral case/route status and capability mode |
| `GET /venue/notes` | All onboarded function roles list all Notes | `BLOCK/ADAPT`; institution/case/appointment-scoped query; legacy adapter view only |
| `POST /venue/mint/:poolId` | Issuer mints verified AssurePool-sourced Note | `ADAPT`; tokenised representation adapter, gated by neutral case and approved route pack |
| `POST /venue/demo/run/:poolId` | Issuer runs mint→surveillance→sample DvP | `KEEP` only in explicit demo environment; `BLOCK` in controlled live/production |
| `POST /venue/demo/receivables/run/:poolId` | Issuer runs trustee-authorised receivables demo | `KEEP` only as labelled test/demo; it is not PTC or legal issuance evidence |
| `GET /venue/tape/:poolId` | All onboarded roles read verified AssurePool tape | `COMPAT/ADAPT`; move to provider-neutral intake/evidence resource with case ACL |
| `GET /venue/tape/:poolId/underlying` | All onboarded roles read anonymised underlying buckets | `BLOCK/ADAPT`; enforce case/evidence purpose and least-disclosure policy |
| `POST /venue/notes/:noteId/surveillance/sync` | Issuer/desk/trustee pulls AssurePool cycles and anchors them | `ADAPT/BLOCK`; route lifecycle adapter with source acknowledgement, quality gates and no automatic tradeability from mere cycle presence |
| `GET /venue/notes/:noteId/surveillance` | All onboarded roles read mirrored cycles | `ADAPT`; participant/case/appointment access |
| `POST /venue/notes/:noteId/dvp` | Issuer/desk requests settlement then asset update | `ADAPT/BLOCK`; durable settlement saga, idempotency and route-specific authority before controlled live use |
| `GET /venue/notes/:noteId/dvp` | All onboarded roles list trades | `ADAPT`; case/party/oversight-scoped read |
| `GET /venue/notes/:noteId/holdings` | All onboarded roles list all holders | `BLOCK/ADAPT`; confidentiality and role-specific holding views; authoritative-register reconciliation |
| `POST /venue/notes/:noteId/amortise` | Issuer/trustee burns and allocates pro rata | `ADAPT/BLOCK`; preserve exact allocation math, add lifecycle evidence, authority, cash confirmation and recovery saga |
| `POST /venue/notes/:noteId/close` | Issuer/trustee burns and redeems | `ADAPT/BLOCK`; governed route transition with external acknowledgement/idempotent recovery |
| `POST /venue/notes/:noteId/break-glass` | Regulator role submits body-supplied regulator DID/purpose | `BLOCK/ADAPT`; actor comes from authenticated credential/appointment, not request body; add approval, scope, expiry and upstream access receipt |
| `GET /venue/notes/:noteId/break-glass` | Regulator/trustee sees events | `ADAPT`; route/appointment/legal-purpose scoped |
| `GET /venue/reports/portfolio` | All onboarded roles see portfolio | `BLOCK/ADAPT`; tenant/case/oversight scope and governed export |
| `GET /venue/notes/:id/report` | All onboarded roles see Note report | `ADAPT`; case ACL and report version/receipt |
| `GET /venue/notes/:id/export.csv` | All onboarded roles download holdings/trades CSV | `BLOCK/ADAPT`; scoped, watermarked, receipt-logged export; PII/confidentiality policy |
| `GET /venue/activity` | All onboarded roles see audit rows/window check | `ADAPT`; institution/case scope, full-chain verification job and oversight views |
| `GET /venue/documents` | All onboarded roles list documents, optional `noteId` | `BLOCK/ADAPT`; case/evidence ACL, purpose, version and classification |
| `POST /venue/documents` | Issuer/desk/trustee uploads base64 document | `ADAPT/BLOCK`; streaming object store, digest, malware scan/quarantine, immutable version, retention and uploader authority |
| `GET /venue/documents/:id/download` | All onboarded roles download by ID | `BLOCK/ADAPT`; object-level authorisation, access receipt, safe disposition and watermark where required |
| `GET /venue/ingress/pools` | All onboarded roles list all ingested pools | `BLOCK/ADAPT`; provider/institution/case scoping and immutable versions |
| `POST /venue/ingress/pools` | Issuer/desk upserts free-form spec by `poolId` | `BLOCK/COMPAT`; neutral versioned intake envelope, signed receipt and idempotency; no overwrite of evidence history |
| `GET /venue/billing/statement` | Issuer/desk see global illustrative billing | `ADAPT`; institution/contract scope and finance reconciliation |
| `GET /venue/billing/events` | Issuer/desk see billing events | `ADAPT`; tenant scope and correction/credit-note trail |
| `GET /venue/webhooks` | Platform admin lists subscriptions, verification/disabled state and scope without returning secret/Vault path | `ADAPT`; institution ownership is nullable until PR-03 and list access remains platform-wide |
| `POST /venue/webhooks` | Platform admin creates an inactive HTTPS/public-DNS-checked subscription; HMAC secret goes to Vault and is shown once | `ADAPT`; tenant authority and certified receiver policy follow PR-03/PR-12 |
| `POST /venue/webhooks/:id/verify` | Platform admin runs a signed five-minute endpoint challenge before activation | `KEEP/ADAPT`; retain challenge and SSRF/connect-time controls, add institution authority later |
| `DELETE /venue/webhooks/:id` | Platform admin soft-revokes subscription and retains evidence | `KEEP/ADAPT`; institution-owned revocation follows participant administration |
| `GET /venue/webhooks/deliveries` | Platform admin sees digest/state/attempt/retry/terminal delivery evidence | `ADAPT`; tenant/event scope remains PR-03 work |
| `POST /venue/webhooks/deliveries/:id/replay` | Platform admin re-queues a terminal durable delivery under the stable delivery ID | `KEEP/ADAPT`; maker-checker/tenant authority and replay SOP required before controlled live |
| `GET /venue/support/events` | Platform admin reads lifecycle event log | `KEEP/ADAPT`; scoped support access and privacy-safe payload contract |
| `GET /venue/support/overview` | Platform admin sees operational counts | `KEEP/ADAPT`; neutral cases/providers/reconciliation queues |
| `GET /venue/ops/health` | All onboarded roles see ops status | `ADAPT`; expose appropriate participant status, keep sensitive detail admin-only |
| `GET /venue/ops/findings` | All onboarded roles see findings | `BLOCK/ADAPT`; current findings may expose other participants; split participant, trustee and operator views |
| `POST /venue/ops/run` | Platform admin runs deterministic sweep | `KEEP/ADAPT`; add neutral-case/provider/register controls and run receipt |
| `PATCH /venue/ops/control` | Superadmin changes kill switch/agent mode | `ADAPT`; two-person/high-risk change ceremony and independent emergency path |

### 3.3 Current Rail database models

| Model | Current purpose | Disposition |
|---|---|---|
| `VenueUser` | Human identity plus one global function role, platform role, entity role/DID, status and allow-list | `ADAPT/BLOCK`; reduce to human/account identity plus platform privilege; move institution/mandate/route powers to scoped relations |
| `VenueSession` | Session audit/revocation record | `KEEP/ADAPT`; add credential assurance, active institution, step-up, revocation reason and security context |
| `Note` | AssurePool-sourced tokenised object with tape/manifest/token and aggregate snapshot | `ADAPT`; legacy tokenised representation/instrument projection linked to `TransactionCase` |
| `NoteHolding` | Rail-local token units by holder DID | `ADAPT/BLOCK`; token adapter ledger, reconciled to the declared authoritative record; never generic legal ownership by default |
| `MintLog` | Append-only mint attempt/result evidence | `ADAPT`; external-instruction/acknowledgement and idempotency linkage |
| `SurveillanceMirror` | Note/pool period verdict and anchor | `ADAPT`; generic lifecycle evidence plus route-specific projections |
| `Dvp` | Asset/cash transfer record | `ADAPT/BLOCK`; result projection from a durable settlement saga, not the saga itself |
| `BreakGlass` | Regulator access anchor | `ADAPT`; full request/approval/grant/use/expiry/revocation evidence |
| `Document` | Inline bytes and optional Note link | `ADAPT/BLOCK`; metadata/version/policy in DB, encrypted object store for bytes, scan/quarantine and case/evidence ownership |
| `IngestedPool` | Mutable free-form pool spec, unique `poolId` | `COMPAT/RETIRE`; replace with immutable intake submission/version/receipt records |
| `BillingEvent` | Usage metering from lifecycle event | `KEEP/ADAPT`; institution/contract/rate-card/correction/reconciliation fields |
| `WebhookSubscription` | PR-02: nullable institution scope, HTTPS endpoint, Vault reference, event list, challenge/verification, disable/revoke state; migration clears old plaintext secret | `ADAPT`; institution ownership/authority and rotation ceremony follow PR-03/PR-12 |
| `WebhookDelivery` | PR-02: durable job with outbox link, stable delivery ID, digest, attempt, due/lock, delivered/retry/dead-letter/blocked/shadow state and response digest | `KEEP/ADAPT`; participant-scoped views and operating acceptance remain |
| `EventLog` | Durable lifecycle event with additive schema/aggregate/tenant/case/idempotency/correlation fields | `KEEP/ADAPT`; legacy fields stay compatible and neutral case ownership becomes authoritative in PR-06 |
| `ProviderReference`, `SourceReference` | PR-02 provider-neutral external identity/object/version/digest foundation | `KEEP/ADAPT`; connector/admission authority is not implied and follows PR-03/PR-05 |
| `IntakeSubmission`, `IntakeReceipt`, `InboxMessage` | PR-02 immutable/deduplicated carrier and receipt foundation; no public neutral intake writer yet | `KEEP`; PR-05 supplies governed object handling and provider adapters |
| `IdempotencyRecord`, `OutboxMessage` | PR-02 request-digest compare/replay and atomic digest-bound lifecycle fanout foundation | `KEEP/ADAPT`; neutral case command integration follows PR-06; legacy mutators retain their recorded PR-00 gaps |
| `ExternalInstruction`, `ExternalAcknowledgement` | PR-02 idempotent requested-effect/authenticated-result persistence foundation | `KEEP`; saga execution/finality policy remains PR-09/PR-11 |
| `MigrationReceipt` | PR-02 batch/count/digest/operator/reviewer/error-reference record | `KEEP`; each later backfill must actually issue and independently approve it |
| `AuditLog` | Hash-chained audit row | `KEEP/ADAPT`; actor authority/tenant/case/request/evidence references and atomicity with governed commands |
| `WebAuthnCredential` | Passkey material | `KEEP` |
| `WebAuthnChallenge` | Short-lived passkey challenge | `KEEP/ADAPT`; enforce consumption/idempotency and ceremony purpose |
| `MfaEnrollment` | TOTP enrollment | `KEEP/ADAPT`; secret encryption/key rotation and recovery policy |
| `OpsFinding` | Deduplicated deterministic integrity finding | `KEEP/ADAPT`; tenant/case/provider/route scope, ownership, SLA and evidence of closure |
| `OpsControl` | Singleton ops mode/kill switch | `KEEP/ADAPT`; effective configuration history and two-person change control |

### 3.4 Current Rail web screens

| Route | Current capability | Disposition |
|---|---|---|
| `/` | Public tokenised-Note proposition | No change in this technical pass. Later correct only materially false scope/capability claims |
| `/login` | Firebase Google/email login, reCAPTCHA | `KEEP/ADAPT`; institution SSO and participant identity-provider options |
| `/onboard` | Individual DigiKYC DID verification | `ADAPT`; relabel internally as identity binding; build a separate institutional admission journey |
| `/console` | Token Note mint/surveillance/DvP/amortise/close, holdings, documents, reports, underlying and break-glass | `KEEP` as legacy token-adapter console; `ADAPT` into case-driven workspaces, never the generic default |
| `/activity` | Recent audit entries and returned-window chain badge | `ADAPT`; case/tenant/oversight filters and complete-chain assurance status |
| `/admin` | Global users/roles, system/ops, billing, webhooks, events | `ADAPT`; split platform operations from institution administration and trustee/route oversight |
| `/settings` | Profile, theme, passkeys and TOTP | `KEEP/ADAPT`; active institution, mandate, notification and step-up context |

### 3.5 Current background jobs, events and external adapters

| Component | Current fact | Disposition |
|---|---|---|
| `OpsClockService` | Five-minute interval with Postgres advisory-lock leader election | `KEEP/ADAPT`; useful scheduler pattern, but use durable job leases/receipts for critical route deadlines |
| `IntegrityEngineService` | Read-only reconciliation for Note supply, lifecycle, anchors, k-anon, billing/event/audit counts and audit chain | `KEEP/EXTRACT`; extend to neutral cases, provider receipts, settlement sagas and authoritative registers |
| `VenueEventBus` | In-process event emitter | `KEEP` only as local notification; not a durable integration bus |
| `EventLog`/billing write | Lifecycle event and billing row written in domain transaction | `KEEP`; strongest existing transaction pattern, generalise it |
| `EventSinkService` | PR-02: transitional in-process relay only in explicit `legacy`; shadow/durable modes leave egress to the DB worker | `COMPAT/RETIRE`; remove legacy mode after observation/cutover evidence |
| `OutboxRelayService` | PR-02: `SKIP LOCKED` claims, two-minute stale-claim recovery, fanout, bounded backoff, dead letter and stable-ID replay; shadow suppresses network | `KEEP/ADAPT`; external receiver conformance/soak and 24x7 operating evidence remain required |
| `WebhooksService` / egress / Vault adapter | PR-02: HTTPS-only, DNS and connect-time SSRF defence, no redirects, challenge verification, Vault KV-v2 HMAC reference, bounded response/digest | `KEEP/ADAPT`; mTLS/certification may be route/participant policy and Vault/receiver live proof is not local code evidence |
| `AssureLocker` tape client | HTTP/2-capable `GET` by `poolId`, demo fallback | `COMPAT`; becomes the AssurePool source adapter |
| Surveillance client | Pulls AssurePool surveillance by pool | `COMPAT/ADAPT`; provider-neutral lifecycle submission plus AssurePool adapter |
| `HtsAdapter` | Demo works; live mint/burn methods throw TODO errors | `KEEP` as demo; `BLOCK` for live until connector, conformance, key custody and recovery tests exist |
| `HcsAdapter` | Demo anchor; live posts hash through AssureLocker base URL to placeholder internal route | `ADAPT/BLOCK`; dedicated provider endpoint/credential, non-empty acknowledgement and replay/reconcile |
| `SettlementAdapter` | Demo; live posts cash transfer through AssureLocker base URL and accepts possibly empty reference | `ADAPT/BLOCK`; payment-provider contract, idempotency, definitive status, reversals and saga |
| Trustee authorisation | Demo signing helper with hard-coded demo trustee DID/key semantics | `KEEP` as test fixture; `BLOCK` as institutional signature/appointment evidence |

---

## 4. Adjacent code ownership and reuse register

### 4.1 AssurePool — remains in AssureCLA

Current source assets:

- shared eligibility/tape/surveillance code in `packages/shared/src/co-lending/{pool,tape,pool-surveillance}.ts`;
- API/controller/service in `apps/api/src/co-lending`;
- lender UI at `apps/web/src/app/lender/assurepool/page.tsx`; and
- `CoLendingPool`, `CoLendingPoolLoan`, `CoLendingPoolLock` and `CoLendingPoolCycle` persistence.

Current pool endpoint set and disposition:

| Endpoint family | Disposition |
|---|---|
| `POST/GET /v1/co-lending/arrangements/:claId/pools` | `KEEP`; DA tape-preparation workspace |
| `POST /v1/co-lending/pools/:id/evaluate` and `GET /:id` | `KEEP`; source eligibility/readiness |
| `POST /v1/co-lending/pools/:id/loans/:loanId/override` | `KEEP`; source exception evidence with authority |
| `POST /v1/co-lending/pools/:id/freeze` | `KEEP`; deterministic immutable source manifest |
| `GET /v1/co-lending/pools/:id/lock` | `KEEP/ADAPT`; source encumbrance state |
| `POST .../lock/reserve`, `/verify`, `/release` | `KEEP/ADAPT`; source reservation adapter, remove mint-only assumptions |
| `POST /v1/co-lending/pools/:id/cycles`, `GET .../surveillance` | `KEEP`; source-side performance evidence, mapped into Rail lifecycle where contracted |
| `GET .../tape.csv`, `GET .../tape.json` | `KEEP/COMPAT`; add neutral versioned export adapter alongside existing consumer contract |

Required corrections in later AssurePool PRs:

- replace comments and fields that define the tape as “the only artifact crossing to Rail”,
  “AssurePool Note”, “mintable” or reserve-then-mint as the universal destination;
- retain existing external compatibility until Rail consumers migrate;
- make completion acknowledgement provider-neutral and idempotent; and
- connect successful Rail completion through the AssurePool adapter to
  `markPoolLockPermanent`. The method exists, but no current Rail DvP caller completes this source
  lock lifecycle.

### 4.2 Existing transfer room — migrate controls, not coupling

Current persistence:

- `PoolTransferRoom`: `poolId`, `claId`, copied `manifestHash`, transferor DID, purpose, status,
  declaration/reliance text versions and lifecycle timestamps;
- `TransferRoomInvite`: one named transferee DID, invite token, category/classification,
  declaration hash/timestamps and status;
- `TransferRoomAccessLog`: monotonic `seq`, per-room hash chain, actor/action/object/time; and
- `TransferRoomMessage`: append-only attributable Q&A.

Current API surface:

- open/list room;
- issue named invite;
- retrieve/accept invite with declaration and reliance;
- read summary/tape/findings;
- export watermarked, pool-scoped dossier;
- post/list Q&A; and
- close/withdraw and revoke invites.

Controls to preserve exactly or strengthen:

- invitation-only access with no cross-room discovery;
- transferor/transferee actor checks using institution and individual DID context;
- declaration and reliance gates before transferee reads;
- pool-scoped least disclosure;
- frozen manifest binding and content-drift recomputation;
- commercial-key redaction for the current passive room mode;
- single-writer advisory lock and monotonic sequence for the access hash chain;
- watermarked export with actor/room/manifest reference;
- append-only attributable Q&A; and
- closure that revokes grants while retaining evidence.

Couplings not to preserve in the generic model:

- room identity anchored to `poolId`/`claId`;
- TLE category embedded as the universal participant taxonomy;
- `DA | PTC_DATA_ROOM | RECEIVABLES_DA` used as proof of route capability;
- delegated reads under the transferor's CLA identity;
- direct invocation of `CoLendingService`/`CoLendingExportService`; and
- a blanket prohibition on commercial fields. Passive diligence retains that policy, while future
  permitted term/RFQ work uses a different, counsel-approved function assignment and ACL.

Target: Rail `TransactionCase` → one or more `CaseRoom`s → `RoomGrant`, `RoomAccessEvent`,
`RoomMessage`, `EvidenceObject` and provider-specific view adapters. The imported legacy chain must
retain its original room ID/payload/hash or be wrapped as a sealed legacy chain; hashes may not be
recomputed merely to fit a new ID.

### 4.3 AssureTransfer — product logic plus selectively reusable primitives

| Current code | Present capability | Disposition |
|---|---|---|
| `transfer/types.ts` | Receivables, party, transaction, prior transfer and manifest types | `KEEP` with AssureTransfer; expose neutral contracts through adapters |
| `derive.ts` | Calendar holding-period/residual-maturity calculations and submitted/derived comparison | `KEEP`; extract only if another governed route uses identical semantics |
| `validate.ts` | Zod input/evidence validation, acceptance eligibility and disclaimers | `KEEP`; product-specific evidence pack |
| `rule-registry.ts` | Effective releases, review/approval status and decision assembly | `KEEP/EXTRACT`; generic release mechanics may be shared, legal rules remain route/product-owned |
| `fingerprint.ts` | Canonical invoice fingerprint | `KEEP`; optional neutral provenance primitive with versioned semantics |
| `chain.ts` | Duplicate/prior-transfer/circularity findings, frozen manifest, PII fence, in-memory claim registry | `EXTRACT` neutral manifest/PII interfaces; replace in-memory registry with Rail durable claims only for Rail cases |
| `completion.machine.ts` | Requirement-plan-driven state machine | `EXTRACT` transition/idempotency pattern; keep AssureTransfer plans in product |
| `transfer.service.ts` | Immutable evidence assembly with disclaimer | `KEEP`; optional provider/evidence result accepted by Rail |
| `transfer/rail.ts` | DynamicPay buyer-cash/lender-funded intake state despite filename | `KEEP/RENAME` safely; it is a DynamicPay adapter, not Rail ownership |
| `assuretransfer-deadline-sweep.ts` | Pure deadline computation used by tests, no scheduler wiring | `KEEP/ADAPT`; route pack supplies deadlines; Rail owns durable scheduling/retry/escalation for Rail cases |

### 4.4 Reusable institutional and workflow assets

The repository already contains substantial institutional capability. It must be reused through
contracts and adapted components, not copied into Rail with product-specific states.

| Source | Reusable capability | Rail use | Must remain outside Rail |
|---|---|---|---|
| Central entity application/profile | Indian identifiers, evidence, application/review/clarification, DID binding, regulatory profile, tiering, retention/legal hold and dossier export | Provider adapter or signed institution/evidence snapshot; common UI/control patterns | AssureLocker product tiers, wallet/coupon/invoice policy and provider-specific decisions |
| `EntityMembership` service | Invites, active/provisional membership, role change, removal, promotion, integrator consent, official contacts, expiry/reminders | Neutral membership/mandate contract and tests | AssureLocker role names and direct runtime dependency |
| SAML/API clients | Institution SSO and service credentials | Rail-owned SSO/client registrations or certified federation adapter | Sharing production secrets/clients between companies/runtimes |
| vLEI-shaped role credentials | Attributable entity/role evidence and revocation | One accepted authority credential type | Assumption that vLEI-shaped data alone grants a Rail action |
| Change proposals | Maker-checker for sensitive institution changes | Reuse state/segregation/approval semantics | Central entity configuration as Rail write authority |
| CLA onboarding cases | Named state commands, immutable evidence versions/quarantine, scoped authority, gaps, decisions/concurrence, validation runs, passkey/PQ approval, audit chain, activation/suspension/export | Neutral case-control primitives and acceptance-test patterns | CLA decisions, scenarios, co-lending product activation and policy codes |
| Connector certification/health/dual-run | Schema conformance, provenance, fail-closed health, comparative shadow evidence | Generic connector framework and Rail route profiles | AssureCLA connector catalogue/payloads as universal Rail schema |

Known integration rule: the committed evidence-trust correction distinguishes an expected provider
cross-check from a cross-check actually achieved for an entity. Rail adapters must preserve that
distinction. No catalogue expectation or capability declaration may be promoted into verified
transaction evidence.

---

## 5. Target neutral Rail domain

The following is the minimum target ownership map. Names are proposed code names and may be refined
in the schema PR, but their responsibilities may not be collapsed into a single status JSON blob.

### 5.1 Participant and authority

| Target record | Minimum responsibility |
|---|---|
| `Institution` | Rail-local stable identity, legal identifiers, status, jurisdiction and provider references; no unnecessary copied KYB payload |
| `InstitutionEvidenceSnapshot` | Signed/versioned provider assertions, achieved verification, source/as-of/expiry, qualifications and digest |
| `ParticipantAdmission` | Institution's Rail relationship, admission status, terms/rulebook acceptance, risk class, review and suspension/revocation |
| `InstitutionMember` | Human-to-institution binding, status and effective dates |
| `AuthorityMandate` | Action/scope/limit, maker/checker/signing authority, delegation basis, evidence, effective/expiry/revocation |
| `Appointment` | Trustee, arranger, counsel, rating agency, servicer, RTA/depository, assurance provider or other role; appointer, acceptance, conflicts and scope |
| `RouteEntitlement` | Route, representation, asset class, lifecycle leg, function, limits/conditions and operating modes permitted |
| `ConnectorRegistration` / `ConnectorCertification` | Institution/provider endpoint, schema/profile version, credentials reference, conformance evidence, mode and health |

### 5.2 Transaction kernel

| Target record | Minimum responsibility |
|---|---|
| `TransactionCase` | Stable case ID, DA/PTC, conventional/tokenised, jurisdiction, market context, lifecycle leg, asset class, route pack and operating mode |
| `CaseVersion` | Immutable governed revisions before evidence lock; route/representation change creates a new version/case lineage |
| `CaseParty` | Institution, role, appointment/authority references, acceptance and status for this case |
| `SourceReference` | Provider/source-system object ID, schema/version, digest, authoritative status and retrieval/export metadata |
| `IntakeSubmission` | Immutable carrier, provider identity, idempotency key, received time, payload/object digest, signature and validation result |
| `EvidenceObject` / `EvidenceVersion` | Type/scope/provider/independence, as-of/expiry, qualification, digest/storage ref, supersession and access policy |
| `Condition` | Precedent/subsequent, owner, due date, evidence, waiver authority and resolution |
| `Decision` / `Approval` | Proposal, actor authority, maker/checker/concurrence, reason, signature/step-up and effective result |
| `CaseTransition` | From/to, command, guard result, actor/authority, idempotency, version and evidence bundle |
| `CaseRoom` / `RoomGrant` | Purpose-specific diligence/negotiation room and named, scoped, expiring access |
| `RoomAccessEvent` / `RoomMessage` | Tamper-evident access/export history and attributable communications |
| `DocumentFamily` / `DocumentVersion` | Template/negotiated/executed families, immutable versions, signature/stamp/filing state and schedule reconciliation |
| `FunctionAssignment` | For each regulated/material function: owned-authorised, licensed partner, participant-owned, external authority or prohibited |

### 5.3 Completion, authoritative record and lifecycle

| Target record | Minimum responsibility |
|---|---|
| `ExternalInstruction` | Provider-neutral requested action, idempotency key, payload digest, performer, timestamps and state |
| `ExternalAcknowledgement` | Authenticated provider result, external ID/status/time, signature/digest and finality class |
| `SettlementSaga` / `SettlementLeg` | Cash/asset/doc/register legs, readiness, execution ordering, timeout, compensation/manual repair and terminal reconciliation |
| `AuthoritativeRecordDeclaration` | Route-approved legal register/recordkeeper and governing rule for this case/instrument |
| `AuthoritativeRecordSnapshot` | Before/after external snapshot/reference and trustee/recordkeeper acknowledgement |
| `ReconciliationBreak` | Expected/observed, severity, blocked capabilities, owner/SLA, repair evidence and independent closure |
| `Deadline` / `JobExecution` | Effective rule, due time, retries, lease, escalation, result and audit receipt |
| `LifecycleEvent` | Collections, distributions, factors, triggers, notices, substitutions, repurchases, defaults, maturity/redemption and external references |
| `Representation` | Conventional or token adapter projection linked to case/instrument; never presumed legal authority without declaration |
| `InboxMessage` / `OutboxMessage` | Durable integration receipt/delivery, schema version, idempotency, attempt/replay/dead-letter state |

### 5.4 Taxonomy that must be governed before feature coding

At minimum:

```text
transaction_route     = DA | PTC
representation        = CONVENTIONAL | TOKENISED
market_context        = DOMESTIC | IFSC | OTHER_APPROVED
placement_or_listing  = BILATERAL | PRIVATE_PLACEMENT | LISTED | OTHER_APPROVED
lifecycle_leg         = INITIAL_TRANSFER_OR_ISSUE | SECONDARY_TRANSFER_OR_TRADE
operating_mode        = REPLAY | SHADOW | SANDBOX | CONTROLLED_LIVE | PRODUCTION
function_performer    = OWNED_AUTHORISED | LICENSED_PARTNER | PARTICIPANT_OWNED |
                        EXTERNAL_AUTHORITY | PROHIBITED
evidence_result       = VERIFIED | PARTIALLY_VERIFIED | UNVERIFIED | FAILED | EXPIRED |
                        NOT_APPLICABLE | REVIEW_REQUIRED
reconciliation_state  = PENDING | MATCHED | BREAK_OPEN | REPAIR_IN_PROGRESS | RESOLVED
```

Every taxonomy value needs definition, legal/operating owner, allowed transitions, display label and
version. `UNKNOWN`, missing and unsupported must not silently map to passing or `NOT_APPLICABLE`.

---

## 6. Production-critical findings

These findings are based on code behaviour. They are not accusations about deployed production,
because the current Rail README itself describes demo/design-stage adapters.

| ID | Severity | Finding and implication | Required gate |
|---|---|---|---|
| `AR-C01` | Critical | Function roles are global. Most list/read routes return all Notes, holdings, documents, ingested pools, reports or findings to any onboarded role; there is no Rail-local institution/case ACL | Institution, case-party and object-level authorisation tests must pass before any multi-institution pilot |
| `AR-C02` | Critical | `@EntityRoles` checks only the role string; unlike function-role checks it does not itself require `ACTIVE + allowlisted`. Platform admin bypasses all function/entity controls | Centralise subject validity, institution context and entitlement checks; deny suspended/revoked accounts on every non-emergency path |
| `AR-C03` | Critical | Individual DigiKYC onboarding immediately sets `ACTIVE + allowlisted`. A default `INVESTOR` role can then read broad venue data. Identity verification is being used as admission | Split identity binding, participant admission and route entitlement; no default market/transaction permission |
| `AR-C04` | Critical | DvP calls the external settlement leg first, then anchor, then DB asset transfer. If cash succeeds and the anchor/DB step fails, cash can move without the asset. The comment “or neither/no settlement risk” is not true for the live sequence | Durable saga, idempotent provider instruction, pending state, recovery/compensation/manual repair, reconciliation and fail-closed resume |
| `AR-C05` | Critical | Mint, burn and anchor external calls occur before the database state commit. A DB failure can leave an external mint/burn/anchor without the intended internal record | External instruction/acknowledgement records, idempotency keys, reconciliation worker and resumable commands |
| `AR-C06` | Critical | Surveillance moves `ISSUED → ACTIVE` when any cycle is mirrored, regardless of `surveillance.ok` or reported problems. `ACTIVE` is then treated as tradeable | Route-pack activation gate must evaluate result, recency, unresolved critical exceptions and authority; problem evidence remains visible without activating |
| `AR-H07` | High | `sellerDid` and `regulatorDid` may be supplied in request bodies; audit actor is often hard-coded `system:tokenco`. The record may not identify the actual authorised human/institution | Derive actor/acting institution/mandate from authenticated context; body may reference a party only when entitlement proves authority |
| `AR-H08` | High | DvP lacks an API idempotency key; `priceMinor` is not validated as a positive integer; invalid `unitsMinor` can raise an unhandled `BigInt` error; live settlement may return an empty reference | Strict schemas, positive exact-money types, command idempotency, non-empty/finality-checked provider acknowledgements |
| `AR-H09` | High | Webhook subscription accepts arbitrary HTTP(S) URLs; secrets are in the DB; dispatch is in-process, best-effort and has no retry/replay worker | SSRF/private-network defence, endpoint challenge, vault-backed secret, durable outbox relay, retry/backoff/dead letter/replay |
| `AR-H10` | High | Governed `AuditLog` append happens after domain transaction in several lifecycle services. Domain/outbox/billing can commit even if audit append fails | Include audit receipt in the governed transaction or make command incomplete until durable audit reconciliation succeeds |
| `AR-H11` | High | Documents trust claimed MIME, accept base64 into app memory, store bytes inline, and have no digest, malware scan/quarantine, immutable versions, retention policy or object ACL | Streaming encrypted object storage, sniffing/scan, digest, version, classification, case ACL, legal hold and access receipts |
| `AR-H12` | High | `IngestedPool` is mutable free-form JSON upserted by `poolId`; repeat submission overwrites source/spec and lacks provider signature, schema version, payload digest or immutable receipt | Immutable provider-neutral intake submission/version/receipt model; retain legacy projection only for compatibility |
| `AR-H13` | High | Demo endpoints and demo adapters are part of normal module imports; no-DB mode omits the global auth guards | Production startup invariant must reject demo/no-DB modes; demo endpoints disabled outside explicit isolated environments |
| `AR-H14` | High | Token holdings are a Rail-local projection with no external authoritative-register declaration or ongoing divergence control | Declare authority by route, store before/after acknowledgements, block movement on discrepancy |
| `AR-H15` | High | AssurePool's permanent source lock is not called from the current Rail completion path | Provider-neutral completion acknowledgement plus AssurePool adapter; reconcile and repair any orphaned reservations |
| `AR-H16` | High | HCS/settlement live placeholders use the AssureLocker base URL, coupling distinct providers/credentials and obscuring outage/perimeter ownership | Separate connector registrations/endpoints/credentials, provider health, conformance and exit paths |
| `AR-M17` | Medium | Audit activity verifies only the returned window while UI wording can be read as whole-chain assurance | Surface whole-chain sweep status separately from window continuity; do not overstate verification |
| `AR-M18` | Medium | `WebAuthnChallenge`, TOTP secret protection, privilege removal and last-factor recovery need explicit production controls | Security design/penetration tests and recovery SOP before controlled live |
| `AR-M19` | Medium | `OpsFinding` has no assignee/SLA/waiver/closure evidence, and broad member visibility can leak other participants' issues | Add scoped views, accountable owner, SLA, escalation and independent closure evidence |
| `AR-M20` | Medium | Current Rail tests are primarily pure/unit tests for tape, k-anon, amortisation and trustee demo authorisation; there is no broad endpoint/DB/multi-tenant/saga test suite | Build contract, integration, migration, concurrency, fault-injection and security test layers before route replay/pilot |

### 6.1 Accuracy policy derived from the findings

For production-grade assurance:

- no external action is “complete” until its authenticated acknowledgement and internal state are
  reconciled;
- no evidence is “verified” merely because a provider normally can perform a check;
- every quantity/amount uses a canonical exact representation and explicit currency/unit/scale;
- every override records authority, before/after state, reason, scope, expiry and independent review;
- every route decision names the governing rule-pack release and evaluation engine build;
- every material result is reproducible from retained inputs or has an external authority receipt;
- unknown/missing/stale/ambiguous data fails closed or enters `REVIEW_REQUIRED`; and
- operational dashboards distinguish expected, received, verified, reconciled and legally effective.

---

## 7. Migration and compatibility rules

### 7.1 Database boundary

- Rail keeps its own database. No cross-database foreign key to AssureLocker/AssureCLA is allowed.
- External institution, pool, evidence and provider objects are referenced by stable provider/source
  identifiers plus signed/digested snapshots sufficient for continuity and audit.
- New tables are additive through the shadow period. Legacy Note/room data is not destructively
  transformed in place.
- Each backfill has a batch ID, source high-water mark, row/object counts, digests, error file,
  operator, reviewer, started/completed time and signed migration receipt.
- Database migrations must be backward compatible for at least the previous deployed API while a
  rolling deployment is possible.

### 7.2 Transfer-room migration

1. Freeze existing behaviour with golden fixtures for room creation, invite/declaration, every read,
   commercial redaction, manifest drift, dossier watermark, Q&A, close and hash-chain verification.
2. Add Rail `TransactionCase`/room tables and an AssurePool provider view adapter.
3. Export legacy rooms in deterministic order with room, invite, message and access-log counts and
   digests. Include the frozen pool/manifest source reference.
4. Preserve the original room ID wherever possible because it is committed inside each access-log
   payload. If not possible, store the entire original chain as a sealed `LegacyAccessChain` and
   never recompute it under the new ID.
5. Import access rows in original `seq` order. Set the target sequence beyond the imported maximum
   before appending Rail-native events.
6. Keep `legacyRoomId`, `legacyPoolId`, `legacyClaId`, source database/version and migration receipt.
7. Run dual-read comparison: room status, grants, declarations, message ordering, access-chain tail,
   tape hash/manifest, findings/dossier digests and authorisation results.
8. Maintain one declared write authority. Initial authority is legacy; then Rail in shadow for new
   flagged rooms; then Rail for all new rooms. Old routes proxy to Rail during compatibility.
9. Rollback switches new-room write authority to legacy only while the legacy schema remains capable
   and no Rail-only feature has been used. Rail-created cases are never silently squeezed back into
   lossy legacy fields; they are paused/exported and repaired explicitly.
10. Retire legacy writes after an agreed compatibility window, zero unresolved parity breaks, replay
    success and participant acceptance. Historical tables remain read-only for retention.

### 7.3 API/event compatibility

- New APIs live under a versioned neutral namespace proposed as `/v1/rail/...`; final naming is an
  API design decision, not a marketing decision.
- Legacy `/venue/notes`, `/venue/tape` and `/v1/transfer-rooms` remain adapters during migration.
- Every mutating request requires an idempotency key or a server-issued single-use command token.
- Events carry event ID, aggregate/case ID, aggregate version, schema version, institution scope,
  occurred/recorded times, actor/authority and correlation/causation IDs.
- Consumers register supported schema versions. Breaking event changes use a new event version, not
  an in-place payload reinterpretation.
- Compatibility metrics count legacy calls, adapter failures and clients by version so retirement is
  evidence-based.

### 7.4 Feature flags

Proposed flags are operational controls, not licence assertions:

| Flag | Initial state | Purpose |
|---|---|---|
| `ARAIL_DEMO_ENDPOINTS_ENABLED` | true only in isolated demo | Remove demo routes/adapters from any controlled environment |
| `ARAIL_NEUTRAL_TAXONOMY_V1` | read-only | Enable neutral serialization and validation without behaviour change |
| `ARAIL_PARTICIPANT_ADMISSION_V1` | shadow | Create/read Rail-local institution/admission snapshots |
| `ARAIL_ROUTE_ENTITLEMENT_ENFORCE` | off→shadow→on | Compare then enforce institution/member/mandate/function permission |
| `ARAIL_NEUTRAL_INGRESS_V1` | shadow | Accept immutable provider-neutral intake submissions |
| `ARAIL_TRANSACTION_CASE_V1` | shadow | Create neutral cases alongside legacy flows |
| `ARAIL_ROOM_READ_SOURCE` | `legacy`, then `compare`, then `rail` | Controlled room read cutover |
| `ARAIL_ROOM_WRITE_SOURCE` | `legacy`, then cohort `rail` | Exactly one room write authority |
| `ARAIL_ASSUREPOOL_ADAPTER_V1` | shadow | Map pool tape/lock/lifecycle into neutral contracts |
| `ARAIL_COMPLETION_ACK_V1` | shadow | Send/reconcile provider-neutral completion acknowledgements |
| `ARAIL_DA_REPLAY_V1` | allow-listed cases | Conventional DA replay/shadow |
| `ARAIL_PTC_REPLAY_V1` | allow-listed cases | Conventional PTC replay/shadow |
| `ARAIL_LEGACY_NOTE_ADAPTER` | on | Keep token Note projection until neutral representation is proven |
| `ARAIL_EXTERNAL_ACTION_SAGA_V1` | shadow→required | Prevent direct external-action-before-DB paths |

All flags need owner, change authority, environment policy, expiry/removal date, audit event, metrics
and a rollback runbook. `PRODUCTION=true` or equivalent may not bypass route/function gates.

---

## 8. Dependency-ordered pull-request programme

Effort bands are preliminary **person-weeks**, not elapsed delivery time or a three-year staffing
budget. They assume reviewers/domain specialists are available and exclude regulator/counsel wait
time. Each PR is cohesive and independently releasable behind flags.

### PR-00 — Baseline characterisation and production claim guards

**Dependencies:** none
**Effort:** 2–4 person-weeks
**Primary roles:** senior backend, QA/SDET, security reviewer, domain analyst

Deliverables:

- golden contract fixtures for all current Rail endpoints and transfer-room behaviours;
- DB-mode auth/role integration harness and explicit demo-mode startup tests;
- fault-injection characterisation for mint, DvP, amortise, close, audit and webhook sequencing;
- endpoint/data exposure matrix by current role;
- test labels that distinguish `DEMO`, `REPLAY`, `SHADOW` and unavailable live adapters; and
- CI assertion that production configuration cannot boot with no DB, demo adapters or demo endpoints.

Acceptance evidence:

- existing behaviour is reproducible without changing it;
- every finding in section 6 has a failing test or explicit architectural test gap;
- golden fixtures contain no secrets/borrower PII; and
- test reports distinguish pure/unit from DB/integration and skipped external portions.

Observability: test artefact inventory and production-config invariant metric/log.
Rollback: tests/config guards only; revert is safe, but do not remove a guard to accommodate a bad
environment.
No scope: no new route models, UI or copy.

### PR-01 — Neutral taxonomy and contract package

**Dependencies:** PR-00
**Effort:** 3–5 person-weeks
**Primary roles:** staff backend/architect, domain analyst, data architect, counsel-facing BA

Deliverables:

- versioned `TransactionRoute`, `Representation`, `OperatingMode`, `LifecycleLeg`, asset-class,
  evidence-result, reconciliation and function-performer taxonomies;
- provider-neutral institution/source/evidence/intake/acknowledgement/event envelopes;
- canonical serialization, digest and exact-money/unit types;
- schema registry and compatibility tests; and
- AssurePool and AssureTransfer mapping tests with no runtime change.

Acceptance evidence:

- no mandatory AssurePool, AssureLocker, IDBI, token, trustee vendor or CLA field in the canonical
  envelope;
- unknown/missing values fail closed;
- schema/version/digest/signature/provider/as-of/expiry/qualification fields are explicit; and
- all current source adapters can map without loss, with source-specific extras isolated.

Flag: `ARAIL_NEUTRAL_TAXONOMY_V1` read-only.
Rollback: remove unused serialization path; no data migration.
No scope: legal route rules and transaction UI.

**PR-01 implementation checkpoint (30 August 2026):** implemented on
`codex/assurerail-pr01-neutral-taxonomy` as a runtime-inert `src/contracts/v1` package. It includes
the governed taxonomies, four neutral envelopes, strict canonical/digest and exact-value helpers,
additive schema registry, an off/read-only-only flag, and lossless comparison mappings for the
current AssurePool DA tape and AssureTransfer receivables manifest. `DEMO` is deliberately excluded
from transaction evidence; `OTHER_APPROVED` classifiers require an `extensionProfileRef`; current
source-specific fields remain isolated below the mapping extension object. There is no endpoint,
database model/migration, AppModule import, write path or public-copy change. Detailed decisions and
rejections: `docs/design/AssureRail_Neutral_Contracts_v1.md`. Executed evidence:
`docs/qa/AssureRail_PR01_Neutral_Contract_Evidence.md`.

### PR-02 — Rail persistence foundation, inbox/outbox and idempotency

**Dependencies:** PR-01
**Effort:** 5–8 person-weeks
**Primary roles:** senior backend, data engineer/DBA, SRE, security, QA

Deliverables:

- additive Rail schema for provider/source references, intake submissions/receipts, idempotency,
  inbox/outbox messages, external instructions/acknowledgements and migration receipts;
- tenant/case-ready ownership columns on neutral records;
- durable outbox relay worker with retry/backoff/dead letter/replay;
- webhook endpoint verification, SSRF defence and secret-vault reference; and
- migration/restore/performance tests.

Acceptance evidence:

- replaying the same command/event does not duplicate domain, billing or external instruction;
- worker restart loses no due delivery;
- private/loopback/link-local/metadata egress is blocked;
- old webhook records are migrated or disabled with an operator-visible reason; and
- rollback leaves existing lifecycle reads/writes intact.

Flags: `ARAIL_NEUTRAL_INGRESS_V1=off→shadow`;
`ARAIL_DURABLE_RELAY_MODE=legacy→shadow→durable`.
Rollback: stop neutral workers/ingress, retain additive rows; legacy relay remains available during
the observation window.

**PR-02 implementation checkpoint (30 August 2026):** implemented at `d84e67020` on
`codex/assurerail-pr01-neutral-taxonomy` as an additive Rail migration and DB-only runtime
foundation. It adds the ten neutral persistence models above, same-database foreign-key integrity,
request/inbox/external-effect idempotency, and atomic legacy lifecycle `EventLog` + billing +
digest-bound outbox writes. Webhooks now use verified HTTPS/public endpoints, preflight and
connect-time SSRF controls, Vault KV-v2 references, stable delivery IDs, durable claims/retries,
dead-letter/replay and an egress-suppressed shadow mode. The migration deliberately disables legacy
subscriptions and clears their plaintext secrets; re-provisioning is required. It adds two
platform-admin endpoints (endpoint verification and terminal delivery replay), no customer/route UI,
institution admission, transaction case, DA/PTC rule, public copy or deployment. Detailed operation,
migration and rollback decisions: `docs/runbooks/AssureRail_PR02_Persistence_And_Relay.md`. Local
evidence: 106/106 Rail tests; disposable Postgres fresh/upgrade/index/backup/restore rehearsal; final
full gate and security scans are recorded separately in `docs/qa/AssureRail_PR02_Persistence_Evidence.md`.

### PR-03 — Institution, membership, mandate and participant admission

**Dependencies:** PR-01 and PR-02
**Effort:** 7–11 person-weeks
**Primary roles:** backend, security/identity engineer, frontend, QA, BA, compliance/operations

Deliverables:

- Rail-local `Institution`, evidence snapshot, admission, membership, mandate, appointment and route
  entitlement models;
- provider-neutral identity/KYB snapshot adapter, with AssureLocker as one provider;
- institutional invite, membership acceptance, mandate proposal/approval, suspension/revocation and
  recertification APIs;
- active institution/session context and step-up evidence;
- explicit separation of identity binding from participant admission; and
- migration projection for existing `VenueUser.entityDid/entityRole` without granting new power.

Acceptance evidence:

- no human acts for an institution without active membership and applicable mandate;
- maker cannot approve their own sensitive authority change;
- suspension/revocation is enforced immediately across API, jobs and service credentials;
- provider outage does not erase previously valid, retained evidence but expiry/risk policy still
  fails closed; and
- `crossCheckExpected` is never rendered/stored as an achieved verification.

Flags: `ARAIL_PARTICIPANT_ADMISSION_V1=shadow`,
`ARAIL_ROUTE_ENTITLEMENT_ENFORCE=off/compare`.
Rollback: keep neutral admission records, return authorisation reads to legacy only in non-live
environments; no imported evidence is deleted.

**PR-03 implementation checkpoint (30 August 2026):** implemented locally at `06c39deef` on
`codex/assurerail-pr01-neutral-taxonomy`. The change is additive and disabled by default. It adds
the eleven Rail-owned institution/admission/authority models, 16 versioned institution APIs, a
provider-neutral identity-binding boundary, session-bound institution context, retained evidence
snapshots, two-person admission/mandate/status/route governance, appointments, service-principal
policy records and exact human/route authority evaluators.

Selected controls and deliberately bounded behavior:

- AssureLocker DigiKYC is the first identity adapter, not an admission authority or compulsory
  institution field. Binding an identity never sets the legacy allow-list, cannot clear a suspension
  and cannot silently replace an existing provider subject.
- A Rail session stores a digest-derived identifier rather than its Firebase bearer. Participant
  requests require the header institution to match an active membership and the institution bound
  to that exact active session.
- TOTP step-up evidence is five-minute, single-use and bound to the exact user, session,
  institution and closed ceremony purpose. Its consumption and the corresponding governed
  proposal/review commit or roll back in one database transaction.
- Admission and route review require a different active platform administrator from the maker.
  Institution mandate and target-status changes require a different participant checker holding
  the exact mandate. Platform employment does not become participant authority.
- Evidence keeps provider/source, digest, signature status, result, method, independence,
  source/as-of/expiry, qualifications and `crossCheckExpected` separate from
  `crossCheckAchieved`; only achieved verified checks may satisfy the evidence policy.
- Route entitlements can be recorded only for `REPLAY`/`SHADOW` and only when the compare flag is
  explicit. `CONTROLLED_LIVE` and `PRODUCTION` are rejected by the service. A participant can
  propose but cannot approve its own route permission.
- A non-null mandate scope key and database partial uniqueness prevent PostgreSQL nullable-key
  behavior or concurrent requests from leaving two proposals pending for the same exact scope.
- Existing `entityDid/entityRole` rows migrate only to `LEGACY_REFERENCE_ONLY`, `NOT_ADMITTED` and
  `LEGACY_PROJECTED` records. They receive no mandate or route entitlement. A matching legacy
  entity role now also fails for a suspended or non-allowlisted account.

Rejected or deferred in this checkpoint: auto-admission after identity verification; compulsory
AssureLocker/AssurePlane/IDBI fields; participant self-grant; live route permission; PR-04 UI; PR-05
automated/object evidence intake; PR-06 transaction cases; enforcement on the legacy Note/room/
document/report surfaces; service-principal credential issuance; provider appointment acceptance;
WebAuthn assertion step-up and production TOTP recovery hardening; atomic legacy hash-chain audit
append for every governance write; public-copy change; deployment.

Detailed decisions and rejections:
`docs/design/AssureRail_Institution_Admission_And_Authority_v1.md`. Operating procedure and safe
pause: `docs/runbooks/AssureRail_PR03_Institution_Authority.md`. Executed evidence:
`docs/qa/AssureRail_PR03_Authority_Evidence.md`.

### PR-04 — Institutional onboarding and administration UI

**Dependencies:** PR-03
**Effort:** 5–8 person-weeks
**Primary roles:** frontend, backend, product designer, accessibility QA, BA/ops

Deliverables:

- institution application/status, evidence gaps, member/mandate, appointment, connector and route
  entitlement workspaces;
- platform-operator, institution-admin, trustee/oversight and ordinary participant views separated;
- approval inbox and step-up ceremony;
- visible source/as-of/expiry/qualification for every evidence result; and
- no auto-admission after individual identity binding.

Acceptance evidence:

- object- and action-level permission suite for every role/tenant combination;
- keyboard/accessibility and export/access-log tests;
- admin cannot silently impersonate an institution; support elevation is time-bound and logged; and
- every rejection/suspension has a reason and review path.

Rollback: UI routes hidden; APIs/data remain dark and auditable.

**PR-04 implementation checkpoint (30 August 2026):** implemented locally on
`codex/assurerail-pr01-neutral-taxonomy`. Three views now preserve the PR-03 boundaries: a
restricted application-status view, an institution-bound participant workspace whose read/action
breadth is derived from exact mandates, and a platform admission/route-review queue with an
explicit no-impersonation boundary. The session exchange owns active-institution selection; browser
storage is only a requested context. Evidence displays provider/source, digest, signature, result,
method, independence, source/as-of/expiry, expected and achieved cross-checks and qualifications
separately. Incoming institutional appointments are visible to their appointee for independent
acceptance. Connector readiness is deliberately labelled unavailable/awaiting PR-05 and grants no
authority. Identity-binding copy was minimally corrected where it had falsely described
AssureLocker DigiKYC as venue admission and routed users to the Note console. No public proposition,
database migration, route enforcement, live capability or deployment was added. Detailed decisions
and rejections: `docs/design/AssureRail_Institutional_Workspaces_v1.md`. Operations:
`docs/runbooks/AssureRail_PR04_Institutional_Workspaces.md`. Executed evidence:
`docs/qa/AssureRail_PR04_Institutional_Workspace_Evidence.md`.

### PR-05 — Evidence/document and provider-neutral intake service

**Dependencies:** PR-02 and PR-03
**Effort:** 7–10 person-weeks
**Primary roles:** backend, data/object-storage, security, frontend, QA

Deliverables:

- immutable intake/evidence/document versions with signatures, digests, classification, purpose,
  expiry/supersession and case ACL;
- encrypted object storage, streaming upload/download, content sniffing, malware scan/quarantine,
  retention/legal hold and access receipts;
- file and API carriers using the same canonical validation result;
- AssurePool tape adapter and third-party registry template adapter; and
- legacy `IngestedPool`/`Document` projections for Note console compatibility.

Acceptance evidence:

- changed payload under the same provider ID creates a new version or conflict, never overwrites;
- quarantined/expired/unauthorised evidence cannot satisfy a gate;
- no mandatory provider brand; and
- object access is case/appointment/purpose scoped and audited.

Flags: `ARAIL_NEUTRAL_INGRESS_V1=shadow`, `ARAIL_ASSUREPOOL_ADAPTER_V1=shadow`.
Rollback: stop neutral intake; retained objects/receipts remain exportable; legacy path stays read/write
until cutover.

**PR-05 implementation checkpoint (30 August 2026):** implemented locally on
`codex/assurerail-pr01-neutral-taxonomy`, without push or deployment. The replay/shadow-only module
adds certified connector registrations; provider/source references; immutable evidence and document
versions; S3-compatible streamed SSE-KMS storage; bounded magic/type checks; ClamAV fail-closed
quarantine; exact institution/purpose/classification grants; digested access receipts; and
step-up-bound append-only legal-hold events. Intake can never accept a participant-supplied verified
result: every received item begins `REVIEW_REQUIRED`, and a merely present signature remains
`PRESENT_UNVERIFIED`.

The certified profile must match the connector declaration and incoming payload. Initial adapters
cover the existing AssurePool frozen DA tape, AssureTransfer receivables DA evidence, and a
provider-neutral common-lender-registry snapshot; none becomes mandatory or a Rail/legal ownership
authority. The legacy schema receives nullable compatibility links and retains existing inline bytes,
but new neutral evidence is not published into the globally scoped legacy Note document surface
before PR-06 case ACL and later caller cutover. `transactionCaseId` is therefore retained as an opaque
scope reference in this checkpoint rather than falsely validated against a case that does not yet
exist.

Selected/rejected detail:
`docs/design/AssureRail_Provider_Neutral_Evidence_And_Intake_v1.md`. Safe operation and stop:
`docs/runbooks/AssureRail_PR05_Evidence_Intake.md`. Executed evidence:
`docs/qa/AssureRail_PR05_Evidence_Intake_Evidence.md`. The verified evidence comprises 146 API tests,
a disposable PostgreSQL fresh/upgrade/constraint/backup/restore rehearsal and a successful web
production build. No live object store, scanner, provider, customer system, configured database,
box deployment, route authority or production claim was exercised.

### PR-06 — Neutral transaction case, decisions, conditions and state engine

**Dependencies:** PR-03 and PR-05
**Effort:** 8–12 person-weeks
**Primary roles:** staff backend, domain architect, QA/SDET, BA, operations, security

Deliverables:

- `TransactionCase`, versions, parties, function assignments, conditions, approvals and transitions;
- optimistic concurrency/idempotent command handling;
- common state spine with route-specific substates and terminal/recovery paths;
- rule-pack/evidence bundle attribution for every guard;
- immutable route/representation after evidence lock; and
- case timeline/export and deterministic replay.

Acceptance evidence:

- illegal/stale/concurrent transitions fail without partial side effects;
- maker-checker/appointment/mandate and evidence gates are independently testable;
- replay reproduces the same decision from retained inputs/versioned rule pack;
- a UI label cannot set legal completion; and
- DA/PTC and conventional/tokenised are discriminators, not shared-policy shortcuts.

Flag: `ARAIL_TRANSACTION_CASE_V1=shadow`.
Rollback: no legacy writes are switched; dark cases remain exportable.

**PR-06 implementation checkpoint (30 August 2026):** implemented locally behind a three-part
participant-admission + neutral-ingress + transaction-case shadow gate, additionally restricted to
`REPLAY/SHADOW` runtime. Nine additive Rail models now hold neutral cases, immutable versions,
accepted institutional parties, material-function assignments, conditions, maker-checker decisions,
optimistic/idempotent transitions and deterministic replay receipts. The 13 versioned case APIs
derive actor/session/institution context, enforce admission/membership/mandate/case-party scope and
require exact route entitlements. Evidence intake/read/grant now enforces case-party scope and stops
versions after evidence lock while retaining legacy opaque identifiers when the case flag is off.
Execution and completion facts deliberately remain unavailable until PR-09's saga/reconciliation
foundation. Detailed selected/rejected decisions:
`docs/design/AssureRail_Neutral_Transaction_Case_And_State_Engine_v1.md`. Operating procedure:
`docs/runbooks/AssureRail_PR06_Transaction_Case.md`. Executed evidence:
`docs/qa/AssureRail_PR06_Transaction_Case_Evidence.md`.

### PR-07 — Rail-owned case room and legacy backfill

**Dependencies:** PR-05 and PR-06
**Effort:** 7–10 person-weeks
**Primary roles:** backend, data migration, frontend, QA/security

Deliverables:

- neutral Rail room/grant/access-chain/message APIs and UI;
- purpose policies separating passive diligence from later permitted commercial workflows;
- AssurePool source view adapter;
- deterministic legacy export/import, sealed chain preservation and migration receipts;
- dual-read comparator and operator repair queue; and
- compatibility response adapter for current room screens/routes.

Acceptance evidence:

- golden transfer-room tests pass against both legacy and Rail implementations;
- every imported chain verifies to the original tail and counts/digests match;
- no user gains access through the migration;
- dossier/tape/findings remain pool-scoped for imported AssurePool rooms; and
- parity breaks block cohort cutover.

Flags: `ARAIL_ROOM_READ_SOURCE=legacy→compare`; write remains `legacy`.
Rollback: read source returns to legacy; imported Rail records remain sealed/dark.

**PR-07 implementation checkpoint (31 August 2026):** implemented locally as a compare-only,
owner-operated migration surface. Seven additive Rail models retain passive rooms, explicitly mapped
institution grants, exact legacy access rows, attributable messages, immutable versioned import
snapshots, parity runs and blocking repair items. `assurecla.transfer-room-export.v1` provides a
deterministic source builder/parser, rejects invitation tokens, verifies every original legacy hash
and permits refresh only by exact append-only/forward-state extension. The original committed room
ID remains explicit even if a Rail ID collision requires a new case-room ID. All three old purpose
labels map only to `PASSIVE_DILIGENCE`; `PTC_DATA_ROOM` creates no PTC capability and commercial
negotiation remains prohibited. Every legacy DID requires a one-to-one mapping to the case owner or
an active case party; imported grants stay `MIGRATED_DARK` and the room stays `DARK_IMPORTED`, so
migration creates no participant access. Root migration batches can span rooms while each retained
room/version receives its own collision-free receipt identity.
The provider-neutral source projection reads PR-05 retained intake evidence; AssurePool is one DA
adapter and there is no delegated CLA/CoLending runtime call. Parity compares binding, grants,
declarations, messages, access chain, manifest and authorisation mapping; mismatches block the room,
and the parity runner cannot close their own break. The new case/room UI exposes import, source view,
parity and repair only. Runtime accepts `compare` only with the PR-03/05/06 shadow foundation;
`rail` read and every Rail room write remain unavailable until PR-08. Detailed decisions and
rejections: `docs/design/AssureRail_Case_Room_And_Legacy_Migration_v1.md`. Operating controls:
`docs/runbooks/AssureRail_PR07_Case_Room_Migration.md`. Executed evidence:
`docs/qa/AssureRail_PR07_Case_Room_Evidence.md`.

### PR-08 — Room/caller cutover and AssurePool completion acknowledgement

**Dependencies:** PR-07
**Effort:** 5–8 person-weeks
**Primary roles:** backend, frontend, SRE, QA, AssureCLA owner

Deliverables:

- new rooms written to Rail by allow-listed cohort;
- old API routes proxy to Rail with identity/context translation;
- both current room UIs move to Rail APIs, then into Rail app navigation when operationally ready;
- provider-neutral completion acknowledgement/inbox/outbox;
- AssurePool adapter translates acknowledged completion to permanent lock and reconciles lock state;
- legacy-use telemetry and retirement runbook.

Acceptance evidence:

- exactly one write authority for every room;
- completion replay is idempotent and cannot make a different pool/version permanent;
- lock timeout/completion races are deterministic and repaired visibly;
- old clients continue during compatibility window; and
- rollback stops new cohort allocation without rewriting Rail-created history.

Flags: cohort `ARAIL_ROOM_WRITE_SOURCE=rail`, `ARAIL_COMPLETION_ACK_V1=shadow→on`.
Rollback: uncut cohorts remain legacy; cut cases pause/export if a Rail-only construct prevents
lossless legacy fallback.

**PR-08 implementation checkpoint (31 August 2026):** implemented locally behind default-off or
legacy-safe gates. Rail now has a maker-checker, versioned per-case write-authority assignment;
idempotent active room/invitation/declaration/message/close commands; signed connector subject
mapping; a narrow old-URL compatibility proxy; compatibility-use telemetry; provider-neutral source
completion records; bounded durable dispatch/recovery; signed exact acknowledgement comparison; and
independent reconciliation. AssurePool has an exact, idempotent completion receipt and a conditional
`CONFIRMED -> COMPLETION_PENDING -> PERMANENT` lock path. Shadow completion creates evidence but no
external mutation. The production on-book adapter remains deliberately unavailable and fails closed;
therefore no live completion claim is made. Both additive migration rehearsals, both API typechecks,
174 Rail tests and 34 focused central API tests passed. Design/decision detail:
`docs/design/AssureRail_Room_Cutover_And_Source_Completion_v1.md`; operating procedure:
`docs/runbooks/AssureRail_PR08_Room_Cutover_And_Completion.md`; executed evidence:
`docs/qa/AssureRail_PR08_Room_Cutover_Evidence.md`. Not deployed and not pushed at this checkpoint.

### PR-09 — External-action saga and conventional DA replay adapter

**Dependencies:** PR-06 and PR-08
**Effort:** 9–14 person-weeks
**Primary roles:** backend/architect, settlement/integration engineer, QA fault injection, operations,
DA domain specialist, counsel-facing BA

Deliverables:

- durable multi-leg saga replacing direct cash-first DvP sequencing;
- conventional DA route pack in `REPLAY/SHADOW`, including parties, diligence ownership, documents,
  consideration, notices, source-system/register acknowledgements and reconciliation;
- one completed historic DA replay with no money/ownership mutation;
- operational break queue, compensation/manual repair and resumption; and
- source/participant comparison report and evidence pack.

Acceptance evidence:

- kill process/network at every step and prove deterministic resume/no duplicate instruction;
- no completion until payment and legally required register/source acknowledgements reconcile;
- transferee credit decision remains participant-owned;
- trustee/assurance products are not injected where DA route does not require them; and
- historic outcome/recomputed Rail result differences are explicit, not auto-corrected.

Flag: `ARAIL_EXTERNAL_ACTION_SAGA_V1=required` for cohort,
`ARAIL_DA_REPLAY_V1=allow-list`.
Rollback: replay/shadow has no external mutation; disable cohort and export evidence.

**PR-09 implementation checkpoint (31 August 2026):** implemented locally as a domestic,
bilateral, conventional-DA `REPLAY/SHADOW` route with an `OBSERVE_ONLY` durable saga. The route has
per-case maker-checker allow-listing; explicit transferee-owned credit-decision evidence; ordered
document, exact consideration, transferor/transferee source, authoritative-register and required-
notice legs; append-only signed/final observations; independent reconciliation; a critical break
queue; maker-checker append-only repair; authoritative before/after snapshots; and JSON/CSV/stable-
digest evidence exports. The common case engine now distinguishes saga-ready, all-legs-observed and
fully-reconciled facts. It remains impossible to mount this adapter in controlled-live/production,
and the module imports no settlement, HCS, HTS or external-egress adapter. All 185 Rail tests, the
Rail build, Prisma validation and the eight-model disposable migration/upgrade/schema-drift/
constraint/backup/restore rehearsal passed. The completed-deal-shaped fixture is explicitly
anonymised reference data, not a real historic transaction. A real participant-authorised historic
DA replay remains open, as does the verified-evidence promotion/provider workflow needed to supply
`VERIFIED` evidence without manual database intervention. Design/decision detail:
`docs/design/AssureRail_Conventional_DA_Replay_And_External_Action_Saga_v1.md`; operating procedure:
`docs/runbooks/AssureRail_PR09_Conventional_DA_Replay.md`; executed evidence:
`docs/qa/AssureRail_PR09_Conventional_DA_Replay_Evidence.md`. It was subsequently committed and
pushed under the founder-approved EX-24; it was not deployed.

### PR-10 — Conventional PTC replay adapter

**Dependencies:** PR-06, PR-07 and the saga/reconciliation foundation of PR-09
**Effort:** 12–18 person-weeks
**Primary roles:** backend/architect, PTC/trustee operations specialist, data/integration, QA, BA,
security; counsel/rating/trustee/RTA/depository reviewers as external dependencies

Deliverables:

- PTC route pack for programme/trust, pool transfer, trustee, counsel, rating, servicer, accounts,
  assurance/review, documents, tranche/class, subscriptions/allotment and authoritative record;
- trustee transaction-control decision that references the route-defined RTA/depository/register;
- provider-neutral assurance appointment/result;
- lifecycle/waterfall inputs and reconciliation contracts; and
- one completed historic PTC replay with source documents and trustee-authoritative comparison.

Acceptance evidence:

- no PTC conclusion arises from a Note label or `PTC_DATA_ROOM` purpose;
- trustee acceptance cannot mask a depository/RTA discrepancy;
- selected assurance provider can be non-AssureLocker/non-AssurePlane;
- every material function has a performer classification and prohibited functions fail closed; and
- replay evidence distinguishes transaction control, legal record and Rail projection.

Flag: `ARAIL_PTC_REPLAY_V1=allow-list`.
Rollback: replay/shadow only; disable cohort, retain exportable case.

**PR-10 persistence-foundation checkpoint (1 September 2026):** the independent domestic,
conventional PTC route-pack/fixture tests are now joined by additive persistence. The common saga
records route and route-evidence digest explicitly; immutable `SagaEvidenceLink` records provide
ordered provider-neutral evidence roles; and `PtcReplayAuthorisation` keeps PTC replay approval
separate from DA approval. The migration classifies/backfills existing saga rows as DA, retains all
legacy DA evidence references and relaxes only the three DA-specific requirements so a PTC replay
does not fabricate a transferee credit decision or DA transfer document. No PTC API, UI, feature
enablement, external dispatch or public capability claim exists at this checkpoint. All 210 Rail
tests, build/schema validation, and the disposable fresh/upgrade/constraint/schema-parity/
backup-restore rehearsal passed. Executed evidence:
`docs/qa/AssureRail_PR10_Persistence_Foundation_Evidence.md`. A governed PTC replay service,
operating runbook and participant-authorised historic PTC replay remain open.

**PR-10 governed-planning checkpoint (1 September 2026):** a disabled-by-default
`ARAIL_PTC_REPLAY_V1=allow_list` gate now mounts five case-scoped governance/planning endpoints only
in `REPLAY/SHADOW` with the prerequisite neutral-case and observe-only saga flags. Saga creation
fails closed unless route, case parties, maker/checker authorisation, case version, performer
assignments and every signed/current/verified evidence binding agree. It atomically retains the
PTC saga, ordered legs, provider-neutral evidence links, authoritative-record declaration and before
snapshot. No observation, reconciliation, repair, comparison, external action or live adapter is
exposed. The full Rail suite passes 212 tests. Runbook:
`docs/runbooks/AssureRail_PR10_Conventional_PTC_Replay.md`; evidence:
`docs/qa/AssureRail_PR10_Governed_Planning_Evidence.md`.

**PR-10 service/database checkpoint (1 September 2026):** the disposable database rehearsal now
invokes the actual PTC planning service against a fully migrated synthetic database. It proves the
atomic 11-leg/19-evidence-link saga write, null DA-only references, authoritative declaration,
governed audit, identical-command replay, changed-command conflict, single-saga invariant and
backup/restore retention. This closes the previously recorded planning-service database gap. It
does not add observation/reconciliation endpoints or satisfy the external historic transaction
gate.

**PR-10 observation/reconciliation checkpoint (1 September 2026):** the same off-by-default,
case-scoped module now exposes ten endpoints: the five governance/planning routes plus append-only
initial observation, exact-result reconciliation, break listing, comparison and evidence-pack
reads. The declared leg-owner institution must supply canonical observed facts backed by a current,
signed, verified evidence version with the same digest, a final external reference, idempotency key
and case-scoped step-up. Exact and mismatched results, field-level differences, leg/saga/case state,
critical completion-blocking breaks and governed audit are committed atomically. The observation
recorder cannot reconcile the same leg; an authoritative after-snapshot is created only from an
exact recordkeeper-owned acknowledgement. The enhanced disposable database rehearsal proves
observation replay, independent reconciliation, mismatch-to-break, comparison and evidence-pack
behaviour, while the full Rail suite passes 213/213. There is still no break-repair endpoint,
external issue/allotment/cash/notice/register action, live adapter, UI or participant-authorised
historic PTC replay. Executed evidence:
`docs/qa/AssureRail_PR10_Observation_Reconciliation_Evidence.md`.

**PR-10 governed-repair checkpoint (1 September 2026):** two additional case-scoped routes now
permit the accountable leg-owner institution to propose an append-only corrected observation and a
different authorised human to approve or reject it. Approval revalidates the current signed
evidence digest and retained expectation, appends observation version 2 without rewriting version
1, atomically resolves the break and records the complete repair trail in the evidence pack.
Rejection reopens the break. The repair checker cannot also reconcile the corrected leg, so a third
authorised human is required. The disposable service/database rehearsal proves self-review denial,
exact-only application, immutable mismatch retention, break resolution, post-repair reconciliation,
zero open breaks and dump/restore survival. The module now has twelve routes but remains off by
default, `REPLAY/SHADOW`, `OBSERVE_ONLY` and free of external transaction adapters. A real
participant-authorised historic PTC replay across all required legs remains open. Executed evidence:
`docs/qa/AssureRail_PR10_Governed_Repair_Evidence.md`.

### PR-11 — Tokenised-DA representation adapter refactor

**Dependencies:** PR-06 and PR-09
**Effort:** 8–12 person-weeks
**Primary roles:** backend/ledger integration, security/key-management, QA, operations, legal BA

Deliverables:

- link existing `Note`, holdings, mint, DvP, amortise and close projections to neutral cases;
- remove hard-coded issuer/trustee actor semantics from commands;
- move external mint/burn/anchor/payment calls into saga instructions/acknowledgements;
- declare whether token is mirror or authority for the approved route (default mirror);
- supply/holding/economic-interest/authoritative-register reconciliation; and
- keep current console/API through legacy adapter.

Acceptance evidence:

- existing demo golden tests continue;
- live adapter remains disabled until connector, key-custody, finality, rollback and external smoke
  evidence pass;
- no token movement when conventional authoritative records disagree; and
- all user/institution/mandate authority derives from case context.

Flag: `ARAIL_LEGACY_NOTE_ADAPTER=on`, token adapter cohort flag added in PR design.
Rollback: retain legacy projection/read; pause external actions, never reverse confirmed external
state without approved correction process.

**PR-11 implementation checkpoint (2 September 2026):** implemented for review on
`codex/assurerail-pr01-neutral-taxonomy` under EX-26. The additive adapter links one legacy Note to
one DA/TOKENISED `TransactionCase` and its active `AuthoritativeRecordDeclaration`; authority mode
is fixed to `MIRROR`. Five case-scoped endpoints support linkage, read, observe-only action
preparation, authenticated acknowledgement observation and exact reconciliation. There is no
external dispatch endpoint and the module imports no HTS, HCS or payment adapter. Linked Notes fail
closed on direct legacy DvP, amortisation, closure, surveillance/break-glass anchoring and global
legacy reads. Supply, token positions, economic interests and the authoritative record must match;
evidence digests bind the complete submitted snapshot and mismatches open critical breaks. The
feature is off by default and rejected outside REPLAY/SHADOW. Full design and rejected shortcuts:
`docs/design/AssureRail_Tokenised_DA_Representation_PR11.md`. Executed evidence:
`docs/qa/AssureRail_PR11_Tokenised_DA_Evidence.md`. No deployment or live capability claim.

### PR-12 — Controlled pilot operating pack and production gate

**Dependencies:** PR-03 through route adapter being piloted
**Effort:** 8–14 person-weeks plus external rehearsals
**Primary roles:** SRE/platform, security, QA, operations lead, service manager, compliance/risk,
route specialist, customer/trustee integration lead

Deliverables:

- environment/credential/key/data segregation, least privilege and two-person production changes;
- runbooks for onboarding, evidence, case operation, breaks, provider outage, cyber incident,
  complaints, corrections, suspension, data export/exit, BCP/DR and regulator/trustee requests;
- RTO/RPO, backup/restore, capacity, failover and reconciliation tests;
- pilot acceptance, daily control evidence, issue register, customer exit and no-mutation rollback;
- independent security review and remediation; and
- signed production-readiness record by engineering, security, operations, product/risk and the
  relevant legal/regulatory authority holders.

Acceptance evidence:

- no unresolved critical finding, no unowned high finding and no skipped mandatory external test;
- restore/replay reconciles to external authorities;
- staffing/coverage and escalation work in rehearsal, including out-of-hours critical incidents;
- participant/trustee can export and independently verify their evidence; and
- capability registry drives all public/product claims.

Rollback: pilot stops new cases/actions; existing cases follow route-specific safe pause/repair/exit,
not a database rollback.

**PR-12 implementation checkpoint (2 September 2026):** implemented for review on
`codex/assurerail-pr01-neutral-taxonomy` under EX-27. Controlled-live and production now require an
Ed25519-signed, expiring activation manifest bound to the exact environment, operating mode, Git
build, route/function/performer/cohort allow-list, current durable gate decisions and five distinct
release approvers. External legal, security, connector, participant/trustee and operating evidence
cannot be replaced with internal or synthetic evidence. Additive persistence retains versioned
readiness gates, immutable decisions, activation proposals/approval/revocation and exact gate
bindings. Internal RBAC enforcement retires legacy platform-admin bypasses and checks separated,
time-bounded staff coverage. The implemented-live capability registry starts empty, while all six
legacy direct external-effect families reject controlled-live/production; therefore PR-12 enables
no transaction function by itself. The deployer handoff keeps the current box in `DEMO` and makes
deployment distinct from activation. The API suite passed 238/238 with zero skipped; a disposable
PostgreSQL rehearsal applied all 19 migrations and proved immutable/restrictive history plus
backup/restore. All real external acceptance gates remain open. Design:
`docs/design/AssureRail_Controlled_Pilot_And_Production_Gate_PR12.md`; executed internal evidence:
`docs/qa/AssureRail_PR12_Internal_Evidence.md`; handoff:
`docs/runbooks/AssureRail_PR12_Activation_And_Deployer_Handoff.md`.

### PR-13 — Permissioned primary commercial venue

**Dependencies:** PR-06, PR-07, PR-12 and applicable DA/PTC route packs

Build institution-scoped opportunity/term display, invitations, interest indications, RFQs,
negotiation messages, controlled term revisions, allocation proposals and accept/reject decisions.
Discovery, negotiation, matching and allocation remain separate material functions with explicit
performer assignments. No order book, anonymous public discovery, automatic match or transaction
completion is implied. Commercial records bind exact case/version, audience, validity, authority,
conflict disclosures and immutable communication history. Controlled-live capability IDs remain
unregistered until exact legal/performer, conduct, participant and operating evidence closes.

**PR-13 implementation checkpoint (2 September 2026):** implemented for review on
`codex/assurerail-pr01-neutral-taxonomy` under EX-27. The additive, shadow-only API owns named
primary opportunities, immutable exact-value term versions, institution invitation grants,
interest indications, RFQs, private negotiation messages and two-person allocations. Access is
derived from the active institution session, human mandate, case scope, named audience and current
route/function entitlement. Publication/resumption rechecks current terms, active audience and
`TERM_DISPLAY`/`SOLICITATION`/`QUOTE_INVITATION` assignments; allocations recheck current terms,
audience and `ALLOCATION` authority before review and response. Sixteen endpoints expose records
only. There is no anonymous discovery, order book, automatic matching, external solicitation,
execution, settlement, issuance, token action or authoritative-record mutation. The
`ARAIL_PRIMARY_COMMERCIAL_V1` flag defaults `off`, may be `shadow` only in `REPLAY`/`SHADOW`, and
requires the neutral case foundation. No implemented-live capability ID was added and every legal,
conduct, participant and operating gate remains open. The API suite passed 246/246 with zero
skipped; a disposable PostgreSQL rehearsal applied all 20 migrations and proved named scope,
immutable versions, idempotency, restrictive history and backup/restore. Design:
`docs/design/AssureRail_Permissioned_Primary_Commercial_Venue_PR13.md`; internal evidence:
`docs/qa/AssureRail_PR13_Primary_Commercial_Evidence.md`; handoff:
`docs/runbooks/AssureRail_PR13_Deployer_Handoff.md`.

### PR-14 — Conventional secondary DA and PTC workflows

**Dependencies:** PR-13 plus PR-09/PR-10 route foundations

Add secondary-interest intake, current-holder/prior-chain verification, seller authority, transfer
restrictions, notices/consents, document execution, cash/register legs and authoritative-record
reconciliation for conventional DA and conventional PTC. DA and PTC keep separate route rules. For
PTC the trustee transaction-control decision and route-defined depository/RTA/register evidence are
both recorded; disagreement blocks completion. Initial implementation remains replay/shadow and
cannot infer ownership from a Rail projection.

**PR-14 implementation checkpoint (2 September 2026):** implemented for review on
`codex/assurerail-pr01-neutral-taxonomy` under EX-27. Separate domestic conventional DA and PTC
secondary replay route packs now govern an additive, observation-only dossier. It records exact
quantity/consideration, active seller/buyer/recordkeeper parties (plus trustee for PTC), immutable
provider-attributed evidence versions, two-person proposal/review, ordered observation legs and
explicit critical breaks. Current-holder, prior-chain, seller-authority, restriction, executed
document, notice/consent, cash and before/after authoritative-record evidence must all be current,
case-scoped and `VERIFIED`; PTC additionally requires a separate trustee-control assertion. A
trustee/recordkeeper disagreement creates `PTC_TRUSTEE_RECORDKEEPER_DISAGREEMENT` and blocks
execution, cash and register-update functions. The five APIs cannot execute, settle, trade,
dispatch, mint, burn or update a register. `ARAIL_CONVENTIONAL_SECONDARY_V1` defaults `off`, may be
`shadow` only with the required neutral-case/saga foundation in `REPLAY`/`SHADOW`, and has no
implemented-live capability ID. The API suite passed 253/253 with zero skipped; a disposable
PostgreSQL rehearsal applied all 21 migrations and proved immutable versions, restrictive history,
schema parity and backup/restore. Synthetic rehearsal rows are structural evidence only. Design:
`docs/design/AssureRail_Conventional_Secondary_DA_PTC_PR14.md`; internal evidence:
`docs/qa/AssureRail_PR14_Conventional_Secondary_Evidence.md`; handoff:
`docs/runbooks/AssureRail_PR14_Deployer_Handoff.md`.

### PR-15 — Tokenised DA live connector and custody boundary

**Dependencies:** PR-11, PR-12 and conventional DA completion controls

Convert the observe-only tokenised-DA adapter into a connector-neutral external-instruction path
behind the durable saga. Add connector certification profiles, signing/key-custody assignments,
idempotent mint/transfer/burn/anchor acknowledgement, ambiguous-success recovery, holdings/supply/
economics/register reconciliation and safe pause. Token authority defaults to mirror. No capability
enters the implemented-live registry without independent connector, custody, legal/finality and
operating evidence.

**PR-15 implementation checkpoint (2 September 2026):** implemented for review on
`codex/assurerail-pr01-neutral-taxonomy` under EX-27; not deployed and not activated. The additive
token connector boundary provides versioned two-person custody/connector bindings, only external
signing-key references, exact per-action candidate capability IDs, a durable idempotent instruction
worker, Vault-referenced HMAC authentication, SSRF-protected HTTPS egress, cryptographically bound
final acknowledgements, ambiguous-success retry using the same idempotency key, safe pause and
mandatory post-action token/economics/authoritative-record reconciliation. The existing token
authority remains `MIRROR`; cash/payment remains outside the token connector and must use a
separately governed settlement provider/saga. Runtime foundations now have explicit `on`/`enforce` modes for later
controlled-live use, while replay features retain their non-live restrictions. The five candidate
token action IDs remain deliberately absent from `IMPLEMENTED_LIVE_CAPABILITY_IDS`: independent
connector conformance, key custody, route legal/finality, operating acceptance, security and pilot
evidence are unavailable and remain open. Consequently the activation guard rejects every PR-15
external action in this build even if an operator sets `ARAIL_TOKENISED_DA_V1=live`. Internal checks
passed 259/259 with zero skipped; the disposable PostgreSQL rehearsal applied all 22 migrations and
proved binding/action restrictions, schema parity and backup/restore. Design:
`docs/design/AssureRail_Tokenised_DA_Live_Connector_And_Custody_PR15.md`; internal evidence:
`docs/qa/AssureRail_PR15_Token_Connector_Evidence.md`; handoff:
`docs/runbooks/AssureRail_PR15_Deployer_Handoff.md`.

### PR-16 — Tokenised PTC route and representation

**Dependencies:** PR-10, PR-12, PR-15 primitives and an approved PTC route design

Implement tokenised PTC as its own PTC/TOKENISED route—not a relabelled Note or tokenised DA flow.
Bind programme/trust, class/tranche, subscription/allotment, trustee control, assurance appointment,
cash, depository/RTA/register and token representation. Add token issue/transfer/lifecycle/burn
instructions only through the saga and exact authority reconciliation. Conventional and tokenised
PTC pricing/configuration remain separate commercial facts; fees never confer legal permission.

### PR-17 — Venue conduct, surveillance, complaints and scale controls

**Dependencies:** PR-13 and the routes exposed to commercial interaction

Add conflicts/related-party disclosures, fair-access and allocation evidence, communications and
conduct surveillance, prohibited-action rules, complaints/corrections, investigation/legal hold,
kill/safe-pause controls, participant sanctions, SLA/queue ownership, capacity budgets and route/
cohort operational dashboards. Policies are versioned and outputs are evidence, not autonomous
legal conclusions. This stage supplies internal tooling required before any broad customer cohort.

### PR-18 — End-to-end customer workspaces

**Dependencies:** PR-03–PR-17 APIs relevant to the route

Build role-specific institution onboarding, opportunity, RFQ/negotiation, diligence room, case,
condition/approval, completion, lifecycle, evidence export, break and support workspaces. Customer
authority derives from membership, mandate, appointment and case role—not UI visibility. Each view
shows source/as-of/expiry/qualification and separates expected, received, verified, reconciled and
legally effective states. Legacy Note screens remain compatibility surfaces until retired by
measured use.

### PR-19 — Integration and developer experience

**Dependencies:** stable PR-13–PR-18 contracts

Provide institution-owned connector/client registration, versioned API/event documentation,
sandbox fixtures clearly labelled non-evidence, webhook challenge/replay, conformance packs,
idempotency examples, delivery health, credential rotation and migration/exit tooling. Sandboxes can
prove software conformance only; real connector certification and authoritative external evidence
remain independent activation gates.

### PR-20 — Customer operations and commercial administration

**Dependencies:** PR-12 and metered capabilities from PR-13–PR-19

Add contracts/rate cards, conventional and tokenised route fee rules, metering, invoice statement,
credits/corrections, implementation cohorts, service requests, operational reviews, renewals,
suspension/termination and full customer evidence/data exit. Commercial calculation is tenant- and
contract-scoped with exact money, effective dating and maker-checker. Pricing never changes route
authority, legal record, evidence result or completion state.

PR-13–PR-20 are product build stages, not blanket launch approvals. Each separately defines flags,
implemented capability IDs, rollback/safe-pause, internal evidence and open external gates. Public
web copy, SEO, articles and inbound campaigns follow the accepted capability registry and are not
made truthful merely by completing these code stages.

---

## 9. Test and evidence baseline

### 9.1 Tests present now

| Area | Current evidence | Interpretation |
|---|---|---|
| Rail tape verification | `verify.test.ts`, receivables demo tape test | Useful pure/fixture verification, not provider integration or production evidence |
| Rail k-anonymity | `kanon.test.ts` | Useful deterministic gate test; does not establish privacy of all new route data |
| Rail amortisation | `amortise-math.test.ts` | Useful exact allocation primitive |
| Rail trustee demo authorisation | `trustee-authorisation.test.ts` | Useful signature/binding fixture; hard-coded/demo semantics are not institutional authority |
| AssurePool | shared pool and pool-surveillance tests | Useful source-selection/manifest/performance primitives |
| Transfer room | `apps/api/test/transfer-room.test.ts` | Strong behaviour source for migration golden suite |
| AssureTransfer | phase-one golden corpus and deadline sweep tests | Product logic evidence; deadline worker is not production scheduled |
| CLA onboarding | multiple state/evidence/decision/scenario/approval/activation suites | Strong source patterns, not Rail participant admission tests |
| Entity/institution | access/policy, tiered onboarding, re-KYC, membership and regulator-related tests | Reusable controls; central service tests do not prove Rail isolation/integration |
| Connector utilities | shared adapter tests and connector server tests | Useful framework starting point; not Rail provider certification |

Previously executed checks in this working session provide a useful starting point but must remain
accurately labelled:

- PR-00 Rail build/schema/runtime/endpoint/invariant/security checks and 61 Rail unit,
  characterisation and local startup-process tests passed; Rail web built;
- CLA onboarding ran 11 suites/189 tests successfully;
- selected institution tests ran 3 suites/35 tests, with live-API portions self-skipped because the
  API was unavailable;
- evidence-trust tests passed eight cases;
- the PR-00 focused AssureTransfer room gate passed 26 tests; earlier wider AssureTransfer runs passed
  its 43-case golden corpus, 30 API/room tests and two deadline-worker tests; and
- PR-03 passed 129/129 Rail API tests and the 26/26 transfer-room gate; a disposable Postgres
  rehearsal proved all ten migrations, SHADOW module startup, inert legacy projection, bounded
  relational/concurrency constraints and backup/restore; final API/web builds, invariants,
  Gitleaks and cached-rule Semgrep checks passed. Exact environment qualifications and skipped/live
  boundaries are retained in `docs/qa/AssureRail_PR03_Authority_Evidence.md`.

These are not production acceptance because they do not yet cover a live authoritative register,
payment provider, institutional signing authority, multi-tenant isolation, fault-injected saga,
backfill or restore/reconciliation.

### 9.2 Required test layers

1. pure canonicalization, exact math, state and rule evaluation;
2. schema/contract/golden corpus for every provider and route release;
3. DB integration with real constraints, row locks, advisory locks and transaction rollback;
4. API authentication, tenant/object/function authorisation and negative access matrix;
5. concurrency/idempotency and duplicate/out-of-order inbox/outbox delivery;
6. external connector simulators for timeout, ambiguous success, duplicate ack, reversal and drift;
7. migration/backfill/dual-read comparison and rollback rehearsal;
8. security tests for SSRF, file handling, secret leakage, IDOR, privilege escalation and audit
   tampering;
9. capacity/soak tests based on bottom-up transaction, evidence, event and lifecycle volumes;
10. backup/restore and provider-exit replay; and
11. signed historic DA/PTC replay followed by shadow/pilot acceptance.

No self-skipped external test may be counted as passed production evidence. The report must display
executed, skipped, unavailable and failed counts separately.

---

## 10. Preliminary delivery roles and effort envelope

This is not the requested three-year bottom-up resource/cost plan. It identifies the skills needed
to deliver the PR programme so that the later capacity model can be built from real work packages.

### 10.1 Core build team through conventional replay

| Role | Why required | Indicative concurrent need |
|---|---|---|
| Product/domain lead | Owns case outcomes, route priority and customer/trustee acceptance | 1 |
| Staff/principal architect | Neutral kernel, boundaries, event/idempotency/saga design | 1 |
| Senior backend engineers | NestJS/TypeScript, state, authz, workflow, integrations | 3–5, ramping with PR-05 onward |
| Data engineer/DBA | Prisma/Postgres, migration, reconciliation, performance/restore | 1–2 |
| Frontend engineers | Institutional onboarding, case, room and ops workspaces | 2 |
| QA/SDET | Contract, integration, fault-injection, migration and regression automation | 2–3 |
| Security/IAM engineer | SSO, passkeys/MFA, mandates, secrets, object security and threat modelling | 1–2 |
| SRE/platform engineer | Environments, durable workers, observability, DR and release safety | 1–2 |
| Business analyst/controls analyst | Taxonomy, evidence maps, SOPs, acceptance and traceability | 2 (DA and PTC overlap) |
| DA operations/domain specialist | Transfer mechanics, documents, notices, reconciliation | 1 |
| PTC/trustee/securitisation specialist | Trust/programme, issue/allotment/register/lifecycle operations | 1–2 |
| Legal/regulatory liaison | Function/perimeter questions and counsel evidence register | 0.5–1 internal coordinator plus external counsel |
| Product/UX designer | Complex institutional workflows and evidence readability | 0.5–1 |

The preliminary PR bands through PR-12 total roughly **86–134 person-weeks**, excluding
PR-13-onward market/secondary functions, external counsel/regulatory elapsed time and customer
integration work. This is a range for decomposition, not a fundraising budget. The three-year plan
must separately model platform operations, security coverage, implementation/customer success,
trustee/route operations, legal/compliance, sales/pilots, management and 24x7 obligations as volume
and controlled-live modes ramp.

### 10.2 Stage gates for hiring/ramp

- **Foundation (PR-00–04):** architecture, two to three backend, data, one frontend, QA, security,
  BA/domain and part-time SRE.
- **Case/room/intake (PR-05–08):** add backend, second frontend, data migration and second QA.
- **DA/PTC replay (PR-09–10):** add named DA and PTC/trustee specialists, integration engineer,
  operations lead and expanded QA/fault injection.
- **Controlled pilot (PR-12):** establish service operations, incident coverage, customer integration,
  security monitoring and compliance/risk ownership before adding transaction volume.
- **Marketplace/secondary (PR-13+):** add market-structure/conduct, surveillance, complaints,
  participant operations and further licensed-partner integration only when the function route is
  approved.

---

## 11. Operating SOP work that runs alongside code

Code completion is not operational readiness. Each workstream needs an owner, maker/checker,
evidence retained, SLA, escalation and independent review where relevant.

Minimum SOP families:

1. institution application, evidence/provider exceptions, admission, recertification, suspension and
   exit;
2. membership, mandate, appointment, privileged support and emergency access;
3. connector certification, credential/key handling, provider change, outage and exit;
4. case creation, evidence lock, diligence/review, conditions, approvals and cancellation;
5. room invitation, declaration, access review, export, communication retention and closure;
6. DA completion, payment/register/source reconciliation, notice and break handling;
7. PTC trustee instruction, assurance appointment, document/rating/issue/allotment/register and
   lifecycle controls;
8. external instruction ambiguity, duplicate acknowledgement, timeout, compensation and manual
   repair;
9. document quarantine, legal hold, retention, correction and disclosure;
10. daily reconciliations, open-break ownership, ageing/escalation and closure review;
11. incident, cyber, data breach, customer/regulator/trustee communication and post-incident review;
12. backup/restore, BCP/DR, capacity degradation and provider failure;
13. complaints, conflicts, related-party service disclosure and fee/control separation; and
14. controlled release, feature-flag change, rollback/safe pause and production acceptance.

Trustee-led assurance removes the specific conflict of Rail appointing/marking its own transaction,
but it does not remove the need to separate participant admission, transaction operation, evidence
provider results, trustee decisions, external authoritative records, platform support, security
administration and reconciliation closure.

---

## 12. First implementation tranche recommended now

The first coding tranche should be **PR-00 through PR-03**, with PR-04 UI design beginning once the
PR-03 API/authority contract stabilises. This produces a safe foundation without committing yet to
untested DA/PTC legal mechanics.

As at 30 August 2026, the PR-00 through PR-04 implementation checkpoints are present locally on the
working branch. No participant-admission or route flag is live, and nothing in these checkpoints is
a deployment or production acceptance. The original code-shaping sign-off questions now stand as:

1. **Selected:** neutral contracts are runtime-inert under
   `apps/assurerail-api/src/contracts/v1`.
2. **Selected for v1:** institution APIs use `/v1/rail/...`; a participant context is the
   session-bound `X-AssureRail-Institution-Id`, never an unverified request-body actor.
3. **Partly selected:** retained signed snapshots remain usable through provider outage only until
   their own expiry/risk policy fails closed. Provider-specific refresh frequency and maximum
   offline continuity remain a PR-05 operating-policy decision.
4. **Partly selected:** PR-02 uses Vault references and a durable Postgres worker/outbox pattern.
   PR-04 therefore exposes a visibly non-authoritative connector placeholder. Encrypted object
   storage, malware service and any broader job-runner choice remain PR-05/PR-06 decisions.
5. **Selected and tested:** explicit runtime profiles separate `DEMO`, `REPLAY`, `SHADOW`,
   `SANDBOX`, `CONTROLLED_LIVE` and `PRODUCTION`; no-DB/demo adapters/demo endpoints fail the
   production-startup contract.
6. **Still required before PR-09/PR-10:** name the historic DA and PTC replay data owners and obtain
   the source/trustee/RTA/depository evidence pack for the PTC example.

These questions affect interfaces or infrastructure choices. They do not reopen the selected
product boundaries above.

The first tranche must not implement marketplace matching, PTC minting, public copy changes or a
big-bang room move. Its measurable outcome is narrower and more valuable: a versioned neutral
contract, durable/idempotent integration foundation, and institution/mandate/route admission model
that can safely support the subsequent transaction case.

---

## 13. Traceability and maintenance

- Every implementation PR references the relevant `PR-xx`, finding IDs and target records in this
  document.
- A disposition change records founder/product decision, architecture reason, legal/operating input,
  migration impact and date; it is not silently edited.
- The as-built tables are updated after each merged tranche, while the original repository baseline
  remains in the header for auditability.
- Capability claims are generated from accepted route/function/operating-mode evidence, not from
  code presence or future scope.
- The eventual three-year resource/cost plan uses these PR/SOP work packages, transaction/evidence
  volume assumptions, service hours and external-provider obligations as bottom-up drivers.
- The PR-00–PR-10 review boundary and remaining historic PTC evidence gate are recorded in
  `docs/qa/AssureRail_PR00_PR10_Review_Handoff.md`; the controlled external intake is defined in
  `docs/templates/AssureRail_Historic_PTC_Replay_Evidence_Intake_v1.md`.
- The trustee/originator pilot execution plan, responsibilities, work packages, gates and acceptance
  sequence are recorded in `docs/operations/AssureRail_Historic_PTC_Replay_Pilot_Plan.md`.
