import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { Prisma } from "@prisma/assurerail-client";
import { loadGoogleCreds } from "../auth/google-credentials";
import { sha256Digest } from "../contracts/v1";
import { PrismaService } from "../store/prisma.service";

export const FOUNDER_DEMO_ACCOUNT_KEYS = [
  "sellerCommercialAdmin",
  "sellerDataPreparer",
  "invoicePreparer",
  "invoiceChecker",
] as const;
type AccountKey = (typeof FOUNDER_DEMO_ACCOUNT_KEYS)[number];
type DemoAccount = { email: string; password: string; totpSecret: string; displayName: string };
type DemoFirebaseUser = Pick<UserRecord, "uid">;
export type FounderDemoConfig = {
  schemaVersion: 1;
  firebaseProjectId: string;
  institutionId: string;
  rotateExistingDemoPasswords: boolean;
  accounts: Record<AccountKey, DemoAccount>;
};

const DEMO_LEGAL_NAME = "AssureRail Synthetic EV Finance NBFC";
const SYNTHETIC_MARKER = "ASSURERAIL_FOUNDER_DEMO_V1";
const DEMO_UPLOAD_PROFILE_REF = "assurerail.neutral-intake.v1";
const DEMO_UPLOAD_SCHEMA_ID = "assurerail.neutral-intake";
const DEMO_UPLOAD_SCHEMA_VERSION = "1.0.0";
const DEMO_UPLOAD_RETENTION_DAYS = 365;
const digest = (value: unknown) => sha256Digest({ marker: SYNTHETIC_MARKER, value });

export function founderDemoSellerMandates(key: "sellerCommercialAdmin" | "sellerDataPreparer") {
  return key === "sellerCommercialAdmin"
    ? ["VIEW_CUSTOMER_OPERATIONS", "MANAGE_CUSTOMER_OPERATIONS", "VIEW_EVIDENCE"] as const
    : ["VIEW_CUSTOMER_OPERATIONS", "VIEW_EVIDENCE", "MANAGE_EVIDENCE"] as const;
}

export function founderDemoUploadProfile(institutionId: string) {
  return {
    connectorRegistrationId: `demo-connector-assessment-upload-${institutionId}`,
    schemaId: DEMO_UPLOAD_SCHEMA_ID,
    schemaVersion: DEMO_UPLOAD_SCHEMA_VERSION,
    retentionDays: DEMO_UPLOAD_RETENTION_DAYS,
  } as const;
}

function required(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`${name} is invalid`);
  return value.trim();
}

export function validateFounderDemoConfig(value: unknown): FounderDemoConfig {
  const input = value as Partial<FounderDemoConfig>;
  if (!input || input.schemaVersion !== 1 || typeof input.accounts !== "object" || !input.accounts) throw new Error("founder demo config schemaVersion 1 is required");
  const firebaseProjectId = required(input.firebaseProjectId, "firebaseProjectId", 160);
  const institutionId = required(input.institutionId, "institutionId", 160);
  if (!/^demo-[a-z0-9-]+$/.test(institutionId)) throw new Error("institutionId must use a demo-* synthetic identifier");
  const emails = new Set<string>();
  const accounts = {} as Record<AccountKey, DemoAccount>;
  for (const key of FOUNDER_DEMO_ACCOUNT_KEYS) {
    const raw = input.accounts[key] as DemoAccount | undefined;
    const email = required(raw?.email, `accounts.${key}.email`, 254).toLowerCase();
    const password = required(raw?.password, `accounts.${key}.password`, 200);
    const totpSecret = required(raw?.totpSecret, `accounts.${key}.totpSecret`, 200).replace(/\s/g, "").toUpperCase();
    const displayName = required(raw?.displayName, `accounts.${key}.displayName`, 120);
    if (!email.endsWith("@example.test")) throw new Error(`${key} must use the reserved example.test domain`);
    if (emails.has(email)) throw new Error("demo account emails must be unique");
    if (password.includes("REPLACE_") || password.length < 16) throw new Error(`${key} requires a non-placeholder password of at least 16 characters`);
    if (totpSecret.includes("REPLACE_") || !/^[A-Z2-7]{16,128}$/.test(totpSecret)) throw new Error(`${key} requires a non-placeholder base32 TOTP secret`);
    emails.add(email);
    accounts[key] = { email, password, totpSecret, displayName };
  }
  return { schemaVersion: 1, firebaseProjectId, institutionId, rotateExistingDemoPasswords: input.rotateExistingDemoPasswords === true, accounts };
}

