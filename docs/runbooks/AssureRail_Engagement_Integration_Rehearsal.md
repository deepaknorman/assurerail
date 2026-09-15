# Paid assessment integration: configuration, rehearsal and remaining work

Updated 2026-09-15. Repository: `assurerail`, branch `codex/paid-assessment-integration`.
This increment implements a controlled **shadow/test** engagement workflow. It does not activate live invoicing, payments, buyer delivery or escrow. Do not demonstrate synthetic payment or qualification fixtures as real provider acceptance.

## Delivered behaviour

1. An authenticated, approved institution selects its accepted agreement and supplies structured book scope and billing details at `/workspace/assessment`. The server calculates and persists the quote, billing profile, scope, agreement digest and approved rate-card reference. Optional integrations are requests, not purchases.
2. The authorised user accepts the exact quote with fresh MFA and explicit terms/data-authority confirmation. Accepted scope and pricing are immutable in PostgreSQL. A later rate card does not retrospectively reprice an accepted engagement.
3. Internal finance prepares the exact stage statement; a different authorised reviewer issues it through the existing invoice-review workflow. Razorpay checkout is tied to that one statement. Initial Assessment and Portfolio Preparation each require their own paid stage.
4. Checkout creation is persisted before the provider request. An uncertain result is reconciled by its existing reference; it is never blindly posted again. Signed webhooks are recorded with duplicate-event protection. Server retrieval verifies captured amount, currency and link ownership. Browser returns do not establish payment. Refund/dispute events hold processing, including events received before the checkout/payment association is known.
5. Paid users upload engagement-scoped, versioned evidence through the existing certified intake, encrypted object storage and malware quarantine. Local CSV/XLSX/PDF extraction preserves source locations; scanned PDF/images use GPT-5.6 Luna for transcription and a second validation pass when authorised. Gemini 3 Flash is the availability fallback. Initial Assessment findings are released automatically as preliminary, unsigned output. Portfolio Preparation findings remain private until qualified human review.
6. The first canonical loan tape uses CSV columns `loan_id,principal_minor` (INR paise). Every supplied row is checked for identifiers, positive exact balances and duplicates; parsed unique-loan count must match the accepted quote before preparation can be accepted. This is data reconciliation, not credit eligibility. Other tape layouts need an approved mapping; extracting XLSX/PDF text does not establish their loan coverage.
7. Initial Assessment uses deterministic rules and source-linked AI to classify the submitted book as `READY_FOR_PORTFOLIO_PREPARATION`, `FIX_AND_REASSESS`, `OUTSIDE_CURRENT_SCOPE` or `AUTOMATED_ANALYSIS_INCOMPLETE`. Its release snapshot records the engine, result digest, model/provider and outcome. It has no consultant review, assurance opinion or professional sign-off.
8. Portfolio Preparation requires a reviewer with current institution-scoped permission, asset-family qualification and fresh MFA to release or reject the exact report digest. A sign-off evidence version/digest and qualification snapshot are retained. The requester cannot release their own preparation report.
9. Each stage allows the first released run plus three included reruns within 30 days of first release, with eight total processing attempts and one pending run at a time. Initial reassessments are automated; preparation reruns require qualified release. Changed commercial scope needs a new governed quote.

Current pricing is ₹500 per unique loan / ₹8L combined minimum for the committed route and ₹650 / ₹10.4L standalone. Initial Assessment is 30% of the standalone fixed quote, with a ₹3.12L minimum, and is credited once against either route. The route-specific remainder is paid before preparation. At3,000 loans this gives₹5.85L initial, then₹9.15L committed or₹13.65L standalone. Execution is additional. Approved rate-card tax is added explicitly; no universal tax rate is hard-coded.

## Configuration and operating boundary

All new capabilities are off by default. Use an isolated test environment and synthetic data until the relevant processing and customer authorities are approved.

