# AssureRail conventional DA coordinated-closing rehearsal

**Classification:** INTERNAL  
**Mode:** dry rehearsal only; no live money, no legal completion claim

## Objective

Exercise the complete evidence and control chain for a conventional DA closing without sending
an external payment instruction. The rehearsal tests readiness, authorisation, provider-response
handling and repair. It does not test or claim atomic legal transfer.

## Rehearsal pack

1. Freeze the programme, seller-specific cohort and purchase-consideration schedule.
2. Record each condition precedent as pending, satisfied, waived or blocked. A satisfied item
   carries evidence; a waiver carries the authorised decision reference.
3. Fill required executed-document slots with immutable evidence-version references and payload
   digests. Preserve replacement versions rather than rewriting history.
4. Generate the seller-specific distribution schedule. Debt release, seller net proceeds,
   AssureRail fees, third-party expenses and tax must sum exactly to gross consideration.
5. Bind the schedule to a provider profile, VAN reference where available, seller mandate and
   accepted-waterfall digest.
6. Require distinct seller and buyer authorisers to approve the exact closing-pack digest using
   step-up evidence. AssureRail has no unilateral release authority.
7. Submit only to the local provider sandbox or mock with a unique idempotency reference per leg.
8. Reconcile every leg to provider acknowledgement and VAN/bank evidence.

## Injected failure cases

| Failure | Required behaviour |
|---|---|
| Required CP remains pending | Pack remains not ready; no authorisation |
| Executed document is missing | Pack remains not ready |
| Distribution schedule does not balance | Instruction rejected |
| Same person attempts seller and buyer approval | Authorisation rejected |
| Provider accepts but times out before outcome | Stop automatic retry; query by idempotency/provider reference |
| One leg settles and a later leg fails | Preserve original facts; reconcile statements; obtain dual approval for any corrective instruction |
| Provider amount differs | Reconciliation rejected and exception opened |
| VAN shows a credit without matching provider leg | Never infer successful settlement from VAN alone |

## Evidence to retain

- frozen closing pack and digest;
- CP and document-slot history;
- authorisation evidence and actor/institution scopes;
- exact instruction and idempotency references;
- provider observations and statement/VAN reconciliation;
- append-only repair decisions;
- separate legal-status confirmation from counsel or authorised parties.

## Release boundary

The current implementation is a deterministic dry-rehearsal library with local tests. Live bank
or escrow submission remains disabled until a named provider has supplied its contract, sandbox,
authentication, callback-signing, idempotency and reconciliation specification and both the
provider and AssureRail have accepted the operating procedure.

## Future Plaza signature adapter

The closing-pack digest is deliberately provider-neutral so a later Plaza integration may collect
institutional multi-signatures without changing the underlying pack. That signature would evidence
approval; it would not itself establish legal assignment or instruct a bank unless the transaction
documents and appointed provider expressly recognise it.

Plaza is not a dependency for the first conventional DA. Its stronger prospective use is in PTC,
where trustee, servicer and account-bank approvals may govern waterfall versions, distributions,
reserve releases and exceptional corrections, and in a regulator-approved tokenisation or CBDC
sandbox. Any adapter remains disabled until identity, key custody, signer authority, revocation,
quorum, recovery and legal-recognition requirements are accepted by the relevant parties.
