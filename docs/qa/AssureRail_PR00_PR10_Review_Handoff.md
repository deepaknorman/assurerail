# AssureRail PR-00–PR-10 review handoff

**Review baseline:** `389b3089f`, branch `codex/assurerail-pr01-neutral-taxonomy`, 1 September 2026

**Deployment status:** not deployed

**Purpose:** give engineering, product, operations, security, trustee and legal reviewers one
evidence-based map of what has been implemented through PR-10, what remains deliberately disabled,
and what external evidence is required before a historic PTC replay can be accepted. This is not a
production-readiness certificate, regulatory opinion or public capability statement.

## 1. Controlling product boundary

- AssureRail is the target transaction infrastructure for DA and PTC, conventional and authorised
  tokenised representations. Matching, secondary trading and live transaction functions remain
  separately gated future scope.
- AssurePool remains a DA-only tape-preparation product in the AssureCLA suite. AssureTransfer
  remains parallel product logic. Rail consumes them only through neutral adapters/contracts.
- Conventional DA and conventional PTC have distinct route packs. PTC is not a renamed Note,
  `PTC_DATA_ROOM` purpose or token demonstration.
- The trustee owns the final PTC transaction-control decision. The route-defined RTA, depository or
  register remains the legally operative authoritative record where applicable. A discrepancy
  between them blocks completion.
- Trustee-appointed assurance is provider-neutral. AssurePlane may be used but is not compulsory;
  AssureLocker is not a privileged evidence source.
- Every PR-09/PR-10 transaction path is historic `REPLAY/SHADOW` and `OBSERVE_ONLY`. It cannot move
  money, issue/allot a PTC, deliver a notice, update a register, mint/burn a token or dispatch an
  external instruction.

## 2. Phase and commit register

| Phase | Principal commits | As-built outcome | Executed evidence |
|---|---|---|---|
| PR-00 | `a2291c051`, `6b1d74e5a` | Current endpoint/access inventory, unsafe-sequence characterisation, explicit operating modes and production/demo startup guards | `docs/qa/AssureRail_PR00_Characterisation_Evidence.md` |
| PR-01 | `8b0f7bef0`, `4fac05cfe` | Versioned neutral taxonomies/envelopes, exact values, canonical digests and lossless AssurePool/AssureTransfer mappings | `docs/qa/AssureRail_PR01_Neutral_Contract_Evidence.md` |
| PR-02 | `d84e67020`, `da48cd769` | Durable idempotency/inbox/outbox foundation, webhook egress controls, retries/dead letter and additive migration | `docs/qa/AssureRail_PR02_Persistence_Evidence.md` |
| PR-03 | `06c39deef`, `cf5ceceed` | Rail-local institutions, admission, membership, mandates, appointments, entitlements and provider-neutral identity snapshots | `docs/qa/AssureRail_PR03_Authority_Evidence.md` |
| PR-04 | `5562ba91e`, `3d1540b25` | Institutional governance workspaces and separated platform/institution oversight views | `docs/qa/AssureRail_PR04_Institutional_Workspace_Evidence.md` |
| PR-05 | `e5d74eac6`, `e09fe88c8` | Immutable provider-neutral evidence/intake, document/object controls, connector profiles and legacy projections | `docs/qa/AssureRail_PR05_Evidence_Intake_Evidence.md` |
| PR-06 | `5babbc8ae`, `fa2a900ac` | Neutral transaction case, parties, functions, conditions, approvals, transitions, optimistic concurrency and replay | `docs/qa/AssureRail_PR06_Transaction_Case_Evidence.md` |
| PR-07 | `1f7be9ca1`, `8cbdd498e` | Rail-owned neutral rooms, sealed legacy-chain migration, parity comparison and passive-diligence policy | `docs/qa/AssureRail_PR07_Case_Room_Evidence.md` |
| PR-08 | `231eb6e95`, `bdc851ab4` | Governed room write-authority cutover and provider-neutral source-completion acknowledgement | `docs/qa/AssureRail_PR08_Room_Cutover_Evidence.md` |
| PR-09 | `8636f7742`, `59b447430` | Observe-only conventional DA replay, participant-owned decisions, ordered observations, exact comparison, breaks, repair, reconciliation and exports | `docs/qa/AssureRail_PR09_Conventional_DA_Replay_Evidence.md` |
| Internal RBAC | `2af88eb39`, `b5c0fee8a`, `31da0acb5`, `79927951d` | Governed internal roles/workspaces and fail-closed prohibition on premature enforcement | Internal-access design/evidence and EX-25 record |
| PR-10 route/foundation | `ee9584e71`, `6c193917b` | Independent domestic conventional-PTC route pack plus additive PTC authorisation/evidence persistence | `docs/qa/AssureRail_PR10_Persistence_Foundation_Evidence.md` |
| PR-10 planning | `ba85ce9ee`, `51f8033ee` | Case-scoped maker/checker allow-listing and atomic 11-leg/19-evidence-link saga planning | `docs/qa/AssureRail_PR10_Governed_Planning_Evidence.md` |
| PR-10 observation | `204038638` | Participant-owned append-only observations, exact comparison, completion-blocking breaks, independent reconciliation and evidence reads | `docs/qa/AssureRail_PR10_Observation_Reconciliation_Evidence.md` |
| PR-10 repair | `389b3089f` | Append-only corrected observations, proposal/review separation, rejection/reopen, exact-only application, three-person post-repair reconciliation and complete repair evidence | `docs/qa/AssureRail_PR10_Governed_Repair_Evidence.md` |

