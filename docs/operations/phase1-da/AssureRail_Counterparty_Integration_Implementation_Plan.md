# AssureRail counterparty integration implementation plan

**Version:** 1.0 — 17 September 2026

**Classification:** `SHARED_PASSWORD`

**Purpose:** reusable planning and acceptance document for a Phase 1 conventional DA seller, buyer or selected service provider

**Status:** template. Complete one controlled copy for each counterparty and interface. It does not itself activate production access, payment collection, data sharing or settlement.

## 1. Implementation record

Complete this table before technical configuration begins. Use `Not applicable` rather than leaving a decision ambiguous.

| Field | Agreed value |
|---|---|
| Plan reference and version | `[To complete]` |
| Counterparty legal name and institution ID | `[To complete]` |
| Counterparty capacity | `Seller / buyer / payment provider / settlement provider / other selected provider` |
| Business owner and authorised approver | `[Name, role and approved business contact]` |
| Counterparty technical owner and backup | `[Name, role and approved business contact]` |
| AssureRail engagement and case reference | `[To complete when applicable]` |
| Asset family and permitted purpose | `[To complete]` |
| Data classification | `Synthetic / authorised historical / live customer data` |
| Integration pattern | `Portal upload / SFTP push / SFTP pull / REST API / provider-hosted checkout / webhook` |
| Environments | `Sandbox / UAT / production` |
| Current state | `Discovery / specification / sandbox / UAT / approved for production / live / suspended / retired` |
| Target gate | `[Name the next evidence gate; do not use a date as a substitute for acceptance]` |
| Commercial document | `[MSA, order, SOW or mandate reference and version]` |
| Security and privacy approvers | `[To complete]` |
| Production activation authority | `[Named counterparty approver and named AssureRail approver]` |

No password, API secret, private key, token, borrower record or bank instruction belongs in this document. Record only an approved vault reference, key fingerprint or evidence reference.

## 2. Outcome and scope

### Intended outcome

Record the specific operational result in one sentence. Examples are: “the seller submits an admitted EV loan tape and supporting evidence through its AssureRail workspace”; “AssureRail delivers the buyer-approved DA pack through SFTP and receives a digest-bound acknowledgement”; or “Razorpay test checkout records a verified, fully captured stage payment in AssureRail’s shadow environment.”

**Agreed outcome:** `[To complete]`

### Included interface

| Decision | Agreed value |
|---|---|
| Direction | `Counterparty to AssureRail / AssureRail to counterparty / bidirectional` |
| Data objects | `[Loan tape, documents, findings, Q&A, invoice, payment state, acknowledgement or other approved object]` |
| Frequency or trigger | `[User action, case gate, event, scheduled interval]` |
| Maximum file, batch and record volumes | `[To complete]` |
| Required acknowledgement | `[Receipt, schema validation, business acceptance, rejection or none]` |
| Record of truth | `[Name the authoritative system for each material field]` |
| Retention and deletion | `[Period, trigger and evidence owner]` |
| Support boundary | `[Business hours, incident route and named owner]` |

### Exclusions and dependencies

Record exclusions explicitly. A standard integration does not imply buyer approval, successful sale, settlement authority, statutory filing, professional opinion or unrestricted access to another party’s systems. Bespoke APIs, non-standard transformations, a second product, production network changes and additional environments require an approved change unless the commercial document expressly includes them.

## 3. Standard integration choices

Choose the least complex mode that satisfies the accepted business need.

| Use case | Default | When another mode is justified | Current AssureRail boundary |
|---|---|---|---|
| Seller data and document intake | Authenticated portal upload | SFTP for repeatable high-volume export; API only where operational frequency justifies it | Portal workflow and REST intake exist; each production connection still needs counterparty acceptance |
| Buyer delivery | Point-to-point SFTP with manifest and acknowledgement | API where the buyer requires near-real-time structured exchange and funds the approved scope | Governed sandbox SFTP foundation exists; production transport and bank-specific acceptance remain gated |
| Upfront assessment payment | Provider-hosted Razorpay checkout plus signed webhook and server reconciliation | Approved secondary provider after its verified merchant API passes the same controls | Razorpay test adapter and webhook exist; test merchant credentials and provider rehearsal remain required |
| Closing settlement | Appointed bank or escrow/VAN provider using a seller-authorised distribution schedule | Provider API after legal, bank and operating acceptance | Calculation and provider-neutral adapter foundations exist; no provider is production-live |
| Ongoing monitoring | Accepted file feed or SFTP schedule | API for high-frequency, mature programmes | Separately selected service; payer and servicer responsibilities must be stated |

