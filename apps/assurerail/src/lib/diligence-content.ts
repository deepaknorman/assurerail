import "server-only";

export const DILIGENCE_CONTENT_VERSION = "2026.09.04.1";
export const DILIGENCE_REVIEWED_AT = "2026-09-04";
export const DILIGENCE_NEXT_REVIEW_AT = "2026-09-17";
export const DILIGENCE_CONTENT_OWNER = "Founder / authorised investor-relations publisher";

export const DILIGENCE_CAPABILITIES = [
  { id: "institutional-control", label: "Institutional control", state: "BUILT_GATED", evidenceRef: "AR-21/22", detail: "Institution admission, membership, mandates, appointments, entitlements and maker-checker controls are implemented behind disabled controls.", open: "Provider validation, identity federation, assignments and customer acceptance." },
  { id: "conventional-da", label: "Conventional direct assignment", state: "REPLAY_PREPARED", evidenceRef: "PR-09 · AR-23", detail: "Observe-only intake, diligence, decisions, completion observations, reconciliation and dossier export.", open: "Participant-authorised completed-deal replay, counsel, security and operating acceptance." },
  { id: "conventional-ptc", label: "Conventional PTC", state: "REPLAY_PREPARED", evidenceRef: "PR-10 · AR-24", detail: "A separate PTC journey preserves trustee, programme/trust, rating, assurance, subscription, allotment and recordkeeper boundaries.", open: "Participant/trustee-authorised all-leg historic replay and route-specific external evidence." },
  { id: "primary-secondary", label: "Primary and secondary workflows", state: "SHADOW_GATED", evidenceRef: "PR-13/14/17 · AR-26/27", detail: "Named-audience primary opportunity and conventional secondary DA/PTC journeys without anonymous execution.", open: "Function perimeter, performer, conduct, participant and operating acceptance." },
  { id: "tokenised-representations", label: "Tokenised representations", state: "SHADOW_GATED", evidenceRef: "PR-11/15/16 · AR-28", detail: "DA and PTC representation journeys default to reconciled mirrors of route-defined records.", open: "Legal character, connector finality, custody/key model and network operating evidence." },
  { id: "enterprise-integration", label: "Enterprise integration", state: "SOFTWARE_ONLY", evidenceRef: "PR-19 · AR-29", detail: "Provider-neutral contracts, institution-owned clients, connector profiles, webhooks, replay and exit tooling.", open: "Provider certification, customer UAT and production acceptance." },
  { id: "controlled-live-production", label: "Controlled-live and production", state: "NOT_ACTIVATED", evidenceRef: "PR-12 · AR-30", detail: "Fail-closed activation records, operational gates and a production-scale assessment board are implemented.", open: "No route activates without current legal, security, customer, provider and operating evidence." },
] as const;

export const DILIGENCE_SECURITY = [
  "Azure India target: Hyderabad primary and Pune recovery; provisioning and recovery evidence remain open.",
  "Authenticated two-tenant E2E and DAST must run against the exact synthetic pre-production build.",
  "Independent VAPT, remediation and clean retest are external gates.",
  "Future token-network infrastructure is separately scoped and is not part of the application-region design.",
] as const;

export const DILIGENCE_DISCLOSURE = [
  "This area contains product and readiness detail for controlled evaluation; it is not a public capability claim.",
  "Access does not authorise use, copying, onward distribution or reliance outside the agreed diligence purpose.",
  "No borrower data, transaction file, credentials, customer evidence or security secret belongs in this area.",
  "Detailed architecture, test artefacts and customer evidence are shared separately under the applicable NDA and access controls.",
] as const;

export const DILIGENCE_MILESTONES = [
  { id: "ASSURERAIL_COMPANY_FORMATION", label: "AssureRail company formation and operating-entity decisions", state: "PLANNED_DATE_OPEN", owner: "Founder / legal liaison", lastCheckedAt: "2026-09-04", nextEvidence: "Incorporation evidence and accepted entity/IP/licence/contracting/tenant decisions; no date assumed before mid-October 2026", promotion: "Update contracting and operating-entity statements only after documentary evidence; do not publish the planning date." },
  { id: "COUNSEL_ROUTE_REVIEW", label: "Counsel route and function review", state: "OPEN", owner: "Founder / legal liaison", lastCheckedAt: "2026-09-04", nextEvidence: "Accepted written route/function advice", promotion: "Update the exact affected route/function only after the written advice is accepted." },
  { id: "INDEPENDENT_SECURITY_TEST", label: "Independent security test and clean retest", state: "OPEN", owner: "Security lead", lastCheckedAt: "2026-09-04", nextEvidence: "Firm appointment, final report and clean retest", promotion: "Update the security evidence statement; do not infer production readiness." },
  { id: "DA_HISTORIC_REPLAY", label: "Participant-authorised historic DA replay", state: "OPEN", owner: "DA relationship owner", lastCheckedAt: "2026-09-04", nextEvidence: "Named owner, signed scope and accepted replay dossier", promotion: "Add the reviewed result only with participant permission and qualifications." },
  { id: "PTC_HISTORIC_REPLAY", label: "Participant/trustee-authorised historic PTC replay", state: "OPEN", owner: "PTC / trustee relationship owner", lastCheckedAt: "2026-09-04", nextEvidence: "Named owners, signed scope and accepted all-leg dossier", promotion: "Add the reviewed result only with trustee/participant permission and qualifications." },
  { id: "DA_PTC_SHADOW", label: "Current-transaction DA/PTC shadow", state: "OPEN", owner: "Pilot operations lead", lastCheckedAt: "2026-09-04", nextEvidence: "Approved scope, security acceptance and measured divergence report", promotion: "Record measured differences before considering any public case study." },
  { id: "PARTNER_EXECUTED_PILOT", label: "Partner-executed pilot", state: "OPEN", owner: "Pilot sponsor", lastCheckedAt: "2026-09-04", nextEvidence: "Signed activation, acceptance record and customer-approved outcome", promotion: "Update only the approved functions, cohort, environment and outcome." },
] as const;
