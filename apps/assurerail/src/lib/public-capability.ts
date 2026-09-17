export type PublicCapabilityState =
  | "PRIVATE_EVALUATION"
  | "BY_ARRANGEMENT"
  | "NOT_AVAILABLE";

export type PublicCapability = {
  id: string;
  label: string;
  state: PublicCapabilityState;
  publicLabel: string;
  summary: string;
};

export const PUBLIC_CAPABILITY_REVIEWED_AT = "2026-09-17";
export const PUBLIC_CAPABILITY_NEXT_REVIEW_AT = "2026-10-16";

/**
 * Publication-safe view of the AssureRail capability register.
 *
 * This is deliberately static and conservative. Runtime flags, a deployed route,
 * or an internal readiness assessment must never promote a public claim. A
 * promotion needs an evidence-backed edit and review of this register.
 */
export const PUBLIC_CAPABILITIES: readonly PublicCapability[] = [
  {
    id: "initial-assessment",
    label: "Automated Initial Assessment",
    state: "BY_ARRANGEMENT",
    publicLabel: "Applications open",
    summary:
      "Approved NBFC portfolios can apply for a paid, automated and unsigned Initial Assessment.",
  },
  {
    id: "completed-deal-review",
    label: "Completed-deal review",
    state: "BY_ARRANGEMENT",
    publicLabel: "By arrangement",
    summary:
      "A completed conventional DA can be examined without changing the original transaction or its records.",
  },
  {
    id: "portfolio-preparation",
    label: "Expert-reviewed Portfolio Preparation",
    state: "BY_ARRANGEMENT",
    publicLabel: "By accepted scope",
    summary:
      "Sellers that proceed can commission qualified review, remediation closure and buyer-ready preparation under a separate paid scope.",
  },
  {
    id: "live-transaction-services",
    label: "Live transaction services",
    state: "NOT_AVAILABLE",
    publicLabel: "Not currently offered",
    summary:
      "AssureRail does not currently offer public matching, execution, custody, funds handling or settlement services.",
  },
] as const;

export const PUBLIC_ROUTE_MODES = [
  {
    route: "Direct assignment",
    conventional:
      "Phase 1: prepare a bilateral transfer while each institution keeps its own decision and records.",
    tokenised:
      "A future representation option only where the transaction structure and applicable permissions support it.",
  },
  {
    route: "PTC",
    conventional:
      "Later phase: conventional PTC discovery continues while production resources focus on direct assignment.",
    tokenised:
      "A separately evaluated future option; it is not implied by conventional PTC support.",
  },
] as const;

export const PUBLIC_PROOF_LADDER = [
  {
    step: "01",
    label: "Initial Assessment",
    summary:
      "Upload the loan tape and evidence for automated, unsigned review, reconciliation and remediation.",
  },
  {
    step: "02",
    label: "Portfolio Preparation",
    summary:
      "Fix gaps, align the portfolio to buyer requirements and obtain qualified expert review of the prepared output.",
  },
  {
    step: "03",
    label: "Execution",
    summary:
      "Run buyer diligence and closing through a separately activated mandate, with selectable integration and settlement services.",
  },
] as const;
