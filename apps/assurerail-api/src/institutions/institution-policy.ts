export const INSTITUTION_ACTIONS = [
  "VIEW_INSTITUTION",
  "ADMINISTER_MEMBERS",
  "PROPOSE_AUTHORITY",
  "APPROVE_AUTHORITY",
  "MANAGE_APPOINTMENTS",
  "OPERATE_CONNECTORS",
  "VIEW_EVIDENCE",
  "MANAGE_EVIDENCE",
  "VIEW_CASE",
  "OPERATE_CASE",
  "OPERATE_ROUTE",
  "VIEW_CASE_ROOM",
  "OPERATE_CASE_ROOM",
  "REVIEW_ROOM_MIGRATION",
  "VIEW_OPPORTUNITY",
  "MANAGE_OPPORTUNITY",
  "RESPOND_OPPORTUNITY",
  "NEGOTIATE_TERMS",
  "MANAGE_ALLOCATION",
  "MANAGE_DEVELOPER_INTEGRATION",
  "VIEW_DELIVERY_HEALTH",
  "EXPORT_INTEGRATION_DATA",
  "VIEW_CUSTOMER_OPERATIONS",
  "MANAGE_CUSTOMER_OPERATIONS",
  "CREATE_SERVICE_REQUEST",
  "EXPORT_CUSTOMER_DATA",
  "MANAGE_IDENTITY_CONNECTIONS",
  "MANAGE_SERVICE_IDENTITIES",
  "MANAGE_ACCESS_REVIEWS",
  "MANAGE_PARTICIPANT_EXIT",
] as const;

export type InstitutionAction = (typeof INSTITUTION_ACTIONS)[number];

