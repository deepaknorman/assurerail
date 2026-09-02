export type PtcProductStageState =
  | "COMPLETE"
  | "IN_PROGRESS"
  | "ACTION_REQUIRED"
  | "UNAVAILABLE"
  | "BLOCKED"
  | "AVAILABLE";

export interface PtcProductJourneyInput {
  canViewEvidence: boolean;
  canViewRooms: boolean;
  visibleEvidenceTypes: readonly string[];
  roomCount: number;
  hasOpenRoom: boolean;
  hasCompletedRoom: boolean;
  caseStatus: string;
  requiredPartiesActive: boolean;
  authorisationStatus: string | null;
  sagaPresent: boolean;
  legs: readonly { legType: string; required: boolean; state: string }[];
  openBreakCount: number;
}

export interface PtcProductStage {
  code: string;
  state: PtcProductStageState;
  summary: string;
}

function evidencePreflight(input: PtcProductJourneyInput, types: readonly string[]): PtcProductStageState {
  if (!input.canViewEvidence) return "UNAVAILABLE";
  return types.some((type) => input.visibleEvidenceTypes.includes(type)) ? "IN_PROGRESS" : "UNAVAILABLE";
}

function legStage(input: PtcProductJourneyInput, types: readonly string[]): PtcProductStageState {
  if (!input.sagaPresent) return "BLOCKED";
  const required = input.legs.filter((leg) => leg.required && types.includes(leg.legType));
  if (required.length === 0) return "COMPLETE";
  if (required.some((leg) => leg.state === "BREAK_OPEN")) return "BLOCKED";
  if (required.every((leg) => leg.state === "RECONCILED")) return "COMPLETE";
  if (required.some((leg) => ["OBSERVED", "RECONCILED"].includes(leg.state))) return "IN_PROGRESS";
  return "ACTION_REQUIRED";
}

function preflightOrLeg(input: PtcProductJourneyInput, legTypes: readonly string[], evidenceTypes: readonly string[]) {
  return input.sagaPresent ? legStage(input, legTypes) : evidencePreflight(input, evidenceTypes);
}

