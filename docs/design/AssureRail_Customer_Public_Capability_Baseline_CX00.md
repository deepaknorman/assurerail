# AssureRail customer/public capability baseline — CX-00

**Status:** implemented baseline for review, 3 September 2026

**Code baseline:** `718e28d0a`

**Deployment fact supplied by deployer:** AR-28/29/30 are deployed; 32 Rail migrations applied;
API/web health checks passed; product flags are explicitly off; operating mode remains `DEMO`

**Authority boundary:** this document records code and deployment state. It does not enable a flag,
approve publication, accept external evidence or activate a customer capability.

## 1. Outcome

The first AssureRail product spine is implemented through AR-30. Its customer surfaces cover
institutional control, conventional DA, conventional PTC, lifecycle, permissioned primary and
secondary workflows, tokenised representations, enterprise integration, customer operations and
internal production-scale assessment. Deployment is not availability: the new product flags are
off, external evidence remains open and no controlled-live or production route is claimed.

CX-00 creates one conservative publication source at
`apps/assurerail/src/lib/public-capability.ts`. Public surfaces may describe only the state and
boundary recorded there. A runtime flag, successful migration, healthy process, synthetic fixture
or internal readiness assessment cannot promote a public claim.

## 2. State separation

| State | Meaning | Current conclusion |
|---|---|---|
| Implemented | Code, schema and automated software evidence exist | AR-21–AR-30 implemented |
| Deployed | Code and migrations are present in an environment | Deployer reports `718e28d0a` deployed |
| Enabled | A fail-closed product flag deliberately mounts a capability | AR-28/29/30 and related product flags reported off |
| Customer accepted | Named institution has completed authorised UAT | Open |
| Externally evidenced | Counsel, VAPT, provider, trustee, recordkeeper or replay evidence exists | Open by exact route/function |
| Controlled-live | Signed PR-12 activation matches build, environment, mode, cohort and evidence | Not available |
| Production | Highest assurance grade plus current operational controls and accepted activation | Not available |

## 3. Customer route inventory

The web application contains the following institution-scoped route families:

- institution home and task/action centre;
- institution admission, membership, mandate, appointment and access administration;
- named primary opportunities and immutable case handoff;
- conventional DA replay/observation;
- conventional PTC replay/observation;
- completion, lifecycle and reconciliation workspaces;
- conventional secondary DA/PTC observation and repair;
- tokenised DA/PTC representation and reconciliation;
- enterprise connector/developer tooling;
- customer contracts, statements, support, reviews and exit; and
- internal RBAC and production-scale assessment.

The legacy Note console remains a compatibility/demo surface. It must not be the default customer
journey or the source of generic DA/PTC public claims.

## 4. Publication-safe capability conclusion

| Capability | Safe current statement | Open evidence/authority |
|---|---|---|
| Institutional control | Built behind disabled controls | Provider validation, customer UAT, production federation |
| Conventional DA | Observe-only replay journey prepared | Named data owner, completed-deal replay, VAPT, counsel, participant/provider acceptance |
| Conventional PTC | Separate observe-only replay journey prepared | Participant/trustee-authorised all-leg historic replay and route evidence |
| Primary/secondary | Named-audience product workflows built and shadow-gated | Function-specific counsel, conduct and performer approval |
| Tokenised DA/PTC | Separately governed mirror journeys built and shadow-gated | Token/title, custody, connector finality and authoritative-register acceptance |
| Enterprise integration | Software-conformance and governance tooling built | Provider security, UAT, data, operating and exit acceptance |
| Controlled-live/production | Activation controls are built | Exact signed activation and every current external/operational gate; not available today |

## 5. Customer/persona coverage to validate in CX-01

CX-01 must test, rather than merely infer, complete journeys for:

1. originator/transferor;
2. transferee/institutional investor;
3. trustee;
4. arranger or approved primary-function partner;
5. RTA/depository/route recordkeeper;
6. servicer;
7. rating or independent assurance provider;
8. institution administrator;
9. integration administrator; and
10. risk, legal, audit and read-only oversight.

For each persona, the acceptance matrix covers invitation/onboarding, institution selection,
authority, opportunity/case visibility, evidence/room access, decisions, completion, lifecycle,
break escalation, support and export/exit. Missing screens or inaccessible transitions remain CX-01
gaps; the existence of a backend endpoint is not customer-journey completion.

## 6. Drift and publication controls

- The standalone public homepage still carried the superseded tokenised-Note/e₹/atomic-settlement
  story at this baseline. PUB-00 replaces it.
- Several AssureLocker downloads and investor surfaces still describe AssureRail as a present
  subsidiary and verified-receivables/CBDC venue. PUB-00 removes or visibly supersedes those claims.
- Three untracked GTM documents dated 30 August are useful inputs but are not accepted publication
  sources and contain pre-AR-30 status language.
- Four untracked `undefined-*.png` files are orphaned leave-behind renders and are excluded.
- The parked AssurePlane bond-trustee assurance work is outside the first-spine customer/public
  programme and receives no build or public claim here.

## 7. Selected hosting direction and later token infrastructure

- The selected AssureRail application/data target is an Azure India dual-region design: Hyderabad
  (`India South Central`) as primary and Pune (`Central India`) as recovery. This is a target, not a
  claim that Azure migration, service parity, failover, restore, residency or VAPT evidence exists.
- Do not describe the two regions as a Microsoft-managed region pair unless Azure architecture
  evidence confirms that property for every selected service. AR-30/PR-12 still require exercised
  backup, restore, failover, capacity, security and signed activation evidence.
- Later tokenisation design expects approximately five to seven HashSphere/HTS nodes distributed
  across India. Node placement, operator allocation, consensus/network governance, key custody and
  cloud/on-premises providers remain a separate design decision; those nodes may or may not use
  Azure. This is future input, not current topology or token-route activation.

## 8. Automated evidence

`npm --workspace @code/assurerail run check:cx00` verifies:

- the 16 expected institution/case customer routes exist;
- all 12 product-facing web flags remain explicitly off in the example environment;
- each flag has a web boundary helper;
- all seven publication-safe capability entries exist; and
- controlled-live remains unavailable and banned legacy claims are absent from the public register.

The check proves repository consistency only. It does not exercise a deployed environment or close
customer, security, legal, trustee, provider or authoritative-record gates.