export function readFounderDemoConfig(path: string): FounderDemoConfig {
  if (!isAbsolute(path)) throw new Error("ASSURERAIL_FOUNDER_DEMO_ACCOUNTS_FILE must be an absolute path");
  const info = statSync(path);
  if (!info.isFile() || (info.mode & 0o077) !== 0) throw new Error("founder demo account file must be a private regular file (chmod 600)");
  return validateFounderDemoConfig(JSON.parse(readFileSync(path, "utf8")));
}

async function firebaseUser(auth: ReturnType<typeof getAuth>, key: AccountKey, account: DemoAccount, rotatePassword: boolean): Promise<UserRecord> {
  let existing: UserRecord | null = null;
  try { existing = await auth.getUserByEmail(account.email); }
  catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") throw error; }
  if (existing) {
    if (existing.customClaims?.assurerailSyntheticDemo !== true || existing.customClaims?.assurerailDemoRole !== key) {
      throw new Error(`refusing to reuse non-demo Firebase identity ${account.email}`);
    }
    return auth.updateUser(existing.uid, { ...(rotatePassword ? { password: account.password } : {}), displayName: account.displayName, disabled: false, emailVerified: true });
  }
  const created = await auth.createUser({ email: account.email, password: account.password, displayName: account.displayName, disabled: false, emailVerified: true });
  await auth.setCustomUserClaims(created.uid, { assurerailSyntheticDemo: true, assurerailDemoRole: key });
  return auth.getUser(created.uid);
}

async function ensureMandate(db: Prisma.TransactionClient, input: { institutionId: string; memberId: string; action: string; userId: string }) {
  const id = `demo-mandate-${input.memberId}-${input.action.toLowerCase()}`;
  const existing = await db.authorityMandate.findUnique({ where: { memberId_action_scopeType_scopeKey_version: { memberId: input.memberId, action: input.action, scopeType: "INSTITUTION", scopeKey: `INSTITUTION:${input.institutionId}`, version: 1 } } });
  if (existing) {
    if (existing.id !== id || existing.institutionId !== input.institutionId || existing.delegationBasis !== SYNTHETIC_MARKER) throw new Error(`existing mandate conflicts with ${id}`);
    return db.authorityMandate.update({ where: { id }, data: {
      status: "ACTIVE", effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 90 * 86_400_000),
      suspendedAt: null, revokedAt: null,
    } });
  }
  return db.authorityMandate.create({ data: {
    id, institutionId: input.institutionId, memberId: input.memberId, action: input.action,
    scopeType: "INSTITUTION", scopeRef: input.institutionId, scopeKey: `INSTITUTION:${input.institutionId}`,
    limits: { syntheticDemoOnly: true }, conditions: { dataClassification: "SYNTHETIC_ONLY" },
    delegationBasis: SYNTHETIC_MARKER, authorityEvidenceRef: "demo://founder-initial-assessment/bootstrap",
    makerCheckerRequired: false, status: "ACTIVE", version: 1, proposedByUserId: "demo-bootstrap-maker",
    proposalStepUpId: "demo-bootstrap-stepup", approvedByUserId: "demo-bootstrap-checker",
    approvalStepUpId: "demo-bootstrap-review", approvalReason: "Synthetic founder demonstration only",
    effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 90 * 86_400_000),
  } });
}

