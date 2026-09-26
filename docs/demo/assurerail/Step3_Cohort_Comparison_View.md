# Step 3: portfolio progression and seller/book drill-down

Founder-confirmed sequence: automatic Initial Assessment → Portfolio Preparation (including
seller offer preparation) → buyer review, cohort selection and offers. This document specifies
the requested view; the current application does not yet implement it.

## View

Use aligned horizontal bars on one common scale:

1. Starting portfolio: unique loans and outstanding principal in the original admitted snapshot.
2. Prepared seller offer: loans retained in the reviewed preparation release.
3. Final selection/offer: loans included in the selected offer version, with its actual status.

Toggle the measure between outstanding principal and unique loan count. Show proposed cash
consideration separately; it is not the same measure as principal. Do not compare amounts to
readiness percentages or imply that a larger final portfolio means a better result.

Segment the final bar by the exact `(sellerInstitutionId, bookRef)` pair. Use a stable opaque
cohort ID mapped to that pair. Versions belong to the underlying snapshots, not new cohort
identities. Books with the same reference at different sellers must remain distinct; the
Step-1 fixtures deliberately exercise that case.

Each segment is clickable and keyboard accessible. It opens a scoped cohort view with seller,
loanbook, included loans, amounts, exclusions/reasons, original assessment, preparation release,
evidence lineage, offer version and buyer decision status. Include a table equivalent so small
segments remain usable. Preserve seller boundaries and access checks on both chart and detail.

## Evidence and arithmetic

- Read persisted, authorised assessment/preparation/selection snapshots. Do not populate later
  bars with example values, pre-labelled approvals or assumed success.
- Before the corresponding stage exists, show “Not yet prepared” or “No offer recorded”, not a
  zero-length bar that could be mistaken for a completed zero-value decision.
- Count each `(seller, book, loan)` once; multiple borrower/guarantor rows do not add principal.
- Segment totals must equal the offer total. Every included loan must trace to the source
  snapshot; exclusions, additions and changed balances require recorded reasons.
- Preserve the start snapshot when a corrected tape arrives. Do not overwrite history to make
  progress appear better. Loan counts may remain unchanged when a duplicated party row is fixed.
- Keep synthetic labels, missing evidence, conditional offers, shadow status and rejected cases
  visible. A seller-prepared offer is not a buyer commitment or proof of closing.
- Presentation cohorts have no billing-allocation or legal-closing side effects.

## Implementation and acceptance work still required

Persist the seller/book presentation membership and versioned selection references; expose
authorised progression and cohort-detail endpoints; implement the stacked bars and drill-down.
Test source-to-segment reconciliation, repeated book references across sellers, duplicate party
rows, cross-seller denial, snapshot history, keyboard navigation and missing-stage rendering.
Then prove the view against released synthetic reports and actual selection records on the box.
