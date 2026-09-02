export type TokenisedProductStageState = "COMPLETE" | "IN_PROGRESS" | "ACTION_REQUIRED" | "BLOCKED" | "AVAILABLE" | "UNAVAILABLE";

export interface TokenisedDaJourneyInput {
  linked: boolean;
  representationStatus: string | null;
  activeBindingCount: number;
  actionCount: number;
  reconciledActionCount: number;
  reconciliationState: string | null;
  openBreakCount: number;
  canOperateRoute: boolean;
  canViewEvidence: boolean;
}

export interface TokenisedPtcJourneyInput {
  proposed: boolean;
  representationStatus: string | null;
  verifiedGateCount: number;
  requiredGateCount: number;
  shadowReadyActionCount: number;
  requiredActionCount: number;
  trusteeRecordReconciled: boolean;
  canOperateRoute: boolean;
  canViewEvidence: boolean;
}

export function deriveTokenisedDaJourney(input: TokenisedDaJourneyInput) {
  const reconciled = input.reconciliationState === "MATCHED" && input.openBreakCount === 0;
  return {
    route: "DA" as const,
    stages: [
      { code: "TOKENISED_DA_CASE", state: "COMPLETE", summary: "The governed case is DA, TOKENISED and initial-transfer scoped. Its route state remains separate from token state." },
      { code: "MIRROR_LINK", state: input.linked ? "COMPLETE" : input.canOperateRoute ? "ACTION_REQUIRED" : "UNAVAILABLE", summary: input.linked ? "A token mirror is linked to the case and its active authoritative-record declaration." : "Link the existing token projection without making it legal title." },
      { code: "CONNECTOR_AND_CUSTODY", state: input.activeBindingCount > 0 ? "IN_PROGRESS" : input.linked ? "ACTION_REQUIRED" : "BLOCKED", summary: `${input.activeBindingCount} active connector/custody binding(s) recorded. Certification, custody acceptance and legal finality remain external activation gates.` },
      { code: "ACTION_OBSERVATION", state: input.actionCount === 0 ? input.linked ? "ACTION_REQUIRED" : "BLOCKED" : input.reconciledActionCount === input.actionCount ? "COMPLETE" : "IN_PROGRESS", summary: `${input.reconciledActionCount}/${input.actionCount} observe-only token action(s) reconciled. Product mode cannot dispatch them.` },
      { code: "FOUR_WAY_RECONCILIATION", state: reconciled ? "COMPLETE" : input.openBreakCount > 0 ? "ACTION_REQUIRED" : input.linked ? "IN_PROGRESS" : "BLOCKED", summary: `Token supply, token holdings, economic interests and the declared authoritative record must match; ${input.openBreakCount} open break(s).` },
      { code: "TOKEN_LIFECYCLE", state: reconciled ? "AVAILABLE" : "BLOCKED", summary: "Lifecycle observations use the common Rail lifecycle product and remain mirror events until externally acknowledged and reconciled." },
      { code: "EVIDENCE_PACK", state: input.linked && input.canViewEvidence ? "AVAILABLE" : input.linked ? "UNAVAILABLE" : "BLOCKED", summary: "A digest-bound, case-scoped pack records linkage, observations, reconciliation and open external gates without asserting legal effect." },
    ] satisfies Array<{ code: string; state: TokenisedProductStageState; summary: string }>,
    openExternalGates: [
      { code: "TOKEN_LEGAL_FINALITY", owner: "COUNSEL_AND_ROUTE_AUTHORITY", state: "OPEN" },
      { code: "CONNECTOR_CUSTODY_OPERATING_ACCEPTANCE", owner: "CONNECTOR_AND_CUSTODY_PERFORMERS", state: "OPEN" },
      { code: "AUTHORITATIVE_RECORD_ACCEPTANCE", owner: "ROUTE_RECORDKEEPER", state: reconciled ? "OBSERVED_AND_RECONCILED" : "OPEN" },
      { code: "CONTROLLED_LIVE_ACCEPTANCE", owner: "PR12_SIGNATORIES", state: "OPEN" },
    ],
    capabilities: { canOperateRoute: input.canOperateRoute, canViewEvidence: input.canViewEvidence },
  };
}

