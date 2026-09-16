# AssureRail design-partner pricing control

**Version:** 1.0 — 17 September 2026  
**Classification:** INTERNAL  
**Decision:** founder-approved pilot offer  
**Programme code:** `DESIGN_PARTNER_30`

## Commercial decision

The first two NBFC seller legal entities that sign an assessment scope may receive a lifetime 30% reduction on AssureRail fees for Initial Assessment, Portfolio Preparation, the core execution success fee and the large-programme supplement. The standard rate card remains unchanged. The benefit is recorded as an entity-bound invoice credit and tax is calculated on the discounted service fee.

The programme has two lifetime slots. An approved slot does not expire, transfer or reopen. A group company, affiliate, fund, SPV or successor does not inherit it unless it is the same contracting legal entity.

The current pilot exclusion set is additional or ancillary services, third-party pass-through charges, secure-file connections, API integration, ongoing monitoring and contractor day rates. This exclusion set is the operating default pending final founder confirmation; no proposal may broaden the discount by implication.

## Approval and invoice flow

1. Commercial maker records the NBFC legal entity, signed-scope timestamp, evidence and proposed programme assignment.
2. An independent commercial checker verifies eligibility and approves or rejects the exact entity assignment using step-up authentication.
3. Approval checks the recorded signed-scope order and obtains one of two permanent database slots. Concurrent reviews are serialised, so a third entity cannot be approved.
4. The accepted standard quote remains frozen. At invoice preparation the system snapshots the programme, entity, slot, standard fee, standard GST, discounted fee, discounted GST and total credit.
5. Razorpay checkout and the paid-stage gate require the discounted net amount and validate the coupon and snapshot digest. An ordinary credit correction cannot imitate the programme.
6. Referral commission remains 8.5% of collected discounted AssureRail fees across the three eligible core stages.

## Worked amounts before GST

| Item | Standard | Design partner |
|---|---:|---:|
| Committed primary loan–borrower pair | ₹500 | ₹350 |
| Committed linked party | ₹250 | ₹175 |
| Committed fixed-stage minimum | ₹8.00 lakh | ₹5.60 lakh |
| Standalone primary loan–borrower pair | ₹650 | ₹455 |
| Standalone linked party | ₹325 | ₹227.50 |
| Standalone fixed-stage minimum | ₹10.40 lakh | ₹7.28 lakh |
| Initial Assessment on the ₹10.40 lakh minimum | ₹3.12 lakh | ₹2.184 lakh |
| Committed large-programme supplement | 10 bps | economic effect of 7 bps |
| Standalone large-programme supplement | 13 bps | economic effect of 9.1 bps |
| Execution through ₹25 crore | 40 bps | economic effect of 28 bps |
| Execution above ₹25 crore | 30 bps marginal | economic effect of 21 bps marginal |
| Execution minimum | ₹5.00 lakh | ₹3.50 lakh |

The effective basis-point figures explain the economics; they are not a replacement rate card. Customer invoices show the agreed standard service fee and the design-partner credit applicable to that invoice.

## Evidence and review boundary

Initial Assessment remains automated and unsigned. The design-partner price does not introduce human merit review. Portfolio Preparation retains qualified expert review and sign-off. The discount does not change evidence thresholds, buyer requirements, external-provider authority, scope reconciliation or settlement controls.