export const STEP_UP_PURPOSES = [
  "PARTICIPANT_ADMISSION_PROPOSE",
  "PARTICIPANT_ADMISSION_REVIEW",
  "MEMBER_INVITE",
  "MEMBERSHIP_ACCEPT",
  "MEMBERSHIP_STATUS_CHANGE",
  "MANDATE_PROPOSE",
  "MANDATE_REVIEW",
  "MANDATE_STATUS_CHANGE",
  "APPOINTMENT_PROPOSE",
  "APPOINTMENT_ACCEPT",
  "APPOINTMENT_STATUS_CHANGE",
  "ROUTE_ENTITLEMENT_PROPOSE",
  "ROUTE_ENTITLEMENT_REVIEW",
  "ROUTE_ENTITLEMENT_STATUS_CHANGE",
  "SERVICE_PRINCIPAL_STATUS_CHANGE",
  "IDENTITY_CONNECTION_STATUS_CHANGE",
  "CONNECTOR_CERTIFICATION_PROPOSE",
  "CONNECTOR_CERTIFICATION_REVIEW",
  "EVIDENCE_LEGAL_HOLD_CHANGE",
  "CASE_CREATE",
  "CASE_VERSION_CREATE",
  "CASE_PARTY_CHANGE",
  "CASE_FUNCTION_ASSIGN",
  "CASE_CONDITION_CHANGE",
  "CASE_DECISION_PROPOSE",
  "CASE_DECISION_REVIEW",
  "CASE_TRANSITION",
  "ROOM_LEGACY_IMPORT",
  "ROOM_PARITY_REVIEW",
  "ROOM_AUTHORITY_PROPOSE",
  "ROOM_AUTHORITY_REVIEW",
  "ROOM_CREATE",
  "ROOM_INVITE",
  "ROOM_ACCEPT",
  "ROOM_CLOSE",
  "CONNECTOR_SUBJECT_PROPOSE",
  "CONNECTOR_SUBJECT_REVIEW",
  "SOURCE_COMPLETION_INITIATE",
  "SOURCE_COMPLETION_RECONCILE",
  "DA_REPLAY_AUTHORISATION_PROPOSE",
  "DA_REPLAY_AUTHORISATION_REVIEW",
  "DA_REPLAY_SAGA_CREATE",
  "DA_REPLAY_OBSERVATION_RECORD",
  "DA_REPLAY_LEG_RECONCILE",
  "DA_REPLAY_REPAIR_PROPOSE",
  "DA_REPLAY_REPAIR_REVIEW",
  "PTC_REPLAY_AUTHORISATION_PROPOSE",
  "PTC_REPLAY_AUTHORISATION_REVIEW",
  "PTC_REPLAY_SAGA_CREATE",
  "PTC_REPLAY_OBSERVATION_RECORD",
  "PTC_REPLAY_LEG_RECONCILE",
  "PTC_REPLAY_REPAIR_PROPOSE",
  "PTC_REPLAY_REPAIR_REVIEW",
  "LIFECYCLE_PLAN_CREATE",
  "LIFECYCLE_EVENT_RECORD",
  "LIFECYCLE_EVENT_RECONCILE",
  "TOKEN_REPRESENTATION_LINK",
  "TOKEN_ACTION_PREPARE",
  "TOKEN_ACTION_OBSERVE",
  "TOKEN_RECONCILIATION_RECORD",
  "TOKEN_CONNECTOR_BINDING_PROPOSE",
  "TOKEN_CONNECTOR_BINDING_REVIEW",
  "TOKEN_LIVE_ACTION_PREPARE",
  "TOKEN_CONNECTOR_SAFE_PAUSE",
  "PTC_TOKEN_REPRESENTATION_PROPOSE",
  "PTC_TOKEN_REPRESENTATION_REVIEW",
  "PTC_TOKEN_EVIDENCE_RECORD",
  "INTERNAL_ROLE_PROPOSE",
  "INTERNAL_ROLE_REVIEW",
  "INTERNAL_ROLE_REVOKE",
  "PRIVILEGED_ACCESS_REQUEST",
  "PRIVILEGED_ACCESS_REVIEW",
  "READINESS_GATE_PROPOSE",
  "READINESS_GATE_REVIEW",
  "DEPLOYMENT_ACTIVATION_REGISTER",
  "DEPLOYMENT_ACTIVATION_REVOKE",
  "COMMERCIAL_OPPORTUNITY_CREATE",
  "COMMERCIAL_TERM_CREATE",
  "COMMERCIAL_CHANGE_PROPOSE",
  "COMMERCIAL_CHANGE_REVIEW",
  "COMMERCIAL_AUDIENCE_INVITE",
  "COMMERCIAL_AUDIENCE_REVOKE",
  "COMMERCIAL_INTEREST_SUBMIT",
  "COMMERCIAL_INTEREST_WITHDRAW",
  "COMMERCIAL_RFQ_SUBMIT",
  "COMMERCIAL_RFQ_RESPOND",
  "COMMERCIAL_MESSAGE_POST",
  "COMMERCIAL_ALLOCATION_PROPOSE",
  "COMMERCIAL_ALLOCATION_REVIEW",
  "DEVELOPER_CLIENT_REGISTER",
  "DEVELOPER_CREDENTIAL_ROTATE",
  "DEVELOPER_CONFORMANCE_RUN",
  "DEVELOPER_WEBHOOK_REGISTER",
  "DEVELOPER_WEBHOOK_VERIFY",
  "DEVELOPER_WEBHOOK_REPLAY",
  "DEVELOPER_EXIT_EXPORT",
  "ENTERPRISE_PROFILE_PROPOSE",
  "ENTERPRISE_GATE_RECORD",
  "ENTERPRISE_PROFILE_REVIEW",
  "ENTERPRISE_HEALTH_RECORD",
  "ENTERPRISE_BINDING_PROPOSE",
  "ENTERPRISE_BINDING_REVIEW",
  "PRODUCTION_SCALE_ASSESS",
  "PRODUCTION_SCALE_REVIEW",
  "CUSTOMER_CONTRACT_ACKNOWLEDGE",
  "CUSTOMER_SERVICE_REQUEST_CREATE",
  "CUSTOMER_SERVICE_REQUEST_MESSAGE",
  "CUSTOMER_EXIT_EXPORT",
  "IDENTITY_CONNECTION_PROPOSE",
  "IDENTITY_CONNECTION_REVIEW",
  "SERVICE_IDENTITY_PROPOSE",
  "SERVICE_IDENTITY_REVIEW",
  "INSTITUTION_ACCESS_REVIEW_PROPOSE",
  "INSTITUTION_ACCESS_REVIEW_REVIEW",
  "PARTICIPANT_EXIT_PROPOSE",
  "PARTICIPANT_EXIT_REVIEW",
  "INTERNAL_CONTRACT_PROPOSE",
  "INTERNAL_CONTRACT_REVIEW",
  "INTERNAL_RATE_CARD_PROPOSE",
  "INTERNAL_RATE_CARD_REVIEW",
  "INTERNAL_USAGE_RECORD",
  "INTERNAL_INVOICE_PREPARE",
  "INTERNAL_INVOICE_REVIEW",
  "INTERNAL_CREDIT_PROPOSE",
  "INTERNAL_CREDIT_REVIEW",
  "INTERNAL_COHORT_MANAGE",
  "INTERNAL_SERVICE_MANAGE",
  "INTERNAL_OPERATIONAL_REVIEW",
  "COMMERCIAL_ALLOCATION_RESPOND",
  "COMMERCIAL_CASE_HANDOFF",
  "SECONDARY_TRANSFER_CREATE",
  "SECONDARY_TRANSFER_EVIDENCE_RECORD",
  "SECONDARY_TRANSFER_PROPOSE",
  "SECONDARY_TRANSFER_REVIEW",
  "SECONDARY_TRANSFER_REPAIR_PROPOSE",
  "SECONDARY_TRANSFER_REPAIR_REVIEW",
  "INTERNAL_CONDUCT_POLICY_PROPOSE",
  "INTERNAL_CONDUCT_POLICY_REVIEW",
  "INTERNAL_CONDUCT_SIGNAL_RECORD",
  "INTERNAL_CONDUCT_ALERT_REVIEW",
  "INTERNAL_CONDUCT_INVESTIGATION_CHANGE",
  "INTERNAL_CONDUCT_COMPLAINT_CHANGE",
  "INTERNAL_CONDUCT_CORRECTION_PROPOSE",
  "INTERNAL_CONDUCT_CORRECTION_REVIEW",
  "INTERNAL_CONDUCT_CONTROL_PROPOSE",
  "INTERNAL_CONDUCT_CONTROL_REVIEW",
  "INTERNAL_CAPACITY_BUDGET_CHANGE",
  "INTERNAL_CAPACITY_OBSERVATION_RECORD",
] as const;

