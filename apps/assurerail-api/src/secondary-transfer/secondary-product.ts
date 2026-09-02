import { SECONDARY_EVIDENCE_TYPES, type SecondaryEvidenceType, type SecondaryRoute } from "./secondary-route-pack";

export type SecondaryProductStageState =
  | "COMPLETE"
  | "IN_PROGRESS"
  | "ACTION_REQUIRED"
  | "UNAVAILABLE"
  | "BLOCKED"
  | "AVAILABLE";

export interface SecondaryProductInput {
  route: SecondaryRoute;
  dossierStatus: string | null;
  evidenceTypes: readonly string[];
  matchedLegCount: number;
  requiredLegCount: number;
  openBreakCount: number;
  approvedRepairCount: number;
  canOperateCase: boolean;
  canOperateRoute: boolean;
  canViewEvidence: boolean;
}

export const REQUIRED_SECONDARY_EVIDENCE: Readonly<Record<SecondaryRoute, readonly SecondaryEvidenceType[]>> = {
  DA: SECONDARY_EVIDENCE_TYPES.filter((type) => type !== "TRUSTEE_TRANSACTION_CONTROL"),
  PTC: SECONDARY_EVIDENCE_TYPES,
};

export function deriveSecondaryProductJourney(input: SecondaryProductInput) {
  const requiredEvidence = REQUIRED_SECONDARY_EVIDENCE[input.route];
  const available = new Set(input.evidenceTypes);
  const missingEvidence = requiredEvidence.filter((type) => !available.has(type));
  const collecting = input.dossierStatus === "COLLECTING";
  const proposed = input.dossierStatus === "PROPOSED";
  const reconciled = input.dossierStatus === "RECONCILED" && input.openBreakCount === 0;
  const reviewed = ["REJECTED", "RECONCILED", "BREAK_OPEN"].includes(input.dossierStatus ?? "");

  return {
    stages: [
      { code: "CASE_AND_PARTIES", state: input.dossierStatus ? "COMPLETE" : "ACTION_REQUIRED", summary: input.dossierStatus ? "A route-specific secondary dossier is bound to active seller, buyer and recordkeeper parties." : "Create a secondary dossier after the case parties, assignments and route entitlements are active." },
      { code: "TITLE_CHAIN", state: !input.canViewEvidence ? "UNAVAILABLE" : available.has("CURRENT_HOLDER") && available.has("PRIOR_TRANSFER_CHAIN") ? "COMPLETE" : input.dossierStatus ? "ACTION_REQUIRED" : "BLOCKED", summary: "Current-holder and prior-transfer-chain facts must be independently retained; Rail does not infer ownership." },
      { code: "RESTRICTIONS_AND_CONSENT", state: !input.canViewEvidence ? "UNAVAILABLE" : available.has("TRANSFER_RESTRICTIONS") && available.has("NOTICE_AND_CONSENT") ? "COMPLETE" : input.dossierStatus ? "ACTION_REQUIRED" : "BLOCKED", summary: "Route restrictions, required consents and notice acknowledgements remain external facts." },
      { code: "AUTHORITY_AND_DOCUMENT", state: !input.canViewEvidence ? "UNAVAILABLE" : available.has("SELLER_AUTHORITY") && available.has("EXECUTED_TRANSFER_DOCUMENT") ? "COMPLETE" : input.dossierStatus ? "ACTION_REQUIRED" : "BLOCKED", summary: "The seller retains signed authority and executed-document evidence; Rail records but does not execute them." },
      { code: "CASH_OBSERVATION", state: !input.canViewEvidence ? "UNAVAILABLE" : available.has("CASH_SETTLEMENT") ? "COMPLETE" : input.dossierStatus ? "ACTION_REQUIRED" : "BLOCKED", summary: "Cash is an exact-value, partner-performed observation. AssureRail never moves funds in this product." },
      ...(input.route === "PTC" ? [{ code: "TRUSTEE_CONTROL", state: !input.canViewEvidence ? "UNAVAILABLE" : available.has("TRUSTEE_TRANSACTION_CONTROL") ? "COMPLETE" : input.dossierStatus ? "ACTION_REQUIRED" : "BLOCKED", summary: "The trustee's transaction-control decision remains distinct from the operative RTA/depository/register fact." } as const] : []),
      { code: "MAKER_CHECKER_REVIEW", state: reviewed ? "COMPLETE" : proposed ? "IN_PROGRESS" : collecting ? "ACTION_REQUIRED" : "BLOCKED", summary: proposed ? "An independent seller reviewer must decide the evidence-bound proposal." : "Proposal and review are purpose-bound, idempotent and separated between people." },
      { code: "REGISTER_RECONCILIATION", state: reconciled ? "COMPLETE" : input.openBreakCount > 0 ? "ACTION_REQUIRED" : reviewed ? "IN_PROGRESS" : "BLOCKED", summary: `${input.matchedLegCount}/${input.requiredLegCount} planned evidence legs match; ${input.openBreakCount} open reconciliation break(s).` },
      { code: "BREAK_REPAIR", state: input.openBreakCount === 0 && reviewed ? "COMPLETE" : input.openBreakCount > 0 ? "ACTION_REQUIRED" : "BLOCKED", summary: `${input.approvedRepairCount} independently approved append-only repair(s); original evidence is never rewritten.` },
      { code: "DOSSIER", state: reviewed ? "AVAILABLE" : "BLOCKED", summary: reviewed ? "A comparison CSV and digest-bound evidence pack are available for participant review." : "The dossier becomes exportable after independent review." },
    ] satisfies Array<{ code: string; state: SecondaryProductStageState; summary: string }>,
    requiredEvidence,
    missingEvidence,
    capabilities: {
      canOperateCase: input.canOperateCase,
      canOperateRoute: input.canOperateRoute,
      canViewEvidence: input.canViewEvidence,
      canGovernDossier: input.canOperateCase && input.canOperateRoute && input.canViewEvidence,
    },
    openExternalGates: [
      { code: "COUNSEL_SECONDARY_ROUTE_PACK", owner: "COUNSEL", state: "OPEN" },
      { code: "PARTICIPANT_ROUTE_ACCEPTANCE", owner: "SELLER_AND_BUYER", state: "OPEN" },
      ...(input.route === "PTC" ? [{ code: "TRUSTEE_AND_RECORDKEEPER_ACCEPTANCE", owner: "TRUSTEE_AND_ROUTE_RECORDKEEPER", state: "OPEN" }] : []),
      { code: "PARTNER_EXECUTION_ACKNOWLEDGEMENTS", owner: "ASSIGNED_PERFORMERS", state: reconciled ? "OBSERVED_AND_RECONCILED" : "OPEN" },
      { code: "CONTROLLED_LIVE_ACCEPTANCE", owner: "PR12_SIGNATORIES", state: "OPEN" },
    ],
  };
}