| Configuration | Test value / meaning |
|---|---|
| `ASSURERAIL_ENGAGEMENT_BILLING_MODE` | `shadow` |
| `ARAIL_CUSTOMER_OPERATIONS_V1` | `shadow`; existing persistence prerequisites also apply |
| `NEXT_PUBLIC_ASSURERAIL_ENGAGEMENT_BILLING_ENABLED` | `true` for the authenticated web journey |
| `ASSURERAIL_CHECKOUT_MODE` | `razorpay_test`; live credentials are rejected |
| `ASSURERAIL_RAZORPAY_ACCOUNT_ID` | Stable merchant `acc_...` identity, independently confirmed; not the rotating API key ID |
| `ASSURERAIL_RAZORPAY_KEY_ID`, `...KEY_SECRET` | Dedicated Razorpay **test** credentials, injected server-side |
| `ASSURERAIL_RAZORPAY_WEBHOOK_SECRET`, `...PREVIOUS_WEBHOOK_SECRET` | Current and temporarily retained previous webhook HMAC secrets; use at least 32 characters |
| `ASSURERAIL_DOCUMENT_PROCESSING_MODE` | `shadow` |
| `ASSURERAIL_AI_ENABLED` | `true` only for an authorised model rehearsal |
| `ASSURERAIL_OPENAI_API_KEY`, `ASSURERAIL_OPENAI_DATA_PROCESSING_APPROVED` | Separate OpenAI key and explicit processor approval |
| `ASSURERAIL_GEMINI_API_KEY`, `ASSURERAIL_GEMINI_DATA_PROCESSING_APPROVED` | Separate Gemini key and explicit processor approval |
| `ASSURERAIL_GEMINI_FALLBACK_ENABLED` | `true` permits fallback on availability failures; refusal or invalid output does not trigger it |
| `ASSURERAIL_EXTRACTOR_PYTHON` | Absolute path to dedicated Python with the pinned requirements installed |
| `ASSURERAIL_ASSESSMENT_UPLOAD_PROFILES_JSON` | Institution-keyed certified connector ID, schema ID/version and approved `retentionDays` |
| `ASSURERAIL_QUALIFIED_REVIEWERS_JSON` | Approved Portfolio Preparation reviewers: `userId`, `assetFamilies`, `expiresAt`, `qualificationRef`; unused by Initial Assessment |

Inject secrets through approved secret storage; never place them in browser configuration, committed files or evidence metadata. No provider notifications or reminders are requested by checkout creation. Maximus is the requested secondary provider, but its adapter is not implemented without a verified merchant API contract.

Bootstrap the institution, approved users, active accepted customer contract and approved rate card through existing governed administration. The new DA/conventional/initial-transfer stage rules are `ENGAGEMENT_STAGE_FEE` (`PER_UNIT_MINOR`, rate `1`, no floor/cap) and `ENGAGEMENT_TAX` (approved percentage rule, no floor/cap). The quote fixes the base charge; these rules meter its exact statement and tax. The database rehearsal's 18% example is synthetic, not a tax determination. Statutory invoice numbering, issuer/place-of-supply treatment, withholding and production accounting remain separate work.

Use the existing object-store, certified connector and ClamAV configuration. No clean scan, no processing. The extractor subprocess has input/time/output limits; deployment must additionally provide an unprivileged, network-isolated extraction environment. Do not equate Python `-I` with a security sandbox.

Model requests use fixed official endpoints, bounded input/output and no document-specified URLs/tools. OpenAI requests set `store:false`; that is not a claim of zero provider retention or India-only residency. Processor approval must cover the actual account and deployment terms. OCR is capped at 20 pages and 8 MiB per model document; local parsing allows 20 MiB/document and 40 MiB/run. Oversized AI analysis is explicitly skipped/qualified, never presented as a clean assessment. Model validation is not independent assurance.

## API surface

Participant base: `/v1/rail/institutions/:institutionId/engagements`. Every route requires the active authenticated institution and the relevant commercial/evidence permission; identifiers alone do not grant access.

| Method and relative path | Function |
|---|---|
| `GET /` | List the institution's engagements |
| `POST /` | Persist billing/scope and obtain a versioned offer |
| `POST /:engagementId/accept` | MFA acceptance of the exact initial quote |
| `POST /:engagementId/preparation` | Accept preparation route after a current released initial report and count reconciliation |
| `GET /:engagementId/stages/:stage/readiness` | Authoritative **shadow** readiness; always `liveStageUnlock:false` |
| `POST /:engagementId/stages/:stage/checkout` | Create/reuse the stage's Razorpay test link |
| `POST /:engagementId/stages/:stage/checkout/reconcile` | Fetch provider state and reconcile the existing payment |
| `POST /:engagementId/runs/upload/:stage` | Raw octet-stream upload with base64url JSON `x-assurerail-document-metadata` |
| `GET /:engagementId/runs` | Run status and released reports only |
| `POST /:engagementId/runs` | Request processing of explicit clean evidence versions with fresh MFA |

Webhook: `POST /v1/rail/payment-webhooks/razorpay`, raw-body HMAC in `x-razorpay-signature`, event identity in `x-razorpay-event-id`. The payload merchant account must match configuration. Register the exact externally reachable route in the provider's **test** dashboard. The code stores a digest and entity references, not the complete webhook body.

Internal base: `/v1/rail/internal/engagements/institutions/:institutionId`:
- `POST /:engagementId/stages/:stage/invoice` prepares the statement; issuance remains the existing independent commercial review operation.
- `GET /:engagementId/runs/:runId` returns the reviewer report.
- `POST /:engagementId/runs/:runId/review` accepts only Portfolio Preparation. It requires `RELEASE`/`REJECT`, exact result digest, validated sign-off evidence and MFA. Initial Assessment rejects this route because it is automatically released. Evidence purpose is `ASSESSMENT_REVIEW:<runId>:<resultDigest>`.

These are implemented authenticated APIs. The new bank-file and escrow helpers below are **not HTTP endpoints** and must not be advertised as callable production APIs.

