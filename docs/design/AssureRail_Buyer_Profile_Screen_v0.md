# AssureRail buyer-profile screen v0

**Status:** implemented preparation-screen foundation  
**Boundary:** buyer policy support; never a buyer credit or acquisition decision

## Purpose

The profile screen converts an approved buyer onboarding profile into deterministic, versionable
checks against a proposed analytical cohort. It returns `BUYER_POLICY_MATCH`,
`BUYER_REVIEW_REQUIRED` or `BUYER_POLICY_MISMATCH`, accompanied by check-level reason codes and
a digest. A match means that the supplied facts meet the recorded profile. It is not an offer,
price, legal opinion, eligibility certificate or approval to acquire.

For multiple sellers, the evaluated object is an analytical and buyer-reviewable cohort. Each
seller's ownership, representations, quote, contract and settlement remain separate unless a
buyer- and counsel-approved transaction structure expressly aggregates them.

## Inputs and controls

- Only the closed, structured criteria vocabulary in `buyer-criteria.ts` is accepted.
- Buyer profiles remain subject to MSA-bound workspace activation and separate credit, legal and
  operations approvals.
- Monetary inputs use integer minor units; corpus and seller-ticket comparisons do not use binary
  floating-point money.
- Missing risk evidence such as LTV, OEM concentration, state concentration, PSL classification or
  history produces `REVIEW`; it never silently passes.
- Hard limits such as asset family, ticket size, DPD, seasoning, excluded-loan presence and
  operational compatibility produce deterministic `PASS` or `FAIL` results.
- The evaluation digest covers the criteria, supplied candidate facts, results and decision.

## Ten worked checks

| Example | Input difference | Expected outcome |
|---|---|---|
| 1 | Five ₹10 Cr EV three-wheeler books, 18–36 months remaining, all recorded limits met | Match |
| 2 | Gold loans against an EV-only profile | Mismatch: asset |
| 3 | Approved-originator route where the profile allows only onboarding of new originators | Mismatch: originator route |
| 4 | ₹20 Cr programme against a ₹25–100 Cr programme range | Mismatch: programme ticket |
| 5 | One seller below the ₹5 Cr per-seller floor | Mismatch: seller ticket |
| 6 | Remaining term extends beyond the buyer's maximum | Mismatch: remaining term |
| 7 | OEM concentration exceeds the buyer's limit | Mismatch: concentration |
| 8 | Repayment-history evidence is missing | Buyer review required |
| 9 | PSL status is unverified while PSL is preferred or required | Buyer review required |
| 10 | Required buyer precheck has not been completed | Buyer review required |

The executable versions of these examples are in `buyer-profile-screen.test.ts`.

## Next integration gate

The profile screen should be invoked only with the current approved buyer profile and the frozen,
seller-authorised cohort facts. Persistence must record profile ID/version/digest, assessment or
preparation version, evaluation digest, time and actor. Re-evaluation is required when the buyer
profile, cohort membership, material evidence or cut-off date changes.