async function ensureInternalAssignment(db: Prisma.TransactionClient, userId: string, role: "MANAGER" | "RISK_COMPLIANCE_OFFICER") {
  const id = `demo-internal-${role.toLowerCase()}-${userId}`;
  const existing = await db.internalRoleAssignment.findUnique({ where: { userId_role_scopeKey_version: { userId, role, scopeKey: "GLOBAL:*", version: 1 } } });
  if (existing) {
    if (existing.id !== id || existing.status !== "ACTIVE") throw new Error(`existing internal assignment conflicts with ${id}`);
    await db.internalRoleAssignment.update({ where: { id }, data: { expiresAt: new Date(Date.now() + 90 * 86_400_000) } });
    return;
  }
  await db.internalRoleAssignment.create({ data: {
    id, userId, role, scopeType: "GLOBAL", scopeRef: null, scopeKey: "GLOBAL:*", status: "ACTIVE", version: 1,
    reason: "Synthetic founder demonstration only", evidenceRef: "demo://founder-initial-assessment/bootstrap",
    proposalDigest: digest({ userId, role, scopeKey: "GLOBAL:*" }), proposedByUserId: "demo-bootstrap-maker",
    proposalStepUpId: "demo-bootstrap-stepup", approvedByUserId: "demo-bootstrap-checker",
    approvalStepUpId: "demo-bootstrap-review", approvalReason: "Synthetic founder demonstration only",
    effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 90 * 86_400_000),
  } });
}

