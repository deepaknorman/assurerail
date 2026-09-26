# Synthetic NBFC inputs — start with Step 1

All institutions, people, loans and balances are fictional. This pack supplies inputs, not
assessment decisions, professional sign-offs or final offers. It contains 62 loans across
three books and two synthetic sellers, as of 15 September 2026.

The agreed sequence is:

1. Automatic Initial Assessment.
2. Portfolio Preparation, including correction, reviewed release and seller offer preparation.
3. Buyer review, cohort selection and offers.

## First upload

Start with `upload-step1/book-a-initial.csv` under the existing synthetic seller
`demo-nbfc-ev-001`. Create a separate assessment engagement for each book; never mix seller
files in one engagement. Use the scope in `input-manifest.json`:

| Book | Seller | Book reference | Actual loans | Primary pairs | Linked pairs | Outstanding / synthetic declared consideration |
|---|---|---|---:|---:|---:|---:|
| A | demo-nbfc-ev-001 | SYN-EV-2W-2025 | 24 | 30 | 3 | INR 37,69,273.35 |
| B | demo-nbfc-ev-001 | SYN-EV-3W-2025 | 18 | 22 | 2 | INR 37,27,411.95 |
| C | demo-nbfc-ev-002 | SYN-EV-2W-2025 | 20 | 25 | 3 | INR 49,89,484.68 |

For Book A choose `VEHICLE_EV`, book reference `SYN-EV-2W-2025`, as-of `2026-09-15`,
30 primary pairs and 3 linked pairs. Its synthetic seller-proposed and aggregate-programme
consideration inputs are both `376927335` minor units. These are independent book scenarios,
not a formed commercial programme; declaration at par is not a valuation or a buyer offer.
Billing/MFA/payment gates still apply before upload. Select document category `LOAN_TAPE`.

Book C exercises a second seller and is not yet enabled for hosted upload under that
institution. It is ready as an offline input fixture. Do not upload it under seller A's account.

## What should happen

| Starting CSV | Intentionally introduced condition | Actual tape checker result |
|---|---|---|
| book-a-initial.csv | Borrower pair duplicated at CSV row 35 | RECORD_EXCEPTIONS; one duplicate |
| book-b-initial.csv | Co-borrower's loan balance differs by INR 100; source role GUARANTOR is unmapped | RECORD_EXCEPTIONS; two invalid records |
| book-c-initial.csv | Canonical, internally consistent tape | MATCHED |

Every book still lacks loan agreements, security documents, repayment histories, borrower
KYC/authority and insurance/collateral evidence. `MATCHED` means the tape reconciles to its
declared counts; it does not mean the portfolio is ready or approved. Full automatic output
also depends on the actual analysis run. No hosted assessment is claimed by this pack's checks.

`reference-for-step2/` holds corrected tapes for the subsequent correction/reassessment work.
They reconcile to the same principal balances and declared pair counts. Preserve the original
assessment; replace the evidence version and reassess through the application. Never upload
initial and corrected tapes together as separate current loan tapes.

## Excel and field meanings

`AssureRail_Synthetic_NBFC_Step1.xlsx` is a readable workbook with instructions, book totals,
62 loan records, party links, upload sheets and a defect register. It contains literal values,
no macros, formulas or external links. The loan master includes fictional vehicle types,
origination dates, rates, terms, instalments and arrears. Its amortisation model excludes fees
and penalty interest; it is not a lender's audited servicing ledger.

Use the CSVs for automatic tape reconciliation. The current extractor can read XLSX cells,
but the loan-tape metric parser requires canonical CSV and correctly returns
`TAPE_MAPPING_REQUIRED` for the workbook. The richer reference CSVs are also for inspection,
not substitutes for the upload files or supporting legal documents.

- `loan_id` and `party_id` are text identifiers; keep their `SYN-` prefixes.
- `party_role` is `BORROWER`, `CO_BORROWER` or `LINKED_PARTY`.
- `principal_minor` is INR paise, a positive integer: INR 1 = 100 paise.
- The same loan balance repeats on its party rows; count principal once per loan.
- Primary billing units count borrower and co-borrower pairs, not just loans.
- The engagement supplies the seller and loanbook scope; the canonical tape has four columns.
- Books A and C intentionally share `bookRef`; the cohort key is **seller + loanbook**, never
  book reference alone. These presentation groups do not alter billing or legal closing groups.

## Reproduce the files and their validation

From the Rail repository, with Python `openpyxl` installed:

```bash
python3 scripts/assurerail-synthetic-nbfc-inputs.py --output-dir demo/assurerail/synthetic-nbfc-step1
npm run build --workspace=@assurerail/api
node scripts/assurerail-synthetic-nbfc-check.cjs
```

`validation-results.json` records file hashes and actual application extraction, row checks,
counts, principal totals and missing document families. It explicitly identifies the code
revision used and states that it is not a hosted assessment run.
