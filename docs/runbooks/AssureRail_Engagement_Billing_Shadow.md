# Engagement billing shadow rehearsal

This increment adds account-scoped pricing previews and invoice-linked bank receipt reconciliation. It is not a live checkout, payment gateway, tax invoice system or stage activation authority.

Enable only in an approved local/staging environment: API `ASSURERAIL_ENGAGEMENT_BILLING_MODE=shadow` and `ARAIL_CUSTOMER_OPERATIONS_V1=shadow`; web `NEXT_PUBLIC_ASSURERAIL_ENGAGEMENT_BILLING_ENABLED=true`. Configure canonical company collection-account references in `ASSURERAIL_BILLING_COLLECTION_ACCOUNT_REFS`. Never enter credentials as references. No flags are enabled by this change.

Customer flow: approved login → active institution workspace → Plan an assessment → enter unique loan count → calculate quote → compare committed/standalone routes and optional secure-file/API needs. Optional selection is a preview only. Current pricing is₹500/₹650 per loan, minima₹8L/₹10.4L. Initial Assessment is 30% of the standalone quote, minimum₹3.12L, credited once to either route. It is automated and unsigned; qualified expert review begins with Portfolio Preparation.

Finance flow:

1. Use the existing contract/rate-card/usage/invoice maker-checker process. Only issued/corrected INR-paise statements can receive a receipt.
2. Ingest institution-owned bank receipt evidence using the existing evidence process: type `BANK_RECEIPT`, purpose `CUSTOMER_BILLING`, current version `VALID`, matching payload digest, not expired. A client-declared payment is insufficient.
3. Authorised internal finance maker obtains MFA proof `INTERNAL_PAYMENT_RECEIPT_PROPOSE`; post to `/v1/rail/internal/engagement-billing/institutions/:institutionId/invoices/:invoiceId/receipts` with configured collectionAccountRef, canonical bankTransferRef, positive exact amountMinor, evidenceRef, evidenceDigest, non-future receivedAt and stepUpEvidenceId.
4. A different authorised finance reviewer obtains `INTERNAL_PAYMENT_RECEIPT_REVIEW`; post APPROVE/REJECT and reason to `.../receipts/:receiptId/review`. Approval rechecks current evidence and invoice balance under an invoice lock. Duplicate transfer references and over-allocation fail closed.
5. Authorised customer reads `/v1/rail/institutions/:institutionId/engagement-billing/invoices/:invoiceId/payment-position`. Partial receipts leave an outstanding balance. Later invoice credit can cause overpayment requiring reconciliation. All responses explicitly deny live-stage unlock.

Do not manually alter database rows to repair rejected receipts or activate stages. The governed correction/refund/reversal path and provider adapters remain pending; rejected transfer references remain reserved against duplicate allocation.

Verification:

- `npm run build` in `apps/assurerail-api`, then `node --test dist/customer-operations/*.test.js`.
- `bash scripts/assurerail-billing-db-rehearsal.sh` from repo root, with PostgreSQL tools and Node on PATH. Creates disposable synthetic local databases, applies all migrations and checks backup/restore. Never set this script to a real customer database.
- `npm run build` in `apps/assurerail`.

Observed: API/web builds pass;22targeted tests pass;34migrations applied with receipt uniqueness, independent review, amount checks and restore passing. No real bank, provider or authenticated payment-to-assessment rehearsal claimed.

The contractor-day allocator is batch validation, not a persisted payable ledger. Secure-file module is an acceptance contract, not a working bank transport. Credentials, buyer specifications, sandbox acceptance and provider settlement remain separate production gates.
