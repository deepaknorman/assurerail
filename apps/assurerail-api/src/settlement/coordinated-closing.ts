import { createHash } from "node:crypto";
import { escrowInstruction, type EscrowInstruction } from "./escrow-settlement-contract";

export type ClosingCondition = {
  conditionId: string;
  category: "DOCUMENT" | "LEGAL" | "FINANCIAL" | "REGISTRY" | "OPERATIONS";
  status: "PENDING" | "SATISFIED" | "WAIVED" | "BLOCKED";
  required: boolean;
  evidenceRef: string | null;
  decisionRef: string | null;
};

export type ClosingDocumentSlot = {
  slotId: string;
  documentType: "ASSIGNMENT_AGREEMENT" | "SELLER_SCHEDULE" | "DEBT_RELEASE" | "LEGAL_OPINION" | "STAMPING_EVIDENCE" | "REGISTRY_EVIDENCE" | "OTHER";
  required: boolean;
  evidenceVersionRef: string | null;
  payloadDigest: string | null;
};

export type CoordinatedClosingInput = {
  programmeRef: string;
  closingRef: string;
  rehearsal: boolean;
  conditions: ClosingCondition[];
  documents: ClosingDocumentSlot[];
  instruction: EscrowInstruction;
  vanRef: string | null;
  providerProfileRef: string;
};

export type ClosingAuthorisation = {
  role: "SELLER_AUTHORISER" | "BUYER_AUTHORISER";
  actorUserId: string;
  institutionId: string;
  closingDigest: string;
  stepUpEvidenceRef: string;
  authorisedAt: string;
};

export type ProviderObservation = {
  legRef: string;
  providerTransferRef: string | null;
  idempotencyRef: string;
  status: "NOT_SENT" | "ACCEPTED" | "SETTLED" | "FAILED" | "REVERSED" | "UNKNOWN";
  observedAmountMinor: string | null;
  observedAt: string;
};

const bounded = (value: string | null, label: string, nullable = false) => {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw new Error(`${label}: bounded reference required`);
  return value.trim();
};

const digest = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

function distinct<T>(items: T[], key: (item: T) => string, label: string) {
  const values = items.map(key);
  if (new Set(values).size !== values.length) throw new Error(`${label}: duplicate entries are not permitted`);
}