export function deriveTokenisedPtcJourney(input: TokenisedPtcJourneyInput) {
  const evidenceComplete = input.requiredGateCount > 0 && input.verifiedGateCount === input.requiredGateCount;
  const actionPlansReady = evidenceComplete && input.requiredActionCount > 0 && input.shadowReadyActionCount === input.requiredActionCount;
  return {
    route: "PTC" as const,
    stages: [
      { code: "TOKENISED_PTC_CASE", state: "COMPLETE", summary: "The governed case is a domestic, private-placement, initial PTC route. It is not a renamed DA Note." },
      { code: "PROGRAMME_TRUST_AND_PARTIES", state: input.proposed ? "COMPLETE" : input.canOperateRoute ? "ACTION_REQUIRED" : "UNAVAILABLE", summary: "The programme, trust, class, trustee, recordkeeper and optional assurance provider remain distinct case facts." },
      { code: "EXTERNAL_EVIDENCE_GATES", state: evidenceComplete ? "COMPLETE" : input.proposed ? "ACTION_REQUIRED" : "BLOCKED", summary: `${input.verifiedGateCount}/${input.requiredGateCount} required external evidence gate(s) verified. Unknown, expired or synthetic proof cannot pass.` },
      { code: "INDEPENDENT_REVIEW", state: input.representationStatus === "SHADOW_READY" ? "COMPLETE" : evidenceComplete ? "ACTION_REQUIRED" : input.proposed ? "BLOCKED" : "BLOCKED", summary: "A person other than the proposer must review the current evidence before shadow readiness." },
      { code: "DORMANT_ACTION_PLANS", state: actionPlansReady ? "AVAILABLE" : "BLOCKED", summary: `${input.shadowReadyActionCount}/${input.requiredActionCount} deterministic issue, transfer, distribution, anchor and burn plan(s) are shadow-ready; none can dispatch.` },
      { code: "TRUSTEE_RECORD_RECONCILIATION", state: input.trusteeRecordReconciled ? "COMPLETE" : input.proposed ? "ACTION_REQUIRED" : "BLOCKED", summary: "The trustee's transaction-control decision and the route-defined RTA/depository/register fact remain separate and must reconcile." },
      { code: "TOKEN_LIFECYCLE", state: input.representationStatus === "SHADOW_READY" && input.trusteeRecordReconciled ? "AVAILABLE" : "BLOCKED", summary: "PTC distributions, notices, triggers and redemption remain externally performed lifecycle observations." },
      { code: "EVIDENCE_PACK", state: input.proposed && input.canViewEvidence ? "AVAILABLE" : input.proposed ? "UNAVAILABLE" : "BLOCKED", summary: "A digest-bound pack preserves the PTC evidence gates and dormant action plan without claiming issue, allotment or title." },
    ] satisfies Array<{ code: string; state: TokenisedProductStageState; summary: string }>,
    openExternalGates: [
      { code: "TRUSTEE_AND_RECORDKEEPER_ACCEPTANCE", owner: "TRUSTEE_AND_ROUTE_RECORDKEEPER", state: input.trusteeRecordReconciled ? "OBSERVED_AND_RECONCILED" : "OPEN" },
      { code: "TOKEN_LEGAL_FINALITY", owner: "COUNSEL_AND_ROUTE_AUTHORITY", state: "OPEN" },
      { code: "TOKEN_CUSTODY_OPERATING_ACCEPTANCE", owner: "TRUSTEE_AND_CUSTODY_PERFORMER", state: "OPEN" },
      { code: "CONTROLLED_LIVE_ACCEPTANCE", owner: "PR12_SIGNATORIES", state: "OPEN" },
    ],
    capabilities: { canOperateRoute: input.canOperateRoute, canViewEvidence: input.canViewEvidence },
  };
}
