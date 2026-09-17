# AssureRail loan-document review architecture and operations

**Version:** 1.0 — 17 September 2026
**Classification:** INTERNAL
**Applies to:** Phase 1 conventional DA; EV and vehicle secured term-loan policy
**Decision owner:** AssureRail product and risk

## Decision

AssureRail uses one evidence-processing ladder:

1. immutable, malware-cleared evidence intake;
2. bounded deterministic libraries for CSV, XLSX and native PDF text;
3. configured OpenAI model tiers only for unresolved visual pages or structured document review; and
4. Gemini Flash only as an approved availability fallback.

AI reads and structures evidence. Versioned deterministic rules produce tape, inventory, coverage and principal-reconciliation outcomes. No model may produce a legal-validity, credit, pricing, acquisition or true-sale decision.

The service remains under the authenticated engagement API at `/v1/rail/institutions/:institutionId/engagements/:engagementId/runs`. A second global `/v1/documents` surface is not introduced because it would duplicate the current tenant, payment, evidence and retention controls.

## First policy

| Item | Controlled decision |
|---|---|
| Transaction route | Conventional direct assignment |
| Asset family | EV and vehicle secured term loans |
| Policy version | `ev-secured-term-da-1.0.0` |
| Evidence schema | `rail-document-evidence-1.0.0` |
| Initial Assessment | Automated, unsigned and without human content review |
| Portfolio Preparation | Qualified, independent section review and sign-off |
| Coverage | Every admitted tape loan receives a document-coverage and principal-reconciliation result |
| AI primary | Configured OpenAI tier; GPT-5.6 Luna default |
| Availability fallback | Configured Gemini tier; Gemini Flash default |

## Evidence and result levels

The original evidence object and version remain immutable. A document review stores source and envelope digests, routing reasons, locators and safe provenance. It does not duplicate extracted borrower text.

| Level | Current output |
|---|---|
| Document | Route, document family, source locator, field state, exact citation, readability exceptions and extraction provenance |
| Loan | Tape loan ID, linked document versions, file-coverage rule and principal-reconciliation rule |
| Pool | Required document inventory, tape-loan coverage, reconciled-loan count, unresolved principal and unallocated or extra loan IDs |

Allowed field states are `observed`, `inferred`, `absent`, `unreadable` and `contradictory`. The model cannot label a value `derived`; only deterministic code can derive a value. Reconciliation accepts observed values. Inferred values remain exceptions.

## Routing controls

CSV and XLSX stay on the deterministic-parser rung. PDF pages are tested for usable text length, printable-character ratio, encoding corruption and expected document anchors. A blank page is not the only OCR trigger. Good native pages remain authoritative in a hybrid document; visual text replaces only the locators routed for visual extraction.

Image and unresolved PDF routes require approved processor terms and credentials. The worker sends no arbitrary URL, enables no model tools or browsing, and instructs the model to treat document text as untrusted evidence. Gemini is used only after an OpenAI network, throttling or service-availability failure. A refusal or invalid model result fails closed and does not trigger provider shopping.

## Deterministic reconciliation

The admitted CSV defines seller-scoped unique loan and party pairs and principal in INR paise. Structured document review may extract an observed loan ID and principal outstanding with exact citations. AssureRail normalises a cited INR amount deterministically, then compares it with the tape value.

Each tape loan receives:

- `LOAN-FILE-COVERAGE-001`: pass only when a supplied document is linked through an observed loan ID; and
- `LOAN-TAPE-PRINCIPAL-001`: pass, fail or indeterminate against the admitted tape principal.

The pool is `RECONCILED` only when every tape loan has linked document evidence, every principal passes and no document loan ID sits outside the tape. This is an evidence-quality state, not buyer approval.

## Persistence and audit

`AssessmentDocumentReview` is the immutable safe projection for one processing job and evidence version. `AssessmentDocumentExtractionAttempt` records each completed native or visual pass and any primary-provider availability failure before fallback. Attempt records contain model tier, provider, model, prompt/preprocessing versions, requested locators, usage and result digest. They contain no raw document text.

The internal run report returns review and attempt provenance. The customer run result returns its own evidence envelope and reconciliation output. Released Initial Assessment results remain automated and unsigned. Preparation cannot be released without the existing qualified-reviewer, independence, evidence and step-up controls.

## Configuration

`ASSURERAIL_AI_MODEL_TIERS_JSON` may substitute approved deployment names while preserving fixed provider roles. `language_default`, `visual_default`, `visual_retry` and `visual_advanced` must use OpenAI. `availability_fallback` must use Gemini. Invalid JSON, a swapped provider or an unsafe model name stops processing.

Provider calls additionally require the relevant data-processing approval flag and a server-side API key. Production model and fallback activation require approved retention, training and data-residency terms; configuration alone is not approval.

## Operational checks

Before activating a tenant:

1. approve its retention and upload profile;
2. approve processor and data-residency terms;
3. rehearse only with synthetic or formally approved redacted evidence;
4. run the API tests, document-extractor tests, migration validation and daily offline security harness;
5. inspect route distribution, unsupported citations, unresolved principal and fallback use; and
6. activate Portfolio Preparation reviewers separately from Initial Assessment automation.

## Improvements over the input design

- The current engagement API is reused instead of creating a conflicting document tenant boundary.
- Native text quality is measured beyond a single character threshold.
- Hybrid processing preserves good native pages.
- Model-generated `derived` values are structurally prohibited.
- Full-population coverage is measured by loan count and unresolved principal.
- Provenance avoids copying borrower text into an additional database table.
- Provider fallback is restricted to availability failures.

## Remaining production gates

The following remain controlled work, not current production claims:

- render and crop only the requested PDF pages before visual submission; the current first slice requests targeted page outputs but supplies the bounded source document;
- batch orchestration above the current per-run evidence and AI-input budgets;
- asset-specific authoritative-source precedence beyond loan ID and principal;
- repayment-schedule arithmetic, security, insurance, mandate, KYC and registry validators;
- versioned event publication and exception exports;
- a labelled multilingual and degraded-scan golden corpus with approval thresholds; and
- production processor, region, retention, recovery and service-level approval.

No gate may be described as live until its test evidence and activation decision are recorded.
