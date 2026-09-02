export type PublicCapabilityState =
  | "IMPLEMENTED_GATED"
  | "REPLAY_EVIDENCE_OPEN"
  | "SHADOW_EVIDENCE_OPEN"
  | "NOT_AVAILABLE";

export type PublicCapability = {
  id: string;
  label: string;
  state: PublicCapabilityState;
  publicLabel: string;
  summary: string;
  boundary: string;
  evidenceRef: string;
};

export const PUBLIC_CAPABILITY_REVIEWED_AT = "2026-09-03";

/**
 * Publication-safe view of the AssureRail capability register.
 *
 * This is deliberately static and conservative. Runtime flags, a deployed route,
 * or an internal readiness assessment must never promote a public claim. A
 * promotion needs an evidence-backed edit and review of this register.
 */
export const PUBLIC_CAPABILITIES: readonly PublicCapability[] = [
  {
    id: "institutional-control",
    label: "Institutional control",
    state: "IMPLEMENTED_GATED",
    publicLabel: "Built · gated",
    summary:
      "Institution admission, membership, mandates, appointments, entitlements and maker-checker controls are implemented behind disabled controls.",
    boundary:
      "Provider validation, customer acceptance and production identity federation remain external gates.",
    evidenceRef: "AR-21/22",
  },
  {
    id: "conventional-da",
    label: "Conventional direct assignment",
    state: "REPLAY_EVIDENCE_OPEN",
    publicLabel: "Replay prepared",
    summary:
      "A governed, observe-only DA journey covers intake, diligence, decisions, completion observations, reconciliation and dossier export.",
    boundary:
      "A participant-authorised completed-deal replay, VAPT, counsel and controlled-live acceptance remain open.",
    evidenceRef: "PR-09 · AR-23",
  },
  {
    id: "conventional-ptc",
    label: "Conventional PTC",
    state: "REPLAY_EVIDENCE_OPEN",
    publicLabel: "Replay prepared",
    summary:
      "A separate observe-only PTC journey preserves trustee, programme/trust, rating, assurance, subscription, allotment and recordkeeper boundaries.",
    boundary:
      "The participant/trustee-authorised all-leg historic replay and route-specific external evidence remain open.",
    evidenceRef: "PR-10 · AR-24",
  },
  {
    id: "primary-secondary",
    label: "Primary and secondary workflows",
    state: "SHADOW_EVIDENCE_OPEN",
    publicLabel: "Built · shadow gated",
    summary:
      "Named-audience primary opportunity and conventional secondary DA/PTC journeys are implemented without anonymous discovery or execution.",
    boundary:
      "Matching, placement, execution, funds, title and authoritative-register mutation are unavailable without exact function approval.",
    evidenceRef: "PR-13/14/17 · AR-26/27",
  },
  {
    id: "tokenised-representations",
    label: "Authorised-tokenised representations",
    state: "SHADOW_EVIDENCE_OPEN",
    publicLabel: "Mirror · shadow gated",
    summary:
      "DA and PTC token representation journeys are implemented separately and default to reconciled mirrors of route-defined records.",
    boundary:
      "No token-title, custody, connector-finality, tokenised PTC issuance or live token transfer is claimed.",
    evidenceRef: "PR-11/15/16 · AR-28",
  },
  {
    id: "enterprise-integration",
    label: "Enterprise integration",
    state: "SHADOW_EVIDENCE_OPEN",
    publicLabel: "Software conformance only",
    summary:
      "Provider-neutral contracts, institution-owned clients, connector profiles, webhooks, replay and exit tooling are implemented.",
    boundary:
      "Software conformance is not provider certification, customer UAT, legal authority or production acceptance.",
    evidenceRef: "PR-19 · AR-29",
  },
  {
    id: "controlled-live-production",
    label: "Controlled-live and production",
    state: "NOT_AVAILABLE",
    publicLabel: "Not activated",
    summary:
      "Fail-closed activation records, operational gates and a production-scale assessment board are implemented.",
    boundary:
      "No controlled-live or production route is available without the exact signed activation and current external evidence.",
    evidenceRef: "PR-12 · AR-30",
  },
] as const;

export const PUBLIC_ROUTE_MODES = [
  {
    route: "Direct assignment",
    conventional:
      "Bilateral initial or subsequent transfer with participant-owned diligence and external completion evidence.",
    tokenised:
      "The same DA controls plus an approved token representation and one-to-one authoritative-record reconciliation.",
  },
  {
    route: "PTC",
    conventional:
      "Trust/programme, issue and allotment, trustee control, route-defined holding record and lifecycle administration.",
    tokenised:
      "The same PTC structure plus separately approved token holding, custody, transfer and corporate-action controls.",
  },
] as const;

export const PUBLIC_PROOF_LADDER = [
  {
    step: "01",
    label: "Replay",
    summary:
      "Reconstruct one completed transaction without changing money, title or the authoritative record.",
  },
  {
    step: "02",
    label: "Shadow",
    summary:
      "Run beside a current transaction and measure evidence, exceptions, elapsed time and reconciliation differences.",
  },
  {
    step: "03",
    label: "Partner-executed pilot",
    summary:
      "The authorised participants perform every operative act; AssureRail coordinates and preserves the evidence trail.",
  },
  {
    step: "04",
    label: "Controlled activation",
    summary:
      "Activate only the exact function, cohort and environment whose legal, security, operational and customer gates are current.",
  },
] as const;
