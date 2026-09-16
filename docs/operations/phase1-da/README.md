# AssureRail Phase 1 conventional DA operating pack

**Version:** 1.0 — 16 September 2026
**Owner:** AssureRail Operations
**Status:** controlled pilot operating baseline; legal and provider terms remain subject to execution
**Phase boundary:** conventional direct assignment (DA). PTC is Phase 2 and is not a Phase 1 sales or delivery commitment.

## Purpose

This pack turns an accepted seller application into a controlled DA preparation and execution process. It separates AssureRail's work from decisions and regulated or authoritative acts retained by the seller, buyer, banks, counsel, auditors and registries.

The operating sequence is:

1. application and portfolio qualification;
2. a binding scope, count and corpus quote;
3. paid automated Initial Assessment;
4. seller remediation and automated reassessment;
5. paid Portfolio Preparation with qualified section review;
6. buyer alignment and execution mandate;
7. provider activation and buyer diligence;
8. independent-bank settlement using a seller-authorised distribution schedule; and
9. a closing baseline plus optional ongoing monitoring.

AssureRail does not guarantee buyer approval, price, timing or closing. It does not hold or commingle settlement money. Every external provider remains responsible for its own professional, statutory or banking act.

## Current activation boundary

Initial Assessment applications are open for approved NBFC portfolios. Until AssureRail Private Limited is incorporated and its bank, GST and live checkout arrangements are ready, work is limited to product development, applications, portfolio qualification, buyer-design discussions and synthetic or authorised historical demonstrations. No paid assessment, live execution mandate, customer-money movement or live settlement may begin before the readiness gate is recorded as passed.

## Controlled sources

| Source | Primary use | Classification |
|---|---|---|
| [Customer service guide](./AssureRail_Phase1_DA_Customer_Service_Guide.md) | Seller-facing journey and Base/Premium/Full comparison | `PUBLIC` |
| [Participant register and RACI](./AssureRail_Phase1_DA_Participant_Register_And_RACI.md) | Appointment, authority and hand-off control | `INTERNAL` |
| [Stage gates and service levels](./AssureRail_Phase1_DA_Stage_Gates_And_SLAs.md) | Operating acceptance criteria and clock rules | `INTERNAL` |
| [Provider onboarding and work order](./AssureRail_Phase1_DA_Provider_Onboarding_And_Work_Order.md) | Supplier admission and engagement | `INTERNAL` |
| [Seller document suite](./AssureRail_Phase1_DA_Seller_Document_Suite.md) | Contracting map and schedules | `AUTHENTICATED` |
| [Buyer onboarding and MSA schedule](./AssureRail_Phase1_DA_Buyer_Onboarding_And_MSA_Schedule.md) | Post-MSA buyer workspace, requirements and RBAC | `AUTHENTICATED` |
| [Referral partner addendum](./AssureRail_Phase1_DA_Referral_Partner_Addendum.md) | Accepted referral economics and controls | `AUTHENTICATED` |
| [Quote reconciliation, credit and refund terms](./AssureRail_Phase1_DA_Quote_Reconciliation_Credit_And_Refund_Terms.md) | Quote and billing rules | `SHARED_PASSWORD` |
| [Artifact manifest](./artifact-manifest.json) | Distribution and supersession rules | `INTERNAL` |

Generated HTML is a deterministic rendering of these Markdown sources. Edit the source, run `node scripts/build-assurerail-phase1-da-ops-pack.mjs`, review the generated diff and then distribute only at the manifest classification.

Artifacts marked `SHARED_PASSWORD` use one long, randomly generated download password. Record each recipient and version, rotate the password if it is disclosed outside the approved group, and do not reuse it as a user or system credential. `AUTHENTICATED` material remains in the approved counterparty workspace rather than the shared download gate.

## Control rules

- Base, Premium and Full are presentation views. The quote, order and mandate contract each service line separately.
- Initial Assessment is automated and unsigned. It has no consultant, qualified expert or human merit reviewer.
- Portfolio Preparation requires qualified CA or financial and transaction-counsel section review. An asset specialist is added only when a rule or exception requires one.
- Buyer requirements inform preparation; they do not silently add a seller-paid service.
- Seller and buyer data remain scoped by workspace, case, document and action. A referral or data-preparation role creates no broader access.
- Provider output is accepted as evidence of that provider's act. AssureRail does not relabel it as its own legal, audit, bureau, registry or banking opinion.
- The public and customer documents deliberately contain no internal revenue benchmark, supplier margin or quote-governance target.