export type StepUpPurpose = (typeof STEP_UP_PURPOSES)[number];

export interface AuthorityPolicyInput {
  now: Date;
  institutionStatus: string;
  admissionStatus: string | null;
  admissionEffectiveAt: Date | null;
  admissionExpiresAt: Date | null;
  memberStatus: string | null;
  memberEffectiveAt: Date | null;
  memberExpiresAt: Date | null;
  mandateStatus: string | null;
  mandateEffectiveAt: Date | null;
  mandateExpiresAt: Date | null;
  mandateAction: string | null;
  mandateScopeType: string | null;
  mandateScopeRef: string | null;
  requestedAction: InstitutionAction;
  requestedScopeType: string;
  requestedScopeRef?: string | null;
}

export interface PolicyDecision {
  allowed: boolean;
  code: string;
}

function activeDuring(
  now: Date,
  effectiveAt: Date | null,
  expiresAt: Date | null
): boolean {
  return (
    (!effectiveAt || effectiveAt.getTime() <= now.getTime()) &&
    (!expiresAt || expiresAt.getTime() > now.getTime())
  );
}

/**
 * Pure, fail-closed human-authority evaluation. Platform employment or a legacy global role is not
 * an input and therefore can never become participant authority through this policy.
 */
export function evaluateInstitutionAuthority(
  input: AuthorityPolicyInput
): PolicyDecision {
  if (input.institutionStatus !== "ACTIVE")
    return { allowed: false, code: "INSTITUTION_NOT_ACTIVE" };
  if (input.admissionStatus !== "ADMITTED")
    return { allowed: false, code: "PARTICIPANT_NOT_ADMITTED" };
  if (
    !activeDuring(
      input.now,
      input.admissionEffectiveAt,
      input.admissionExpiresAt
    )
  ) {
    return { allowed: false, code: "ADMISSION_OUTSIDE_EFFECTIVE_PERIOD" };
  }
  if (input.memberStatus !== "ACTIVE")
    return { allowed: false, code: "MEMBERSHIP_NOT_ACTIVE" };
  if (
    !activeDuring(input.now, input.memberEffectiveAt, input.memberExpiresAt)
  ) {
    return { allowed: false, code: "MEMBERSHIP_OUTSIDE_EFFECTIVE_PERIOD" };
  }
  if (input.mandateStatus !== "ACTIVE")
    return { allowed: false, code: "MANDATE_NOT_ACTIVE" };
  if (
    !activeDuring(input.now, input.mandateEffectiveAt, input.mandateExpiresAt)
  ) {
    return { allowed: false, code: "MANDATE_OUTSIDE_EFFECTIVE_PERIOD" };
  }
  if (input.mandateAction !== input.requestedAction)
    return { allowed: false, code: "ACTION_NOT_MANDATED" };
  // An explicitly institution-wide mandate may govern that institution's already-authorised child
  // resources. The calling service must first prove the resource belongs to the acting institution
  // or one of its active case-party relationships. A resource-scoped mandate never broadens this way.
  const institutionWide =
    input.mandateScopeType === "INSTITUTION" && input.mandateScopeRef === null;
  if (!institutionWide && input.mandateScopeType !== input.requestedScopeType)
    return { allowed: false, code: "SCOPE_TYPE_MISMATCH" };
  if (
    !institutionWide &&
    input.mandateScopeRef !== null &&
    input.mandateScopeRef !== (input.requestedScopeRef ?? null)
  ) {
    return { allowed: false, code: "SCOPE_REFERENCE_MISMATCH" };
  }
  return { allowed: true, code: "AUTHORISED" };
}

