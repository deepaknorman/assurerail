# Synthetic NBFC Step 1 — INR 55 crore portfolio

This is the main presentation-scale input pack: **3,000 fictional loans**, with outstanding
principal of exactly **INR 35 crore + INR 20 crore = INR 55 crore**. All identities and data
are synthetic. These are starting portfolio amounts and synthetic seller declarations at par,
not valuations, buyer offers or completed assessment results.

| Seller | Book | Loanbook reference | Loans | Primary pairs | Linked pairs | Principal |
|---|---|---|---:|---:|---:|---:|
| NBFC 1 — demo-nbfc-ev-001 | A | SYN-EV-2W-2025 | 1,200 | 1,500 | 120 | INR 20 crore |
| NBFC 1 — demo-nbfc-ev-001 | B | SYN-EV-3W-2025 | 800 | 1,000 | 80 | INR 15 crore |
| **NBFC 1 total** | | | **2,000** | **2,500** | **200** | **INR 35 crore** |
| NBFC 2 — demo-nbfc-ev-002 | C | SYN-EV-2W-2025 | 600 | 750 | 60 | INR 12 crore |
| NBFC 2 — demo-nbfc-ev-002 | D | SYN-EV-3W-2025 | 400 | 500 | 40 | INR 8 crore |
| **NBFC 2 total** | | | **1,000** | **1,250** | **100** | **INR 20 crore** |
| **Programme total** | | | **3,000** | **3,750** | **300** | **INR 55 crore** |

There are 4,050 valid loan/party rows. Initial files contain 4,062 rows because Book A also
contains twelve intentional duplicates. Principal is counted once per unique loan, regardless
of its co-borrowers or linked parties. The average outstanding loan is INR 1.75 lakh for
NBFC 1 and INR 2 lakh for NBFC 2; individual amounts vary.

## Use the files

- `AssureRail_Synthetic_NBFC_55Cr_Step1.xlsx`: instructions, book summary, all 3,000 loan
  records, four upload sheets and a defect register. Literal values only; no macros/formulas.
- `upload-step1/`: four canonical CSVs, one per seller/loanbook engagement. Use these for the
  automatic tape checks. The workbook remains a human-readable reference; XLSX tape mapping
  is not implemented by the current metric parser.
- `input-manifest.json`: exact scope, as-of date, integer-paise amounts and expected defects.
- `reference-loan-master.csv` and `reference-party-links.csv`: richer inspection data, not
  upload replacements or substitutes for supporting legal documents.
- `reference-for-step2/`: corrected versions for later evidence replacement and reassessment.
  Do not upload an original and its corrected tape together as two current loan tapes.
- `scripts/assurerail-synthetic-preparation-inputs.py`: generates the bounded Book A
  Preparation corpus after acceptance: ten deliberately selected loans across all three states
  and both repayment states, ten one-page text PDFs plus forty CSVs, and one manifest-declared
  INR 100 repayment-principal mismatch. The batch proves real review controls while continuing
  to disclose that 1,190 of 1,200 loans lack supporting-document coverage.
- `validation-results.json`: actual code-generated checks, totals, hashes, sizes and timings.

Start with Book A under the existing synthetic seller `demo-nbfc-ev-001`: `VEHICLE_EV`,
book reference `SYN-EV-2W-2025`, as-of `2026-09-15`, 1,500 primary pairs and 120 linked pairs.
Declare `20000000000` paise for that book's consideration and `55000000000` paise for the
target programme. The same programme declaration applies to all four scopes. This does not
form a billing cohort or waive a commercial-review gate. Follow the application's quote,
acceptance, MFA and payment steps before upload; use evidence category `LOAN_TAPE`.

NBFC 2 still needs its own institution/admission/access setup on the demo host. Never upload
Books C/D under NBFC 1's account. Both sellers deliberately reuse the same book references:
the presentation cohort key must be **seller institution + loanbook**, not loanbook alone.

## Expected checks and processing boundary

| Book | Starting tape result | Deliberate defects |
|---|---|---|
| A | RECORD_EXCEPTIONS | 12 duplicated borrower pairs |
| B | RECORD_EXCEPTIONS | 8 inconsistent repeated balances; 8 unmapped GUARANTOR roles |
| C | MATCHED | No tape defect |
| D | MATCHED | No tape defect |

All corrected reference tapes return MATCHED and retain the exact same principal totals.
All books still lack the five supporting families: loan agreements, security documents,
repayment histories, KYC/authority and insurance/collateral evidence. A matched tape can enter
Portfolio Preparation, but it does not establish document completeness, buyer approval or sale
readiness. Those open families and the loan-file coverage count are disclosed and digest-bound
when the seller accepts Preparation.

Full-record extraction and deterministic metrics pass for all eight CSVs. However, the
current assessment worker feeds tape rows into a 120,000-character AI input guard. Even the
shortest possible annotated full-tape payload exceeds that guard for every book here:

| Book | Initial CSV bytes | Annotated source characters, lower bound |
|---|---:|---:|
| A | 76,333 | 378,965 |
| B | 50,620 | 250,580 |
| C | 37,994 | 187,922 |
| D | 25,344 | 125,322 |

Loan tapes stay entirely outside model review. The worker checks every tape row with
deterministic code and a tape-only run records
`NOT_APPLICABLE / NO_UNSTRUCTURED_DOCUMENTS_SELECTED`. Supporting documents use the bounded
review path with explicit admitted, reviewed and unreviewed coverage. No cap was raised and no
rows were sampled away to make this fixture pass. Local fixture validation does not by itself
claim hosted uploads, malware scans, provider calls or a complete assessment run; hosted proof
is recorded separately under `docs/demo/assurerail/evidence/`.

## Exact totals and reproducibility

Starting amortisation profiles give varied loan sizes, rates, terms and arrears. Each book's
target is distributed proportionately by largest remainder in integer paise, then original
principal and scheduled instalments are derived consistently. Every balance is checked back
against the amortisation model. No oversized balancing loan is inserted to force a total.
Fees and penalty interest are excluded from this synthetic model.

```bash
python3 scripts/assurerail-synthetic-nbfc-inputs.py --profile 55cr --output-dir demo/assurerail/synthetic-nbfc-55cr
npm run build --workspace=@assurerail/api
node scripts/assurerail-synthetic-nbfc-check.cjs demo/assurerail/synthetic-nbfc-55cr
python3 scripts/assurerail-synthetic-preparation-inputs.py \
  --tape demo/assurerail/synthetic-nbfc-55cr/reference-for-step2/book-a-corrected.csv \
  --loan-master demo/assurerail/synthetic-nbfc-55cr/reference-loan-master.csv \
  --output-dir /tmp/assurerail-book-a-preparation
```

The original 62-loan pack remains a small regression fixture. This pack supersedes it for
the INR 55 crore demonstration. Step 2 includes seller offer preparation; Step 3 uses actual
reviewed/selected records for the planned clickable seller-and-loanbook comparison.