export async function seedFounderDemoDatabase(config: FounderDemoConfig, users: Record<AccountKey, DemoFirebaseUser>) {
  const db = new PrismaService();
  await db.$connect();
  try {
    await db.$transaction(async tx => {
      const applicantUserId = `demo-user-${FOUNDER_DEMO_ACCOUNT_KEYS[0]}`;
      const institution = await tx.institution.findUnique({ where: { id: config.institutionId } });
      if (institution && (institution.legalName !== DEMO_LEGAL_NAME || institution.institutionKind !== "NBFC")) throw new Error("refusing to reuse a non-demo institution identifier");
      if (!institution) await tx.institution.create({ data: { id: config.institutionId, legalName: DEMO_LEGAL_NAME, institutionKind: "NBFC", jurisdiction: "IND", legalIdentifiers: { syntheticDemo: true, marker: SYNTHETIC_MARKER }, status: "ACTIVE", applicantUserId } });
      await tx.participantAdmission.upsert({
        where: { institutionId: config.institutionId },
        create: { id: `demo-admission-${config.institutionId}`, institutionId: config.institutionId, status: "ADMITTED", termsVersion: "DEMO-1", rulebookVersion: "DEMO-1", riskClass: "SYNTHETIC", applicationDigest: digest({ institutionId: config.institutionId, admission: true }), effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 90 * 86_400_000), decisionReason: "Synthetic founder demonstration only" },
        update: { status: "ADMITTED", effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 90 * 86_400_000), decisionReason: "Synthetic founder demonstration only" },
      });

      for (const key of FOUNDER_DEMO_ACCOUNT_KEYS) {
        const account = config.accounts[key], firebase = users[key], id = `demo-user-${key}`;
        const existing = await tx.venueUser.findUnique({ where: { email: account.email } });
        if (existing && existing.id !== id) throw new Error(`refusing to reuse existing venue account ${account.email}`);
        const existingId = await tx.venueUser.findUnique({ where: { id } });
        const expectedRole = key.startsWith("seller") ? "ISSUER" : "DESK";
        if (existingId && (existingId.email !== account.email || existingId.role !== expectedRole || (existingId.firebaseUid && existingId.firebaseUid !== firebase.uid))) throw new Error(`existing venue identity conflicts with ${id}`);
        await tx.venueUser.upsert({ where: { id }, create: {
          id, firebaseUid: firebase.uid, email: account.email, displayName: account.displayName,
          role: expectedRole, isAdmin: false,
          entityDid: key.startsWith("seller") ? `did:web:demo.assurerail.local:institution:${config.institutionId}` : null,
          entityRole: key === "sellerCommercialAdmin" ? "ORGADMIN" : key === "sellerDataPreparer" ? "OPERATOR" : null,
          allowlisted: true, status: "ACTIVE", identityProvider: "FIREBASE_DEMO_BOOTSTRAP",
          identitySubject: `demo:${firebase.uid}`, identityVerifiedAt: new Date(),
        }, update: { firebaseUid: firebase.uid, displayName: account.displayName, allowlisted: true, status: "ACTIVE", identityProvider: "FIREBASE_DEMO_BOOTSTRAP", identitySubject: `demo:${firebase.uid}`, identityVerifiedAt: new Date() } });
        const mfa = await tx.mfaEnrollment.findUnique({ where: { firebaseUid_method: { firebaseUid: firebase.uid, method: "TOTP" } } });
        if (mfa && mfa.secret !== account.totpSecret && !config.rotateExistingDemoPasswords) throw new Error(`TOTP secret differs for ${key}; explicit credential rotation is required`);
        await tx.mfaEnrollment.upsert({ where: { firebaseUid_method: { firebaseUid: firebase.uid, method: "TOTP" } }, create: { firebaseUid: firebase.uid, method: "TOTP", secret: account.totpSecret, verified: true, verifiedAt: new Date() }, update: { ...(config.rotateExistingDemoPasswords ? { secret: account.totpSecret } : {}), verified: true, verifiedAt: mfa?.verifiedAt ?? new Date() } });
      }

      for (const key of ["sellerCommercialAdmin", "sellerDataPreparer"] as const) {
        const userId = `demo-user-${key}`, memberId = `demo-member-${key}`;
        await tx.institutionMember.upsert({ where: { institutionId_userId: { institutionId: config.institutionId, userId } }, create: {
          id: memberId, institutionId: config.institutionId, userId, invitedEmail: config.accounts[key].email,
          membershipRole: key === "sellerCommercialAdmin" ? "ADMIN" : "MEMBER", status: "ACTIVE",
          invitedByUserId: "demo-bootstrap-maker", invitationDigest: digest({ key, institutionId: config.institutionId }),
          acceptedAt: new Date(), effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 90 * 86_400_000),
          bootstrapApprovedDecisionId: "demo-bootstrap-decision", recertificationDueAt: new Date(Date.now() + 60 * 86_400_000),
        }, update: { status: "ACTIVE", expiresAt: new Date(Date.now() + 90 * 86_400_000), recertificationDueAt: new Date(Date.now() + 60 * 86_400_000) } });
        const actions = founderDemoSellerMandates(key);
        for (const action of actions) await ensureMandate(tx, { institutionId: config.institutionId, memberId, action, userId });
        await tx.authorityMandate.updateMany({
          where: {
            institutionId: config.institutionId,
            memberId,
            status: "ACTIVE",
            delegationBasis: SYNTHETIC_MARKER,
            action: { notIn: [...actions] },
          },
          data: { status: "REVOKED", revokedAt: new Date() },
        });
      }
      await ensureInternalAssignment(tx, "demo-user-invoicePreparer", "MANAGER");
      await ensureInternalAssignment(tx, "demo-user-invoiceChecker", "RISK_COMPLIANCE_OFFICER");

      const uploadProfile = founderDemoUploadProfile(config.institutionId);
      const providerId = `demo-provider-assessment-upload-${config.institutionId}`;
      const providerKey = `founder-demo-assessment-upload-${config.institutionId}`;
      const provider = await tx.providerReference.findUnique({
        where: { providerType_providerKey: { providerType: "SYNTHETIC_DOCUMENT_UPLOAD", providerKey } },
      });
      if (provider && (provider.id !== providerId || provider.institutionId !== config.institutionId || provider.status !== "ACTIVE")) {
        throw new Error("existing founder-demo upload provider conflicts with the synthetic profile");
      }
      if (!provider) await tx.providerReference.create({ data: {
        id: providerId, providerKey, providerType: "SYNTHETIC_DOCUMENT_UPLOAD",
        displayName: "Founder demo assessment upload", status: "ACTIVE", institutionId: config.institutionId,
        metadata: { syntheticDemo: true, marker: SYNTHETIC_MARKER, networkAuthority: false },
      } });

      const connectorKey = "founder-demo-assessment-upload";
      const connector = await tx.connectorRegistration.findUnique({
        where: { institutionId_connectorKey: { institutionId: config.institutionId, connectorKey } },
      });
      const schemaProfiles = [{
        profileRef: DEMO_UPLOAD_PROFILE_REF,
        schemaId: uploadProfile.schemaId,
        schemaVersion: uploadProfile.schemaVersion,
      }];
      if (connector && (
        connector.id !== uploadProfile.connectorRegistrationId
        || connector.providerReferenceId !== providerId
        || connector.connectorType !== "ASSESSMENT_DOCUMENT_UPLOAD"
        || connector.transport !== "FILE"
        || connector.status !== "CERTIFIED_SHADOW"
        || digest(connector.schemaProfiles) !== digest(schemaProfiles)
      )) throw new Error("existing founder-demo upload connector conflicts with the synthetic profile");
      if (!connector) await tx.connectorRegistration.create({ data: {
        id: uploadProfile.connectorRegistrationId, institutionId: config.institutionId,
        providerReferenceId: providerId, connectorKey, connectorType: "ASSESSMENT_DOCUMENT_UPLOAD",
        displayName: "Founder demo assessment file upload", transport: "FILE", endpoint: null,
        schemaProfiles, credentialVaultRef: null, status: "CERTIFIED_SHADOW",
        createdByUserId: "demo-user-sellerDataPreparer",
      } });

      const certificationId = `demo-cert-assessment-upload-${config.institutionId}`;
      const certification = await tx.connectorCertification.findUnique({ where: { id: certificationId } });
      const certificationDigest = digest({
        connectorRegistrationId: uploadProfile.connectorRegistrationId,
        profileRef: DEMO_UPLOAD_PROFILE_REF,
        schemaId: uploadProfile.schemaId,
        schemaVersion: uploadProfile.schemaVersion,
        checks: ["synthetic-only", "file-transport", "object-store", "malware-scan"],
      });
      if (certification && (
        certification.connectorRegistrationId !== uploadProfile.connectorRegistrationId
        || certification.profileRef !== DEMO_UPLOAD_PROFILE_REF
        || certification.schemaId !== uploadProfile.schemaId
        || certification.schemaVersion !== uploadProfile.schemaVersion
        || certification.operatingMode !== "SHADOW"
        || certification.status !== "APPROVED"
        || certification.conformanceEvidenceDigest !== certificationDigest
      )) throw new Error("existing founder-demo upload certification conflicts with the synthetic profile");
      if (!certification) await tx.connectorCertification.create({ data: {
        id: certificationId, connectorRegistrationId: uploadProfile.connectorRegistrationId,
        profileRef: DEMO_UPLOAD_PROFILE_REF, schemaId: uploadProfile.schemaId,
        schemaVersion: uploadProfile.schemaVersion, operatingMode: "SHADOW", status: "APPROVED",
        conformanceEvidenceDigest: certificationDigest,
        conformanceResult: { passed: true, syntheticOnly: true, networkRoundTripPerformed: false },
        qualifications: [{ code: "SYNTHETIC_FOUNDER_DEMO_ONLY", severity: "LIMITATION" }],
        reason: "Bounded synthetic upload profile for the founder Initial Assessment demonstration",
        proposedByUserId: "demo-user-sellerDataPreparer", proposalStepUpId: "demo-upload-cert-propose",
        reviewedByUserId: "demo-user-invoiceChecker", reviewStepUpId: "demo-upload-cert-review",
        reviewReason: "Independent synthetic-demo profile review", effectiveAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 90 * 86_400_000),
      } });

      const contractId = `demo-contract-${config.institutionId}`, rateCardId = `demo-rate-${config.institutionId}`;
      const contract = await tx.customerContract.findUnique({ where: { id: contractId } });
      if (!contract) await tx.customerContract.create({ data: {
        id: contractId, institutionId: config.institutionId, contractRef: "FOUNDER-DEMO", version: 1,
        status: "ACTIVE_SHADOW", currency: "INR", currencyScale: 2,
        termsDigest: digest({ contract: "FOUNDER-DEMO", version: 1 }), termsEvidenceRef: "demo://founder-initial-assessment/terms",
        proposedByUserId: "demo-user-invoicePreparer", proposalStepUpId: "demo-contract-propose",
        reviewedByUserId: "demo-user-invoiceChecker", reviewStepUpId: "demo-contract-review",
        reviewReason: "Synthetic founder demonstration only", reviewedAt: new Date(),
        participantAcceptedByUserId: "demo-user-sellerCommercialAdmin",
        participantMandateId: "demo-mandate-demo-member-sellerCommercialAdmin-manage_customer_operations",
        participantStepUpId: "demo-contract-accept", participantAcceptedAt: new Date(),
        effectiveAt: new Date(Date.now() - 86_400_000), expiresAt: new Date(Date.now() + 180 * 86_400_000), renewalReviewAt: new Date(Date.now() + 150 * 86_400_000),
      } });
      const card = await tx.customerRateCard.findUnique({ where: { id: rateCardId } });
      if (!card) await tx.customerRateCard.create({ data: {
        id: rateCardId, customerContractId: contractId, version: 1, status: "APPROVED_SHADOW",
        effectiveAt: new Date(Date.now() - 86_400_000), expiresAt: new Date(Date.now() + 180 * 86_400_000),
        rateCardDigest: digest({ rateCard: "FOUNDER-DEMO", version: 1 }), proposedByUserId: "demo-user-invoicePreparer",
        proposalStepUpId: "demo-rate-propose", reviewedByUserId: "demo-user-invoiceChecker",
        reviewStepUpId: "demo-rate-review", reviewReason: "Synthetic founder demonstration only", reviewedAt: new Date(),
        feeRules: { create: [
          { id: `demo-fee-stage-${config.institutionId}`, transactionRoute: "DA", representation: "CONVENTIONAL", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", metric: "ENGAGEMENT_STAGE_FEE", feeBasis: "PER_UNIT_MINOR", rateValue: "1", roundingMode: "HALF_UP" },
          { id: `demo-fee-tax-${config.institutionId}`, transactionRoute: "DA", representation: "CONVENTIONAL", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", metric: "ENGAGEMENT_TAX", feeBasis: "NOTIONAL_BASIS_POINTS", rateValue: "1800", roundingMode: "HALF_UP" },
        ] },
      } });
    }, { isolationLevel: "Serializable" });
  } finally { await db.$disconnect(); }
}

