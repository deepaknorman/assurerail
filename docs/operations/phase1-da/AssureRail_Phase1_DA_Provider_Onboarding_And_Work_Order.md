# AssureRail Phase 1 DA provider onboarding and work-order template

**Version:** 1.0 — 16 September 2026
**Classification:** `INTERNAL`
**Use:** one provider-admission record plus one accepted work order for every case assignment. Admission never authorises work on a customer case by itself.

## Provider classes

This template applies to seller and buyer counsel, CA or financial reviewers, bureau providers or authorised pullers, escrow/VAN/settlement and collection-account banks, ROC/NeSL/RTO/registry agents, field verifiers, technical reviewers, servicers, integration contractors and other case suppliers.

## Admission checklist

| Control | Required evidence | Approver |
|---|---|---|
| Legal identity | Incorporation/registration, PAN/GST, registered address, authorised signatory | Commercial + Finance |
| Qualification and scope | Professional membership, licence, empanelment or competence evidence appropriate to the service | Reviewer Coordinator or function owner |
| Conflicts and independence | Conflict declaration; related-party and prior-work disclosure; independence wording where relevant | Risk / Compliance |
| Insurance and liability | Professional indemnity/cyber cover where proportionate; liability and remedy terms | Risk / Compliance |
| Security and privacy | Data categories, purpose, location, subprocessors, retention, deletion, incident contact and access method | Security / Privacy |
| Banking and tax | Verified bank account, cancelled cheque/bank letter, invoice and TDS/GST data | Finance Checker |
| Service capability | Named leads, locations, capacity, turnarounds, escalation and continuity | Engagement Operations |
| Deliverable standard | Template, evidence form, signature method, limitation and acceptance criteria | Function owner |
| Commercial schedule | Fixed/unit/day rates, tax, expenses, validity, cancellation and overrun approval | Commercial Approver |
| Access role | Least-privilege workspace role and expiry; no shared credentials | Security / Privacy |

No provider receives case data until its admission is current, the case work order is accepted, conflicts are cleared and the provider's scoped identity is active.

## Provider work order

### A. Identification

| Field | Required entry |
|---|---|
| Work-order ID and version | Stable ID; revisions never overwrite an accepted version |
| Case and seller | Case ID, legal seller name and permitted buyer visibility |
| Provider and named personnel | Legal provider, lead, supporting personnel and professional IDs |
| Provider class | Counsel / CA / bureau / bank / registry / field / technical / servicer / integration / other |
| Appointment source | Seller, buyer, AssureRail managed service or joint instruction |
| Contracting party and payer | Name each separately; specify any seller-authorised settlement deduction |
| Effective and expiry dates | Access and delivery window |

### B. Scope and boundary

State the exact questions, population or sample, cut-off date, location, record types, standard, assumptions and exclusions. Identify whether the provider must issue a certificate, opinion, report, filing receipt, bank acknowledgement, data file or signed section.

The work order must state what the deliverable does **not** establish. For example, computational population coverage is not physical verification; counsel review is not a credit decision; a filing receipt is not proof of economic performance.

### C. Inputs and access

List every input, source, permitted purpose, expected format and due date. Record workspace folders or API/SFTP endpoints, authentication method, data-export permission, retention date and deletion/return evidence. Provider access is case- and purpose-specific.

### D. Deliverables and acceptance

| Deliverable | Format and signature | Due date / SLA | Acceptance test | Dependency owner |
|---|---|---|---|---|
| `[name]` | `[PDF/data/receipt; signing method]` | `[date/time]` | `[completeness, reconciliation, professional wording]` | `[party]` |

AssureRail may check completeness, identity, consistency and agreed format. It does not rewrite or adopt a provider's professional conclusion. Rejection identifies the failed acceptance criterion; it cannot require a different conclusion.

### E. Fees and change control

Record fixed, unit and day rates; GST; approved expenses; invoice milestone; cancellation; and any maximum. A person-day is charged as a full day whenever that person works, and a provider day may be allocated across engagements only when the time record identifies each case and no case is double charged.

The current internal contractor planning allowance is ₹25,000 per person-day. An accepted work order may state a different negotiated rate. Qualified reviewer invoices are payable within 15 days after the contracted deliverable is accepted, regardless of whether the portfolio later closes; settlement success must not become an unstated condition of professional payment.

No out-of-scope work, additional person, extra sample, travel or overrun is payable without a versioned change request that states reason, price, timing impact, payer and approving authority. Routine managed services may be sold at a published AssureRail customer rate; the provider invoice remains separate internal evidence.

### F. Escalation and closure

Record operational, professional, information-security and billing contacts. Define critical incident notification, missed-SLA escalation and substitute-person approval. Closure requires deliverable receipt, access removal, data return/deletion evidence, invoice reconciliation and outstanding exception hand-off.

## Provider-specific additions

- **Counsel:** jurisdiction, reliance addressees, opinion scope, privilege and duplicate-scope check.
- **CA / financial reviewer:** membership status, independence, section being signed, procedures and reliance wording.
- **Bureau:** permitted purpose, consent/authority, inquiry footprint, response retention and dispute route.
- **Bank / VAN / escrow:** account ownership, maker-checker, beneficiary validation, cut-offs, failed payment and unmatched-money handling.
- **Registry:** filer authority, credential custody, statutory receipt, rejection/retry and authoritative status check.
- **Field / technical:** sample basis, visit proof, geo/time evidence, safety, fraud escalation and unvisited-population wording.
- **Servicer / collection bank:** allocation rules, reversals, arrears, remittance timing, statement format and continuity plan.
- **Integration contractor:** data map, validation totals, test files, failure/replay, credential handover and production support period.