export function createCoordinatedClosingPack(input: CoordinatedClosingInput) {
  bounded(input.programmeRef, "programmeRef");
  bounded(input.closingRef, "closingRef");
  bounded(input.providerProfileRef, "providerProfileRef");
  bounded(input.vanRef, "vanRef", true);
  if (!input.rehearsal && !input.vanRef) throw new Error("live-ready pack requires a provider-issued VAN reference");
  if (!input.conditions.length || !input.documents.length) throw new Error("conditions and document slots required");
  distinct(input.conditions, (item) => item.conditionId, "conditions");
  distinct(input.documents, (item) => item.slotId, "documents");
  const conditionCategories = new Set(["DOCUMENT", "LEGAL", "FINANCIAL", "REGISTRY", "OPERATIONS"]);
  const conditionStatuses = new Set(["PENDING", "SATISFIED", "WAIVED", "BLOCKED"]);
  const documentTypes = new Set(["ASSIGNMENT_AGREEMENT", "SELLER_SCHEDULE", "DEBT_RELEASE", "LEGAL_OPINION", "STAMPING_EVIDENCE", "REGISTRY_EVIDENCE", "OTHER"]);
  for (const condition of input.conditions) {
    bounded(condition.conditionId, "conditionId");
    if (!conditionCategories.has(condition.category) || !conditionStatuses.has(condition.status)) throw new Error("invalid condition category or status");
    if (!condition.required && condition.status === "WAIVED") throw new Error("only a required condition needs a waiver decision");
    if (["SATISFIED", "WAIVED"].includes(condition.status) && !condition.decisionRef) throw new Error("satisfied or waived condition requires a decision reference");
    if (condition.status === "SATISFIED" && !condition.evidenceRef) throw new Error("satisfied condition requires evidence");
    if (condition.status === "WAIVED" && condition.evidenceRef) throw new Error("waived condition records the waiver decision, not substitute evidence");
  }
  for (const document of input.documents) {
    bounded(document.slotId, "slotId");
    if (!documentTypes.has(document.documentType)) throw new Error("invalid closing document type");
    if ((document.evidenceVersionRef === null) !== (document.payloadDigest === null)) throw new Error("document evidence reference and digest must be supplied together");
    if (document.payloadDigest && !/^sha256:[a-f0-9]{64}$/.test(document.payloadDigest)) throw new Error("document payload digest required");
  }
  const instruction = escrowInstruction(input.instruction);
  if (instruction.programmeRef !== input.programmeRef || instruction.closingRef !== input.closingRef) throw new Error("instruction does not belong to this closing");
  if (new Set(instruction.legs.map((leg) => leg.sellerInstitutionId)).size !== 1) throw new Error("each closing pack must remain seller-specific");
  const blockingConditions = input.conditions.filter((item) => item.required && !["SATISFIED", "WAIVED"].includes(item.status));
  const missingDocuments = input.documents.filter((item) => item.required && !item.evidenceVersionRef);
  const readiness = blockingConditions.length || missingDocuments.length ? "NOT_READY" : "READY_FOR_AUTHORISATION";
  const canonical = {
    schema: "assurerail-coordinated-closing/1",
    programmeRef: input.programmeRef,
    closingRef: input.closingRef,
    rehearsal: input.rehearsal,
    conditions: [...input.conditions].sort((a, b) => a.conditionId.localeCompare(b.conditionId)),
    documents: [...input.documents].sort((a, b) => a.slotId.localeCompare(b.slotId)),
    instruction,
    vanRef: input.vanRef,
    providerProfileRef: input.providerProfileRef,
  };
  return {
    ...canonical,
    closingDigest: digest(canonical),
    readiness,
    blockingConditionIds: blockingConditions.map((item) => item.conditionId),
    missingDocumentSlotIds: missingDocuments.map((item) => item.slotId),
    custodyProvidedByRail: false as const,
    railMayReleaseFunds: false as const,
    legalTransferEstablishedByPack: false as const,
  };
}

export function authoriseCoordinatedClosing(pack: ReturnType<typeof createCoordinatedClosingPack>, approvals: ClosingAuthorisation[]) {
  if (pack.readiness !== "READY_FOR_AUTHORISATION") throw new Error("closing pack is not ready for authorisation");
  distinct(approvals, (item) => item.role, "authorisation roles");
  distinct(approvals, (item) => item.actorUserId, "authorisation actors");
  const requiredRoles: ClosingAuthorisation["role"][] = ["SELLER_AUTHORISER", "BUYER_AUTHORISER"];
  if (approvals.length !== requiredRoles.length || approvals.some((approval) => !requiredRoles.includes(approval.role))) throw new Error("only the required seller and buyer authorisations are accepted");
  const sellerInstitutionId = pack.instruction.legs[0].sellerInstitutionId;
  for (const approval of approvals) {
    bounded(approval.actorUserId, "actorUserId");
    bounded(approval.institutionId, "institutionId");
    bounded(approval.stepUpEvidenceRef, "stepUpEvidenceRef");
    if (approval.closingDigest !== pack.closingDigest || !Number.isFinite(Date.parse(approval.authorisedAt))) throw new Error("authorisation is not bound to this closing pack");
    if (approval.role === "SELLER_AUTHORISER" && approval.institutionId !== sellerInstitutionId) throw new Error("seller authoriser must belong to the seller in this closing");
    if (approval.role === "BUYER_AUTHORISER" && approval.institutionId !== pack.instruction.buyerInstitutionId) throw new Error("buyer authoriser must belong to the buyer in this closing");
  }
  if (!requiredRoles.every((role) => approvals.some((approval) => approval.role === role))) throw new Error("seller and buyer authorisation required");
  return {
    status: "AUTHORISED_FOR_PROVIDER_SUBMISSION" as const,
    closingDigest: pack.closingDigest,
    authorisationsDigest: digest([...approvals].sort((a, b) => a.role.localeCompare(b.role))),
    approvals,
    railMaySubmitOnlyUnderProviderMandate: true as const,
    railMayReleaseFunds: false as const,
  };
}

