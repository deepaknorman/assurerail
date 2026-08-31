# AssureRail internal operations RBAC and escalation v1

**Status:** design and implementation baseline — 1 September 2026
**Scope:** AssureRail internal staff control plane. It is deliberately separate from participant
institutions, their members, mandates, appointments and transaction authority.
**Precedes:** PTC customer workflow and PR-10 conventional-PTC replay implementation.
**Does not authorise:** a live transaction, access to a customer case, a deployment, a production
configuration change or an emergency action merely by naming a role.

---

## 1. Decision and rationale

The current legacy Rail access model is not fit for a multi-institution operating platform. It has
two global platform roles (`SUPERADMIN` and `ADMIN`) and permits either to bypass broad function
and entity checks. That is appropriate only as a temporary bootstrap mechanism. It conflates staff
administration, production operations, customer support, security administration and transaction
authority. A holder could otherwise obtain operational visibility and privileged control in the
same session, without a durable scoped delegation or independent approval.

The selected model is **scoped ABAC/RBAC**, not a hierarchy of ever-more-powerful administrators:

1. A staff role grants only a named internal permission bundle. It is not a customer, trustee,
   issuer, investor or regulator role.
2. An assignment has an owner, scope, effective time, expiry, reason and approval history. There
   is no permanent catch-all staff super-user in the normal operating path.
3. Customer/case information, security administration, production-system control and transaction
   operations remain separate permission domains. A role in one domain does not imply a role in
   another.
4. A staff member can propose work but cannot approve their own access grant, critical case repair,
   route/function change, security exception or production-control change.
5. Break-glass is a distinct, time-bound, purpose-bound and independently reviewed mechanism. It
   grants the least additional permission for a defined incident; it never creates a silent global
   administrator.
6. Existing `VenueUser.platformRole` remains a **legacy bootstrap compatibility field only** while
   the new control plane runs in shadow. No new use of it is permitted. It will not be used as the
   permanent authorisation answer for new internal APIs or workspaces.

This is an operational-separation control, not a licensing claim. It supports the selected position
that AssureRail does not mark its own transaction and that trustee/accountable external parties
retain transaction control and legal-record authority.

---

## 2. Subjects and boundaries

| Subject | What it represents | What it must not be used for |
|---|---|---|
| `VenueUser` | Authenticated human account and security/session identity | Proof of staff authority, participant admission, case party or trustee appointment by itself |
| `InternalRoleAssignment` | Rail-staff role, scope and approval record | Participant membership or commercial counterparty authority |
| `InstitutionMember` / `AuthorityMandate` | A customer's human authority for its institution | Rail internal staff administration |
| `Appointment` / `CaseFunctionAssignment` | A transaction's accountable external function and performer | Platform support power or a generic staff entitlement |
| `PrivilegedAccessRequest` | A time-bound escalation for a defined support/incident purpose | A bypass around customer mandate, trustee decision or legal register |

An employee who is also an employee of a participant institution has two separately evaluated
identities and contexts. They must explicitly choose the active context; the platform does not
merge the powers.

---

## 3. Internal roles, boundaries and default workspaces

Role names are stable machine values. Display labels may be clearer to staff but must not obscure
their exact entitlement.

