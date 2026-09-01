import {
  assertSha256Digest,
  exactMoney,
  sha256Digest,
  toCanonicalValue,
  type CanonicalValue,
  type FunctionPerformer,
  type MaterialFunction,
} from "../contracts/v1";

/**
 * This route pack only creates an immutable historic-observation plan. It does not issue,
 * allot, settle, file, notify, or update a legal record. A completed historic PTC evidence pack
 * is required before a real replay may be asserted.
 */
export const CONVENTIONAL_PTC_REPLAY_ROUTE_PACK = Object.freeze({
  ref: "assurerail://route-packs/domestic-conventional-ptc-replay",
  version: "1.0.0",
  transactionRoute: "PTC",
  representation: "CONVENTIONAL",
  jurisdiction: "IN",
  marketContext: "DOMESTIC",
  placementOrListing: "PRIVATE_PLACEMENT",
  lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
  operatingModes: ["REPLAY", "SHADOW"] as const,
  executionMode: "OBSERVE_ONLY" as const,
  requiredMaterialFunctions: [
    "PROGRAMME_OR_TRUST_ADMINISTRATION",
    "POOL_TRANSFER_AND_ELIGIBILITY",
    "TRUSTEE_TRANSACTION_CONTROL",
    "DOCUMENTATION_AND_CLOSING",
    "ISSUANCE_OR_ALLOTMENT",
    "CASH_SETTLEMENT",
    "AUTHORITATIVE_REGISTER_UPDATE",
  ] as const satisfies readonly MaterialFunction[],
  conditionalMaterialFunctions: [
    "ASSURANCE_OR_REVIEW",
    "RATING_OR_EXTERNAL_REVIEW",
    "SERVICING_AND_COLLECTION_ACCOUNT",
  ] as const satisfies readonly MaterialFunction[],
});

export type PtcReplayLegType =
  | "PROGRAMME_TRUST_AND_APPOINTMENT"
  | "POOL_TRANSFER_AND_ELIGIBILITY"
  | "REQUIRED_REVIEW"
  | "EXECUTED_DOCUMENTS_AND_TRANCHE"
  | "SUBSCRIPTION_AND_CONSIDERATION"
  | "TRUSTEE_TRANSACTION_CONTROL"
  | "ISSUE_OR_ALLOTMENT"
  | "AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT"
  | "LIFECYCLE_AND_NOTICE_SETUP";

export interface PtcFunctionAssignmentPlan {
  readonly materialFunction: MaterialFunction;
  readonly performer: FunctionPerformer;
  readonly performerInstitutionId: string;
  readonly authorityEvidenceDigest?: string;
}

export interface ConventionalPtcReplayInput {
  readonly originatorInstitutionId: string;
  readonly trusteeInstitutionId: string;
  readonly recordkeeperInstitutionId: string;
  readonly programmeTrust: {
    readonly programmeOrTrustEvidenceDigest: string;
    readonly trusteeAppointmentEvidenceDigest: string;
  };
  readonly poolTransfer: {
    readonly poolTransferEvidenceDigest: string;
    readonly poolEligibilityEvidenceDigest: string;
    readonly poolDigest: string;
  };
  readonly requiredReviews: {
    readonly counsel?: {
      readonly providerInstitutionId: string;
      readonly opinionEvidenceDigest: string;
    };
    readonly rating?: {
      readonly providerInstitutionId: string;
      readonly evidenceDigest: string;
    };
    readonly assurance?: {
      readonly providerInstitutionId: string;
      readonly appointmentEvidenceDigest: string;
      readonly resultEvidenceDigest: string;
    };
  };
  readonly issue: {
    readonly executedDocumentsEvidenceDigest: string;
    readonly trancheDefinitionDigest: string;
    readonly subscriptionEvidenceDigest: string;
    readonly consideration: { readonly currency: unknown; readonly units: unknown; readonly scale: unknown };
    readonly considerationReference: string;
    readonly trusteeControlDecisionDigest: string;
    readonly allotmentEvidenceDigest: string;
  };
  readonly authoritativeRecord: {
    readonly recordType: string;
    readonly recordReference: string;
    readonly declarationEvidenceDigest: string;
    readonly beforeDigest: string;
    readonly afterDigest: string;
  };
  readonly lifecycleSetup: {
    readonly servicerInstitutionId?: string;
    readonly servicerAppointmentEvidenceDigest?: string;
    readonly collectionAccountEvidenceDigest?: string;
    readonly requiredNoticeAcknowledgementDigest: string;
  };
}

