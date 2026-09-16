import assert from "node:assert/strict";
import test from "node:test";
import { FakeBuyerSftpSandboxAdapter } from "./buyer-sftp.adapter";
import { BuyerSftpExportCoordinator, InMemoryBuyerSftpRepository } from "./buyer-sftp.domain";
import {
  BUYER_SFTP_BOUNDARY,
  buyerSftpProfileConfiguration,
  parseBuyerSftpProfiles,
  type BuyerSftpActor,
  type BuyerSftpProfile,
} from "./buyer-sftp.policy";
import { sha256Digest } from "../contracts/v1/canonical";

const buyer = "buyer_hdfc_sandbox";
const seller = "seller_nbfc_one";
const maker: BuyerSftpActor = { userId: "seller_maker", institutionId: seller, roles: ["SELLER_EXPORT_MAKER"], buyerScopes: [buyer], sellerScopes: [seller] };
const profileMaker: BuyerSftpActor = { userId: "rail_integrator", institutionId: "assurerail", roles: ["ASSURERAIL_INTEGRATION_OPERATOR"], buyerScopes: [buyer], sellerScopes: [seller] };
const checker: BuyerSftpActor = { userId: "rail_checker", institutionId: "assurerail", roles: ["ASSURERAIL_EXPORT_CHECKER"], buyerScopes: [buyer], sellerScopes: [seller] };
const operator: BuyerSftpActor = { userId: "rail_operator", institutionId: "assurerail", roles: ["ASSURERAIL_INTEGRATION_OPERATOR"], buyerScopes: [buyer], sellerScopes: [seller] };
const acknowledger: BuyerSftpActor = { userId: "buyer_ops", institutionId: buyer, roles: ["BUYER_ACKNOWLEDGER"], buyerScopes: [buyer], sellerScopes: [seller] };

const profileInput = {
  profileId: "hdfc_da_outbound",
  version: 1,
  buyerInstitutionId: buyer,
  environment: "SANDBOX" as const,
  host: "sftp-sandbox.bank.example",
  port: 22,
  username: "assurerail_uat",
  credentialKeyRef: "vault://rail/sftp/hdfc/uat/key",
  pinnedHostKeyFingerprint: `SHA256:${"A".repeat(43)}=`,
  outboundRoot: "/assurerail/outbound",
  acknowledgementRoot: "/assurerail/acknowledgements",
  schemaVersion: "da_v1",
  allowListedDocumentFamilies: ["LOAN_TAPE", "DOCUMENT_INDEX", "EXCEPTION_REGISTER"] as const,
  maximumFileBytes: 1024 * 1024,
  maximumBatchBytes: 20 * 1024 * 1024,
  retentionDays: 30,
  retryPolicy: { maximumAttempts: 3, initialDelaySeconds: 30, maximumDelaySeconds: 300 },
};

function fixture() {
  let clock = new Date("2026-09-17T10:00:00.000Z");
  const repository = new InMemoryBuyerSftpRepository();
  const adapter = new FakeBuyerSftpSandboxAdapter();
  const coordinator = new BuyerSftpExportCoordinator(repository, adapter, () => clock);
  const proposed = coordinator.proposeProfile(profileMaker, profileInput);
  const profile = coordinator.approveProfile(checker, proposed.profileId, proposed.version, "evidence://buyer-uat/hdfc-v1");
  const files = [
    { filename: "loan-tape.csv", documentFamily: "LOAN_TAPE" as const, mediaType: "text/csv", content: Buffer.from("loan_id,principal_minor\nL1,10000\n") },
    { filename: "document-index.json", documentFamily: "DOCUMENT_INDEX" as const, mediaType: "application/json", content: Buffer.from('{"version":1}') },
  ];
  return { repository, adapter, coordinator, profile, files, advance: (seconds: number) => { clock = new Date(clock.getTime() + seconds * 1000); } };
}

test("[SFTP][CONFIG] per-buyer profile pins the host and contains references rather than secrets", () => {
  const config = { ...profileInput, proposedByUserId: profileMaker.userId };
  const profile: BuyerSftpProfile = { ...config, status: "PROPOSED", approvedByUserId: null, buyerAcceptanceEvidenceRef: null, configurationDigest: sha256Digest(buyerSftpProfileConfiguration(config)) };
  assert.deepEqual(parseBuyerSftpProfiles(JSON.stringify([profile])), [profile]);
  assert.equal(BUYER_SFTP_BOUNDARY.productionDispatchPermitted, false);
  assert.equal(BUYER_SFTP_BOUNDARY.passwordAuthenticationPermitted, false);
  assert.throws(() => parseBuyerSftpProfiles(JSON.stringify([{ ...profile, environment: "PRODUCTION" }])), /production SFTP is not enabled/);
  const inlineKeyMaterial = ["----", "-BE", "GIN PRI", "VATE KEY", "-----"].join("");
  assert.throws(() => parseBuyerSftpProfiles(JSON.stringify([{ ...profile, credentialKeyRef: inlineKeyMaterial }])), /opaque secret-manager reference/);
  assert.throws(() => parseBuyerSftpProfiles(JSON.stringify([{ ...profile, pinnedHostKeyFingerprint: "" }])), /pinned/);
  assert.throws(() => parseBuyerSftpProfiles(JSON.stringify([{ ...profile, status: "UNREVIEWED" }])), /status is invalid/);
  assert.throws(() => parseBuyerSftpProfiles(JSON.stringify([profile, profile])), /must be unique/);
});