| Role | Primary job | May do | Must not do | Default workspace |
|---|---|---|---|---|
| `SUPERADMIN` | Governance custodian for the internal-control plane | appoint/revoke top-tier administrators; approve governed emergency/elevation and irreversible control proposals | routine case operations, customer data browsing, self-approval, unilateral production change | Governance and emergency-approval inbox |
| `SYSADMIN` | Platform reliability/SRE | environment health, deployment/release proposals, capacity/backup/recovery execution, operational telemetry | read business documents or customer-case contents; manage security identities; approve their own release | System health, jobs, backup/restore and release evidence |
| `SECURITY_ADMIN` | IAM, key/secret, vulnerability and security-incident control | identity policy, credential revocation, security monitoring, approve relevant access elevations | deploy code; make commercial/case decisions; approve their own security exception | Security posture, identities, incidents and elevation approvals |
| `ORGADMIN` | Internal team/operating-unit administrator | propose staff memberships/role assignments in its own operating unit; run recertification | grant top-tier roles; change security/system policy; approve their own assignment | Team roster, assignment proposals and recertification |
| `MANAGER` | Operations/service manager | own queues, assign work, escalate aged breaks, propose operational disposition | approve own proposal; alter IAM/security configuration; impersonate customer | Operational dashboard, SLA/escalation queue |
| `CASE_OPERATOR` | Controlled case-service operator | prepare case data, request evidence, coordinate approved workflow, create repair proposals | approve a case decision/repair they made; make participant credit/trustee/legal decisions | Case work queue, evidence and repair proposals |
| `RECONCILIATION_ANALYST` | Independent control/reconciliation | investigate and attest reconciliation observations; recommend closure | record and independently close the same break; change source evidence | Reconciliation and exception queue |
| `INTEGRATION_OPERATOR` | Certified connector/run operations | monitor/retry approved connector jobs, submit conformance results, raise provider incidents | view unrelated case contents; edit route rules; access raw secrets | Connector health and delivery queue |
| `RISK_COMPLIANCE_OFFICER` | Conduct, conflicts, complaints and control oversight | review/approve controlled policy/case exception according to assignment; oversee complaints and conflicts | become system administrator; operate own reviewed case | Risk/compliance review and exception register |
| `SUPPORT_ANALYST` | Customer support triage | view ticket metadata, approved diagnostic state and customer-provided context; request scoped elevation | browse customer portfolios/documents; alter cases or controls | Support tickets and approved diagnostics |
| `AUDITOR` | Independent assurance | read immutable audit/evidence receipts and approved exports within scope | write operational data, approve changes, access secrets | Audit, control evidence and report exports |
| `VIEWER` | Read-only internal stakeholder | read explicitly published/scope-approved dashboards and reports | export sensitive data, view customer objects by default, make any change | Read-only dashboard |

`VIEWER` is not a default entitlement. A person with no active assignment has no internal-platform
authority. `AUDITOR` is intentionally not synonymous with `VIEWER`: it has controlled access to
integrity evidence but no operating tools.

### 3.1 Why the five requested grades are insufficient alone

`SUPERADMIN`, `SYSADMIN`, `ORGADMIN`, `MANAGER` and `VIEWER` are retained. They do not cover the
three separation duties required in ordinary operations: security/IAM, case operation and
independent reconciliation. `SECURITY_ADMIN`, `CASE_OPERATOR` and `RECONCILIATION_ANALYST` are
therefore mandatory separate roles. `INTEGRATION_OPERATOR`, `RISK_COMPLIANCE_OFFICER`,
`SUPPORT_ANALYST` and `AUDITOR` complete the minimum viable institutional operating model; they are
activated only if the corresponding team/function exists.

No role is a grant of legal transaction authority. PTC trustee, RTA/depository/register, rating,
servicer, account bank, assurance provider and participant decisions are still represented by the
case's external appointment/function/mandate records.

---

## 4. Permission domains and separation rules

Permissions are atomic and evaluated with role, active assignment, scope, session assurance and
resource policy. The initial internal control-plane domains are:

```text
GOVERNANCE       role assignment, policy/control proposals, emergency approval
SYSTEM           runtime/readiness, release proposal/approval, jobs, backup/restore
SECURITY         identity, MFA, credentials, security events, access elevation
OPERATIONS       queue management, case preparation, break investigation
RECONCILIATION   observe, propose repair, independently review/close
INTEGRATIONS     connector certification, health, retry/replay, provider incident
SUPPORT          ticket/diagnostic access and scoped-elevation request
RISK_COMPLIANCE  exception, conflict, complaint and control review
AUDIT            evidence/audit-chain verification and governed export
REPORTING        published dashboard/report read only
```

The following are hard constraints, even when a person has more than one valid role:

1. **Maker-checker:** the proposer/requester cannot approve, execute or independently close that
   same governed item.