export async function bootstrapFounderDemo() {
  if (process.env.ASSURERAIL_FOUNDER_DEMO_BOOTSTRAP !== "apply" || process.env.ASSURERAIL_DEMO_DATA_CLASSIFICATION !== "SYNTHETIC_ONLY" || process.env.ASSURERAIL_OPERATING_MODE !== "SHADOW") throw new Error("explicit SHADOW synthetic-demo bootstrap gates are required");
  const configPath = required(process.env.ASSURERAIL_FOUNDER_DEMO_ACCOUNTS_FILE, "ASSURERAIL_FOUNDER_DEMO_ACCOUNTS_FILE", 1_000);
  const config = readFounderDemoConfig(configPath);
  if (process.env.ASSURERAIL_FOUNDER_DEMO_TARGET !== `${config.firebaseProjectId}:${config.institutionId}`) throw new Error("ASSURERAIL_FOUNDER_DEMO_TARGET must exactly acknowledge the Firebase project and institution");
  const creds = loadGoogleCreds();
  if (!creds || creds.projectId !== config.firebaseProjectId) throw new Error("Firebase Admin credential does not match the acknowledged demo project");
  const appName = "assurerail-founder-demo-bootstrap";
  const app = getApps().find(candidate => candidate.name === appName) ?? initializeApp({ credential: cert({ projectId: creds.projectId, clientEmail: creds.clientEmail, privateKey: creds.privateKey }), projectId: creds.projectId }, appName);
  const auth = getAuth(app), users = {} as Record<AccountKey, UserRecord>;
  for (const key of FOUNDER_DEMO_ACCOUNT_KEYS) users[key] = await firebaseUser(auth, key, config.accounts[key], config.rotateExistingDemoPasswords);
  await seedFounderDemoDatabase(config, users);
  return { status: "READY", classification: "SYNTHETIC_ONLY", firebaseProjectId: config.firebaseProjectId, institutionId: config.institutionId, assessmentUploadProfile: { [config.institutionId]: founderDemoUploadProfile(config.institutionId) }, accounts: FOUNDER_DEMO_ACCOUNT_KEYS.map(key => ({ role: key, email: config.accounts[key].email, firebaseUid: users[key].uid })), passwordsPrinted: false, liveAuthorityGranted: false };
}

if (require.main === module) void bootstrapFounderDemo().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(`[FOUNDER-DEMO-BOOTSTRAP] FAILED: ${(error as Error).message}`); process.exitCode = 1; });