test("[SFTP][RBAC] profile and export approval require scoped independent actors", () => {
  const repository = new InMemoryBuyerSftpRepository();
  const coordinator = new BuyerSftpExportCoordinator(repository, new FakeBuyerSftpSandboxAdapter());
  const proposed = coordinator.proposeProfile(profileMaker, profileInput);
  assert.throws(() => coordinator.approveProfile({ ...checker, userId: profileMaker.userId }, proposed.profileId, 1, "evidence://buyer-uat/v1"), /cannot approve their own/);
  assert.throws(() => coordinator.approveProfile({ ...checker, buyerScopes: ["another_buyer"] }, proposed.profileId, 1, "evidence://buyer-uat/v1"), /outside the buyer scope/);
  const profile = coordinator.approveProfile(checker, proposed.profileId, 1, "evidence://buyer-uat/v1");
  assert.equal(profile.status, "APPROVED");
  assert.throws(() => coordinator.proposeExport({ ...maker, institutionId: "another_seller" }, { profileId: profile.profileId, profileVersion: 1, sellerInstitutionId: seller, engagementId: "eng_1", idempotencyKey: "request_1", files: [{ filename: "tape.csv", documentFamily: "LOAN_TAPE", mediaType: "text/csv", content: Buffer.from("x") }] }), /belong to the seller/);
});

test("[SFTP][MANIFEST] proposal is content-bound and idempotent within buyer, seller and profile scope", () => {
  const { coordinator, profile, files } = fixture();
  const request = { profileId: profile.profileId, profileVersion: profile.version, sellerInstitutionId: seller, engagementId: "eng_1", caseId: "case_1", idempotencyKey: "seller_upload_1", files };
  const first = coordinator.proposeExport(maker, request);
  const replay = coordinator.proposeExport(maker, request);
  assert.equal(replay.batchRef, first.batchRef);
  assert.match(first.remoteFolder, /^\/assurerail\/outbound\/seller_nbfc_one\/eng_1\/sftp_[a-f0-9]{32}$/);
  assert.equal(first.manifest.files.length, 2);
  assert.ok(first.manifest.files.every((file) => /^sha256:[a-f0-9]{64}$/.test(file.sha256Digest)));
  assert.throws(() => coordinator.proposeExport(maker, { ...request, files: [{ ...files[0], content: Buffer.from("changed") }] }), /idempotency key was already used/);
  assert.throws(() => coordinator.proposeExport(maker, { ...request, idempotencyKey: "not_allowed", files: [{ filename: "report.pdf", documentFamily: "ASSESSMENT_REPORT", mediaType: "application/pdf", content: Buffer.from("pdf") }] }), /not allow-listed/);
});

test("[SFTP][DELIVERY] exact approved bytes upload once and buyer acknowledgement covers every digest", async () => {
  const { repository, adapter, coordinator, profile, files } = fixture();
  let record = coordinator.proposeExport(maker, { profileId: profile.profileId, profileVersion: 1, sellerInstitutionId: seller, engagementId: "eng_2", idempotencyKey: "seller_upload_2", files });
  assert.throws(() => coordinator.approveExport({ ...checker, userId: maker.userId }, record.batchRef, record.manifestDigest), /cannot approve their own/);
  record = coordinator.approveExport(checker, record.batchRef, record.manifestDigest);
  await assert.rejects(() => coordinator.dispatch(operator, record.batchRef, [{ ...files[0], content: Buffer.from("tampered") }, files[1]]), /do not match/);
  record = await coordinator.dispatch(operator, record.batchRef, files);
  assert.equal(record.status, "AWAITING_ACKNOWLEDGEMENT");
  assert.equal(adapter.uploadCalls, 1);
  await assert.rejects(() => coordinator.dispatch(operator, record.batchRef, files), /not dispatchable/);
  const digests = record.manifest.files.map((file) => file.sha256Digest);
  assert.throws(() => coordinator.recordAcknowledgement(acknowledger, { acknowledgementRef: "ack_1", batchRef: record.batchRef, manifestDigest: record.manifestDigest, buyerInstitutionId: buyer, status: "ACCEPTED", acceptedFileDigests: digests.slice(0, 1), rejectedFiles: [], buyerObservedAt: "2026-09-17T10:02:00Z" }), /account for every file/);
  record = coordinator.recordAcknowledgement(acknowledger, { acknowledgementRef: "ack_1", batchRef: record.batchRef, manifestDigest: record.manifestDigest, buyerInstitutionId: buyer, status: "ACCEPTED", acceptedFileDigests: digests, rejectedFiles: [], buyerObservedAt: "2026-09-17T10:02:00Z" });
  assert.equal(record.status, "BUYER_ACCEPTED");
  const duplicate = coordinator.recordAcknowledgement(acknowledger, { acknowledgementRef: "ack_1", batchRef: record.batchRef, manifestDigest: record.manifestDigest, buyerInstitutionId: buyer, status: "ACCEPTED", acceptedFileDigests: digests, rejectedFiles: [], buyerObservedAt: "2026-09-17T10:02:00Z" });
  assert.equal(duplicate.acknowledgementDigest, record.acknowledgementDigest);
  assert.ok(repository.auditEvents().some((event) => event.eventType === "BUYER_SFTP_ACKNOWLEDGEMENT_RECORDED"));
  assert.doesNotMatch(JSON.stringify(repository.auditEvents()), /vault|private key|loan_id/iu);
});

