/**
 * An anonymised reference outcome used to exercise a completed-deal replay shape. It contains no
 * customer assertion and is not evidence that a real transaction has been replayed or accepted.
 */
export const COMPLETED_DA_REFERENCE_REPLAY_V1 = Object.freeze({
  fixtureClass: "ANONYMISED_REFERENCE_OUTCOME",
  transferorInstitutionId: "institution-transferor-fixture",
  transfereeInstitutionId: "institution-transferee-fixture",
  recordkeeperInstitutionId: "institution-recordkeeper-fixture",
  legalMechanism: "ASSIGNMENT",
  consideration: { currency: "INR", units: "125000000", scale: 2 },
  transfereeCreditDecisionDigest: `sha256:${"1".repeat(64)}`,
  executedTransferDocumentDigest: `sha256:${"2".repeat(64)}`,
  expectedOutcome: {
    transferredAssetDigest: `sha256:${"3".repeat(64)}`,
    considerationReference: "historic-payment-reference-redacted",
    transferorSourceAfterDigest: `sha256:${"4".repeat(64)}`,
    transfereeSourceAfterDigest: `sha256:${"5".repeat(64)}`,
    authoritativeRecordAfterDigest: `sha256:${"6".repeat(64)}`,
  },
  authoritativeRecord: {
    recordType: "PARTICIPANT_LOAN_REGISTER",
    recordReference: "historic-register-reference-redacted",
    beforeDigest: `sha256:${"7".repeat(64)}`,
  },
  notices: [{
    noticeType: "SERVICER_RECORD_UPDATE",
    recipientInstitutionId: "institution-servicer-fixture",
    expectedAcknowledgementDigest: `sha256:${"8".repeat(64)}`,
  }],
});
