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
 * This register is the reviewed source for anonymous service descriptions.
 * Changes require supporting evidence and public-claims review.
 */
export const PUBLIC_CAPABILITIES: readonly PublicCapability[] = [
  {
    id: "initial-assessment",
    label: "Initial Assessment",
    state: "BY_ARRANGEMENT",
    publicLabel: "Start here",
    summary:
      "Applications open for a paid, automated assessment of the admitted loan population, evidence coverage, remediation priorities and indicative seller economics.",
  },
  {
    id: "portfolio-preparation",
    label: "Expert-reviewed Portfolio Preparation",
    state: "BY_ARRANGEMENT",
    publicLabel: "Progress after assessment",
    summary:
      "Resolve priority gaps, align evidence to the intended buyer route and obtain qualified review of the financial, legal and technical sections in scope.",
  },
  {
    id: "live-transaction-services",
    label: "Execution and settlement orchestration",
    state: "BY_ARRANGEMENT",
    publicLabel: "By accepted mandate",
    summary:
      "Execution requires an accepted seller mandate and activation with the buyer and appointed providers. AssureRail coordinates the process; it does not act as custodian or hold client funds.",
  },
] as const;

export const PUBLIC_PROOF_LADDER = [
  {
    step: "01",
    label: "Initial Assessment",
    summary:
      "Accept the case-specific quote, pay the initial amount and upload the loan tape and evidence. Receive an automated view of population quality, gaps, indicative eligibility and economics.",
  },
  {
    step: "02",
    label: "Portfolio Preparation",
    summary:
      "Close priority gaps, assemble the buyer-ready evidence structure and obtain qualified review of the sections included in the accepted scope.",
  },
  {
    step: "03",
    label: "Execution",
    summary:
      "Appoint AssureRail under a separate seller mandate to coordinate buyer diligence, conditions, integrations and the agreed closing workflow.",
  },
] as const;