The standard point-to-point SFTP setup, testing and validation customer rate is **₹50,000 per accepted connection**, plus applicable tax, for the agreed standard scope. It is a deliberately low-friction setup price. It covers one counterparty, one product, one production connection and its agreed sandbox/UAT path, one approved schema, one authentication method and the agreed test cycle. Buyer-specific transformation, a second source or destination, field remediation, repeated changes after acceptance and APIs are separately quoted.

## 4. Acceptance gates

Work proceeds as one dependency-led chain. A calendar target may be recorded, but no elapsed time waives a gate.

| Gate | Required result | Minimum acceptance evidence | Decision owners |
|---|---|---|---|
| G0 — Authority and scope | The parties, purpose, data, payer and commercial boundary are authorised | Executed or accepted governing document; named owners; permitted-purpose and data-authority record | Counterparty business owner; AssureRail commercial approver |
| G1 — Discovery complete | Source, destination, volumes, records of truth and exceptions are known | Completed implementation record; sample schema; dependency and open-item register | Both technical owners |
| G2 — Interface frozen | Versioned schema, mapping, security profile and acknowledgement contract are accepted | Interface specification digest; example payloads; rejection codes; retention rule | Counterparty technical owner; AssureRail integration operator |
| G3 — Secure configuration | Identities, credentials, network controls and audit routes are configured without placing secrets in documents | Vault references; fingerprints; access approvals; rotation and revocation evidence | Both security approvers |
| G4 — Sandbox passed | Positive and negative tests produce the expected records without live business effect | Signed test report; test-data declaration; defect record; evidence digests | Both technical owners |
| G5 — UAT accepted | Authorised business users accept the end-to-end result and operating procedure | UAT cases and approval; reconciled counts/totals; support and escalation test | Counterparty business owner; AssureRail operations |
| G6 — Production ready | Legal entity, MSA/order, privacy, security, support, backup, rollback and production settings are approved | Production-readiness checklist; independent maker-checker approvals; cutover and rollback record | Named production activation authorities |
| G7 — First production event reconciled | The first controlled event is acknowledged and matched end to end | Source, transport, destination and acknowledgement digests; business control totals; incident-free or resolved-exception record | Both operations owners |
| G8 — Steady state or closure | Monitoring, access review and change control operate, or the interface is cleanly retired | Service review; access recertification; deletion/export evidence where applicable | Both business owners |

## 5. Workstream plan

| Workstream | Activities | AssureRail responsibility | Counterparty responsibility | Completion evidence |
|---|---|---|---|---|
| Commercial and authority | Confirm party role, scope, payer, data authority, liability boundary and selected service lines | State the platform/service boundary and issue the applicable plan/SOW | Evidence authority, permitted purpose and authorised approvers | G0 record |
| Data and schema | Inventory objects, fields, formats, control totals, allowed values and rejection treatment | Supply or agree the canonical contract and validation rules | Supply representative, authorised samples and source definitions | Versioned mapping and fixtures |
| Identity and RBAC | Name administrators/operators, create scoped access and test joiner/mover/leaver actions | Enforce institution, workspace, case, document and action scopes | Nominate users and promptly remove or update access | Access approval and recertification record |
| Security and privacy | Threat review, encryption, host or TLS identity, credential custody, retention and incident route | Configure AssureRail controls and evidence | Approve network/provider controls and protect its endpoint and users | Security acceptance pack |
| Build and configuration | Configure profile, mapping, endpoint, webhook, folders or checkout | Build only the agreed adapter/configuration | Configure its source/destination and provide sandbox access | Configuration digest and maker-checker approval |
| Test and reconciliation | Execute positive, failure, replay, ambiguity and recovery tests | Operate the AssureRail side and retain technical evidence | Operate the counterparty side and confirm business control totals | Joint test report |
| UAT and operating procedure | Rehearse ordinary processing, rejection, support and incident escalation | Train the scoped AssureRail operators | Provide authorised UAT users and accept the process | Signed UAT and runbook |
| Cutover and first event | Freeze changes, activate, constrain the first event and reconcile it | Run activation and AssureRail-side reconciliation | Approve production activation and destination/source result | G6 and G7 evidence |
| Service and change | Monitor health, access, incidents, versions and exit | Report the agreed evidence and coordinate changes | Notify source/schema/endpoint changes before implementation | Review and change records |