export interface PlannedPtcReplayLeg {
  readonly legKey: string;
  readonly legType: PtcReplayLegType;
  readonly sequence: number;
  readonly required: true;
  readonly participantOwnerInstitutionId: string;
  readonly performerClass: FunctionPerformer;
  readonly expected: CanonicalValue;
  readonly expectedDigest: string;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function digest(value: unknown, field: string): string {
  return assertSha256Digest(value, field);
}

function optionalDigest(value: unknown, field: string): string | undefined {
  return value === undefined || value === null || value === "" ? undefined : digest(value, field);
}

function planLeg(
  legKey: string,
  legType: PtcReplayLegType,
  sequence: number,
  participantOwnerInstitutionId: string,
  performerClass: FunctionPerformer,
  expected: unknown,
): PlannedPtcReplayLeg {
  const canonical = toCanonicalValue(expected);
  return Object.freeze({
    legKey,
    legType,
    sequence,
    required: true,
    participantOwnerInstitutionId,
    performerClass,
    expected: canonical,
    expectedDigest: sha256Digest(canonical),
  });
}

/**
 * Produces the PTC-specific ordered replay plan. Although a trustee and recordkeeper may happen
 * to be the same legal institution, their functions, evidence and plan legs remain distinct.
 */
export function buildConventionalPtcReplayPlan(
  input: ConventionalPtcReplayInput,
): readonly PlannedPtcReplayLeg[] {
  const originator = requiredText(input.originatorInstitutionId, "originatorInstitutionId");
  const trustee = requiredText(input.trusteeInstitutionId, "trusteeInstitutionId");
  const recordkeeper = requiredText(input.recordkeeperInstitutionId, "recordkeeperInstitutionId");
  const consideration = exactMoney(input.issue.consideration);
  if (BigInt(consideration.units) <= 0n) throw new Error("issue.consideration units must be positive");

  const legs: PlannedPtcReplayLeg[] = [
    planLeg("programme-trust-and-appointment", "PROGRAMME_TRUST_AND_APPOINTMENT", 10, trustee, "EXTERNAL_AUTHORITY", {
      programmeOrTrustEvidenceDigest: digest(input.programmeTrust.programmeOrTrustEvidenceDigest, "programmeTrust.programmeOrTrustEvidenceDigest"),
      trusteeAppointmentEvidenceDigest: digest(input.programmeTrust.trusteeAppointmentEvidenceDigest, "programmeTrust.trusteeAppointmentEvidenceDigest"),
      trusteeInstitutionId: trustee,
    }),
    planLeg("pool-transfer-and-eligibility", "POOL_TRANSFER_AND_ELIGIBILITY", 20, originator, "PARTICIPANT_OWNED", {
      poolDigest: digest(input.poolTransfer.poolDigest, "poolTransfer.poolDigest"),
      poolEligibilityEvidenceDigest: digest(input.poolTransfer.poolEligibilityEvidenceDigest, "poolTransfer.poolEligibilityEvidenceDigest"),
      poolTransferEvidenceDigest: digest(input.poolTransfer.poolTransferEvidenceDigest, "poolTransfer.poolTransferEvidenceDigest"),
      originatorInstitutionId: originator,
    }),
  ];

  const counsel = input.requiredReviews.counsel;
  const rating = input.requiredReviews.rating;
  const assurance = input.requiredReviews.assurance;
  if (assurance) {
    const assuranceProviderInstitutionId = requiredText(assurance.providerInstitutionId, "requiredReviews.assurance.providerInstitutionId");
    legs.push(planLeg("trustee-appointed-assurance", "REQUIRED_REVIEW", 30, assuranceProviderInstitutionId, "EXTERNAL_AUTHORITY", {
      appointmentEvidenceDigest: digest(assurance.appointmentEvidenceDigest, "requiredReviews.assurance.appointmentEvidenceDigest"),
      providerInstitutionId: assuranceProviderInstitutionId,
      resultEvidenceDigest: digest(assurance.resultEvidenceDigest, "requiredReviews.assurance.resultEvidenceDigest"),
      appointedByInstitutionId: trustee,
      reviewType: "ASSURANCE",
    }));
  }
  if (counsel) {
    const providerInstitutionId = requiredText(counsel.providerInstitutionId, "requiredReviews.counsel.providerInstitutionId");
    legs.push(planLeg("counsel-review", "REQUIRED_REVIEW", 31, providerInstitutionId, "EXTERNAL_AUTHORITY", {
      evidenceDigest: digest(counsel.opinionEvidenceDigest, "requiredReviews.counsel.opinionEvidenceDigest"),
      providerInstitutionId,
      reviewType: "COUNSEL",
    }));
  }
  if (rating) {
    const providerInstitutionId = requiredText(rating.providerInstitutionId, "requiredReviews.rating.providerInstitutionId");
    legs.push(planLeg("rating-review", "REQUIRED_REVIEW", 32, providerInstitutionId, "EXTERNAL_AUTHORITY", {
      evidenceDigest: digest(rating.evidenceDigest, "requiredReviews.rating.evidenceDigest"),
      providerInstitutionId,
      reviewType: "RATING",
    }));
  }

  legs.push(
    planLeg("executed-documents-and-tranche", "EXECUTED_DOCUMENTS_AND_TRANCHE", 40, trustee, "EXTERNAL_AUTHORITY", {
      executedDocumentsEvidenceDigest: digest(input.issue.executedDocumentsEvidenceDigest, "issue.executedDocumentsEvidenceDigest"),
      trancheDefinitionDigest: digest(input.issue.trancheDefinitionDigest, "issue.trancheDefinitionDigest"),
    }),
    planLeg("subscription-and-consideration", "SUBSCRIPTION_AND_CONSIDERATION", 50, originator, "PARTICIPANT_OWNED", {
      consideration,
      considerationReference: requiredText(input.issue.considerationReference, "issue.considerationReference"),
      subscriptionEvidenceDigest: digest(input.issue.subscriptionEvidenceDigest, "issue.subscriptionEvidenceDigest"),
    }),
    planLeg("trustee-transaction-control", "TRUSTEE_TRANSACTION_CONTROL", 60, trustee, "EXTERNAL_AUTHORITY", {
      trusteeControlDecisionDigest: digest(input.issue.trusteeControlDecisionDigest, "issue.trusteeControlDecisionDigest"),
      trusteeInstitutionId: trustee,
    }),
    planLeg("issue-or-allotment", "ISSUE_OR_ALLOTMENT", 70, trustee, "EXTERNAL_AUTHORITY", {
      allotmentEvidenceDigest: digest(input.issue.allotmentEvidenceDigest, "issue.allotmentEvidenceDigest"),
      trusteeControlDecisionDigest: digest(input.issue.trusteeControlDecisionDigest, "issue.trusteeControlDecisionDigest"),
    }),
    planLeg("authoritative-record-acknowledgement", "AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT", 80, recordkeeper, "EXTERNAL_AUTHORITY", {
      afterDigest: digest(input.authoritativeRecord.afterDigest, "authoritativeRecord.afterDigest"),
      beforeDigest: digest(input.authoritativeRecord.beforeDigest, "authoritativeRecord.beforeDigest"),
      declarationEvidenceDigest: digest(input.authoritativeRecord.declarationEvidenceDigest, "authoritativeRecord.declarationEvidenceDigest"),
      recordReference: requiredText(input.authoritativeRecord.recordReference, "authoritativeRecord.recordReference"),
      recordType: requiredText(input.authoritativeRecord.recordType, "authoritativeRecord.recordType"),
      recordkeeperInstitutionId: recordkeeper,
    }),
  );

  const servicerInstitutionId = input.lifecycleSetup.servicerInstitutionId === undefined
    ? undefined
    : requiredText(input.lifecycleSetup.servicerInstitutionId, "lifecycleSetup.servicerInstitutionId");
  const servicerAppointment = optionalDigest(input.lifecycleSetup.servicerAppointmentEvidenceDigest, "lifecycleSetup.servicerAppointmentEvidenceDigest");
  const collectionAccount = optionalDigest(input.lifecycleSetup.collectionAccountEvidenceDigest, "lifecycleSetup.collectionAccountEvidenceDigest");
  if ((servicerInstitutionId || servicerAppointment || collectionAccount) && !(servicerInstitutionId && servicerAppointment && collectionAccount)) {
    throw new Error("lifecycleSetup servicer institution, appointment and collection-account evidence must be supplied together");
  }
  legs.push(planLeg("lifecycle-and-notice-setup", "LIFECYCLE_AND_NOTICE_SETUP", 90, servicerInstitutionId ?? trustee, servicerInstitutionId ? "PARTICIPANT_OWNED" : "EXTERNAL_AUTHORITY", {
    collectionAccountEvidenceDigest: collectionAccount,
    requiredNoticeAcknowledgementDigest: digest(input.lifecycleSetup.requiredNoticeAcknowledgementDigest, "lifecycleSetup.requiredNoticeAcknowledgementDigest"),
    servicerAppointmentEvidenceDigest: servicerAppointment,
    servicerInstitutionId,
  }));

  return Object.freeze(legs.sort((left, right) => left.sequence - right.sequence));
}

export function buildConventionalPtcFunctionAssignments(
  input: ConventionalPtcReplayInput,
): readonly PtcFunctionAssignmentPlan[] {
  // Keep the persisted-assignment projection behind the same completeness/fail-closed checks as
  // the immutable replay plan. No caller may obtain a seemingly valid function map from a partial
  // lifecycle, reviewer, amount or evidence input.
  buildConventionalPtcReplayPlan(input);
  const originator = requiredText(input.originatorInstitutionId, "originatorInstitutionId");
  const trustee = requiredText(input.trusteeInstitutionId, "trusteeInstitutionId");
  const recordkeeper = requiredText(input.recordkeeperInstitutionId, "recordkeeperInstitutionId");
  const assignments: PtcFunctionAssignmentPlan[] = [
    { materialFunction: "PROGRAMME_OR_TRUST_ADMINISTRATION", performer: "EXTERNAL_AUTHORITY", performerInstitutionId: trustee, authorityEvidenceDigest: digest(input.programmeTrust.programmeOrTrustEvidenceDigest, "programmeTrust.programmeOrTrustEvidenceDigest") },
    { materialFunction: "POOL_TRANSFER_AND_ELIGIBILITY", performer: "PARTICIPANT_OWNED", performerInstitutionId: originator, authorityEvidenceDigest: digest(input.poolTransfer.poolTransferEvidenceDigest, "poolTransfer.poolTransferEvidenceDigest") },
    { materialFunction: "TRUSTEE_TRANSACTION_CONTROL", performer: "EXTERNAL_AUTHORITY", performerInstitutionId: trustee, authorityEvidenceDigest: digest(input.programmeTrust.trusteeAppointmentEvidenceDigest, "programmeTrust.trusteeAppointmentEvidenceDigest") },
    { materialFunction: "DOCUMENTATION_AND_CLOSING", performer: "EXTERNAL_AUTHORITY", performerInstitutionId: trustee, authorityEvidenceDigest: digest(input.issue.executedDocumentsEvidenceDigest, "issue.executedDocumentsEvidenceDigest") },
    { materialFunction: "ISSUANCE_OR_ALLOTMENT", performer: "EXTERNAL_AUTHORITY", performerInstitutionId: trustee, authorityEvidenceDigest: digest(input.issue.allotmentEvidenceDigest, "issue.allotmentEvidenceDigest") },
    { materialFunction: "CASH_SETTLEMENT", performer: "PARTICIPANT_OWNED", performerInstitutionId: originator, authorityEvidenceDigest: digest(input.issue.subscriptionEvidenceDigest, "issue.subscriptionEvidenceDigest") },
    { materialFunction: "AUTHORITATIVE_REGISTER_UPDATE", performer: "EXTERNAL_AUTHORITY", performerInstitutionId: recordkeeper, authorityEvidenceDigest: digest(input.authoritativeRecord.declarationEvidenceDigest, "authoritativeRecord.declarationEvidenceDigest") },
  ];
  if (input.requiredReviews.assurance) assignments.push({ materialFunction: "ASSURANCE_OR_REVIEW", performer: "EXTERNAL_AUTHORITY", performerInstitutionId: requiredText(input.requiredReviews.assurance.providerInstitutionId, "requiredReviews.assurance.providerInstitutionId"), authorityEvidenceDigest: digest(input.requiredReviews.assurance.appointmentEvidenceDigest, "requiredReviews.assurance.appointmentEvidenceDigest") });
  if (input.requiredReviews.counsel) assignments.push({ materialFunction: "LEGAL_REVIEW_OR_OPINION", performer: "EXTERNAL_AUTHORITY", performerInstitutionId: requiredText(input.requiredReviews.counsel.providerInstitutionId, "requiredReviews.counsel.providerInstitutionId"), authorityEvidenceDigest: digest(input.requiredReviews.counsel.opinionEvidenceDigest, "requiredReviews.counsel.opinionEvidenceDigest") });
  if (input.requiredReviews.rating) assignments.push({ materialFunction: "RATING_OR_EXTERNAL_REVIEW", performer: "EXTERNAL_AUTHORITY", performerInstitutionId: requiredText(input.requiredReviews.rating.providerInstitutionId, "requiredReviews.rating.providerInstitutionId"), authorityEvidenceDigest: digest(input.requiredReviews.rating.evidenceDigest, "requiredReviews.rating.evidenceDigest") });
  if (input.lifecycleSetup.servicerInstitutionId && input.lifecycleSetup.servicerAppointmentEvidenceDigest) assignments.push({ materialFunction: "SERVICING_AND_COLLECTION_ACCOUNT", performer: "PARTICIPANT_OWNED", performerInstitutionId: requiredText(input.lifecycleSetup.servicerInstitutionId, "lifecycleSetup.servicerInstitutionId"), authorityEvidenceDigest: digest(input.lifecycleSetup.servicerAppointmentEvidenceDigest, "lifecycleSetup.servicerAppointmentEvidenceDigest") });
  return Object.freeze(assignments);
}

export function comparePtcReplayObservation(
  expectedInput: unknown,
  observedInput: unknown,
): {
  readonly result: "MATCHED" | "BREAK_OPEN";
  readonly expected: CanonicalValue;
  readonly observed: CanonicalValue;
  readonly expectedDigest: string;
  readonly observedDigest: string;
  readonly differences: readonly { readonly path: string; readonly expected: CanonicalValue | undefined; readonly observed: CanonicalValue | undefined }[];
} {
  const expected = toCanonicalValue(expectedInput);
  const observed = toCanonicalValue(observedInput);
  const differences: Array<{ path: string; expected: CanonicalValue | undefined; observed: CanonicalValue | undefined }> = [];
  const walk = (left: CanonicalValue | undefined, right: CanonicalValue | undefined, path: string): void => {
    if (left === undefined || right === undefined) {
      differences.push({ path, expected: left, observed: right });
      return;
    }
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || sha256Digest(left) !== sha256Digest(right))
        differences.push({ path, expected: left, observed: right });
      return;
    }
    if (left !== null && right !== null && typeof left === "object" && typeof right === "object") {
      const leftRecord = left as Readonly<Record<string, CanonicalValue>>;
      const rightRecord = right as Readonly<Record<string, CanonicalValue>>;
      for (const key of [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].sort())
        walk(leftRecord[key], rightRecord[key], `${path}.${key}`);
      return;
    }
    if (left !== right) differences.push({ path, expected: left, observed: right });
  };
  walk(expected, observed, "$");
  return Object.freeze({
    result: differences.length === 0 ? "MATCHED" : "BREAK_OPEN",
    expected,
    observed,
    expectedDigest: sha256Digest(expected),
    observedDigest: sha256Digest(observed),
    differences: Object.freeze(differences),
  });
}

export function derivePtcSagaState(
  legs: readonly { required: boolean; state: string }[],
  openBreakCount: number,
): "READY" | "EXECUTING" | "OBSERVED" | "RECONCILED" | "BREAK_OPEN" {
  if (openBreakCount > 0 || legs.some((leg) => leg.state === "BREAK_OPEN")) return "BREAK_OPEN";
  const required = legs.filter((leg) => leg.required);
  if (required.length === 0 || required.every((leg) => leg.state === "PLANNED")) return "READY";
  if (required.every((leg) => leg.state === "RECONCILED")) return "RECONCILED";
  if (required.every((leg) => ["OBSERVED", "RECONCILED"].includes(leg.state))) return "OBSERVED";
  return "EXECUTING";
}
