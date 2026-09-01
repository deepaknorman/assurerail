# AssureRail conventional secondary DA/PTC — PR-14

**Status:** implemented internal replay/shadow foundation under EX-27; not deployed and not live.
**Date:** 2 September 2026
**Authority:** EX-27 in `docs/qa/PRODUCT_FREEZE.md`.

## 1. Result

PR-14 adds a deliberately non-mutating conventional secondary-transfer dossier to the neutral Rail
case. It supports domestic DA and domestic PTC as separate route packs. It can retain and compare a
completed historic transaction, but it cannot execute a trade, move cash, change title, update an
RTA/depository/register, solicit a counterparty, mint/burn a token or mark a function legally
effective.

The design reuses the PR-09/PR-10 evidence and reconciliation discipline without creating a second
settlement engine. The PR-14 record is the route-specific secondary dossier; later approved live
work must execute through the durable external-instruction/saga boundary and PR-12 activation
manifest rather than through these five APIs.

## 2. Separate route packs

| Fact | Conventional DA secondary | Conventional PTC secondary |
|---|---|---|
| Route pack | `domestic-conventional-da-secondary-replay` | `domestic-conventional-ptc-secondary-replay` |
| Representation | `CONVENTIONAL` | `CONVENTIONAL` |
| Lifecycle leg | `SECONDARY_TRANSFER_OR_TRADE` | `SECONDARY_TRANSFER_OR_TRADE` |
| Allowed case/runtime modes | `REPLAY`, `SHADOW` | `REPLAY`, `SHADOW` |
| Trustee | Prohibited from being injected as a DA requirement | Required as a separate active case party and function performer |
| Legal holding record | Route-declared external recordkeeper | Route-declared depository/RTA/register, with trustee transaction control separately retained |
| Rail authority | None; retained comparison only | None; retained comparison only |

Both routes require an active seller, buyer and recordkeeper case party; PTC additionally requires
an active trustee. Seller and buyer must be different admitted institutions. The case must have
effective, non-prohibited assignments and entitlements for secondary transfer/trading, execution,
cash settlement and authoritative-register update. PTC also requires trustee transaction control.

## 3. Evidence taxonomy and gate

The dossier uses immutable versions of these evidence facts:

1. current holder;
2. prior transfer chain;
3. seller authority;
4. transfer restrictions;
5. executed transfer document;
6. notice and consent;
7. cash settlement;
8. authoritative record before;
9. authoritative record after; and
10. trustee transaction control, PTC only.

An evidence record is accepted only when its Rail evidence object is `AVAILABLE`, case-scoped, its
latest version is the current pointer, validation is `VALID`, result is `VERIFIED`, it is not
expired, and the named provider agrees with the retained provider reference (or evidence owner when
no provider reference exists). The assertion digest is separate from the evidence payload digest:
the payload proves retained bytes; the assertion digest is the exact route fact being compared.

There is no fallback to `PARTIALLY_VERIFIED`, `REVIEW_REQUIRED`, missing evidence or a provider's
general capability. Missing evidence stops the dossier in `COLLECTING` and is therefore an open
gate. Test fixtures prove software behaviour only and can never close a participant, trustee,
recordkeeper, cash or legal evidence gate.

## 4. Workflow and authority

1. The case-owning seller creates one dossier with exact quantity and consideration values.
2. A seller operator records evidence using active human mandate and single-use step-up evidence.
3. The service retains successive evidence versions; it never overwrites an earlier assertion.
4. The seller maker proposes only when every route-required latest evidence item is verified.
5. A different seller human reviews the proposal. Maker and checker cannot be the same user.
6. Approval materialises immutable ordered observation legs. Rejection retains the proposal.
7. A matched historic dossier becomes `RECONCILED`; an authority discrepancy becomes
   `BREAK_OPEN` and creates an explicit critical break.

All governed commands use case/institution authority, an advisory lock or optimistic state/version
guard, consumed step-up evidence and an audit append in the same database transaction.

## 5. Trustee and authoritative record rule

For PTC, trustee control and the operative record are not collapsed. The trustee evidence asserts
the exact expected post-transfer result. The recordkeeper evidence independently asserts the
observed post-transfer result. If the digests disagree, Rail creates
`PTC_TRUSTEE_RECORDKEEPER_DISAGREEMENT`, assigns it to the trustee, marks every observation leg
`BREAK_OPEN`, and blocks execution, cash settlement and authoritative-register update capability.

The trustee remains the final transaction-control authority in the Rail workflow. The route-defined
depository/RTA/register remains the legally operative record where applicable. Neither authority is
replaced by a Rail row, token, UI state or trustee email.

## 6. API and data boundary

The five case-scoped APIs are: read dossier, create dossier, record evidence, propose, and review.
There is deliberately no endpoint named execute, trade, settle, dispatch, mint, burn or update
register. Persistence is additive and restrictive:

- `SecondaryTransfer` — one exact-valued route dossier per case;
- `SecondaryTransferEvidence` — immutable evidence type/version/provider/assertion facts;
- `SecondaryTransferLeg` — ordered result of independent review; and
- `SecondaryTransferBreak` — explicit owner, severity, blocked functions and retained comparison.

## 7. Flags, rollback and activation

`ARAIL_CONVENTIONAL_SECONDARY_V1` defaults to `off`. `shadow` requires participant admission,
neutral ingress and transaction-case shadow foundations plus `ARAIL_EXTERNAL_ACTION_SAGA_V1=required`.
The runtime rejects it outside `REPLAY`/`SHADOW`. PR-14 adds no implemented-live capability ID.

Rollback sets the flag to `off` and restarts. It does not delete or rewrite dossiers. Because no
external action exists, there is no external compensation on rollback. A future controlled-live
implementation will require its exact capability to be added to the live registry and a signed
PR-12 manifest whose external gates include route permission, connector certification, operating
acceptance and participant evidence.

## 8. Explicitly not claimed

- no secondary matching, order book or marketplace;
- no legally effective DA assignment or PTC transfer;
- no payment, depository, RTA or trustee connector certification;
- no independent legal or operating acceptance;
- no completed historic customer replay from synthetic fixtures; and
- no controlled-live, production, public-copy or revenue-readiness claim.
