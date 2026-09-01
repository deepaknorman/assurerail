import { sha256Digest } from "../contracts/v1";

export const TOKENISED_PTC_ROUTE_PACK = Object.freeze({
  ref: "assurerail://route-packs/domestic-tokenised-ptc-shadow",
  version: "1.0.0",
  route: "PTC", representation: "TOKENISED", marketContext: "DOMESTIC",
  placementOrListing: "PRIVATE_PLACEMENT", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
  operatingModes: ["REPLAY", "SHADOW"] as const, authorityMode: "MIRROR" as const,
});

export const PTC_TOKEN_GATE_SPECS = Object.freeze([
  ["HISTORIC_PTC_REPLAY_ACCEPTED", "HISTORIC_PTC_REPLAY_ACCEPTANCE", "ORIGINATOR"],
  ["PROGRAMME_TRUST", "PROGRAMME_OR_TRUST", "TRUSTEE"],
  ["TRUSTEE_APPOINTMENT", "TRUSTEE_APPOINTMENT", "TRUSTEE"],
  ["POOL_TRANSFER_ELIGIBILITY", "POOL_TRANSFER_AND_ELIGIBILITY", "ORIGINATOR"],
  ["CLASS_TRANCHE_DOCUMENTS", "PTC_CLASS_TRANCHE_DOCUMENTS", "TRUSTEE"],
  ["SUBSCRIPTION_CONSIDERATION", "PTC_SUBSCRIPTION_CONSIDERATION", "ORIGINATOR"],
  ["TRUSTEE_TRANSACTION_CONTROL", "TRUSTEE_TRANSACTION_CONTROL", "TRUSTEE"],
  ["ALLOTMENT", "PTC_ALLOTMENT", "TRUSTEE"],
  ["ASSURANCE_APPOINTMENT", "ASSURANCE_APPOINTMENT", "TRUSTEE"],
  ["ASSURANCE_RESULT", "ASSURANCE_RESULT", "ASSURANCE"],
  ["AUTHORITATIVE_RECORD_ACK", "AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT", "RECORDKEEPER"],
  ["TRUSTEE_RECORD_RECONCILIATION", "PTC_TRUSTEE_RECORD_RECONCILIATION", "TRUSTEE"],
  ["TOKEN_LEGAL_FINALITY", "PTC_TOKEN_LEGAL_FINALITY", "TRUSTEE"],
  ["TOKEN_CUSTODY_OPERATING", "PTC_TOKEN_CUSTODY_OPERATING_ACCEPTANCE", "TRUSTEE"],
] as const);

export const PTC_TOKEN_ACTIONS = Object.freeze([
  ["ISSUE", "assurerail.ptc.token.issue.v1"],
  ["TRANSFER", "assurerail.ptc.token.transfer.v1"],
  ["DISTRIBUTION", "assurerail.ptc.token.distribution.v1"],
  ["LIFECYCLE_ANCHOR", "assurerail.ptc.token.lifecycle-anchor.v1"],
  ["BURN", "assurerail.ptc.token.burn.v1"],
] as const);

export function ptcTokenPlanDigest(representationId: string, actionType: string, gates: readonly string[]): string {
  return sha256Digest({ representationId, actionType, authorityMode: "MIRROR", blockingGateCodes: [...gates].sort(), dispatchProhibited: true });
}
