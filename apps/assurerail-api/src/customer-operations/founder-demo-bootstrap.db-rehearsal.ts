import assert from "node:assert/strict";
import { PrismaService } from "../store/prisma.service";
import { FOUNDER_DEMO_ACCOUNT_KEYS, seedFounderDemoDatabase, validateFounderDemoConfig } from "./founder-demo-bootstrap";

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
    const [institution, venueUsers, mfa, members, activeMandates, assignments, contract, card] = await Promise.all([
      db.institution.findUnique({ where: { id: config.institutionId }, include: { admission: true } }),
      db.venueUser.findMany({ where: { id: { startsWith: "demo-user-" } } }),
      db.mfaEnrollment.findMany({ where: { firebaseUid: { startsWith: "firebase-" }, method: "TOTP", verified: true } }),
      db.institutionMember.findMany({ where: { institutionId: config.institutionId } }),
      db.authorityMandate.findMany({ where: { institutionId: config.institutionId, status: "ACTIVE" } }),
      db.internalRoleAssignment.findMany({ where: { id: { startsWith: "demo-internal-" }, status: "ACTIVE" } }),
      db.customerContract.findUnique({ where: { id: `demo-contract-${config.institutionId}` } }),
      db.customerRateCard.findUnique({ where: { id: `demo-rate-${config.institutionId}` }, include: { feeRules: true } }),
    ]);
    assert.equal(institution?.status, "ACTIVE");
    assert.equal(institution?.admission?.status, "ADMITTED");
    assert.equal(venueUsers.length, 4);
    assert.equal(mfa.length, 4);
    assert.equal(members.length, 2);
    assert.equal(activeMandates.length, 8);
    assert.deepEqual(assignments.map(item => item.role).sort(), ["MANAGER", "RISK_COMPLIANCE_OFFICER"]);
    assert.equal(contract?.status, "ACTIVE_SHADOW");
    assert.equal(card?.status, "APPROVED_SHADOW");
    assert.deepEqual(card?.feeRules.map(rule => rule.metric).sort(), ["ENGAGEMENT_STAGE_FEE", "ENGAGEMENT_TAX"]);
    console.log("[FOUNDER-DEMO-DB] PASS four identities, two participant memberships, eight mandates, independent invoice roles, active contract and rate card; second run idempotent");
  } finally { await db.$disconnect(); }
}

void main().catch(error => { console.error(`[FOUNDER-DEMO-DB] FAILED: ${(error as Error).message}`); process.exitCode = 1; });
