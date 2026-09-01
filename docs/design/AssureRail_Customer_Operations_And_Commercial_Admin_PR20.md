# AssureRail customer operations and commercial administration — PR-20

**Status:** implemented under EX-27 for review; not deployed or activated
**Operating boundary:** replay/shadow customer relationship administration only

## Outcome

PR-20 adds the durable customer-operating layer that sits beside, and cannot control, transaction
execution. It includes:

- versioned institution contracts, effective dates, renewal reviews and customer acceptance;
- versioned rate cards with route, representation, lifecycle-leg and metric-specific rules;
- exact usage events, statement lines and contract-scoped invoice statements;
- maker-checker credits/corrections and invoice issuance;
- replay/shadow implementation cohorts with retained gate references;
- customer service requests, attributable messages, SLA deadlines and escalation levels;
- periodic operational-review records; and
- a high-water-marked, digest-bound customer evidence/data exit package.

The participant UI is `/workspace/operations`. The API flag
`ARAIL_CUSTOMER_OPERATIONS_V1` and web build flag
`NEXT_PUBLIC_ASSURERAIL_CUSTOMER_OPERATIONS_V1` both default to `off`. The only implemented value
is `shadow`, and it is accepted only in `REPLAY` or `SHADOW` with participant admission,
institution integration and internal RBAC already enabled. There is no PR-20 live capability ID.

## Selected commercial model

AssureRail is not assumed to be fixed-fee. A rate rule may be fixed minor units, minor units per
unit, or basis points of an exact minor-unit notional. The current agreed PTC examples are retained
as contract-configurable commercial terms:

- conventional PTC: 30 basis points, or 0.30%, of the contracted transferred notional; and
- tokenised PTC: 50 basis points, or 0.50%, of the contracted transferred notional.

They are not hard-coded platform defaults. A customer contract and independently approved rate
card must name the route, representation, lifecycle leg, metric, currency, decimal scale,
effective period, rounding mode and any minimum/maximum. This preserves the ability to negotiate
other DA/PTC, primary/secondary and customer-specific terms without changing transaction policy.

The exact test corpus includes the agreed illustrations:

- 55% of INR 300 crore at 30 bps produces INR 0.495 crore; and
- 55% of INR 4,000 crore at 30 bps produces INR 6.6 crore.

These tests prove arithmetic only. They do not prove volume, customer count, revenue recognition
or a binding commercial agreement.

## Authority and maker-checker

Participant reads and actions require the path institution to equal the active session
institution. The server then checks active membership and an exact action mandate. Customer
acceptance, service-request creation/messages and exit exports consume purpose-bound, single-use
step-up evidence.

Internal work uses the OP-01 control plane with no active participant context:

- a manager can propose contracts/rate cards, record usage, prepare statements, propose credits,
  manage cohorts/service and record operational reviews;
- a risk/compliance officer independently reviews contracts, rate cards, statement issuance and
  credits; and
- a support analyst can manage service requests but cannot price, invoice or correct charges.

The proposer or preparer cannot approve the same contract, rate card, invoice statement or credit.
`SUPERADMIN` remains a governance role and receives no customer-operating permission merely because
it is highly privileged.

A new or renewed contract reaches `ACTIVE_SHADOW` only after independent internal review and
customer acceptance. Reinstatement also returns to `APPROVED_PENDING_CUSTOMER`; prior acceptance is
cleared. Suspension and termination are separately proposed and independently reviewed.

## Exact metering and statement rules

- Every amount and quantity is canonical non-negative integer text; floats, exponent notation,
  signs and leading zeroes fail closed.
- Currency is ISO-4217 alpha-3 and carries an explicit scale from 0 to 9. Statements copy the
  contract scale, so historical display cannot change with later configuration.
- Basis-point calculation uses `BigInt` and a named `DOWN` or `HALF_UP` policy. A basis-point rate
  cannot exceed 10,000.
- Usage is unique by institution and source event, within the accepted contract term, and may
  reference only a case owned by or actively including that institution.
- Statement preparation rejects an empty period or missing route-specific fee rule, claims each
  usage event once in the same database transaction, and retains a calculation digest per line.
- A different reviewer must issue the draft before the customer can see it. Credits apply only to
  issued statements and cannot make the net fee negative.

The resulting record is a shadow commercial statement, not an Indian tax invoice, payment demand,
accounting posting or revenue-recognition conclusion. Tax/GST, invoicing, collections and finance
system integration remain external approval/integration work.

## Customer data and evidence exit

The customer export contains contractual records visible to the customer, metering/issued
statements, service history, cohorts, reviews, visible case/room inventory and evidence metadata.
It excludes:

- internal draft/rejected contracts, rate cards, statements, changes and credits;
- revoked or expired evidence grants;
- evidence granted for a case the institution cannot see;
- secrets, credentials and Vault references; and
- document bytes, which remain available through the evidence service's receipt-logged download.

The export stores version, high-water time, record counts, scope and a canonical manifest digest.
It does not rewrite or reclassify source evidence.

## Rejected shortcuts

- treating AssureRail as universally fixed-fee;
- using 30 or 50 bps as an unchangeable global default;
- floating-point fee arithmetic or a currency without explicit scale;
- showing customers unreviewed contracts, rate cards, invoices or credits;
- allowing a renewal/reinstatement to reuse stale customer acceptance;
- attaching usage/support activity to another institution's case;
- letting support, billing or pricing mutate route authority, evidence, ownership, reconciliation
  or completion;
- calling a shadow statement a legal/tax invoice; or
- treating synthetic fee/database tests as customer, finance, tax or production acceptance.

## Activation boundary

PR-20 builds the reviewable product path but deliberately does not activate it. Promotion beyond
shadow requires, at minimum, executed customer terms/rate cards, finance and tax acceptance,
participant statement reconciliation, access-isolation and security review, support/SLA and
escalation rehearsal, customer exit rehearsal, data-retention approval and the relevant PR-12
controlled-live/production gates. Missing evidence remains open; it cannot be replaced by the
synthetic fixtures in this PR.