export function reconcileCoordinatedClosing(
  pack: ReturnType<typeof createCoordinatedClosingPack>,
  authorisation: ReturnType<typeof authoriseCoordinatedClosing>,
  observations: ProviderObservation[],
) {
  if (authorisation.closingDigest !== pack.closingDigest) throw new Error("authorisation does not belong to closing pack");
  distinct(observations, (item) => item.legRef, "observed legs");
  distinct(observations, (item) => item.idempotencyRef, "idempotency references");
  const expected = new Map(pack.instruction.legs.map((leg) => [leg.legRef, leg]));
  const observationStatuses = new Set(["NOT_SENT", "ACCEPTED", "SETTLED", "FAILED", "REVERSED", "UNKNOWN"]);
  for (const observation of observations) {
    const leg = expected.get(observation.legRef);
    if (!leg) throw new Error("observation references an unknown settlement leg");
    bounded(observation.idempotencyRef, "idempotencyRef");
    if (!observationStatuses.has(observation.status)) throw new Error("invalid provider observation status");
    if (!Number.isFinite(Date.parse(observation.observedAt))) throw new Error("valid observation time required");
    if (observation.status === "SETTLED" && (!observation.providerTransferRef || observation.observedAmountMinor !== leg.amountMinor)) throw new Error("settled observation requires matching amount and provider reference");
    if (["ACCEPTED", "SETTLED", "FAILED", "REVERSED"].includes(observation.status) && !observation.providerTransferRef) throw new Error("provider response requires a provider reference");
    if (observation.observedAmountMinor !== null && !/^(0|[1-9][0-9]{0,29})$/.test(observation.observedAmountMinor)) throw new Error("observed amount must use integer minor units");
  }
  const byLeg = new Map(observations.map((item) => [item.legRef, item]));
  const unresolved = pack.instruction.legs.filter((leg) => !byLeg.has(leg.legRef) || ["NOT_SENT", "ACCEPTED", "UNKNOWN"].includes(byLeg.get(leg.legRef)!.status));
  const exceptions = observations.filter((item) => ["FAILED", "REVERSED"].includes(item.status));
  const allSettled = pack.instruction.legs.every((leg) => byLeg.get(leg.legRef)?.status === "SETTLED");
  const status = allSettled ? "RECONCILED" : exceptions.length ? "EXCEPTION" : "AMBIGUOUS_OR_PENDING";
  return {
    status,
    closingDigest: pack.closingDigest,
    observationDigest: digest([...observations].sort((a, b) => a.legRef.localeCompare(b.legRef))),
    unresolvedLegRefs: unresolved.map((item) => item.legRef),
    exceptionLegRefs: exceptions.map((item) => item.legRef),
    repairPlaybook: status === "RECONCILED" ? [] : [
      "STOP_AUTOMATIC_RESUBMISSION",
      "QUERY_PROVIDER_BY_IDEMPOTENCY_AND_PROVIDER_REFERENCE",
      "RECONCILE_VAN_OR_BANK_STATEMENT",
      "OBTAIN_DUAL_APPROVAL_FOR_ANY_CORRECTIVE_INSTRUCTION",
      "PRESERVE_ORIGINAL_INSTRUCTION_AND_APPEND_REPAIR_EVIDENCE",
      "ESCALATE_LEGAL_TRANSFER_STATUS_SEPARATELY_FROM_FUNDS_STATUS",
    ],
    automaticRetryPermitted: false as const,
    railMayInferSettlementFromVan: false as const,
    legalCompletionInferred: false as const,
  };
}
