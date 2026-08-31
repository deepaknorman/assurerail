/**
 * Structural fixture only. It contains synthetic identifiers and digests, is not a completed
 * transaction, and must never be represented as historic PTC evidence or a route approval.
 */
import { sha256Digest } from "../../contracts/v1";
import type { ConventionalPtcReplayInput } from "../ptc-route-pack";

const digest = (value: string) => sha256Digest({ synthetic: "PTC_REPLAY_V1", value });

export const SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1: ConventionalPtcReplayInput = Object.freeze({
  originatorInstitutionId: "inst_originator_synthetic",
  trusteeInstitutionId: "inst_trustee_synthetic",
  recordkeeperInstitutionId: "inst_recordkeeper_synthetic",
  programmeTrust: {
    programmeOrTrustEvidenceDigest: digest("programme-trust"),
    trusteeAppointmentEvidenceDigest: digest("trustee-appointment"),
  },
  poolTransfer: {
    poolTransferEvidenceDigest: digest("pool-transfer"),
    poolEligibilityEvidenceDigest: digest("pool-eligibility"),
    poolDigest: digest("pool"),
  },
  requiredReviews: {
    counsel: {
      providerInstitutionId: "inst_counsel_synthetic",
      opinionEvidenceDigest: digest("counsel-opinion"),
    },
    rating: {
      providerInstitutionId: "inst_rating_synthetic",
      evidenceDigest: digest("rating"),
    },
    assurance: {
      providerInstitutionId: "inst_assurance_synthetic",
      appointmentEvidenceDigest: digest("assurance-appointment"),
      resultEvidenceDigest: digest("assurance-result"),
    },
  },
  issue: {
    executedDocumentsEvidenceDigest: digest("executed-documents"),
    trancheDefinitionDigest: digest("tranche-definition"),
    subscriptionEvidenceDigest: digest("subscription"),
    consideration: { currency: "INR", units: "125000000", scale: 2 },
    considerationReference: "synthetic-consideration-reference",
    trusteeControlDecisionDigest: digest("trustee-control"),
    allotmentEvidenceDigest: digest("allotment"),
  },
  authoritativeRecord: {
    recordType: "RTA_REGISTER",
    recordReference: "synthetic-rta-register-reference",
    declarationEvidenceDigest: digest("record-declaration"),
    beforeDigest: digest("record-before"),
    afterDigest: digest("record-after"),
  },
  lifecycleSetup: {
    servicerInstitutionId: "inst_servicer_synthetic",
    servicerAppointmentEvidenceDigest: digest("servicer-appointment"),
    collectionAccountEvidenceDigest: digest("collection-account"),
    requiredNoticeAcknowledgementDigest: digest("notice-acknowledgement"),
  },
});
