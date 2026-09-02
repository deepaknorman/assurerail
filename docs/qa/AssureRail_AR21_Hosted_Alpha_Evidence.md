# AssureRail AR-21 hosted-alpha evidence

**Status:** internally implemented and checked under EX-28; not deployed, activated or customer
accepted
**Date:** 2 September 2026
**Scope:** institution-scoped action centre and customer journey consolidation

## 1. Result

AR-21 adds a shadow-only hosted-alpha layer over the PR-03–PR-20 governed records. It gives an
active institution member a deterministic queue of visible work without creating a new source of
authority or copying confidential record payloads into notifications.

The API derives tasks only after `VIEW_INSTITUTION`, then independently evaluates the exact action
needed for each task family. Queries remain institution-, case- or named-offeree scoped. The
customer header no longer requests the legacy platform-wide `/venue/activity` feed while an
institution is active: it requests the same scoped action response used by the dedicated action
centre. Platform activity remains available only to an administrator with no acting institution.

## 2. Implemented evidence

| Control | Evidence |
|---|---|
| Fail-closed flag | `ARAIL_HOSTED_ALPHA_V1` and `NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1` accept only `off` or `shadow` and default to `off` |
| Runtime boundary | API startup rejects hosted alpha without participant-admission and transaction-case foundations or outside `REPLAY`/`SHADOW` |
| Session scope | Path institution must equal the authenticated session's active institution |
| Authority | Task visibility is filtered by evaluated institution actions; every destination API remains authoritative |
| Tenant isolation | Case work is limited to owned/active-party cases; governance, evidence, allocation and service queries use the active institution |
| Confidentiality | Tasks contain concise source metadata and a destination link, not document bodies, negotiation messages, monetary terms or evidence bytes |
| Determinism | Priority, due state, due time and stable ID define task order; due-soon means within 72 hours |
| Honest state | Empty results explicitly do not mean external or transaction gates are complete; unavailable data is not converted to zero |
| Customer UI | Workspace summary, dedicated `/workspace/tasks` page, category filters and scoped header notifications |
| Accessibility baseline | Semantic headings, live result region, button controls, visible labels and responsive task layout |

Task sources implemented in this stage are pending mandates, route entitlements, institutional
status changes, appointments, case-party invitations, open case conditions, proposed decisions,
open reconciliation breaks, evidence quarantine/expiry, named allocation responses and active
service requests.

## 3. Automated checks

| Check | Result |
|---|---|
| AssureRail API TypeScript typecheck | Passed |
| AssureRail API unit/contract/configuration suite | Passed; 299 tests, 0 failed, 0 skipped |
| AR-21 web boundary check | Passed |
| PR-18 customer-workspace regression check | Passed |
| AssureRail production web build | Passed; `/workspace/tasks` generated |
| Diff whitespace check | Passed |
| Freeze-boundary worktree check | Passed under EX-28 for explicitly staged files |

The first full API run exposed an incorrect source-file lookup in the new compiled contract test;
the test was corrected to inspect compiled modules and the complete suite then passed. The first
web build could not fetch declared Google font assets inside the restricted network sandbox; the
same production build passed with network access. Neither event was treated as acceptance evidence
until the successful rerun.

## 4. Open evidence and exclusions

- No customer or trustee has accepted the task taxonomy, priority, wording or workflow.
- No multi-institution DB integration test, accessibility audit or usability session is claimed by
  this stage.
- No external data, provider action, money, token, ownership record or legal completion fact is
  changed.
- No email, SMS, push or webhook notification is sent; those channels require AR-29 provider and
  consent controls.
- No task can close a condition, approve a decision, resolve a break, accept an allocation or alter
  a service request. It only links to the separately authorised destination.
- Controlled-live and production remain prohibited for this feature. The PR-12 activation manifest
  and all external route gates remain independently controlling.

## 5. Acceptance classification

**Internal code acceptance:** passed.

**Hosted-alpha deployment:** not performed.

**Customer acceptance, controlled-live and production:** open and not implied.
