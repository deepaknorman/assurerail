# AssureRail buyer-policy compiler v0 — implementation boundary

This implementation follows `docs/design/AssureRail_Buyer_Policy_Compiler_v0_Spec.md` and sits
alongside, rather than replacing, the buyer-profile screen.

## Two separate controls

1. The **buyer-profile screen** compares a proposed analytical cohort with the approved structured
   onboarding profile: accepted asset families, programme and seller-ticket ranges, originator
   routes, concentration limits, evidence families and operational preferences.
2. The **buyer-policy compiler** evaluates buyer-authored, cited decision-table rows over admitted
   loan, borrower, linked-party, document and book facts.

The first is a coarse preparation screen. The second produces record-level outcomes and remediation
work. Neither is a buyer credit, legal, valuation, pricing or acquisition decision.

## Safe decision-table language

The compiler does not execute buyer-provided code or arbitrary expressions. Its allow-listed
operators are equality/inequality, numeric bounds, set inclusion, presence and an as-of-date check.
Every row records:

- a unique check ID and record scope;
- one or more allow-listed predicates and an optional conditional predicate;
- buyer-authored severity and explicit unknown-evidence behaviour;
- the admitted fields it consumes;
- a buyer requirement reference, anchor and excerpt digest.

Rows are effective-dated, tied to the approved buyer-profile digest and compiled into a
deterministic policy digest. There are no default buyer policies and no cross-buyer reuse.

## Runtime evidence

Every admitted fact states whether it is present or unknown, its source evidence references and,
where applicable, the AI run receipt that produced it. Unknown or absent evidence follows the
row's explicit `EXCLUDE`, `REMEDIATE` or `DISCLOSE` behaviour and never silently passes.

The output contains record-level checks and citations, preparation outcomes, policy and evaluation
digests, buyer-ready numerator/denominator and the fixed qualification
`BUYER_POLICY_CHECKLIST_NOT_BUYER_DECISION`.

## Gate to first real policy

The included EV rows are synthetic executable fixtures matching the specification's ten worked
examples. Production rows require a buyer working session, the buyer's own requirement citation,
buyer approval of the compiled sheet and linkage to the current MSA-bound profile. Any buyer
objection proposed as a new row remains inactive until that buyer confirms it.
