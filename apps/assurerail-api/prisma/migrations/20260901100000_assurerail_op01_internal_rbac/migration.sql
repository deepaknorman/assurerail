-- OP-01a: additive internal-staff RBAC/elevation evidence. This does not alter legacy platformRole
-- behaviour, grant anyone an assignment or change participant/case authority.

CREATE TABLE "InternalRoleAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeRef" TEXT,
  "scopeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "reason" TEXT NOT NULL,
  "evidenceRef" TEXT,
  "proposalDigest" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL,
  "proposalStepUpId" TEXT,
  "approvedByUserId" TEXT,
  "approvalStepUpId" TEXT,
  "approvalReason" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "supersedesId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivilegedAccessRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestedPermission" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeRef" TEXT,
  "scopeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "reason" TEXT NOT NULL,
  "ticketRef" TEXT NOT NULL,
  "riskClass" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "requestedByUserId" TEXT NOT NULL,
  "requestStepUpId" TEXT,
  "approvedByUserId" TEXT,
  "approvalStepUpId" TEXT,
  "approvalReason" TEXT,
  "deniedByUserId" TEXT,
  "deniedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivilegedAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalAccessEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "internalRoleAssignmentId" TEXT,
  "privilegedAccessRequestId" TEXT,
  "eventType" TEXT NOT NULL,
  "permission" TEXT,
  "scopeType" TEXT,
  "scopeRef" TEXT,
  "requestId" TEXT,
  "reason" TEXT,
  "payloadDigest" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalAccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalRoleAssignment_proposalDigest_key" ON "InternalRoleAssignment"("proposalDigest");
CREATE UNIQUE INDEX "InternalRoleAssignment_userId_role_scopeKey_version_key" ON "InternalRoleAssignment"("userId", "role", "scopeKey", "version");
CREATE INDEX "InternalRoleAssignment_userId_status_expiresAt_idx" ON "InternalRoleAssignment"("userId", "status", "expiresAt");
CREATE INDEX "InternalRoleAssignment_role_status_scopeType_scopeRef_idx" ON "InternalRoleAssignment"("role", "status", "scopeType", "scopeRef");
CREATE INDEX "InternalRoleAssignment_proposedByUserId_createdAt_idx" ON "InternalRoleAssignment"("proposedByUserId", "createdAt");
CREATE INDEX "PrivilegedAccessRequest_userId_status_expiresAt_idx" ON "PrivilegedAccessRequest"("userId", "status", "expiresAt");
CREATE INDEX "PrivilegedAccessRequest_status_scopeType_scopeRef_idx" ON "PrivilegedAccessRequest"("status", "scopeType", "scopeRef");
CREATE INDEX "PrivilegedAccessRequest_ticketRef_idx" ON "PrivilegedAccessRequest"("ticketRef");
CREATE INDEX "InternalAccessEvent_userId_occurredAt_idx" ON "InternalAccessEvent"("userId", "occurredAt");
CREATE INDEX "InternalAccessEvent_internalRoleAssignmentId_occurredAt_idx" ON "InternalAccessEvent"("internalRoleAssignmentId", "occurredAt");
CREATE INDEX "InternalAccessEvent_privilegedAccessRequestId_occurredAt_idx" ON "InternalAccessEvent"("privilegedAccessRequestId", "occurredAt");
CREATE INDEX "InternalAccessEvent_eventType_occurredAt_idx" ON "InternalAccessEvent"("eventType", "occurredAt");

ALTER TABLE "InternalRoleAssignment" ADD CONSTRAINT "InternalRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VenueUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivilegedAccessRequest" ADD CONSTRAINT "PrivilegedAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VenueUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalAccessEvent" ADD CONSTRAINT "InternalAccessEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VenueUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalAccessEvent" ADD CONSTRAINT "InternalAccessEvent_internalRoleAssignmentId_fkey" FOREIGN KEY ("internalRoleAssignmentId") REFERENCES "InternalRoleAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalAccessEvent" ADD CONSTRAINT "InternalAccessEvent_privilegedAccessRequestId_fkey" FOREIGN KEY ("privilegedAccessRequestId") REFERENCES "PrivilegedAccessRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
