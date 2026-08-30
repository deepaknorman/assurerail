# AssureRail PR-06 transaction-case operating runbook

**Mode:** replay/shadow only; no external transaction mutation

**Owners:** case operations, participant administrators, route/domain analyst, evidence operations,
security/IAM, database/platform operations and independent decision checker

## Enablement prerequisites

1. Apply migrations through `20260830230000_assurerail_pr06_transaction_case` in the target non-live
   database and retain migration/backup/restore evidence.
2. Declare runtime `REPLAY` or `SHADOW`; set participant admission, neutral ingress and transaction
   case to `shadow`. Do not enable the module in DEMO, SANDBOX, CONTROLLED_LIVE or PRODUCTION.
3. Admit each institution, activate each human membership and approve only necessary `VIEW_CASE`,
   `OPERATE_CASE`, `VIEW_EVIDENCE` and `MANAGE_EVIDENCE` mandates. Use case-specific mandates where
   narrower authority is required.
4. Approve an exact replay/shadow route entitlement for each case owner and intended function
   performer. A taxonomy value or code deployment is not an entitlement.
5. Identify the route-pack owner and retain the exact approved reference/version. PR-06 does not
   supply DA/PTC legal rules.

## Create and invite

1. Generate a stable client idempotency key and canonical case request. Record DA/PTC,
   conventional/tokenised, jurisdiction, market/placement, lifecycle leg, asset class and replay or
   shadow separately.
2. If any classification is `OTHER_APPROVED`, include the approved extension profile. Stop if it is
   absent.
3. Confirm the owner has the exact admission, mandate and route entitlement. Obtain `CASE_CREATE`
   step-up and create the case.
4. On idempotency conflict, compare request digests. Do not retry changed content under the same key
   or fabricate a second case reference.
5. Owner proposes each counterparty with authority evidence. The named institution independently
   accepts through its active context and step-up. A proposed party has no case/evidence access.

## Prepare, evidence-lock and review

1. Create specification revisions only in `DRAFT`/`INTAKE_OPEN`. An identical digest is a replay;
   changed reasoning for the same bytes is a conflict requiring review.
2. Assign every material function. Confirm performer institution is an active party with an exact
   route entitlement. Retain appointment, authority and permission evidence according to performer
   class.
3. Add precedent/subsequent conditions with accountable institution, due date and waiver authority.
   Satisfaction needs available evidence scoped to this case. Waiver is prohibited without declared
   waiver authority.
4. Ingest evidence through a certified provider profile. Confirm owner/active-party scope, latest
   validation, expiry and qualification. `REVIEW_REQUIRED` is not a passing assurance result.
5. Before `EVIDENCE_LOCKED`, run the evidence inventory and confirm no unavailable, quarantined,
   expired or unscoped item. After lock, do not alter case specification, parties, functions or
   evidence versions.
6. A maker proposes the case decision. A different mandated checker confirms the unchanged evidence
   bundle and route-pack version before approval.

## Transition and replay

1. Read the current aggregate version immediately before a command.
2. Use a new idempotency key for a genuinely new transition. Bind command, target, expected version,
   reason and step-up evidence. An identical retry returns the original transition.
3. Treat `409` stale/concurrent results as a signal to reload the full case and compare, never as
   authority to force the state.
4. Run replay after material review stages and before cohort acceptance. `REPRODUCED` means the
   retained Rail state spine and export hash reproduce; it does not prove external legal effect.
5. A replay failure or evidence-bundle drift blocks progress and enters the operations issue queue.

## Block, cancellation and safe stop

- Move to `BLOCKED` with a specific retained reason when evidence, authority, route policy or
  reconciliation becomes uncertain. Recovery needs an approved decision for the exact target.
- Cancellation needs independent `CASE_CANCELLATION` approval. Do not use cancellation to hide a
  failed external effect; PR-06 cannot create one.
- Disable `ARAIL_TRANSACTION_CASE_V1` to stop the new routes. Retained case/evidence history remains
  exportable and is never deleted as rollback.
- Suspend institution/member/mandate for authority incidents; suspend connector for evidence-source
  incidents. Preserve the distinction.
- Do not switch legacy room or Note write authority in this runbook. PR-07/08 define that cutover.

## Daily evidence and handover

Retain created/replayed case counts, status/age, stale-command conflicts, evidence-lock failures,
maker/checker identity and mandate IDs, open conditions, prohibited/unassigned functions, replay
failures and any case held `BLOCKED`. Report executed, failed, skipped and unavailable checks
separately. A zero error count is not production acceptance.