export function derivePtcProductJourney(input: PtcProductJourneyInput) {
  const caseApproved = ["APPROVED_FOR_EXECUTION", "EXECUTION_PENDING", "COMPLETION_PENDING", "COMPLETED"].includes(input.caseStatus);
  const requiredLegs = input.legs.filter((leg) => leg.required);
  const reconciledLegs = requiredLegs.filter((leg) => leg.state === "RECONCILED");
  const allRequiredReconciled = requiredLegs.length > 0 && reconciledLegs.length === requiredLegs.length;
  const gateState = (reconciled: boolean) => reconciled
    ? "INTERNAL_RECONCILIATION_RECORDED_EXTERNAL_ACCEPTANCE_OPEN"
    : "OPEN";
  const legsOfType = (type: string) => requiredLegs.filter((leg) => leg.legType === type);
  const reconciled = (type: string) => legsOfType(type).length > 0 && legsOfType(type).every((leg) => leg.state === "RECONCILED");
  return {
    stages: [
      { code: "CASE_FOUNDATION", state: caseApproved && input.requiredPartiesActive ? "COMPLETE" : input.caseStatus === "DRAFT" ? "ACTION_REQUIRED" : "IN_PROGRESS", summary: `${input.caseStatus}; active originator, trustee and recordkeeper: ${input.requiredPartiesActive}.` },
      { code: "DILIGENCE", state: input.canViewRooms ? input.hasCompletedRoom ? "COMPLETE" : input.hasOpenRoom ? "IN_PROGRESS" : "ACTION_REQUIRED" : "UNAVAILABLE", summary: input.canViewRooms ? `${input.roomCount} visible room(s); completion requires a closed diligence room.` : "VIEW_CASE_ROOM authority is required." },
      { code: "REPLAY_AUTHORISATION", state: input.authorisationStatus === "APPROVED" ? "COMPLETE" : input.authorisationStatus === "PROPOSED" ? "IN_PROGRESS" : "ACTION_REQUIRED", summary: input.authorisationStatus ?? "NOT_PROPOSED" },
      { code: "PROGRAMME_TRUST", state: preflightOrLeg(input, ["PROGRAMME_TRUST_AND_APPOINTMENT"], ["PROGRAMME_OR_TRUST", "TRUSTEE_APPOINTMENT"]), summary: "Programme/trust and trustee appointment remain trustee-controlled evidence." },
      { code: "POOL_TRANSFER_ELIGIBILITY", state: preflightOrLeg(input, ["POOL_TRANSFER_AND_ELIGIBILITY"], ["POOL_TRANSFER", "POOL_ELIGIBILITY"]), summary: "Pool transfer and eligibility remain originator-supplied facts; Rail does not make the credit decision." },
      { code: "COUNSEL_RATING_ASSURANCE", state: preflightOrLeg(input, ["REQUIRED_REVIEW"], ["COUNSEL_OPINION", "RATING_OR_EXTERNAL_REVIEW", "ASSURANCE_APPOINTMENT", "ASSURANCE_RESULT"]), summary: "Only route-required, independently appointed reviews belong here; AssurePlane is optional and provider-neutral." },
      { code: "DOCUMENTS_TRANCHE", state: preflightOrLeg(input, ["EXECUTED_DOCUMENTS_AND_TRANCHE"], ["EXECUTED_PTC_DOCUMENTS", "PTC_TRANCHE_DEFINITION"]), summary: "Executed documents and tranche/class terms must reconcile to retained evidence." },
      { code: "SUBSCRIPTION_CONSIDERATION", state: preflightOrLeg(input, ["SUBSCRIPTION_AND_CONSIDERATION"], ["PTC_SUBSCRIPTION"]), summary: "Subscribers and payment providers perform consideration; Rail observes and reconciles only." },
      { code: "TRUSTEE_CONTROL", state: preflightOrLeg(input, ["TRUSTEE_TRANSACTION_CONTROL"], ["TRUSTEE_TRANSACTION_CONTROL"]), summary: "The trustee's transaction-control decision is final for Rail workflow control." },
      { code: "ISSUE_ALLOTMENT", state: preflightOrLeg(input, ["ISSUE_OR_ALLOTMENT"], ["PTC_ISSUE_OR_ALLOTMENT"]), summary: "Issuance/allotment remains the assigned external performer's act." },
      { code: "AUTHORITATIVE_RECORD", state: preflightOrLeg(input, ["AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT"], ["AUTHORITATIVE_RECORD_DECLARATION", "AUTHORITATIVE_RECORD_SNAPSHOT"]), summary: "The route-defined trustee/RTA/depository/register acknowledgement controls legal-record reconciliation." },
      { code: "LIFECYCLE_NOTICE_SETUP", state: preflightOrLeg(input, ["LIFECYCLE_AND_NOTICE_SETUP"], ["SERVICER_APPOINTMENT", "COLLECTION_ACCOUNT", "REQUIRED_NOTICE_ACKNOWLEDGEMENT"]), summary: "Servicing, accounts and required notices remain assigned-party responsibilities." },
      { code: "RECONCILIATION", state: !input.sagaPresent ? "BLOCKED" : input.openBreakCount > 0 ? "BLOCKED" : allRequiredReconciled ? "COMPLETE" : reconciledLegs.length > 0 ? "IN_PROGRESS" : "ACTION_REQUIRED", summary: `${reconciledLegs.length}/${requiredLegs.length} required leg(s) reconciled; ${input.openBreakCount} open break(s).` },
      { code: "DOSSIER", state: input.sagaPresent ? "AVAILABLE" : "BLOCKED", summary: input.sagaPresent ? "Comparison and evidence pack are reproducible from retained records." : "An immutable PTC saga is required before a dossier exists." },
    ] satisfies PtcProductStage[],
    externalGates: [
      { code: "COUNSEL_ROUTE_PACK", owner: "COUNSEL", state: "EXTERNAL_EVIDENCE_REQUIRED" },
      { code: "HISTORIC_REPLAY_OWNER_ACCEPTANCE", owner: "ORIGINATOR_AND_TRUSTEE", state: input.authorisationStatus === "APPROVED" ? "INTERNAL_APPROVAL_RECORDED_EXTERNAL_ACCEPTANCE_OPEN" : "OPEN" },
      { code: "TRUSTEE_TRANSACTION_CONTROL", owner: "TRUSTEE", state: gateState(reconciled("TRUSTEE_TRANSACTION_CONTROL")) },
      { code: "RATING_AND_ASSURANCE", owner: "TRUSTEE_APPOINTED_PROVIDERS", state: legsOfType("REQUIRED_REVIEW").length > 0 ? gateState(reconciled("REQUIRED_REVIEW")) : input.sagaPresent ? "NOT_REQUIRED_BY_RETAINED_ROUTE_PLAN" : "ROUTE_DETERMINATION_REQUIRED" },
      { code: "AUTHORITATIVE_REGISTER_CONFIRMATION", owner: "TRUSTEE_WITH_ROUTE_RECORDKEEPER", state: gateState(reconciled("AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT")) },
      { code: "CONTROLLED_LIVE_ACCEPTANCE", owner: "PR12_SIGNATORIES", state: "OPEN" },
    ],
  };
}
