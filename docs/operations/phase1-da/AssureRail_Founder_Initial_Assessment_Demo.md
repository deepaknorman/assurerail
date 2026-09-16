# AssureRail founder Initial Assessment demonstration

**Classification:** INTERNAL  
**Purpose:** repeatable demonstration of the paid seller journey using synthetic data only

## Demonstration boundary

Use the authenticated AssureRail workspace and a disposable synthetic seller. The payment provider
must remain in Razorpay test mode, document processing in shadow mode and every uploaded record must
be invented. The demonstration proves implemented workflow and controls. It does not prove bank
acceptance, live payment collection, buyer connectivity, legal transfer or production readiness.

## Accounts prepared outside the repository

| Account | Required authority | Demonstrated action |
|---|---|---|
| Seller commercial administrator | Manage customer operations; accept engagement; step-up | Create scope, inspect quote and accept terms |
| Seller data preparer | Manage evidence and customer operations; step-up | Upload the tape, attach corrected evidence and request processing |
| AssureRail invoice preparer | `COMMERCIAL_INVOICE_PREPARE` | Prepare the Initial Assessment invoice |
| AssureRail invoice checker | Independent invoice issue authority | Review and issue the invoice |

Provision identities in the approved Firebase test project and assign institution-scoped
memberships and mandates through the normal administration path. Store credentials in the approved
secret manager or private test-account file. Never commit a password, TOTP seed, bearer token or
Firebase key.

## Synthetic case

- Asset family: `VEHICLE_EV`.
- One seller; one quoted unique seller–loan–borrower pair; no linked party.
- First tape: one valid row plus a duplicate of the same seller–loan–borrower pair.
- Corrected tape: one valid row only, uploaded as the next version of the same evidence family.
- Purchase consideration: synthetic ₹1 crore in integer paise.
- Expected minimum-route Initial Assessment invoice before GST: ₹3.12 lakh; the system calculates
  tax from the frozen rate card.

## Presenter sequence

1. Sign in as the seller commercial administrator and open **Assessment**.
2. Enter the synthetic book scope. Show that count means the unique seller–loan–borrower pair and
   that linked parties are a separate ₹250 unit where applicable.
3. Show the frozen committed and standalone totals and the 30% Initial Assessment invoice. Accept
   the current terms and seller data authority with step-up authentication.
4. As the AssureRail invoice maker and checker, prepare and independently issue the invoice. Open the
   Razorpay test checkout and use its test success route. Confirm that processing remains blocked
   until payment is verified.
5. As seller data preparer, upload the first synthetic CSV and request Initial Assessment. Refresh
   until the result is `AUTO RELEASED`.
6. Show the unsigned automated result, source-grounded finding or tape exception, AI run receipt,
   remediation owner, affected pair, and the statement that no consultant or professional signed it.
7. Upload the corrected tape as a replacement version. Select it, attach it to the remediation item
   with step-up authentication, and include that item in the next reassessment.
8. Run the comparable reassessment. Show resolved, continuing and new gaps, before/after data
   quality, the remaining allowance, and the unchanged accepted scope digest.
9. Show that the workspace and upload path remain available after the included allowance. Explain
   that three automated same-scope reassessments are included within 30 days; changed scope is
   requoted.
10. Stop at Portfolio Preparation. Explain that qualified human review and sign-off begin there and
    require the remaining accepted-route payment before work starts.

## Required evidence after each rehearsal

- tested commit and deployment identifier;
- synthetic account-to-role map with secrets removed;
- quote and invoice digests, Razorpay test receipt and webhook replay result;
- source evidence version digests, Initial Assessment result digest and AI run-receipt digest;
- remediation and reassessment lineage, including resolved/continuing/new gap summary;
- screenshots or browser trace with synthetic identifiers only; and
- failed-control observations, owner and retest result.

## Local control rehearsal

From the AssureRail repository, run:

```bash
npm run policy:check
npm test --workspace=@assurerail/api
npm run build --workspace=@assurerail/web
npm run security:offline-daily
```

The disposable PostgreSQL engagement rehearsal exercises quote freeze, independent invoice issue,
Razorpay test payment, clean evidence, automated unsigned release and payment-reversal hold. It is a
service-level control rehearsal and does not replace the account-driven browser demonstration.

