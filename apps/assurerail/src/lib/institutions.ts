import { vpost } from "./venue";

export type CapabilitySet = {
  view: boolean;
  administerMembers: boolean;
  proposeAuthority: boolean;
  approveAuthority: boolean;
  manageAppointments: boolean;
  proposeRouteEntitlement: boolean;
};

export type EvidenceSnapshot = {
  id: string;
  providerReferenceId: string | null;
  providerInstitutionRef: string;
  evidenceType: string;
  schemaId: string;
  schemaVersion: string;
  payloadDigest: string;
  signatureStatus: string;
  result: string;
  verificationMethod: string;
  independenceClass: string;
  crossCheckExpected: unknown;
  crossCheckAchieved: unknown;
  qualifications: unknown;
  sourceAsOfAt: string;
  expiresAt: string;
  supersedesSnapshotId: string | null;
  createdAt: string;
};

export type Mandate = {
  id: string;
  action: string;
  scopeType: string;
  scopeRef: string | null;
  limits: unknown;
  conditions: unknown;
  delegationBasis: string;
  authorityEvidenceRef: string;
  status: string;
  version: number;
  supersedesMandateId: string | null;
  proposedByUserId: string;
  approvedByUserId: string | null;
  approvalReason: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
};

export type InstitutionMember = {
  id: string;
  userId: string;
  invitedEmail: string;
  membershipRole: string;
  status: string;
  acceptedAt?: string | null;
  effectiveAt?: string | null;
  expiresAt: string | null;
  recertificationDueAt?: string | null;
  suspendedAt?: string | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
  mandates?: Mandate[];
};

export type Appointment = {
  id: string;
  institutionId?: string;
  direction?: "OUTGOING" | "INCOMING";
  transactionCaseId: string | null;
  appointmentRole: string;
  appointeeInstitutionId: string | null;
  appointeeProviderRef: string | null;
  scope: unknown;
  conflictDisclosure: unknown;
  status: string;
  proposedByUserId: string;
  acceptedByUserId: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
};

export type RouteEntitlement = {
  id: string;
  transactionRoute: string;
  representation: string;
  assetClass: string;
  lifecycleLeg: string;
  materialFunction: string;
  functionPerformer: string;
  routePackRef: string;
  permissionEvidenceRef: string;
  operatingModes: string[];
  limits: unknown;
  conditions: unknown;
  status: string;
  proposedByUserId: string;
  approvedByUserId: string | null;
  approvalReason: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
};

export type InstitutionWorkspace = {
  accessLevel: "APPLICATION" | "SELF" | "GOVERNANCE";
  capabilities: CapabilitySet;
  evidenceGaps: { code: string; message: string }[];
  connectorReadiness: { status: string; grantsAuthority: false; message: string };
  institution: {
    id: string;
    legalName: string;
    institutionKind: string;
    jurisdiction: string;
    legalIdentifiers?: unknown;
    status: string;
    suspensionReason?: string | null;
    suspendedAt?: string | null;
    revokedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    admission: {
      id?: string;
      status: string;
      termsVersion: string;
      rulebookVersion: string;
      riskClass?: string | null;
      reviewDueAt: string | null;
      effectiveAt: string | null;
      expiresAt: string | null;
      decisionReason: string | null;
      decisions?: AdmissionDecision[];
    } | null;
    evidenceSnapshots: EvidenceSnapshot[];
    members: InstitutionMember[];
    appointments: Appointment[];
    routeEntitlements: RouteEntitlement[];
    changeProposals: StatusChangeProposal[];
  };
};

export type AdmissionDecision = {
  id: string;
  decisionType: string;
  status: string;
  reason: string;
  proposedByUserId: string;
  reviewedByUserId?: string | null;
  proposedAt: string;
  reviewedAt?: string | null;
  reviewNote?: string | null;
};

export type StatusChangeProposal = {
  id: string;
  targetType: string;
  targetId: string;
  changeType: string;
  fromStatus: string;
  reason: string;
  status: string;
  proposedByUserId: string;
  proposedAt: string;
};

export type InstitutionListItem = {
  id: string;
  membershipRole: string;
  status: string;
  effectiveAt: string | null;
  expiresAt: string | null;
  institution: {
    id: string;
    legalName: string;
    institutionKind: string;
    jurisdiction: string;
    status: string;
    admission: { status: string; effectiveAt: string | null; expiresAt: string | null; reviewDueAt: string | null } | null;
  };
  mandates: Pick<Mandate, "id" | "action" | "scopeType" | "scopeRef" | "effectiveAt" | "expiresAt">[];
};

export type AdminQueue = {
  counts: { applications: number; admissionReviews: number; routeReviews: number };
  institutions: {
    id: string;
    legalName: string;
    institutionKind: string;
    jurisdiction: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    admission: {
      id: string;
      status: string;
      riskClass: string | null;
      reviewDueAt: string | null;
      effectiveAt: string | null;
      expiresAt: string | null;
      decisions: AdmissionDecision[];
    } | null;
    _count: { evidenceSnapshots: number; members: number; routeEntitlements: number };
    routeEntitlements: RouteEntitlement[];
  }[];
};

export type AdminInstitutionWorkspace = {
  institution: InstitutionWorkspace["institution"] & {
    applicantUserId?: string;
  };
  evidenceGaps: { code: string; message: string }[];
  operatorBoundary: {
    mayReviewAdmission: true;
    mayReviewRouteEntitlement: true;
    mayActForInstitution: false;
    supportImpersonationAvailable: false;
  };
};

export async function requestTotpStepUp(input: {
  code: string;
  purpose: string;
  institutionId: string;
  withoutInstitutionHeader?: boolean;
}): Promise<string> {
  const result = await vpost<{ stepUp: { id: string } | null }>("/venue/auth/mfa/verify/totp", {
    code: input.code,
    purpose: input.purpose,
    institutionId: input.institutionId,
  }, input.withoutInstitutionHeader ? { institutionId: null } : {});
  if (!result.stepUp?.id) throw new Error("The authenticator proof did not produce step-up evidence.");
  return result.stepUp.id;
}

export function readableJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
