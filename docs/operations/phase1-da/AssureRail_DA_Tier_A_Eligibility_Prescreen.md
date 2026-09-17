# AssureRail DA Tier A eligibility pre-screen

**Room worksheet · v1.0 · 17 September 2026 · `PARTNER_CONTROLLED`**
**Free and tape-only:** no evidence files, portal account, payment, buyer submission, human diligence or professional opinion. Use borrower tokens, not names, PAN, Aadhaar, phone numbers or addresses. Every regulatory threshold is **CONFIRM WITH COUNSEL** before reliance.

## 1 · Define the proposed cohort

| Field | Entry |
|---|---|
| Cohort reference / screen date / tape cut-off |  |
| Proposed asset or loan type and intended buyer class |  |
| Seller legal names (3–4 expected) |  |
| Proposed current-closing sequence | 1. ___ 2. ___ 3. ___ 4. ___ |

**Required tape columns:** `seller_id`, `loan_id`, a cohort-consistent pseudonymous `borrower_token`, `party_role` (`BORROWER` / `CO_BORROWER`), `linked_party_token` and role where applicable, outstanding principal, origination date, original tenor or contractual maturity date, repayment frequency / instalments paid where required, residual tenor at cut-off, asset/loan type, current DPD, maximum DPD in the agreed history window, restructuring flag, and the agreed concentration fields. For vehicle/EV books request manufacturer, model, dealer, geography and borrower/employer or occupation segment where held.

> **Counting face rule:** one primary unit is each unique **seller × loan × borrower or co-borrower** combination. A co-borrower is another primary unit. One linked-party unit is each unique **loan × linked party** combination. The same borrower at two sellers is two billable primary units and a cross-seller overlap signal; do not deduplicate it from either seller.

## 2 · Record each seller before applying rules

| Seller | Declared principal ₹Cr | Loans | Borrower units | Co-borrower units | **Primary units** | Linked-party units | Original-tenor band | Residual-tenor band | Asset / loan type | Current / max DPD | Restructured ₹Cr | Top concentration + % |
|---|---:|---:|---:|---:|---:|---:|---|---|---|---|---:|---|
| A |  |  |  |  | borrower + co-borrower |  |  |  |  |  |  |  |
| B |  |  |  |  |  |  |  |  |  |  |  |  |
| C |  |  |  |  |  |  |  |  |  |  |  |  |
| D |  |  |  |  |  |  |  |  |  |  |  |  |
| **Cohort** |  |  |  |  |  |  | — | — | — | — |  |  |

## 3 · Apply the agreed Tier A rules loan by loan

Insert buyer/counsel-confirmed values before running. Do not invent a regulatory or buyer threshold.

| Test | Confirmed input | Result and provisional exclusion bucket |
|---|---|---|
| Minimum holding period / holding duration (MHP/MHD), derived from origination date, original tenor and any required instalment history | Rule: ___; source/date: ___ · **CONFIRM WITH COUNSEL** | Not met today → **time-cured**; record projected cure date. Missing/inconsistent field → **remediable**. |
| Residual tenor at expected transfer | Minimum / permitted band: ___ · source/date: ___ · **CONFIRM WITH COUNSEL** | Outside accepted band → **structural for this cohort**. |
| Asset / loan type and permitted transferee | Accepted taxonomy / transferee class: ___ · source/date: ___ · **CONFIRM WITH COUNSEL** | Unmapped field → **remediable**; confirmed outside policy → **structural**. |
| DPD history | Current/max/history rule: ___ · source/date: ___ | Missing field → **remediable**; confirmed breach → **structural for this cohort**. |
| Restructuring | Treatment: ___ · source/date: ___ · **CONFIRM WITH COUNSEL** | Missing flag → **remediable**; disallowed restructuring → **structural**. |
| Concentrations | Borrower/group/manufacturer/dealer/geography/product caps: ___ · source/date: ___ | Cap overflow → **structural for this cohort construction**; retain outside the proposed pool. |

**Bucket discipline:** **time-cured** means no repair is claimed and the loan may become eligible only on a later confirmed date; **remediable** means data or Tier B evidence must be corrected and then retested; **structural** means it is outside the present rule set or cohort. Count principal once: structural controls first; otherwise use time-cured where waiting is required, then remediable, while retaining every secondary reason code. Tier A cannot test RC endorsement, insurance, KYC/authority, stamping or executed agreements; those remain Tier B and paid.

## 4 · Output the honest waterfall

| Seller | Declared ₹Cr | Time-cured today ₹Cr | Remediable / Tier-B-conditional ₹Cr | Structural / cohort-cap ₹Cr | **Tier-A eligible today: low–high ₹Cr** | Retention input | **Indicative transferable: low–high ₹Cr** | Price / ₹100 | Debt release ₹Cr | **Indicative net cash: low–high ₹Cr** |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|
| A |  |  |  |  |  | ___ **CONFIRM WITH COUNSEL** |  |  |  |  |
| B |  |  |  |  |  | ___ **CONFIRM WITH COUNSEL** |  |  |  |  |
| C |  |  |  |  |  | ___ **CONFIRM WITH COUNSEL** |  |  |  |  |
| D |  |  |  |  |  | ___ **CONFIRM WITH COUNSEL** |  |  |  |  |
| **Cohort roll-up** |  |  |  |  |  | — |  |  |  |  |

**Low eligible** = declared − time-cured − remediable/Tier-B-conditional − structural/cap exclusions. **High eligible** assumes stated remediable items pass Tier B; it still excludes time-cured and structural items. **Indicative transferable** = eligible × (1 − confirmed retention). **Indicative net cash** = transferable × price/100 − debt release − disclosed fees, tax and expenses. All are ranges, not a quote, buyer decision or proceeds promise.

**Current ₹48Cr working example—not an outcome:** 25–35% assumed attrition produces **₹31.2–36.0Cr** Tier-A eligible. Applying an **illustrative 10% retention solely to show the calculation — CONFIRM WITH COUNSEL** produces **₹28.08–32.40Cr** indicative transferable. At an illustrative ₹100/₹100 price, gross consideration is the same range before debt release, fees, tax and expenses; net cash stays blank until those inputs are supplied.

**Cross-seller overlap:** ___ borrower tokens occur at more than one seller; ₹___Cr exposure; top repeated token share ___%. Treat this as a concentration and possible double-financing/double-pledge **signal for investigation**, never as a conclusion. Each seller remains separately owned, mandated, diligenced, contracted and settled; the cohort does not legally commingle the books.

**Founder decision required — MHD/MHP re-runs:** the included three same-scope automated reassessments expire 30 days after the first Initial Assessment and will not serve exclusions curing over several months. Choose before quoting: ☐ extend only the MHD-cured window ☐ introduce a low-cost tape-only maturity re-screen ☐ retain the current rule and quote a later run separately. **No option is approved by this worksheet.**
