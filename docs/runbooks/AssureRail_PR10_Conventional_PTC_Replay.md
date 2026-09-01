# AssureRail PR-10 conventional PTC replay runbook

**Status:** internal planning-stage procedure, 1 September 2026

**Perimeter:** domestic India, conventional PTC, initial issuance, historic `REPLAY/SHADOW`,
`OBSERVE_ONLY`. This procedure is not a live issuance, allotment, settlement or authoritative-record
procedure.

## 1. Enablement prerequisites

The planning module is off unless all of the following are explicitly set in a persistent,
authenticated `REPLAY` or `SHADOW` runtime:

```text
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_NEUTRAL_INGRESS_V1=shadow
ARAIL_TRANSACTION_CASE_V1=shadow
ARAIL_EXTERNAL_ACTION_SAGA_V1=required
ARAIL_PTC_REPLAY_V1=allow_list
```

Do not enable the PTC flag in demo, sandbox, controlled-live or production. No environment flag is
regulatory approval or evidence that a customer/route is accepted.

## 2. Case preparation

1. Create a case with route `PTC`, representation `CONVENTIONAL`, jurisdiction `IN`, market context
   `DOMESTIC`, placement `PRIVATE_PLACEMENT`, lifecycle leg `INITIAL_TRANSFER_OR_ISSUE`, and the exact
   approved route-pack reference/version.
2. Record active originator, trustee and route-defined recordkeeper case parties. The trustee and
   recordkeeper functions remain separate even when the same institution performs both.
3. Record one current, non-prohibited function assignment for every required material function.
   Conditional counsel, rating, assurance and servicing functions must be assigned whenever they
   are present in the replay input.
4. Complete the ordinary case evidence, condition, decision and maker/checker transition controls
   until the case is independently `APPROVED_FOR_EXECUTION`.
5. Do not use a Note, token, `PTC_DATA_ROOM`, email, UI label or provider capability declaration as
   PTC evidence.

## 3. Evidence preparation

Every evidence binding must be an `AVAILABLE` case-scoped object whose latest version is valid,
signature-verified, result-verified and unexpired. The object owner and payload digest must match
the declared role. Required core roles are programme/trust, trustee appointment, pool transfer,
pool eligibility, executed documents, tranche definition, subscription, trustee control,
issue/allotment, authoritative-record declaration and before snapshot, required notice
acknowledgement, and historic PTC outcome. Add counsel, rating, assurance appointment/result,
servicer appointment and collection-account evidence where declared.

An expected provider cross-check is not achieved evidence. Quarantined, stale, superseded,
partially verified or unverified evidence cannot be used.

## 4. Maker/checker allow-listing

1. The case owner proposes PTC replay authorisation with a unique idempotency key, retained authority
   evidence reference, reason and case-scoped step-up evidence.
2. A different authorised human reviews it with a second idempotency key, reason and step-up.
3. Reject or stop if route parties/functions changed after proposal. Approval is case-specific and
   does not authorise another transaction.

## 5. Saga planning

Submit the expected case aggregate version, complete route input, explicit evidence-object bindings,
legal mechanism, historic outcome reference/digest, authoritative-record declaration reference and
before-snapshot time, reason and step-up evidence. The service must either atomically write the
case-version increment, PTC saga, ordered evidence links, ordered legs, authoritative declaration,
before snapshot and governed audit, or write none of them.

Confirm after creation:

- `transactionRoute=PTC` and `executionMode=OBSERVE_ONLY`;
- route-pack reference/version and plan/evidence-bundle digests are retained;
- trustee-control and authoritative-record legs are distinct and ordered;
- no DA-specific credit-decision or transfer-document field was fabricated; and
- no external instruction, outbox delivery or provider action was created.

## 6. Current stop boundary

This checkpoint does not expose commands to record observations, reconcile legs, repair breaks,
export a comparison, issue/allot a PTC, move cash, deliver notices or update an RTA/depository/
register. Stop after plan verification. Do not manipulate database rows to simulate the next phase.

## 7. Disable and retain

Set `ARAIL_PTC_REPLAY_V1=off` and restart the non-live environment to remove the planning routes.
Do not delete saga, evidence, authorisation or audit history. Export the case/evidence references and
record the reason for suspension. Since this stage dispatches no external action, rollback requires
no money/title compensation.

## 8. Gate before completed replay acceptance

Obtain the named historic transaction data owner, permission to use the evidence, actual trustee
control decision, route-defined RTA/depository/register before/after acknowledgements, and required
counsel/rating/assurance evidence. The append-only observation/reconciliation/export phase and its
tests must be implemented before that evidence can be replayed and accepted.