test("[SFTP][REVOCATION] profile suspension safe-pauses an already approved batch", async () => {
  const { coordinator, profile, files } = fixture();
  let record = coordinator.proposeExport(maker, { profileId: profile.profileId, profileVersion: 1, sellerInstitutionId: seller, engagementId: "eng_5", idempotencyKey: "seller_upload_5", files });
  record = coordinator.approveExport(checker, record.batchRef, record.manifestDigest);
  coordinator.suspendProfile(checker, profile.profileId, profile.version, "HOST_KEY_ROTATION_PENDING");
  await assert.rejects(() => coordinator.dispatch(operator, record.batchRef, files), /no longer approved/);
});

test("[SFTP][AMBIGUOUS] unknown upload is never retried until remote reconciliation proves absence", async () => {
  const { adapter, coordinator, profile, files } = fixture();
  let record = coordinator.proposeExport(maker, { profileId: profile.profileId, profileVersion: 1, sellerInstitutionId: seller, engagementId: "eng_3", idempotencyKey: "seller_upload_3", files });
  record = coordinator.approveExport(checker, record.batchRef, record.manifestDigest);
  adapter.nextUploadOutcome = { outcome: "AMBIGUOUS", reasonCode: "SOCKET_CLOSED_AFTER_SEND" };
  record = await coordinator.dispatch(operator, record.batchRef, files);
  assert.equal(record.status, "AMBIGUOUS_REQUIRES_RECONCILIATION");
  await assert.rejects(() => coordinator.dispatch(operator, record.batchRef, files), /reconcile ambiguous outcomes first/);
  adapter.nextInspectionOutcome = { outcome: "ABSENT" };
  record = await coordinator.reconcileAmbiguous(operator, record.batchRef);
  assert.equal(record.status, "RETRYABLE");
  record = await coordinator.dispatch(operator, record.batchRef, files);
  assert.equal(record.status, "AWAITING_ACKNOWLEDGEMENT");
  assert.equal(adapter.uploadCalls, 2);
});

test("[SFTP][RETRY] retriable failure uses capped backoff and partial acknowledgement stays open", async () => {
  const { adapter, coordinator, profile, files, advance } = fixture();
  let record = coordinator.proposeExport(maker, { profileId: profile.profileId, profileVersion: 1, sellerInstitutionId: seller, engagementId: "eng_4", idempotencyKey: "seller_upload_4", files });
  record = coordinator.approveExport(checker, record.batchRef, record.manifestDigest);
  adapter.nextUploadOutcome = { outcome: "FAILED", reasonCode: "TEMPORARY_UNAVAILABLE", retriable: true };
  record = await coordinator.dispatch(operator, record.batchRef, files);
  assert.equal(record.status, "RETRYABLE");
  await assert.rejects(() => coordinator.dispatch(operator, record.batchRef, files), /backoff/);
  advance(30);
  record = await coordinator.dispatch(operator, record.batchRef, files);
  const [accepted, rejected] = record.manifest.files.map((file) => file.sha256Digest);
  record = coordinator.recordAcknowledgement(acknowledger, { acknowledgementRef: "ack_partial", batchRef: record.batchRef, manifestDigest: record.manifestDigest, buyerInstitutionId: buyer, status: "PARTIAL", acceptedFileDigests: [accepted], rejectedFiles: [{ fileDigest: rejected, reasonCode: "INVALID_SCHEMA" }], buyerObservedAt: "2026-09-17T10:05:00Z" });
  assert.equal(record.status, "PARTIAL_REQUIRES_RECONCILIATION");
});
