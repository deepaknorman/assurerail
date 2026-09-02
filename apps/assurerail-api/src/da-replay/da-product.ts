export interface DaProductJourneyInput {
  canViewEvidence: boolean;
  canViewRooms: boolean;
  sourceCount: number;
  evidenceCount: number;
  validEvidenceCount: number;
  roomCount: number;
  hasOpenRoom: boolean;
  hasCompletedRoom: boolean;
  creditEvidenceSatisfied: boolean;
  documentEvidenceSatisfied: boolean;
  caseStatus: string;
  requiredPartiesActive: boolean;
  authorisationStatus: string | null;
  sagaPresent: boolean;
  requiredLegCount: number;
  observedLegCount: number;
  reconciledLegCount: number;
  openBreakCount: number;
  recordkeeperReconciled: boolean;
}

export interface DaProductStage {
  code: string;
  state: "COMPLETE" | "IN_PROGRESS" | "ACTION_REQUIRED" | "UNAVAILABLE" | "BLOCKED" | "AVAILABLE";
  summary: string;
}

const state = (satisfied: boolean, pending = false): DaProductStage["state"] =>
  satisfied ? "COMPLETE" : pending ? "IN_PROGRESS" : "ACTION_REQUIRED";

export function deriveDaProductJourney(input: DaProductJourneyInput) {
  const caseApproved = ["APPROVED_FOR_EXECUTION", "EXECUTION_PENDING", "COMPLETION_PENDING", "COMPLETED"].includes(input.caseStatus);
  const allRequiredLegsObserved = input.requiredLegCount > 0 && input.observedLegCount === input.requiredLegCount;
  const allRequiredLegsReconciled = input.requiredLegCount > 0 && input.reconciledLegCount === input.requiredLegCount;
  return {
    stages: [
      { code: "INTAKE", state: input.canViewEvidence ? state(input.sourceCount > 0 && input.validEvidenceCount > 0, input.sourceCount > 0 || input.evidenceCount > 0) : "UNAVAILABLE", summary: input.canViewEvidence ? `${input.sourceCount} source reference(s); ${input.validEvidenceCount}/${input.evidenceCount} visible evidence object(s) currently valid.` : "VIEW_EVIDENCE authority is required." },
      { code: "DILIGENCE", state: input.canViewRooms ? (input.hasCompletedRoom ? "COMPLETE" : input.hasOpenRoom ? "IN_PROGRESS" : "ACTION_REQUIRED") : "UNAVAILABLE", summary: input.canViewRooms ? `${input.roomCount} visible case room(s); completion requires a closed diligence room.` : "VIEW_CASE_ROOM authority is required." },
      { code: "CREDIT_DECISION", state: input.canViewEvidence ? state(input.creditEvidenceSatisfied) : "UNAVAILABLE", summary: "The transferee owns its credit decision; Rail only validates retained evidence visible to this institution." },
      { code: "DOCUMENTATION", state: input.canViewEvidence ? state(input.documentEvidenceSatisfied) : "UNAVAILABLE", summary: "Executed transfer-document evidence must be signed, valid, current and visible to this institution." },
      { code: "CASE_APPROVAL", state: state(caseApproved && input.requiredPartiesActive, input.caseStatus !== "DRAFT" || input.requiredPartiesActive), summary: `${input.caseStatus}; required parties active: ${input.requiredPartiesActive}.` },
      { code: "REPLAY_AUTHORISATION", state: state(input.authorisationStatus === "APPROVED", input.authorisationStatus === "PROPOSED"), summary: input.authorisationStatus ?? "NOT_PROPOSED" },
      { code: "COMPLETION_PLAN", state: state(input.sagaPresent), summary: input.sagaPresent ? `${input.requiredLegCount} required partner/external leg(s); OBSERVE_ONLY.` : "No immutable completion plan recorded." },
      { code: "PARTNER_EXECUTION", state: input.sagaPresent ? state(allRequiredLegsObserved, input.observedLegCount > 0) : "BLOCKED", summary: `${input.observedLegCount}/${input.requiredLegCount} required leg(s) observed; Rail dispatched none.` },
      { code: "RECONCILIATION", state: input.sagaPresent ? state(allRequiredLegsReconciled && input.openBreakCount === 0, input.reconciledLegCount > 0 || input.openBreakCount > 0) : "BLOCKED", summary: `${input.reconciledLegCount}/${input.requiredLegCount} reconciled; ${input.openBreakCount} open break(s).` },
      { code: "DOSSIER", state: input.sagaPresent ? "AVAILABLE" : "BLOCKED", summary: input.sagaPresent ? "Comparison CSV and evidence pack are reproducible from retained records." : "A saga is required before a dossier exists." },
    ] satisfies DaProductStage[],
    openExternalGates: [
      { code: "COUNSEL_ROUTE_PACK", owner: "COUNSEL", state: "EXTERNAL_EVIDENCE_REQUIRED" },
      { code: "PARTICIPANT_AUTHORISATION", owner: "TRANSFEROR_AND_TRANSFEREE", state: input.authorisationStatus === "APPROVED" ? "INTERNAL_APPROVAL_RECORDED_EXTERNAL_ACCEPTANCE_OPEN" : "OPEN" },
      { code: "PARTNER_EXECUTION_ACKNOWLEDGEMENTS", owner: "ASSIGNED_PERFORMERS", state: input.sagaPresent && allRequiredLegsObserved ? "OBSERVED" : "OPEN" },
      { code: "AUTHORITATIVE_RECORD_CONFIRMATION", owner: "ROUTE_RECORDKEEPER", state: input.recordkeeperReconciled ? "RECONCILED" : "OPEN" },
      { code: "CONTROLLED_LIVE_ACCEPTANCE", owner: "PR12_SIGNATORIES", state: "OPEN" },
    ],
  };
}