2. **Security/system separation:** a `SYSADMIN` cannot approve their own production release,
   disable security monitoring, grant identity permissions or approve a security exception.
   A `SECURITY_ADMIN` cannot deploy/release code or approve their own access elevation.
3. **Operation/reconciliation separation:** the person who records/repairs a case leg cannot
   independently reconcile/close that leg or its break.
4. **Support least disclosure:** support gets metadata first. Customer data/document view is a
   purpose-specific temporary elevation, requires a ticket and expiry, and creates a customer-visible
   access receipt where the route policy requires one.
5. **No role implies export:** sensitive/exportable content has separate object/purpose policy and
   an export receipt. `VIEWER`, `SUPPORT_ANALYST` and `SYSADMIN` have no default export permission.
6. **No internal role implies external authority:** no internal assignment may satisfy a case party,
   appointment, mandate, settlement performer, trustee decision or authoritative-record guard.

---

## 5. Assignment lifecycle

An `InternalRoleAssignment` holds one role at one scope:

```text
PROPOSED → ACTIVE → SUSPENDED | EXPIRED | REVOKED
                 ↘ SUPERSEDED
```

Required records are: target user, role, scope (`GLOBAL`, `OPERATING_UNIT`, `ENVIRONMENT`,
`CASE`, `SUPPORT_TICKET`), scope reference, reason, requested/effective/expiry time, proposer,
approver, distinct step-up receipts, evidence/ticket reference and immutable audit digest.

Assignment requirements:

- `SUPERADMIN`, `SYSADMIN` and `SECURITY_ADMIN` require two-person approval and a maximum defined
  term; no role may create its own assignment.
- `ORGADMIN` can propose assignments only within its active operating-unit scope. A separate
  manager/security/governance approver validates the proposal according to role risk.
- `VIEWER` has a short default term and no global data scope.
- Suspensions/revocations take effect immediately in API, UI, jobs and service sessions. Existing
  session/elevation tokens are invalidated.
- Recertification is scheduled before expiry. Unrecertified assignments fail closed.

Legacy `platformRole` rows migrate as **reference-only candidates**, not active new assignments.
During shadow operation, the new engine produces a comparison result and does not remove legacy
bootstrap access. Enforcement is a separately approved rollout with an exportable coverage report.

---

## 6. Escalation and emergency access

### 6.1 Normal operational escalation

| Trigger | First owner | Escalate to | Decision/closure authority |
|---|---|---|---|
| Case evidence/condition gap | `CASE_OPERATOR` | `MANAGER` → participant/trustee/function owner | external party for transaction fact; Rail manager only for queue disposition |
| Reconciliation break | `RECONCILIATION_ANALYST` | `MANAGER` → `RISK_COMPLIANCE_OFFICER` → relevant external recordkeeper/trustee | independent analyst/reviewer; recordkeeper/trustee remains authoritative where applicable |
| Connector outage/ambiguous result | `INTEGRATION_OPERATOR` | `SYSADMIN` + `MANAGER` → provider owner | no automated completion; route safe-pause and independent reconciliation |
| Customer support/data request | `SUPPORT_ANALYST` | `MANAGER` → data/case owner; `SECURITY_ADMIN` if elevation needed | scope owner and, when needed, security approver |
| Security event | `SECURITY_ADMIN` | `SYSADMIN` + `SUPERADMIN` + risk/compliance | security incident commander; external notification follows runbook/counsel |
| Platform availability/DR | `SYSADMIN` | `MANAGER` + `SECURITY_ADMIN` + `SUPERADMIN` | two-person controlled change and recovery acceptance |

### 6.2 Privileged access request

`PrivilegedAccessRequest` is required for a support, incident or recovery exception. It must carry
the incident/ticket, exact resource scope, requested permission, business reason, start/expiry,
requester, risk classification and required approver class. It begins `REQUESTED`, becomes
`APPROVED` only after a distinct authorised approver with recent step-up, and then yields a bounded
`ACTIVE` grant. It ends automatically at expiry or immediately on revoke, incident closure, account
suspension or role/assignment loss. Every use creates a non-editable access event.