export interface EvidencePolicyInput {
  now: Date;
  result: string;
  signatureStatus: string;
  expiresAt: Date;
  crossCheckExpected: unknown;
  crossCheckAchieved: unknown;
}

function checkNames(value: unknown, achieved: boolean): Set<string> {
  if (Array.isArray(value)) {
    return new Set(
      value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.length > 0
      )
    );
  }
  if (!value || typeof value !== "object") return new Set();
  return new Set(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([, result]) =>
          !achieved ||
          result === true ||
          result === "VERIFIED" ||
          result === "ACHIEVED" ||
          Boolean(
            result &&
              typeof result === "object" &&
              ["VERIFIED", "ACHIEVED"].includes(
                String((result as Record<string, unknown>).result)
              )
          )
      )
      .map(([name]) => name)
  );
}

/** A retained signed snapshot remains usable during provider outage, but never beyond its expiry. */
export function evaluateInstitutionEvidence(
  input: EvidencePolicyInput
): PolicyDecision {
  if (input.expiresAt.getTime() <= input.now.getTime())
    return { allowed: false, code: "EVIDENCE_EXPIRED" };
  if (input.signatureStatus !== "VERIFIED")
    return { allowed: false, code: "SIGNATURE_NOT_VERIFIED" };
  if (input.result !== "VERIFIED")
    return { allowed: false, code: "EVIDENCE_NOT_VERIFIED" };

  const expected = checkNames(input.crossCheckExpected, false);
  const achieved = checkNames(input.crossCheckAchieved, true);
  if ([...expected].some((name) => !achieved.has(name))) {
    return { allowed: false, code: "EXPECTED_CROSS_CHECK_NOT_ACHIEVED" };
  }
  return { allowed: true, code: "EVIDENCE_ACCEPTABLE" };
}

export interface RouteEntitlementPolicyInput {
  now: Date;
  status: string;
  effectiveAt: Date | null;
  expiresAt: Date | null;
  transactionRoute: string;
  representation: string;
  assetClass: string;
  lifecycleLeg: string;
  materialFunction: string;
  functionPerformer: string;
  operatingModes: unknown;
  requested: {
    transactionRoute: string;
    representation: string;
    assetClass: string;
    lifecycleLeg: string;
    materialFunction: string;
    operatingMode: string;
  };
}

export function evaluateRouteEntitlement(
  input: RouteEntitlementPolicyInput
): PolicyDecision {
  if (
    input.status !== "ACTIVE" ||
    !activeDuring(input.now, input.effectiveAt, input.expiresAt)
  ) {
    return { allowed: false, code: "ROUTE_ENTITLEMENT_NOT_ACTIVE" };
  }
  const dimensions = [
    [input.transactionRoute, input.requested.transactionRoute],
    [input.representation, input.requested.representation],
    [input.assetClass, input.requested.assetClass],
    [input.lifecycleLeg, input.requested.lifecycleLeg],
    [input.materialFunction, input.requested.materialFunction],
  ];
  if (dimensions.some(([held, requested]) => held !== requested)) {
    return { allowed: false, code: "ROUTE_DIMENSION_MISMATCH" };
  }
  if (input.functionPerformer === "PROHIBITED")
    return { allowed: false, code: "FUNCTION_PROHIBITED" };
  const modes = Array.isArray(input.operatingModes) ? input.operatingModes : [];
  if (!modes.includes(input.requested.operatingMode))
    return { allowed: false, code: "OPERATING_MODE_NOT_ENTITLED" };
  return { allowed: true, code: "ROUTE_ENTITLED" };
}
