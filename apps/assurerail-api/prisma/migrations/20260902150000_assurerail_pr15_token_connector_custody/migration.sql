-- PR-15: provider-neutral token connector and custody assignment.
-- Bindings hold only external key/custody references and verified evidence digests. They do not
-- store private keys, confer legal title, or activate a capability without PR-12 gates.

CREATE TABLE "TokenConnectorBinding" (
  "id" TEXT NOT NULL,
  "tokenRepresentationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "connectorRegistrationId" TEXT NOT NULL,
  "connectorCertificationId" TEXT NOT NULL,
  "connectorProfileRef" TEXT NOT NULL,
  "custodyInstitutionId" TEXT NOT NULL,
  "custodyModel" TEXT NOT NULL,
  "signingKeyReference" TEXT NOT NULL,
  "signingPolicyDigest" TEXT NOT NULL,
  "supportedActionTypes" JSONB NOT NULL,
  "custodyEvidenceObjectId" TEXT NOT NULL,
  "custodyEvidenceDigest" TEXT NOT NULL,
  "legalFinalityEvidenceObjectId" TEXT NOT NULL,
  "legalFinalityEvidenceDigest" TEXT NOT NULL,
  "operatingAcceptanceEvidenceObjectId" TEXT NOT NULL,
  "operatingAcceptanceEvidenceDigest" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "proposalDigest" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL,
  "proposedByMandateId" TEXT NOT NULL,
  "proposalStepUpId" TEXT NOT NULL,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedByUserId" TEXT,
  "reviewedByMandateId" TEXT,
  "reviewStepUpId" TEXT,
  "reviewReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "suspendedByUserId" TEXT,
  "suspensionReason" TEXT,
  "suspendedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TokenConnectorBinding_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TokenAction" ADD COLUMN "connectorBindingId" TEXT;

CREATE UNIQUE INDEX "TokenConnectorBinding_representation_version_key" ON "TokenConnectorBinding"("tokenRepresentationId", "version");
CREATE UNIQUE INDEX "TokenConnectorBinding_representation_proposal_key" ON "TokenConnectorBinding"("tokenRepresentationId", "proposalDigest");
CREATE INDEX "TokenConnectorBinding_representation_status_idx" ON "TokenConnectorBinding"("tokenRepresentationId", "status", "effectiveAt");
CREATE INDEX "TokenConnectorBinding_connector_status_idx" ON "TokenConnectorBinding"("connectorRegistrationId", "status");
CREATE INDEX "TokenConnectorBinding_connectorCertificationId_idx" ON "TokenConnectorBinding"("connectorCertificationId");
CREATE INDEX "TokenConnectorBinding_custodyInstitutionId_status_idx" ON "TokenConnectorBinding"("custodyInstitutionId", "status");
CREATE INDEX "TokenAction_connector_state_idx" ON "TokenAction"("connectorBindingId", "state");

ALTER TABLE "TokenConnectorBinding" ADD CONSTRAINT "TokenConnectorBinding_tokenRepresentationId_fkey" FOREIGN KEY ("tokenRepresentationId") REFERENCES "TokenRepresentation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenConnectorBinding" ADD CONSTRAINT "TokenConnectorBinding_connectorRegistrationId_fkey" FOREIGN KEY ("connectorRegistrationId") REFERENCES "ConnectorRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenConnectorBinding" ADD CONSTRAINT "TokenConnectorBinding_connectorCertificationId_fkey" FOREIGN KEY ("connectorCertificationId") REFERENCES "ConnectorCertification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenConnectorBinding" ADD CONSTRAINT "TokenConnectorBinding_custodyInstitutionId_fkey" FOREIGN KEY ("custodyInstitutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenConnectorBinding" ADD CONSTRAINT "TokenConnectorBinding_custodyEvidenceObjectId_fkey" FOREIGN KEY ("custodyEvidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenConnectorBinding" ADD CONSTRAINT "TokenConnectorBinding_legalFinalityEvidenceObjectId_fkey" FOREIGN KEY ("legalFinalityEvidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenConnectorBinding" ADD CONSTRAINT "TokenConnectorBinding_operatingAcceptanceEvidenceObjectId_fkey" FOREIGN KEY ("operatingAcceptanceEvidenceObjectId") REFERENCES "EvidenceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TokenAction" ADD CONSTRAINT "TokenAction_connectorBindingId_fkey" FOREIGN KEY ("connectorBindingId") REFERENCES "TokenConnectorBinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
