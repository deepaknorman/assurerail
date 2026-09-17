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

The repository now includes a guarded, idempotent bootstrap for these exact four identities and
their synthetic NBFC, memberships, mandates, independent internal roles, active shadow contract and
rate card. Copy
`demo/assurerail/founder-initial-assessment/accounts.example.json` outside the repository, replace
the passwords and base32 TOTP secrets, add those secrets to the presenter's authenticator, restrict
the file to mode `600`, and run `npm --prefix apps/assurerail-api run
demo:bootstrap:founder` under the explicit shadow/synthetic gates documented in the kit. The
bootstrap accepts only reserved `@example.test` addresses, refuses conflicting or non-demo
identities and never prints passwords or authenticator secrets.

## Demo deployment controls

The two commercial flags do not enable this journey by themselves. The API must run with the
following dependency-complete shadow profile:

| Control | Demo value |
|---|---|
| Runtime | `ASSURERAIL_OPERATING_MODE=SHADOW` |
| Admission and intake | `ARAIL_PARTICIPANT_ADMISSION_V1=shadow`; `ARAIL_NEUTRAL_INGRESS_V1=shadow` |
| Durable event handling | `ARAIL_DURABLE_RELAY_MODE=shadow` |
| Developer and staff authority | `ARAIL_DEVELOPER_PORTAL_V1=shadow`; `ARAIL_INTERNAL_RBAC_V1=shadow` or `enforce` |
| Customer operations and billing | `ARAIL_CUSTOMER_OPERATIONS_V1=shadow`; `ASSURERAIL_ENGAGEMENT_BILLING_MODE=shadow` |
| Authenticated web journey | `NEXT_PUBLIC_ASSURERAIL_ENGAGEMENT_BILLING_ENABLED=true` |
| Test checkout | `ASSURERAIL_CHECKOUT_MODE=razorpay_test` plus server-side test merchant, key, webhook and allowed collection-account references |
| Evidence intake | Private object storage, certified upload profile and reachable ClamAV scanner |
| Assessment processing | `ASSURERAIL_DOCUMENT_PROCESSING_MODE=shadow` and a dedicated extractor runtime |

Keep AI disabled until the approved provider account, processing authority and server-side secrets
are installed. When enabled for the synthetic demonstration, use GPT-5.6 Luna as primary and
Gemini 3 Flash only as the approved availability fallback. No unrelated DA, PTC, tokenised or live
adapter flag is required for this journey.

## Synthetic case

- Asset family: `VEHICLE_EV`.
- One seller; one quoted unique seller–loan–borrower pair; no linked party.
- First tape: one valid row plus a duplicate of the same seller–loan–borrower pair.
- Corrected tape: one valid row only, uploaded as the next version of the same evidence family.
- Purchase consideration: synthetic ₹1 crore in integer paise.
- Expected standard minimum-route Initial Assessment invoice before GST: ₹3.12 lakh. For an
  approved design-partner seller, the same frozen quote shows a 30% credit and ₹2.184 lakh taxable
  service fee; the system calculates GST on that discounted fee.

Use the packaged files under `demo/assurerail/founder-initial-assessment/`:

| File | Demonstration purpose |
|---|---|
| `demo-manifest.json` | Exact book, count, corpus, billing and expected-result inputs |
| `loan-tape-v1-with-gap.csv` | Twelve unique loan–borrower pairs plus one repeated pair; expected `RECORD_EXCEPTIONS` |
| `loan-tape-v2-corrected.csv` | Same corpus with the duplicate removed; expected `MATCHED` |

The two tape versions preserve the same underlying principal. The correction demonstrates an
attributable gap and reassessment without improving the economics by changing the book.

## Presenter sequence

1. Sign in as the seller commercial administrator and open **Assessment**.
2. Enter the synthetic book scope. Show that count means the unique seller–loan–borrower pair and
   that linked parties are a separate ₹250 unit where applicable.
3. Show the frozen committed and standalone totals and the Initial Assessment invoice. If using a
   design-partner fixture, show the standard amount, entity-bound programme credit and discounted
   taxable amount separately. Accept
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
