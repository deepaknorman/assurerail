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

export const PUBLIC_CAPABILITY_REVIEWED_AT = "2026-09-16";
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
    label: "Review",
    summary:
      "Begin with a transaction that has already completed.",
  },
  {
    step: "02",
    label: "Evaluate",
    summary:
      "Agree what evidence, effort and outcomes should be compared.",
  },
  {
    step: "03",
    label: "Pilot",
    summary:
      "Progress only through a separately agreed scope with the responsible institutions.",
  },
] as const;
