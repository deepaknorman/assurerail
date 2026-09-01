# AssureRail trustee-coordinated historic PTC replay pilot plan

**Status:** execution-ready operating plan; external transaction/data owner not yet named

**Date:** 1 September 2026

**Scope:** one completed domestic India conventional PTC transaction, processed only in
`REPLAY/SHADOW` and `OBSERVE_ONLY`

**Purpose:** close the external-evidence component of PR-10 by proving that AssureRail can reproduce,
compare, evidence and independently reconcile an actual completed PTC transaction without issuing,
allotting, settling, notifying, soliciting, trading, tokenising or changing any authoritative record.

This plan does not establish live-operation approval, regulatory permission, production readiness
or customer acceptance for a venue. It is an evidence-backed historic replay and co-design exercise.

## 1. Recommended pilot structure

Use a trustee-coordinated model, with IDBI Trusteeship as the preferred first co-design candidate if
it agrees:

- the trustee identifies a suitable completed transaction and appoints its operations lead and
  independent outcome reviewer;
- the originating NBFC authorises use of its pool, transfer, subscription and consideration records;
- the trustee authorises use of its appointment, trust/programme, transaction-control, documentation
  and issue/allotment records;
- the trustee or data owner supplies the route-defined RTA/depository/register acknowledgement. If
  the trustee relies on that recordkeeper, Rail retains both the trustee decision and the referenced
  external acknowledgement;
- counsel, rating, servicer, account provider and assurance evidence are included only where the
  actual route required them; and
- AssureRail provides the non-live replay environment, neutral intake, case/saga controls,
  comparison, break handling and independently verifiable evidence pack.

The trustee is the final transaction-control authority in Rail. It is not automatically the owner of
every source record and cannot grant rights it does not hold. The pilot therefore records one named
coordinating data owner plus the owner/permission basis for each supplied object.

## 2. Entry criteria and transaction selection

The first transaction should be:

1. completed and operationally settled;
2. domestic conventional PTC, not a tokenised representation;
3. supported by available executed documents and system acknowledgements;
4. sufficiently recent that responsible operations staff can explain exceptions;
5. supported by a cooperative originator and trustee;
6. supported by an identifiable RTA/depository/register record or acknowledgement; and
7. free of unresolved litigation, distress or unusual mechanics that would make it a poor first
   reference case.

Selection does not imply that exceptions are excluded. A transaction with documented ordinary
operational exceptions can be useful, but any legal-mechanics difference from the v1 route pack must
be resolved as an explicit route-pack decision before replay rather than forced into the fixture.

## 3. Authority and data-use package

Before evidence intake, obtain a signed or otherwise formally authorised pilot/data-use record that
names:

- transaction reference or approved pseudonym;
- coordinating data-owning institution and accountable individual;
- trustee lead and independent trustee reviewer;
- source owner for each evidence family;
- permitted historic-replay purpose and non-live limitation;
- authorised AssureRail operators and external reviewers;
- approved encrypted transfer/clean-room method;
- redaction and pseudonymisation standard;
- retention end date, legal hold, return/destruction and deletion evidence;
- permitted comparison/evidence-pack exports; and
- restrictions on onward use, public claims and fundraising/customer disclosure.

The detailed intake and final acceptance record are in
`docs/templates/AssureRail_Historic_PTC_Replay_Evidence_Intake_v1.md`.

## 4. People and separation

| Responsibility | Preferred source | Separation requirement |
|---|---|---|
| Executive sponsor | AssureRail founder/product owner | does not substitute for evidence owner |
| Pilot coordinator | AssureRail product/domain lead | coordinates but does not self-approve evidence |
| Trustee operations lead | IDBI or selected trustee | supplies/explains trustee-owned facts |
| Trustee outcome reviewer | selected trustee | independent of evidence preparation where required |
| Originator data owner | selected NBFC | formally authorises originator-owned records |
| Originator operations SME | securitisation/treasury operations | explains pool/transfer/subscription/cash facts |
| Recordkeeper liaison | RTA/depository/register or trustee liaison | validates the legally operative record evidence |
| Rail evidence/intake operator | implementation/data engineer | cannot provide source authority |
| Rail replay-authorisation maker | authorised case owner | different from authorisation checker |
| Rail replay-authorisation checker | authorised case owner | different from maker |
| Leg observation recorder | declared owner institution | different from leg reconciler |
| Repair maker, if required | accountable break owner | different from repair checker |
| Repair checker, if required | accountable break owner | different from maker and post-repair reconciler |
| Independent replay reviewer | QA/controls/operations | different from replay maker/operator |
| Security/privacy reviewer | security/privacy owner | approves intake/access/retention controls |
| Legal/regulatory liaison | internal coordinator/external counsel | acknowledges perimeter; does not mark evidence facts |

Every governed platform actor needs an active institution membership, applicable mandate, route
authority and case-scoped step-up. Where an external party cannot operate Rail directly, its signed
source acknowledgement remains external evidence; an AssureRail operator may ingest it but may not
pretend to be that party.

## 5. Work packages and gates

### WP-1 — Transaction nomination and permission

Deliverables:

- candidate transaction fact sheet;
- named data owner, trustee lead, originator lead and recordkeeper route;
- executed NDA/data-use authority;
- data classification, retention, redaction and export decision; and
- go/no-go against the v1 domestic conventional PTC route.