## Bank-file and escrow boundary

`bank-file.adapter.ts` implements a sandbox-only OpenSSH SFTP transport with pinned host keys, dedicated mounted secrets, password fallback disabled, bounded files, data-plus-manifest publication and explicit ambiguous outcomes. Private keys must have no group/other permissions. The buyer must agree to consume only complete files with the matching final manifest. A successful upload means **awaiting acknowledgement**, not acceptance or settlement.

The caller must still be integrated with a durable dispatch/outbox and attempt state before using this transport. There is no supplied live buyer template, endpoint, acknowledgment channel or real SFTP roundtrip evidence. FTPS transport is not implemented by this increment. ₹50K covers the previously agreed standard scoped setup; a second product or reused interface is not another automatic setup fee.

`escrow-settlement-contract.ts` validates balanced INR instructions, invoiced deduction references and individual settlement-leg observations. It does not validate legal mandates by itself, hold money, create a VAN, dispatch to Castler or prove provider settlement. Multi-seller authority, signed instructions, beneficial ownership, bank/Castler authentication and durable reconciliation must be implemented against the eventual provider contract.

## Verification and demonstration

Run from the repository root with Node/npm on PATH and a dedicated Python environment:

```sh
npm run build --workspace=@assurerail/api
npm run build --workspace=@assurerail/web
(cd apps/assurerail-api && node --test dist/customer-operations/*.test.js dist/internal-access/internal-access-policy.test.js dist/evidence/*.test.js)
python -B scripts/test_assurerail_document_extract.py
bash -n scripts/assurerail-billing-db-rehearsal.sh
ASSURERAIL_EXTRACTOR_PYTHON=/absolute/path/to/python bash scripts/assurerail-billing-db-rehearsal.sh
```

Install `scripts/assurerail-document-requirements.txt` in that Python environment. The PostgreSQL script uses a disposable local cluster and must never be pointed at a shared/live database. It builds the API itself. The new service rehearsal separately requires an explicit disposable-rehearsal flag and localhost database.

Evidence from this increment is revalidated after each pricing/workflow revision. The database test exercises the actual engagement, invoice, checkout, upload, extraction, automated initial release and rerun services, while identity/MFA, provider HTTP and clean scanner are **synthetic stubs**. Portfolio Preparation reviewer acceptance still needs its own complete database scenario. The existing invoice/receipt backup-restore checks precede the new engagement scenarios; new engagement records were not separately backup-restored. No real provider charges, AI inference, authenticated browser journey, bank SFTP roundtrip or Castler settlement have been performed.

For a technical demonstration, run the disposable rehearsal and show its explicit synthetic status. For the authenticated UI demo, provision approved test identities/contracts/roles and certified storage/scanning first, then follow the eight delivered steps above. Do not claim that the complete authenticated demo has passed based solely on a web build.

## Remaining stages and acceptance gates

| Stage | What still needs implementation / acceptance |
|---|---|
| Live paid engagement | Production commercial/invoice authority and tax-document integration; governed receipt-reference correction, checkout hold release and expired-link replacement; live payment configuration and reconciliation acceptance. Fresh test capture expires after five minutes and must be refreshed before another gated action. |
| Full preparation | AssurePool signed seller launch with accepted Rail billing authority, full credit/legal/risk modelling and approved tape mappings; representative document/model accuracy evaluation, customer correction UX and qualified Portfolio Preparation reviewer capacity. |
| Buyer onboarding integration | Approved buyer-profile synchronisation, seller/staff identity acceptance and cross-product scoped handoff tests. |
| Buyer file delivery | Durable dispatch/outbox, buyer-specific mapping, credentials, approved template, acknowledgment integration, duplicate/partial/ambiguous-outcome and rotation acceptance. |
| Settlement | Bank/Castler specification, per-seller mandate verification, actual provider dispatch, authenticated events, fee allocation from actual settled consideration and complete leg reconciliation. |
| Full demo / production readiness | Authenticated browser walkthrough, adversarial/cross-tenant tests, real provider test-mode end-to-end run, real-document evaluation, bank sandbox acceptance and operational recovery rehearsal. |

Inputs to request: Razorpay test merchant/account/webhook configuration; authorised OpenAI and Gemini accounts; reviewer qualification evidence and scoped access; buyer SFTP template/sandbox/owner; Castler settlement specification and test credentials. Missing external inputs do not make the remaining internal work complete. No production deployment was performed by this change.

## Provider references

- [Razorpay Payment Links APIs](https://razorpay.com/docs/payments/payment-links/apis/)
- [Razorpay webhook validation and testing](https://razorpay.com/docs/webhooks/validate-test/)
- [OpenAI GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs)
- [Gemini 3 Flash](https://ai.google.dev/gemini-api/docs/generate-content/gemini-3)
- [Gemini document processing](https://ai.google.dev/gemini-api/docs/document-processing)
- [pypdf text extraction](https://pypdf.readthedocs.io/en/stable/user/extract-text.html)