Emergency cannot mean invisible. For severe availability/security incidents, a two-person emergency
ceremony may shorten normal approval timing, but still requires a reason, maximum duration,
after-the-fact independent review and incident record. It cannot be used to bypass a trustee or
participant's transaction decision.

---

## 7. Role-specific UI and API design

The internal console must render a role-specific landing page, not one global `/admin` screen:

| Workspace | Roles | Content/actions |
|---|---|---|
| Governance | `SUPERADMIN`, approved `ORGADMIN` scope | assignment/elevation proposals, approval inbox, recertification, immutable decisions |
| System operations | `SYSADMIN` (read-only exposure to others as policy permits) | readiness, job lease/backlog, release/restore evidence, capacity, change proposals |
| Security | `SECURITY_ADMIN`, scoped `AUDITOR` | identities, session revocation, credential status, alerts, incident/elevation approval |
| Operations | `MANAGER`, `CASE_OPERATOR` | service queue, case task assignment, SLA, controlled requests; no legal-completion button |
| Reconciliation | `RECONCILIATION_ANALYST`, `MANAGER`, `RISK_COMPLIANCE_OFFICER` | breaks, evidence comparison, repair/review segregation, ageing/escalation |
| Integrations | `INTEGRATION_OPERATOR`, `SYSADMIN` | connector certification/health, retries, delivery receipts, provider incidents |
| Support | `SUPPORT_ANALYST`, `MANAGER` | tickets, metadata diagnostics, elevation request; no portfolio/document list |
| Audit & reporting | `AUDITOR`, `VIEWER` | scoped immutable evidence, report availability and export receipts |

API endpoints and UI must return only resources permitted by the active staff assignment and
resource policy. A front-end redirect is not an authorisation control; every command and object
read is enforced server-side.

---

## 8. Delivery sequence and evidence

This is an additive **OP-01 internal control-plane** tranche and does not renumber the selected
transaction PR programme.

1. **OP-01a — role/policy registry:** immutable role definitions, assignment/elevation persistence,
   policy evaluator, `off → shadow` feature flag, legacy comparison, negative matrix tests and audit
   receipts.
2. **OP-01b — control-plane APIs/UI:** assignment proposal/approval/revoke, recertification and
   elevation workflow; role-specific workspaces; no customer content through support by default.
3. **OP-01c — enforcement/cutover:** per-domain `shadow → enforce`, existing-admin migration
   evidence, session revocation and emergency rehearsal. Legacy global bypass is retired only after
   coverage is proved.
4. **OP-02 — customer/participant surfaces:** once internal operators are safely separated,
   complete customer-side admissions, mandates, appointments and case workspaces; no internal role
   leaks into customer authority.
5. **PR-10 — PTC replay:** begins only after OP-01a provides the control boundary required for
   PTC/trustee/RTA/depository review work. It still requires the named historic evidence owner and
   a signed source/trustee/RTA/depository comparison pack; code can be prepared without inventing
   that external evidence.
6. **OP-03 / PR-12:** information-security production controls, operating runbooks/rehearsals and
   independent review follow the functional implementation; no deployment is implied by this plan.

Acceptance evidence for OP-01a includes: every defined role/permission pair; no role inheritance
surprises; expired/suspended assignments fail immediately; prohibition of self-approval; support
denied object reads without elevation; no internal role satisfies external case authority; and full
audit/elevation event integrity.

---

## 9. Deliberately rejected shortcuts

- rebrand the current `ADMIN` role as `SYSADMIN` and keep the global bypass;
- use internal `ORGADMIN` as a customer institution administrator;
- make `SUPERADMIN` a routine all-data/all-action account;
- model role power only in the web UI or a static route list;
- let a support ticket automatically reveal customer documents or holdings;
- treat a staff case operator as trustee, recordkeeper, participant credit approver or assurance
  provider;
- allow a user to approve their own access, repair, exception, release or incident closure;
- add PTC labels/screens before the external route, authority and record evidence exists; or
- turn on `enforce`/production modes because a policy table or UI has been merged.
