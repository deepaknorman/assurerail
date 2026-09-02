# AssureRail activation playbook — replay → shadow → partner-executed pilot

**Status:** current operating/GTM baseline, 3 September 2026

**Code baseline:** `718e28d0a`

**Deployment:** AR-21–AR-30 deployed; 32 Rail migrations applied; API/web health reported green;
new product flags explicitly off; `ASSURERAIL_OPERATING_MODE=DEMO` unchanged

**Authority:** deployment is not enablement, customer acceptance, external evidence, controlled-live
or production activation.

## 1. What now exists

The first AssureRail product spine is implemented through AR-30. It includes:

- provider-neutral institutional admission, membership, mandate, appointment and entitlement;
- conventional DA and conventional PTC observe-only replay journeys;
- evidence, transaction case, room, completion, reconciliation and append-only repair controls;
- post-completion lifecycle observation and reconciliation;
- named-audience primary opportunity/RFQ/negotiation/allocation records and case handoff;
- conventional secondary DA/PTC observation;
- separately governed tokenised DA and PTC mirror journeys;
- enterprise integration, software-conformance, webhook and exit tooling;
- customer contracts, rate cards, statements, support and operational reviews;
- scoped internal RBAC and a production-scale assessment board; and
- fail-closed route/function/build/environment/cohort activation controls.

These facts establish a serious software product. They do not establish real transaction accuracy,
customer acceptance, legal permission, provider finality, VAPT closure or production operations.

## 2. Current capability posture

| Capability | Software state | External/operating state |
|---|---|---|
| Institution and staff control | Implemented behind disabled controls | Real IdP/KYB, customer UAT and staff-enforcement rehearsal open |
| Conventional DA | Observe-only journey implemented | Participant-authorised completed-deal replay open |
| Conventional PTC | Observe-only journey implemented | Participant/trustee-authorised all-leg completed-deal replay open |
| Lifecycle | Observation/reconciliation implemented | Servicer, payment, trustee/recordkeeper and operating acceptance open |
| Primary and secondary | Permissioned/named-audience records and guided journeys implemented | Function-specific counsel, conduct and authorised-performer gates open |
| Tokenised DA/PTC | Separate mirror journeys implemented | Title, custody, connector finality, authoritative-record and live acceptance open |
| Enterprise integration | Governance and software conformance implemented | Provider security, customer UAT, data, operating and exit evidence open |
| Controlled-live/production | Gate and assessment machinery implemented | No exact signed activation; unavailable |

The capability publisher and every customer-facing statement must preserve these distinctions.

## 3. The activation ladder

Never skip a rung. Each rung has a different authority, permitted behaviour and output.

| Rung | What runs | What cannot happen | Required inputs | Output that sells the next rung |
|---|---|---|---|---|
| **1 · Historic replay** | A completed DA, followed by a completed PTC, reconstructed in `REPLAY`/observe-only mode | No money, title, issue, allotment, notice, register or token mutation | Party consent, NDA/DPA as applicable, named data owner, redacted complete file and approved replay authority | Evidence-graded dossier, gap register, state reconstruction and comparison workbook |
| **2 · Live shadow** | A current DA and PTC observed beside the incumbent process | Incumbent process remains authoritative; no external instruction or execution | Accepted replay, minimised data scope, VAPT/retest evidence, customer security review, named operating owners | Divergence report, cycle/effort baseline, exception history and target operating model |
| **3 · Partner-executed pilot** | One real conventional transaction coordinated on Rail while each authorised actor performs its own operative act | Rail cannot infer legal completion or perform an unapproved function | Counsel-ratified route pack, contracts, performer matrix, provider UAT/finality, DR/incident/support rehearsal and PR-12 gate decisions | Reference transaction and independently verifiable completion/exit pack |
| **4 · Controlled activation** | Only the exact route, function, cohort, environment and build in the signed manifest | No generic venue switch; no stale evidence; safe-pause on contradiction | Current gates, two-person signed activation, staffed SOPs, monitoring and rollback/safe-pause readiness | Repeatable customer service with mode-specific evidence |
| **5 · AssureRail-owned regulated function** | A specific regulated function performed by AssureRail | Never assumed from software or incorporation | Explicit permission, capital/governance/people/controls and separate activation | Function-specific live service |

## 4. First replay: exact entry contract

### 4.1 Data owner and authority

The customer must name a person accountable for the completed transaction file and obtain the
required participant permissions. For PTC, the trustee must participate in or authorise the replay
and identify the route-defined RTA/depository/register evidence on which it relied.

### 4.2 Minimum DA evidence

- transaction identifiers, parties, roles and authority;
- versioned tape/pool and source-system references;
- diligence requests, findings, decisions and conditions;
- agreed terms and executed documents;
- consideration/payment evidence;
- assignment, notice, registration/stamping and source-book acknowledgements as applicable;
- completion decision and known breaks; and
- servicing/lifecycle hand-off evidence.

### 4.3 Minimum PTC evidence

- programme/trust and appointment documents;
- originator, trustee, arranger, counsel, rating, assurance, servicer and account-bank roles;
- pool transfer, eligibility and retained-interest evidence;
- tranche/class terms, offer/subscription/allotment and consideration evidence;
- trustee transaction-control decision;
- RTA/depository/route-defined holding record and acknowledgements;
- executed document, filing/stamping and notice evidence as applicable;
- waterfall, surveillance and lifecycle setup; and
- known reconciliation breaks and corrections.

Missing evidence is an output of the replay. It is not synthetically filled, silently waived or
converted to `NOT_APPLICABLE`.

