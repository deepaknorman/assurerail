import assert from "node:assert/strict";
import { PrismaService } from "../store/prisma.service";
import { FOUNDER_DEMO_ACCOUNT_KEYS, founderDemoUploadProfile, seedFounderDemoDatabase, validateFounderDemoConfig } from "./founder-demo-bootstrap";

async function main() {
  if (process.env.ASSURERAIL_DISPOSABLE_FOUNDER_DEMO_REHEARSAL !== "true" || !process.env.DATABASE_URL?.includes("127.0.0.1")) throw new Error("disposable local founder-demo rehearsal required");
  const accounts = Object.fromEntries(FOUNDER_DEMO_ACCOUNT_KEYS.map((key, index) => [key, { email: `rail-demo-${key.toLowerCase()}@example.test`, password: `Synthetic-Only-${index}-Password!`, totpSecret: `JBSWY3DPEHPK3PX${["A", "B", "C", "D"][index]}`, displayName: `Synthetic ${key}` }]));
  const config = validateFounderDemoConfig({ schemaVersion: 1, firebaseProjectId: "assurerail-demo-rehearsal", institutionId: "demo-nbfc-ev-001", rotateExistingDemoPasswords: false, accounts });
  const users = Object.fromEntries(FOUNDER_DEMO_ACCOUNT_KEYS.map(key => [key, { uid: `firebase-${key}` }])) as Parameters<typeof seedFounderDemoDatabase>[1];
  await seedFounderDemoDatabase(config, users);
  await seedFounderDemoDatabase(config, users);
  const db = new PrismaService();
  await db.$connect();
  try {
    const uploadProfile = founderDemoUploadProfile(config.institutionId);
    const [institution, venueUsers, mfa, members, activeMandates, assignments, contract, card, connector] = await Promise.all([
      db.institution.findUnique({ where: { id: config.institutionId }, include: { admission: true } }),
      db.venueUser.findMany({ where: { id: { startsWith: "demo-user-" } } }),
      db.mfaEnrollment.findMany({ where: { firebaseUid: { startsWith: "firebase-" }, method: "TOTP", verified: true } }),
      db.institutionMember.findMany({ where: { institutionId: config.institutionId } }),
      db.authorityMandate.findMany({ where: { institutionId: config.institutionId, status: "ACTIVE" } }),
      db.internalRoleAssignment.findMany({ where: { id: { startsWith: "demo-internal-" }, status: "ACTIVE" } }),
      db.customerContract.findUnique({ where: { id: `demo-contract-${config.institutionId}` } }),
      db.customerRateCard.findUnique({ where: { id: `demo-rate-${config.institutionId}` }, include: { feeRules: true } }),
      db.connectorRegistration.findUnique({ where: { id: uploadProfile.connectorRegistrationId }, include: { certifications: true } }),
    ]);
    assert.equal(institution?.status, "ACTIVE");
    assert.equal(institution?.admission?.status, "ADMITTED");
    assert.equal(venueUsers.length, 4);
    assert.equal(mfa.length, 4);
    assert.equal(members.length, 2);
    assert.equal(activeMandates.length, 6);
    const actionsByMember = Object.fromEntries(members.map(member => [member.id, activeMandates.filter(mandate => mandate.memberId === member.id).map(mandate => mandate.action).sort()]));
    assert.deepEqual(actionsByMember["demo-member-sellerCommercialAdmin"], ["MANAGE_CUSTOMER_OPERATIONS", "VIEW_CUSTOMER_OPERATIONS", "VIEW_EVIDENCE"]);
    assert.deepEqual(actionsByMember["demo-member-sellerDataPreparer"], ["MANAGE_EVIDENCE", "VIEW_CUSTOMER_OPERATIONS", "VIEW_EVIDENCE"]);
    assert.deepEqual(assignments.map(item => item.role).sort(), ["MANAGER", "RISK_COMPLIANCE_OFFICER"]);
    assert.equal(contract?.status, "ACTIVE_SHADOW");
    assert.equal(card?.status, "APPROVED_SHADOW");
    assert.deepEqual(card?.feeRules.map(rule => rule.metric).sort(), ["ENGAGEMENT_STAGE_FEE", "ENGAGEMENT_TAX"]);
    assert.equal(connector?.status, "CERTIFIED_SHADOW");
    assert.equal(connector?.providerReferenceId, `demo-provider-assessment-upload-${config.institutionId}`);
    assert.deepEqual(connector?.schemaProfiles, [{ profileRef: "assurerail.neutral-intake.v1", schemaId: uploadProfile.schemaId, schemaVersion: uploadProfile.schemaVersion }]);
    assert.equal(connector?.certifications.length, 1);
    assert.equal(connector?.certifications[0]?.status, "APPROVED");
    assert.equal(connector?.certifications[0]?.operatingMode, "SHADOW");
    console.log("[FOUNDER-DEMO-DB] PASS identities, separated commercial/evidence mandates, invoice roles, active contract/rate card and certified synthetic upload profile; second run idempotent");
  } finally { await db.$disconnect(); }
}

void main().catch(error => { console.error(`[FOUNDER-DEMO-DB] FAILED: ${(error as Error).message}`); process.exitCode = 1; });