## 6. Interface specification schedule

| Topic | Required decision |
|---|---|
| Object identity | Stable institution, engagement/case, seller, loan, borrower or co-borrower and batch identifiers as applicable |
| Versioning | Schema version, effective date, compatibility rule and retirement notice |
| Control totals | Record count, unique-loan/borrower count, principal or payment total, file count and digest as applicable |
| Encoding and format | CSV/XLSX/PDF/JSON rules, UTF-8, date/decimal conventions, units and null handling |
| Validation | Required fields, field bounds, duplicate handling, referential checks and complete rejection taxonomy |
| Transport identity | HTTPS certificate or pinned SSH host-key fingerprint verified out of band |
| Client identity | Institution-owned user, service identity, API credential or dedicated SSH key; no shared personal account |
| Encryption | TLS/SFTP in transit and approved encryption at rest; private keys and secrets stay in the approved secret store |
| Idempotency | Stable request or batch key; same key and same content returns the existing result; changed content fails |
| Publication | For SFTP, payloads are staged and the final manifest is published last under agreed atomicity rules |
| Acknowledgement | Receipt and business acceptance are distinct; acknowledgement binds object/batch identity, version and digest |
| Ambiguity | Timeout or unknown outcome is inspected/reconciled before retry; never repeat a potentially completed financial or delivery act blindly |
| Audit | Actor/service identity, time, institution scope, action, outcome and bounded digests; no secrets or unrestricted payload logging |
| Retention and exit | Staged-copy deletion, authoritative-record retention, customer export and credential revocation |

## 7. Minimum test and evidence pack

Use synthetic data in sandbox unless authorised historical data is specifically approved. Live borrower data is prohibited in a test environment.

| Test family | Required cases | Acceptance result |
|---|---|---|
| Happy path | Valid file/request, expected count/amount and valid acknowledgement | One accepted result with matching control totals and digests |
| Authentication | Valid identity, expired/revoked identity, wrong environment and unauthorised method | Only the valid scoped identity succeeds |
| Authorisation and tenancy | Wrong institution, case, seller, buyer, role and document scope | Cross-scope attempts are denied and audited without data disclosure |
| Input safety | Missing fields, invalid encoding, oversized object, duplicate IDs, malicious filename and malware/quarantine path | Deterministic rejection; nothing unsafe proceeds |
| Replay and idempotency | Exact replay and same key with changed bytes | Exact replay returns the existing outcome; changed content fails |
| Failure and ambiguity | Pre-send failure, timeout, connection loss after send and unavailable acknowledgement | Safe retry only when absence is proven; unknown outcomes remain held for reconciliation |
| Business reconciliation | Record count, unique pair count, corpus/payment amount, exclusions and rounding | Source, AssureRail and destination totals reconcile or carry an approved exception |
| Rejection and repair | Partial rejection, corrected payload and resubmission | Every rejection has an owner/reason and the corrected version remains traceable |
| Credential lifecycle | Rotation, previous-key overlap where approved, revocation and emergency suspension | No outage or unauthorised fallback; old credential ceases at the recorded point |
| Recovery and exit | Rollback, backup/recovery evidence, export and deletion/revocation | Agreed recovery objective and clean closure are evidenced |

## 8. Production cutover and rollback

Production activation requires two independently recorded approvals. At cutover, record the exact schema/profile digest, endpoint identity, credential version, environment, feature flag, allowed institution/case scope and first-event limit. Freeze unrelated changes until the first event is reconciled.

Rollback means suspending the connector or checkout path, preserving the audit record and authoritative evidence, revoking or disabling affected credentials when required, and returning to the agreed manual or portal process. Do not delete an indeterminate event or retry it merely to make the dashboard look complete. Payments, settlement and buyer delivery remain held until their true provider/destination state is established.

## 9. Operating and change control