## 3. PR-10 as-built surface

The module is off by default and mounts only when the neutral admission, intake, transaction-case
and observe-only saga prerequisites are enabled in a persistent authenticated `REPLAY` or `SHADOW`
runtime. Its 12 case-scoped routes provide:

1. authorisation read, proposal and independent review;
2. saga list and atomic plan creation;
3. initial participant-owned observation and independent exact-result reconciliation;
4. break listing;
5. repair proposal and independent approval/rejection;
6. comparison; and
7. evidence-pack export.

The planned saga contains 11 ordered legs and 19 role-bound evidence links for the synthetic full
route fixture. Trustee transaction control and authoritative-record acknowledgement are distinct
legs. DA-only credit-decision and transfer-document references remain null rather than being
fabricated.

## 4. Controls reviewers should challenge

| Control question | Expected answer/evidence |
|---|---|
| Can a feature flag make PTC live? | No. Runtime validation accepts only `REPLAY/SHADOW`; saga execution is `OBSERVE_ONLY`; perimeter tests reject transaction adapters |
| Can one institution act for another? | No. Case participation, active membership, mandate, route authority and declared leg ownership are independently checked |
| Can the observation recorder approve their own result? | No. A different human must reconcile |
| Can the repair maker approve their own correction? | No. Maker/checker is enforced with separate step-up ceremonies |
| Can the repair checker also reconcile? | No. A third human is required after repair |
| Can a mismatch be overwritten? | No. The bad observation remains version 1; correction is appended as version 2 |
| Can trustee approval hide a register mismatch? | No. The authoritative-record leg/snapshot is distinct and mismatches block completion |
| Can expected provider capability become verified evidence? | No. The latest retained evidence version must be current, valid, signed, verified and digest-matched |
| Can a retry duplicate a saga, observation, repair or reconciliation? | No. Command-scoped idempotency and compare-and-set state changes retain/replay the original result |
| Does repair dispatch an external correction? | No. It repairs only the historic Rail evidence interpretation; no external adapter is imported or called |

## 5. Verification result at handoff

- `apps/assurerail-api` build passed.
- Full API suite: 213 passed, 0 failed, 0 skipped.
- Disposable PostgreSQL PR-10 rehearsal passed fresh migration, synthetic planning, identical-command
  replay, exact observation, mismatch, rejection/reopen, approval/apply, third-person reconciliation,
  additive DA upgrade, schema parity and dump/restore.
- Final synthetic state: one 11-leg PTC saga, 19 plan evidence links, two reconciled legs, nine
  intentionally unobserved later legs, one rejected repair, one applied repair and zero open breaks.
- Pre-push gitleaks and Semgrep gates passed for `204038638` and `389b3089f`.
- No deployment was performed.

## 6. Deliberately not established

- No real participant/trustee-authorised historic PTC transaction has been replayed.
- No claim has been established for live PTC issuance, allotment, settlement, notice delivery,
  register update, matching, distribution, secondary trading or tokenised PTC.
- No PTC customer UI has been accepted. The current work is API/domain/operating evidence, not a
  finished customer venue.
- No production operations pack, counsel permission conclusion, licensed-performer conclusion or
  signed production-readiness decision has been supplied by this PR.
- PR-11 tokenised-DA representation refactoring and PR-12 controlled-pilot production gates have not
  been started in this continuation.

## 7. External historic PTC replay gate

The next acceptance step requires a named transaction data owner and permission to use one completed
domestic conventional PTC transaction. The required intake is defined in
`docs/templates/AssureRail_Historic_PTC_Replay_Evidence_Intake_v1.md`.

Until that pack is received through an approved secure channel and accepted by the trustee/data
owner, engineering may test only synthetic structures. It must not invent missing documents,
signatures, decisions, register acknowledgements or dates, and must not mark PR-10 complete on the
basis of the synthetic rehearsal.

## 8. Requested review decisions

Reviewers should record one of `ACCEPT`, `ACCEPT_WITH_ACTIONS` or `REJECT` for each item:

1. neutral product/route boundary and absence of AssureLocker/AssurePlane compulsion;
2. PTC party/function/evidence taxonomy and 11-leg ordering;
3. trustee-control versus authoritative-record separation;
4. participant authority, maker/checker and three-person repaired-leg separation;
5. exact comparison, append-only correction and reconciliation-break semantics;
6. evidence-pack completeness and independent verifiability;
7. external historic evidence owner, secure intake method and permitted retention/redaction; and
8. permission to run the all-leg historic replay in a non-live environment.