## 5. Customer and partner sequence

1. **Transaction counsel:** ratify the exact conventional DA and PTC route/function matrices and
   partner-executed perimeter. Counsel does not approve “AssureRail” generically.
2. **Historic DA data owner:** one repeat originator/transferor with a complete closed transaction.
3. **Historic PTC data owner and trustee:** one completed issuance with trustee and route
   recordkeeper evidence.
4. **DA shadow pair:** the originator plus a transferee/bank willing to run a minimised parallel
   observation after security acceptance.
5. **PTC shadow group:** originator, trustee, investor/subscriber and the applicable recordkeeper,
   with rating/servicer feeds where required.
6. **Selected providers:** identity/KYB, document/signing/stamping, payment, RTA/depository/register,
   rating/servicing, notifications and other route-specific connectors.

IDBI Trusteeship may be an early co-design participant, but no deck, schema or route may imply an
appointment, endorsement or compulsory dependency without its approval.

## 6. Positioning

> Keep your LMS, arranger workflow, trustee stack, RTA/depository and payment providers. AssureRail
> creates one governed transaction case across them: parties, authority, evidence, terms,
> approvals, completion, reconciliation and lifecycle. Start by replaying a transaction you have
> already completed, then shadow the next one before deciding what should change.

Do not claim that every DA/PTC uses email, that all competing platforms have arrangement conflicts,
or that AssureRail is “Switzerland.” Use a customer’s own replay evidence to establish the specific
problem and benefit.

## 7. Commercial path

- Replay and initial shadow may be sold as fixed-scope professional-services/design-partner work.
- AssureRail is not a universally fixed-fee service.
- Current PTC commercial illustrations are 0.30% of contracted conventional-PTC transferred
  notional and 0.50% for tokenised PTC. They are configurable contract examples, not platform
  defaults or public promises.
- Every live rate card identifies payer, route, representation, lifecycle leg, metric, currency,
  scale, effective period, rounding, caps/floors, cancellation/refund and approval.
- Trustee-appointed assurance is a separate service relationship and remains outcome-independent.

No price or fee may grant admission, alter evidence, suppress a finding, close a break or establish
transaction completion.

## 8. Security, RBAC and hosting gates

The selected application/data target is Azure India with Hyderabad (`India South Central`) primary
and Pune (`Central India`) recovery. This is a target architecture. Service availability, data
residency, private connectivity, encryption/key design, log/SIEM coverage, backup/restore,
cross-region failover, RTO/RPO, capacity and VAPT must be designed and exercised before acceptance.
Do not call the two regions an Azure managed pair without service-specific evidence.

`SEC-01` closes the internally controllable security work:

1. dependency/SBOM remediation and regression evidence;
2. Azure threat model and configuration baseline;
3. authenticated multi-institution E2E/negative-authorisation tests;
4. API/web DAST in a dedicated non-production environment; and
5. an external-firm VAPT scope, remediation and clean-retest register.

The internal RBAC engine is implemented, but deployment currently keeps the relevant product
controls off. Shadow/enforcement requires real, identity-bound staff assignments, at least six
distinct critical control holders, joiner/mover/leaver and recertification evidence, maker-checker,
emergency elevation and the retirement/porting of remaining legacy admin operations.

## 9. Later tokenisation infrastructure

The conventional route does not wait for tokenisation. When tokenisation is separately approved,
the current design input is approximately five to seven HashSphere/HTS nodes distributed across
India. Node operators, locations, consensus/network governance, custody/key control and hosting
provider remain open. The node estate may or may not use Azure and must not be collapsed into the
AssureRail application-region design.

## 10. Customer/public workstream

| Workstream | Purpose | Release rule |
|---|---|---|
| `CX-00` | One code/deployment/capability baseline | Internal record; no activation |
| `PUB-00` | Remove superseded token/e₹/atomic-settlement/subsidiary claims | Publish after claims review |
| `CX-01` | Complete persona journeys, accessibility and negative-access UAT | Synthetic/internal first; customer acceptance remains open |
| `SIM-01` | Guided synthetic demo and resettable customer sandbox | Every fixture labelled non-evidence; no external mutation |
| `PUB-01` | Foundation website, scope/status and replay CTA | Publication-safe capability register controls claims |
| `GTM-01` | Decks, replay proposal, scorecard, security/integration and objection packs | Results remain blank until real evidence exists |
| `INBOUND-01` | Lead/CRM qualification from replay request to pilot | No raw borrower/transaction data through public forms |
| `PUB-02` / `CONTENT-01` | Route/persona/trust depth and effective-dated education | Expand only as design-partner and route evidence matures |

The parked AssurePlane bond-trustee assurance work is outside this activation playbook and has no
build authority under the first-spine exceptions.

## 11. Immediate execution order

1. Complete CX-00/PUB-00 and reconcile the public/GTM story to AR-30.
2. Complete CX-01 persona/negative-access acceptance and SIM-01 synthetic sandbox.
3. Execute SEC-01 internal work and appoint the independent VAPT firm.
4. Secure the named historic DA data owner and issue the replay intake under NDA.
5. Secure the named historic PTC/trustee data owner and issue the PTC evidence intake.
6. Produce and independently review both replay dossiers.
7. Begin minimised DA/PTC shadow only after security acceptance.
8. Prepare the partner-executed pilot only after counsel, provider, operations and PR-12 gates are
   current.

At every step, unavailable evidence stays open. A synthetic fixture, healthy endpoint, deployed
flagged-off module, internal dashboard or commercial deadline cannot stand in for it.
