-- PR-03 introduces Rail-local institution/admission/authority records. Existing global entity fields
-- remain available to legacy callers, but their projection below is deliberately non-admitted and
-- receives no mandate or route entitlement.

ALTER TABLE "VenueUser"
  ADD COLUMN "identityProvider" TEXT,
  ADD COLUMN "identitySubject" TEXT,
  ADD COLUMN "identityVerifiedAt" TIMESTAMP(3);

UPDATE "VenueUser"
SET
  "identityProvider" = 'ASSURELOCKER_DIGIKYC',
  "identitySubject" = "did",
  "identityVerifiedAt" = "updatedAt"
WHERE "did" IS NOT NULL;

ALTER TABLE "VenueSession"
  ADD COLUMN "activeInstitutionId" TEXT,
  ADD COLUMN "credentialAssurance" TEXT,
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revocationReason" TEXT,
  ADD COLUMN "securityContext" JSONB;

CREATE INDEX "VenueSession_activeInstitutionId_idx" ON "VenueSession"("activeInstitutionId");
CREATE INDEX "VenueSession_revokedAt_idx" ON "VenueSession"("revokedAt");

CREATE TABLE "Institution" (
  "id" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "institutionKind" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "legalIdentifiers" JSONB NOT NULL,
  "legacyEntityRef" TEXT,
  "status" TEXT NOT NULL DEFAULT 'APPLICANT',
  "applicantUserId" TEXT NOT NULL,
  "suspensionReason" TEXT,
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Institution_legacyEntityRef_key" ON "Institution"("legacyEntityRef");
CREATE INDEX "Institution_status_idx" ON "Institution"("status");
CREATE INDEX "Institution_applicantUserId_idx" ON "Institution"("applicantUserId");

CREATE TABLE "ParticipantAdmission" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'APPLIED',
  "termsVersion" TEXT NOT NULL,
  "rulebookVersion" TEXT NOT NULL,
  "riskClass" TEXT,
  "applicationDigest" TEXT NOT NULL,
  "reviewDueAt" TIMESTAMP(3),
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParticipantAdmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParticipantAdmission_institutionId_key" ON "ParticipantAdmission"("institutionId");
CREATE INDEX "ParticipantAdmission_status_createdAt_idx" ON "ParticipantAdmission"("status", "createdAt");
CREATE INDEX "ParticipantAdmission_reviewDueAt_idx" ON "ParticipantAdmission"("reviewDueAt");

CREATE TABLE "ParticipantAdmissionDecision" (
  "id" TEXT NOT NULL,
  "participantAdmissionId" TEXT NOT NULL,
  "decisionType" TEXT NOT NULL,
  "fromAdmissionStatus" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "evidenceSnapshotIds" JSONB NOT NULL,
  "proposedRiskClass" TEXT,
  "proposedExpiresAt" TIMESTAMP(3),
  "proposedReviewDueAt" TIMESTAMP(3),
  "proposalDigest" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewNote" TEXT,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "ParticipantAdmissionDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdmissionDecision_admission_status_idx"
  ON "ParticipantAdmissionDecision"("participantAdmissionId", "status");
CREATE INDEX "ParticipantAdmissionDecision_proposedByUserId_idx"
  ON "ParticipantAdmissionDecision"("proposedByUserId");
CREATE UNIQUE INDEX "AdmissionDecision_one_pending_per_admission_key"
  ON "ParticipantAdmissionDecision"("participantAdmissionId") WHERE "status"='PENDING';

CREATE TABLE "InstitutionMember" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "invitedEmail" TEXT NOT NULL,
  "membershipRole" TEXT NOT NULL DEFAULT 'MEMBER',
  "status" TEXT NOT NULL DEFAULT 'INVITED',
  "invitedByUserId" TEXT,
  "invitationDigest" TEXT,
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "legacyEntityRole" TEXT,
  "bootstrapApprovedDecisionId" TEXT,
  "recertificationDueAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstitutionMember_institutionId_userId_key"
  ON "InstitutionMember"("institutionId", "userId");
CREATE INDEX "InstitutionMember_institutionId_status_idx" ON "InstitutionMember"("institutionId", "status");
CREATE INDEX "InstitutionMember_userId_status_idx" ON "InstitutionMember"("userId", "status");
CREATE INDEX "InstitutionMember_invitedEmail_idx" ON "InstitutionMember"("invitedEmail");

CREATE TABLE "StepUpEvidence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "firebaseUid" TEXT NOT NULL,
  "institutionId" TEXT,
  "method" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "assuranceContext" JSONB NOT NULL,
  "evidenceDigest" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "StepUpEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StepUpEvidence_evidenceDigest_key" ON "StepUpEvidence"("evidenceDigest");
CREATE INDEX "StepUpEvidence_userId_purpose_expiresAt_idx" ON "StepUpEvidence"("userId", "purpose", "expiresAt");
CREATE INDEX "StepUpEvidence_sessionId_expiresAt_idx" ON "StepUpEvidence"("sessionId", "expiresAt");
CREATE INDEX "StepUpEvidence_institutionId_expiresAt_idx" ON "StepUpEvidence"("institutionId", "expiresAt");
CREATE INDEX "StepUpEvidence_firebaseUid_idx" ON "StepUpEvidence"("firebaseUid");

CREATE TABLE "InstitutionEvidenceSnapshot" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "providerReferenceId" TEXT,
  "providerInstitutionRef" TEXT NOT NULL,
  "evidenceType" TEXT NOT NULL,
  "schemaId" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "payloadDigest" TEXT NOT NULL,
  "signatureStatus" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "verificationMethod" TEXT NOT NULL,
  "independenceClass" TEXT NOT NULL,
  "assertions" JSONB NOT NULL,
  "crossCheckExpected" JSONB NOT NULL,
  "crossCheckAchieved" JSONB NOT NULL,
  "qualifications" JSONB NOT NULL,
  "sourceAsOfAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "supersedesSnapshotId" TEXT,
  "storageRef" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionEvidenceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstitutionEvidenceSnapshot_institutionId_payloadDigest_key"
  ON "InstitutionEvidenceSnapshot"("institutionId", "payloadDigest");
CREATE INDEX "InstitutionEvidence_institution_type_asOf_idx"
  ON "InstitutionEvidenceSnapshot"("institutionId", "evidenceType", "sourceAsOfAt");
CREATE INDEX "InstitutionEvidenceSnapshot_providerReferenceId_idx"
  ON "InstitutionEvidenceSnapshot"("providerReferenceId");
CREATE INDEX "InstitutionEvidenceSnapshot_expiresAt_idx" ON "InstitutionEvidenceSnapshot"("expiresAt");

CREATE TABLE "AuthorityMandate" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeRef" TEXT,
  "scopeKey" TEXT NOT NULL,
  "limits" JSONB NOT NULL,
  "conditions" JSONB NOT NULL,
  "delegationBasis" TEXT NOT NULL,
  "authorityEvidenceRef" TEXT NOT NULL,
  "makerCheckerRequired" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "supersedesMandateId" TEXT,
  "proposedByUserId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvalStepUpId" TEXT,
  "approvalReason" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorityMandate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthorityMandate_member_action_scope_version_key"
  ON "AuthorityMandate"("memberId", "action", "scopeType", "scopeKey", "version");
CREATE UNIQUE INDEX "AuthorityMandate_one_pending_scope_key"
  ON "AuthorityMandate"("memberId", "action", "scopeType", "scopeKey") WHERE "status"='PROPOSED';
CREATE INDEX "AuthorityMandate_institutionId_status_idx" ON "AuthorityMandate"("institutionId", "status");
CREATE INDEX "AuthorityMandate_memberId_action_status_idx" ON "AuthorityMandate"("memberId", "action", "status");
CREATE INDEX "AuthorityMandate_expiresAt_idx" ON "AuthorityMandate"("expiresAt");

CREATE TABLE "Appointment" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "transactionCaseId" TEXT,
  "appointmentRole" TEXT NOT NULL,
  "appointeeInstitutionId" TEXT,
  "appointeeProviderRef" TEXT,
  "scope" JSONB NOT NULL,
  "conflictDisclosure" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "proposedByUserId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "acceptanceStepUpId" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appointment_institutionId_status_idx" ON "Appointment"("institutionId", "status");
CREATE INDEX "Appointment_appointeeInstitutionId_status_idx" ON "Appointment"("appointeeInstitutionId", "status");
CREATE INDEX "Appointment_transactionCaseId_idx" ON "Appointment"("transactionCaseId");

CREATE TABLE "RouteEntitlement" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "transactionRoute" TEXT NOT NULL,
  "representation" TEXT NOT NULL,
  "assetClass" TEXT NOT NULL,
  "lifecycleLeg" TEXT NOT NULL,
  "materialFunction" TEXT NOT NULL,
  "functionPerformer" TEXT NOT NULL,
  "routePackRef" TEXT NOT NULL,
  "permissionEvidenceRef" TEXT NOT NULL,
  "operatingModes" JSONB NOT NULL,
  "limits" JSONB NOT NULL,
  "conditions" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "proposedByUserId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvalStepUpId" TEXT,
  "approvalReason" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RouteEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RouteEntitlement_institutionId_status_idx" ON "RouteEntitlement"("institutionId", "status");
CREATE INDEX "RouteEntitlement_route_function_status_idx"
  ON "RouteEntitlement"("institutionId", "transactionRoute", "representation", "materialFunction", "status");
CREATE INDEX "RouteEntitlement_expiresAt_idx" ON "RouteEntitlement"("expiresAt");

CREATE TABLE "InstitutionServicePrincipal" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "credentialVaultRef" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "allowedActions" JSONB NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionServicePrincipal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstitutionServicePrincipal_clientId_key" ON "InstitutionServicePrincipal"("clientId");
CREATE INDEX "InstitutionServicePrincipal_institutionId_status_idx"
  ON "InstitutionServicePrincipal"("institutionId", "status");
CREATE INDEX "InstitutionServicePrincipal_expiresAt_idx" ON "InstitutionServicePrincipal"("expiresAt");

CREATE TABLE "InstitutionChangeProposal" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "changeType" TEXT NOT NULL,
  "fromStatus" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "proposalPayload" JSONB NOT NULL,
  "proposalDigest" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "proposedByUserId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewNote" TEXT,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "InstitutionChangeProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstitutionChangeProposal_institutionId_status_idx"
  ON "InstitutionChangeProposal"("institutionId", "status");
CREATE INDEX "InstitutionChangeProposal_targetType_targetId_status_idx"
  ON "InstitutionChangeProposal"("targetType", "targetId", "status");
CREATE UNIQUE INDEX "InstitutionChangeProposal_one_pending_target_key"
  ON "InstitutionChangeProposal"("targetType", "targetId") WHERE "status"='PENDING';

ALTER TABLE "ParticipantAdmission"
  ADD CONSTRAINT "ParticipantAdmission_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParticipantAdmissionDecision"
  ADD CONSTRAINT "AdmissionDecision_admissionId_fkey"
  FOREIGN KEY ("participantAdmissionId") REFERENCES "ParticipantAdmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstitutionMember"
  ADD CONSTRAINT "InstitutionMember_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InstitutionMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "VenueUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StepUpEvidence"
  ADD CONSTRAINT "StepUpEvidence_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "VenueUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StepUpEvidence_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "VenueSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstitutionEvidenceSnapshot"
  ADD CONSTRAINT "InstitutionEvidenceSnapshot_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InstitutionEvidenceSnapshot_providerReferenceId_fkey"
  FOREIGN KEY ("providerReferenceId") REFERENCES "ProviderReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorityMandate"
  ADD CONSTRAINT "AuthorityMandate_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AuthorityMandate_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "InstitutionMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteEntitlement"
  ADD CONSTRAINT "RouteEntitlement_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstitutionServicePrincipal"
  ADD CONSTRAINT "InstitutionServicePrincipal_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstitutionChangeProposal"
  ADD CONSTRAINT "InstitutionChangeProposal_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reversible compatibility projection: legacy entityDid/entityRole values become inert reference-only
-- institutions/members. They deliberately receive NOT_ADMITTED and no AuthorityMandate.
INSERT INTO "Institution" (
  "id", "legalName", "institutionKind", "jurisdiction", "legalIdentifiers", "legacyEntityRef",
  "status", "applicantUserId", "createdAt", "updatedAt"
)
SELECT
  'inst_legacy_' || encode(sha256(convert_to("entityDid", 'UTF8')), 'hex'),
  'Legacy institution projection',
  'OTHER_APPROVED_INSTITUTION',
  'UNDECLARED',
  jsonb_build_object('legacyEntityRef', "entityDid"),
  "entityDid",
  'LEGACY_REFERENCE_ONLY',
  min("id"),
  min("createdAt"),
  CURRENT_TIMESTAMP
FROM "VenueUser"
WHERE "entityDid" IS NOT NULL AND btrim("entityDid") <> ''
GROUP BY "entityDid"
ON CONFLICT ("legacyEntityRef") DO NOTHING;

INSERT INTO "ParticipantAdmission" (
  "id", "institutionId", "status", "termsVersion", "rulebookVersion", "applicationDigest",
  "decisionReason", "createdAt", "updatedAt"
)
SELECT
  'padm_legacy_' || encode(sha256(convert_to(i."legacyEntityRef", 'UTF8')), 'hex'),
  i."id",
  'NOT_ADMITTED',
  'LEGACY_NOT_ACCEPTED',
  'LEGACY_NOT_ACCEPTED',
  'sha256:' || repeat('0', 64),
  'Legacy VenueUser projection only; grants no Rail admission or authority',
  i."createdAt",
  CURRENT_TIMESTAMP
FROM "Institution" i
WHERE i."status" = 'LEGACY_REFERENCE_ONLY'
ON CONFLICT ("institutionId") DO NOTHING;

INSERT INTO "InstitutionMember" (
  "id", "institutionId", "userId", "invitedEmail", "membershipRole", "status",
  "legacyEntityRole", "invitedAt", "createdAt", "updatedAt"
)
SELECT
  'imem_legacy_' || encode(sha256(convert_to(u."entityDid" || ':' || u."id", 'UTF8')), 'hex'),
  i."id",
  u."id",
  u."email",
  'LEGACY_PROJECTED',
  'LEGACY_PROJECTED',
  u."entityRole",
  u."createdAt",
  u."createdAt",
  CURRENT_TIMESTAMP
FROM "VenueUser" u
JOIN "Institution" i ON i."legacyEntityRef" = u."entityDid"
WHERE u."entityDid" IS NOT NULL AND btrim(u."entityDid") <> ''
ON CONFLICT ("institutionId", "userId") DO NOTHING;
