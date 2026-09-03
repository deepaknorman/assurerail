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

export const PUBLIC_CAPABILITY_REVIEWED_AT = "2026-09-03";
export const PUBLIC_CAPABILITY_NEXT_REVIEW_AT = "2026-10-03";

/**
 * Publication-safe view of the AssureRail capability register.
 *
 * This is deliberately static and conservative. Runtime flags, a deployed route,
 * or an internal readiness assessment must never promote a public claim. A
 * promotion needs an evidence-backed edit and review of this register.
 */
export const PUBLIC_CAPABILITIES: readonly PublicCapability[] = [
  {
    id: "private-evaluation",
    label: "Private product evaluation",
    state: "PRIVATE_EVALUATION",
    publicLabel: "Available",
    summary:
      "Institutional teams can review the proposition and agree a suitably bounded evaluation.",
  },
  {
    id: "completed-deal-review",
    label: "Completed-deal review",
    state: "BY_ARRANGEMENT",
    publicLabel: "By arrangement",
    summary:
      "A completed DA or PTC can be examined without changing the original transaction or its records.",
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
      "Coordinate a bilateral transfer while each institution keeps its own decision and records.",
    tokenised:
      "A future representation option only where the transaction structure and applicable permissions support it.",
  },
  {
    route: "PTC",
    conventional:
      "Coordinate the parties and evidence while the trustee and appointed providers retain their roles.",
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