| Event | Required action |
|---|---|
| Schema or mapping change | New version, regression fixtures, maker-checker approval and counterparty acceptance before activation |
| Endpoint, certificate or host-key change | Independently verify the new identity; suspend on an unexpected change |
| Credential compromise or suspected misuse | Suspend, revoke/rotate, investigate and record incident evidence before resuming |
| Repeated rejection or reconciliation difference | Open a problem record; do not normalise unexplained variances |
| Material volume/frequency increase | Reassess limits, performance, support and commercial scope |
| Provider or subprocessor change | Complete legal, privacy, security and operating review before data transfer |
| Exit | Stop new events, reconcile pending events, export authorised records, revoke access and evidence deletion/retention decisions |

All changes record requester, business reason, affected objects, risk, test evidence, approvers, effective time, rollback plan and superseded configuration digest.

## 10. Buyer-specific schedule

Complete this section when the counterparty is a direct assignee.

| Decision | Buyer-agreed value |
|---|---|
| MSA and approved requirement-profile version | `[To complete]` |
| Buyer administrators and operational roles | `[To complete]` |
| Eligible asset, corpus, seasoning, tenor and performance ranges | `[Structured profile reference]` |
| Required evidence and professional review | `[Structured profile reference]` |
| Delivery mode, folder/API resource and schema | `[To complete]` |
| Receipt, validation and business-acceptance acknowledgements | `[To complete]` |
| Diligence/Q&A contacts and clocks | `[To complete]` |
| Purchase decision and conditions record | `[Buyer-owned process/reference]` |
| Funding, VAN/escrow and settlement dependencies | `[To complete; no bank instruction secret]` |
| Post-close servicing and optional monitoring | `[Payer, servicer, frequency and term]` |

The buyer retains credit, legal, compliance, valuation, pricing and purchase decisions. Successful technical delivery does not mean buyer acceptance or settlement.

## 11. Seller-specific schedule

Complete this section when the counterparty is an originator or seller.

| Decision | Seller-agreed value |
|---|---|
| Seller authority, order/mandate and data-purpose reference | `[To complete]` |
| Source LMS/ERP and authoritative owners | `[To complete]` |
| Declared and admitted counts/corpus control totals | `[To complete]` |
| Unique seller × loan × borrower/co-borrower identity rule | `[Mapping reference]` |
| Linked-party records and ₹250 quantity treatment | `[Mapping/reference]` |
| Upload/export method and frequency | `[Portal / SFTP / API if separately approved]` |
| Data Preparer or formatting facilitator | `[Named seller-appointed role; seller-funded]` |
| Exception/remediation owner and reassessment route | `[To complete]` |
| Existing lender, payoff/release and registry dependencies | `[To complete]` |
| Seller-authorised settlement distribution approvers | `[To complete; no bank instruction secret]` |

The seller remains responsible for source facts, authority, attestations, remediation decisions and approved settlement instructions. AssureRail records and processes the submitted evidence within the accepted scope.

## 12. Razorpay test implementation annex

Use this annex for AssureRail’s upfront Initial Assessment and Portfolio Preparation checkout rehearsal. It does not authorise live collection.

### Inputs to obtain and custody

| Input | Where it belongs | Acceptance check |
|---|---|---|
| Razorpay dashboard test-mode access | Named account administrators with MFA | Two authorised administrators can access test mode; no shared login |
| Stable merchant account identity | Secret/configuration inventory as `ASSURERAIL_RAZORPAY_ACCOUNT_ID`; record only a masked value or vault evidence here | Matches the webhook payload `account_id` and approved merchant account |
| Test key ID | Server-side secret configuration as `ASSURERAIL_RAZORPAY_KEY_ID` | Begins with the approved test prefix; live-mode credentials are rejected by AssureRail |
| Test key secret | Approved server-side secret store as `ASSURERAIL_RAZORPAY_KEY_SECRET` | Retrievable by the runtime identity only; never pasted in this plan, source control, chat or browser variables |
| Webhook secret | Generate a separate random value of at least 32 characters and store server-side as `ASSURERAIL_RAZORPAY_WEBHOOK_SECRET` | Test delivery signature validates over the exact raw body |
| Previous webhook secret | Temporary rotation-only secret reference | Removed after the bounded rotation overlap |
| Test webhook URL | Exact externally reachable AssureRail test URL ending `/v1/rail/payment-webhooks/razorpay` | HTTPS, correct environment and provider test delivery received |
| Selected events | `payment_link.paid` plus applicable refund and payment-dispute events available for the test account | Paid state is reconciled; refund/dispute places processing on hold |