Gate: no evidence intake until authority and handling terms are complete.

### WP-2 — Evidence-mapping workshop

Run a working session covering every applicable leg:

- action/function and accountable institution;
- expected historic fact;
- authoritative source/document/system;
- observed historic outcome;
- signature, version, as-of time, expiry and qualification;
- legal recordkeeper versus trustee-control distinction;
- required redaction without loss of control meaning; and
- named recorder and independent reconciler.

Deliverables: completed evidence manifest, route deviations, missing-evidence register and agreed
secure-transfer inventory.

Gate: route deviations are approved/versioned; missing mandatory evidence blocks replay planning.

### WP-3 — Controlled intake and validation

Deliverables:

- encrypted object/payload intake outside source control;
- malware/quarantine result where files are used;
- immutable object/version, source reference, digest and access policy;
- provider/source signature and achieved verification status;
- as-of/expiry/qualification and retention/legal-hold metadata;
- pseudonym mapping retained by the data owner where possible; and
- intake reconciliation signed by operator and reviewer.

Gate: `AVAILABLE`, current, valid, signature-verified and result-verified evidence only. Expected
provider capability is not promoted to achieved evidence.

### WP-4 — Case and replay authorisation

Deliverables:

- Rail institutions, parties, appointments, functions and mandates;
- exact route dimensions and route-pack version;
- immutable case evidence lock;
- maker/checker case transition to `APPROVED_FOR_EXECUTION`; and
- separately maker/checker-approved PTC replay allow-listing.

Gate: party, function, authority, evidence and aggregate-version checks all pass.

### WP-5 — Witnessed all-applicable-leg replay

Deliverables:

- immutable saga plan and before snapshot;
- participant-owned observations in required sequence;
- independent reconciliation of every exact result;
- critical completion-blocking break for every mismatch;
- append-only maker/checker repair only where corrected source evidence justifies it;
- third-person reconciliation after repair; and
- trustee-control and authoritative-register results recorded separately.

Gate: no unresolved critical break; every required/applicable leg is independently reconciled.

### WP-6 — Comparison, evidence pack and acceptance

Deliverables:

- leg-by-leg expected/observed comparison and digests;
- complete break and repair trail;
- trustee decision and referenced recordkeeper acknowledgement;
- final evidence-pack digest and access/export receipts;
- limitations/actions register;
- retention/return/destruction actions; and
- signed `ACCEPT`, `ACCEPT_WITH_ACTIONS` or `REJECT` decision.

Gate: data owner, trustee, recordkeeper route reviewer, independent Rail reviewer, security/privacy,
product/domain and legal/regulatory liaison complete their assigned decision rows.

## 6. Evidence handling options

Choose one option in WP-1:

1. **Pseudonymised encrypted replay environment — recommended.** Source owners remove unnecessary
   personal identifiers while retaining stable pseudonyms, exact totals, dates and relationships.
2. **Trustee/originator-controlled clean room.** Rail processing runs in an approved isolated
   environment; only approved comparison and evidence-pack outputs leave. This is preferable where
   documents cannot be transferred.
3. **Split custody.** Each source owner retains its restricted bytes and provides a signed/digested
   canonical observation plus controlled reviewer access. Use only if reviewers can still verify the
   underlying source; digest-only assertions without an evidence-review path do not close the gate.

No option permits credentials, keys, borrower PII or evidence bytes in Git, ordinary issue trackers
or unapproved email.

## 7. Proposed working cadence

The planning target, conditional on prompt permissions and document availability, is:

| Stage | Target window | Exit evidence |
|---|---:|---|
| Nomination and authority | week 1 | signed scope/data-use decision |
| Evidence mapping and secure collection | weeks 1–2 | complete manifest and gap register |
| Intake, validation and dry run | weeks 2–3 | accepted immutable evidence and zero structural blockers |
| Witnessed replay and exception resolution | weeks 3–4 | all applicable legs observed/reconciled or explicit rejection |
| Independent review and acceptance | weeks 4–5 | signed decision and evidence-pack digest |

These are planning windows, not an assurance promise. Permission, missing records, route deviations
or unresolved breaks extend the schedule and are never bypassed to meet a date.

## 8. Initial approach to the trustee

The request should state:

> AssureRail proposes a controlled, non-live replay of one completed conventional PTC transaction to
> validate transaction-control, evidence, reconciliation and audit capability. No money, securities,
> notices or legal records will be changed. We propose redacted or pseudonymised evidence in an
> approved secure environment, with the trustee coordinating its review and helping identify the
> originator and route-defined register acknowledgement. The outputs will be a leg comparison,
> exception/repair record and independently verifiable evidence pack.

Ask for:

- one candidate completed transaction;
- one trustee operations lead and one independent reviewer;
- permission for trustee-held evidence;
- introduction to the originating NBFC/data owner;
- identification of the RTA/depository/register evidence route;
- one evidence-mapping workshop; and
- one witnessed outcome/acceptance review.

## 9. Success and non-success

The pilot succeeds only when the authorised historic transaction is reproduced from retained
evidence, all applicable legs are independently reconciled, all differences and repairs remain
visible, and the final evidence pack is accepted by the assigned reviewers.

The following do not constitute success: synthetic tests, a green API response, a trustee statement
without its referenced recordkeeper acknowledgement where the route requires one, deletion of a
mismatch, an unresolved critical break, or a request to treat replay as permission for live PTC
operation.