The person obtaining the Razorpay credentials should hand them directly to the authorised secret custodian through the approved secret channel. The implementation-plan owner records the vault reference, credential version, fingerprint or last four characters and custody evidence—never the secret value.

Razorpay’s current test-key path is Dashboard → Test mode → Account & Settings → API Keys under Website and app settings → Generate Key. Only an Owner or Admin can generate it, and the Key Secret is shown only at generation time. Configure the webhook separately under Account & Settings → Webhooks; its secret is not the API Key Secret.

### Razorpay rehearsal sequence

1. Confirm the AssureRail environment is `SHADOW`, checkout mode is `razorpay_test`, the merchant identity is correct and live credentials fail closed.
2. Configure the test key, separate webhook secret and exact callback URL through server-side secret injection.
3. Create one stage invoice through the AssureRail maker-checker process.
4. Create the provider-hosted payment link. Confirm the expected INR amount, AssureRail reference, no partial payment, provider notifications disabled and seven-day expiry.
5. Complete the provider’s test payment and receive the signed `payment_link.paid` event.
6. Reconcile the link and captured payment from the server. Browser return or webhook receipt alone does not mark the stage paid.
7. Replay the same webhook event and prove it does not create a second receipt or unlock.
8. Test invalid signature, wrong merchant account and mismatched link/payment/amount; each must fail closed.
9. Exercise a test refund and applicable dispute event; the stage must move to hold and its paid readiness must be revoked pending reconciliation.
10. Rotate the webhook secret through the approved overlap, prove both bounded versions behave as expected, then remove the previous secret.
11. Retain the signed test report, masked provider references, AssureRail audit evidence and defect closure. Do not retain card or payer-sensitive test data beyond the accepted need.

### Razorpay acceptance record

| Check | Evidence reference | Counterparty/provider owner | AssureRail checker | Result |
|---|---|---|---|---|
| Test account and merchant identity verified | `[To complete]` | `[To complete]` | `[To complete]` | `Pending / pass / fail` |
| Credential custody and rotation verified | `[To complete]` | `[To complete]` | `[To complete]` | `Pending / pass / fail` |
| Link creation and server retrieval reconciled | `[To complete]` | `[To complete]` | `[To complete]` | `Pending / pass / fail` |
| Signed webhook, duplicate and negative tests passed | `[To complete]` | `[To complete]` | `[To complete]` | `Pending / pass / fail` |
| Refund/dispute hold passed | `[To complete]` | `[To complete]` | `[To complete]` | `Pending / pass / fail` |
| UAT and production-readiness decision recorded | `[To complete]` | `[To complete]` | `[To complete]` | `Pending / pass / fail` |

## 13. Open items, decisions and sign-off

| ID | Item or decision | Owner | Dependency | Required evidence | State |
|---|---|---|---|---|---|
| `INT-001` | `[To complete]` | `[To complete]` | `[To complete]` | `[To complete]` | `Open / blocked / accepted / closed` |

### Gate approval

| Party | Name and role | Gate approved | Evidence/signature reference | Date and time |
|---|---|---|---|---|
| Counterparty | `[To complete]` | `[To complete]` | `[To complete]` | `[To complete]` |
| AssureRail | `[To complete]` | `[To complete]` | `[To complete]` | `[To complete]` |

An approval applies only to the named version, environment, institution, purpose and scope. A later material change reopens the affected gate.

## 14. Current provider references

- [Razorpay quickstart and dashboard setup](https://razorpay.com/docs/payments/quickstart/)
- [Razorpay API authentication and test keys](https://razorpay.com/docs/api/authentication/)
- [Razorpay Payment Link webhook subscription](https://razorpay.com/docs/payments/payment-links/subscribe-to-webhooks/)
- [Razorpay webhook replay and signature guidance](https://razorpay.com/docs/webhooks/faqs/)
- [Razorpay refund webhook events](https://razorpay.com/docs/webhooks/refunds/)
- [Razorpay dispute webhook events](https://razorpay.com/docs/webhooks/disputes/)
