export const NEUTRAL_INGRESS_FLAG = "ARAIL_NEUTRAL_INGRESS_V1" as const;
export const NEUTRAL_INGRESS_VALUES = ["off", "shadow", "on"] as const;
export type NeutralIngressMode = (typeof NEUTRAL_INGRESS_VALUES)[number];

export const DURABLE_RELAY_FLAG = "ARAIL_DURABLE_RELAY_MODE" as const;
export const DURABLE_RELAY_VALUES = ["legacy", "shadow", "durable"] as const;
export type DurableRelayMode = (typeof DURABLE_RELAY_VALUES)[number];

export const PARTICIPANT_ADMISSION_FLAG = "ARAIL_PARTICIPANT_ADMISSION_V1" as const;
export const PARTICIPANT_ADMISSION_VALUES = ["off", "shadow", "enforce"] as const;
export type ParticipantAdmissionMode = (typeof PARTICIPANT_ADMISSION_VALUES)[number];

export const ROUTE_ENTITLEMENT_FLAG = "ARAIL_ROUTE_ENTITLEMENT_ENFORCE" as const;
export const ROUTE_ENTITLEMENT_VALUES = ["off", "compare", "enforce"] as const;
export type RouteEntitlementMode = (typeof ROUTE_ENTITLEMENT_VALUES)[number];

export const TRANSACTION_CASE_FLAG = "ARAIL_TRANSACTION_CASE_V1" as const;
export const TRANSACTION_CASE_VALUES = ["off", "shadow", "on"] as const;
export type TransactionCaseMode = (typeof TRANSACTION_CASE_VALUES)[number];

export const ROOM_READ_SOURCE_FLAG = "ARAIL_ROOM_READ_SOURCE" as const;
export const ROOM_READ_SOURCE_VALUES = ["legacy", "compare", "rail"] as const;
export type RoomReadSource = (typeof ROOM_READ_SOURCE_VALUES)[number];

export const ROOM_WRITE_SOURCE_FLAG = "ARAIL_ROOM_WRITE_SOURCE" as const;
export const ROOM_WRITE_SOURCE_VALUES = ["legacy", "rail"] as const;
export type RoomWriteSource = (typeof ROOM_WRITE_SOURCE_VALUES)[number];

export const COMPLETION_ACK_FLAG = "ARAIL_COMPLETION_ACK_V1" as const;
export const COMPLETION_ACK_VALUES = ["off", "shadow", "on"] as const;
export type CompletionAcknowledgementMode = (typeof COMPLETION_ACK_VALUES)[number];

export const LEGACY_ROOM_PROXY_FLAG = "ARAIL_LEGACY_ROOM_PROXY_V1" as const;
export const LEGACY_ROOM_PROXY_VALUES = ["off", "shadow"] as const;
export type LegacyRoomProxyMode = (typeof LEGACY_ROOM_PROXY_VALUES)[number];

export const EXTERNAL_ACTION_SAGA_FLAG = "ARAIL_EXTERNAL_ACTION_SAGA_V1" as const;
export const EXTERNAL_ACTION_SAGA_VALUES = ["off", "shadow", "required"] as const;
export type ExternalActionSagaMode = (typeof EXTERNAL_ACTION_SAGA_VALUES)[number];

export const DA_REPLAY_FLAG = "ARAIL_DA_REPLAY_V1" as const;
export const DA_REPLAY_VALUES = ["off", "allow_list"] as const;
export type DaReplayMode = (typeof DA_REPLAY_VALUES)[number];

export const PTC_REPLAY_FLAG = "ARAIL_PTC_REPLAY_V1" as const;
export const PTC_REPLAY_VALUES = ["off", "allow_list"] as const;
export type PtcReplayMode = (typeof PTC_REPLAY_VALUES)[number];

export const TOKENISED_DA_FLAG = "ARAIL_TOKENISED_DA_V1" as const;
export const TOKENISED_DA_VALUES = ["off", "allow_list", "live"] as const;
export type TokenisedDaMode = (typeof TOKENISED_DA_VALUES)[number];

export const TOKENISED_PTC_FLAG = "ARAIL_TOKENISED_PTC_V1" as const;
export const TOKENISED_PTC_VALUES = ["off", "shadow"] as const;
export type TokenisedPtcMode = (typeof TOKENISED_PTC_VALUES)[number];

export const PRIMARY_COMMERCIAL_FLAG = "ARAIL_PRIMARY_COMMERCIAL_V1" as const;
export const PRIMARY_COMMERCIAL_VALUES = ["off", "shadow"] as const;
export type PrimaryCommercialMode = (typeof PRIMARY_COMMERCIAL_VALUES)[number];

export const CONVENTIONAL_SECONDARY_FLAG = "ARAIL_CONVENTIONAL_SECONDARY_V1" as const;
export const CONVENTIONAL_SECONDARY_VALUES = ["off", "shadow"] as const;
export type ConventionalSecondaryMode = (typeof CONVENTIONAL_SECONDARY_VALUES)[number];

export const VENUE_CONDUCT_FLAG = "ARAIL_VENUE_CONDUCT_V1" as const;
export const VENUE_CONDUCT_VALUES = ["off", "shadow"] as const;
export type VenueConductMode = (typeof VENUE_CONDUCT_VALUES)[number];

export const DEVELOPER_PORTAL_FLAG = "ARAIL_DEVELOPER_PORTAL_V1" as const;
export const DEVELOPER_PORTAL_VALUES = ["off", "shadow"] as const;
export type DeveloperPortalMode = (typeof DEVELOPER_PORTAL_VALUES)[number];

export const CUSTOMER_OPERATIONS_FLAG = "ARAIL_CUSTOMER_OPERATIONS_V1" as const;
export const CUSTOMER_OPERATIONS_VALUES = ["off", "shadow"] as const;
export type CustomerOperationsMode = (typeof CUSTOMER_OPERATIONS_VALUES)[number];

export const HOSTED_ALPHA_FLAG = "ARAIL_HOSTED_ALPHA_V1" as const;
export const HOSTED_ALPHA_VALUES = ["off", "shadow"] as const;
export type HostedAlphaMode = (typeof HOSTED_ALPHA_VALUES)[number];

export const INSTITUTIONAL_PRODUCT_FLAG = "ARAIL_INSTITUTIONAL_PRODUCT_V1" as const;
export const INSTITUTIONAL_PRODUCT_VALUES = ["off", "shadow"] as const;
export type InstitutionalProductMode = (typeof INSTITUTIONAL_PRODUCT_VALUES)[number];

export const DA_PRODUCT_FLAG = "ARAIL_DA_PRODUCT_V1" as const;
export const DA_PRODUCT_VALUES = ["off", "shadow"] as const;
export type DaProductMode = (typeof DA_PRODUCT_VALUES)[number];

// OP-01 internal-control-plane rollout. Shadow evaluates and records the new policy without
// replacing the legacy bootstrap role gate; enforcement is a separately approved cutover.
export const INTERNAL_RBAC_FLAG = "ARAIL_INTERNAL_RBAC_V1" as const;
export const INTERNAL_RBAC_VALUES = ["off", "shadow", "enforce"] as const;
export type InternalRbacMode = (typeof INTERNAL_RBAC_VALUES)[number];

type Environment = Readonly<Record<string, string | undefined>>;

function readFlag<T extends string>(
  env: Environment,
  key: string,
  allowed: readonly T[],
  fallback: T,
): { value: T; error?: string } {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return { value: fallback };
  const normalized = raw.trim().toLowerCase().replaceAll("-", "_") as T;
  if (allowed.includes(normalized)) return { value: normalized };
  return {
    value: fallback,
    error: `${key} must be ${allowed.map((value) => JSON.stringify(value)).join(" or ")} (received ${JSON.stringify(raw)})`,
  };
}

export function inspectPersistenceFlags(env: Environment): {
  neutralIngress: NeutralIngressMode;
  durableRelay: DurableRelayMode;
  participantAdmission: ParticipantAdmissionMode;
  routeEntitlement: RouteEntitlementMode;
  transactionCase: TransactionCaseMode;
  roomReadSource: RoomReadSource;
  roomWriteSource: RoomWriteSource;
  completionAcknowledgement: CompletionAcknowledgementMode;
  legacyRoomProxy: LegacyRoomProxyMode;
  externalActionSaga: ExternalActionSagaMode;
  daReplay: DaReplayMode;
  ptcReplay: PtcReplayMode;
  tokenisedDa: TokenisedDaMode;
  tokenisedPtc: TokenisedPtcMode;
  primaryCommercial: PrimaryCommercialMode;
  conventionalSecondary: ConventionalSecondaryMode;
  venueConduct: VenueConductMode;
  developerPortal: DeveloperPortalMode;
  customerOperations: CustomerOperationsMode;
  hostedAlpha: HostedAlphaMode;
  institutionalProduct: InstitutionalProductMode;
  daProduct: DaProductMode;
  internalRbac: InternalRbacMode;
  errors: readonly string[];
} {
  const ingress = readFlag(env, NEUTRAL_INGRESS_FLAG, NEUTRAL_INGRESS_VALUES, "off");
  const relay = readFlag(env, DURABLE_RELAY_FLAG, DURABLE_RELAY_VALUES, "legacy");
  const admission = readFlag(env, PARTICIPANT_ADMISSION_FLAG, PARTICIPANT_ADMISSION_VALUES, "off");
  const entitlement = readFlag(env, ROUTE_ENTITLEMENT_FLAG, ROUTE_ENTITLEMENT_VALUES, "off");
  const transactionCase = readFlag(env, TRANSACTION_CASE_FLAG, TRANSACTION_CASE_VALUES, "off");
  const roomReadSource = readFlag(env, ROOM_READ_SOURCE_FLAG, ROOM_READ_SOURCE_VALUES, "legacy");
  const roomWriteSource = readFlag(env, ROOM_WRITE_SOURCE_FLAG, ROOM_WRITE_SOURCE_VALUES, "legacy");
  const completionAcknowledgement = readFlag(env, COMPLETION_ACK_FLAG, COMPLETION_ACK_VALUES, "off");
  const legacyRoomProxy = readFlag(env, LEGACY_ROOM_PROXY_FLAG, LEGACY_ROOM_PROXY_VALUES, "off");
  const externalActionSaga = readFlag(env, EXTERNAL_ACTION_SAGA_FLAG, EXTERNAL_ACTION_SAGA_VALUES, "off");
  const daReplay = readFlag(env, DA_REPLAY_FLAG, DA_REPLAY_VALUES, "off");
  const ptcReplay = readFlag(env, PTC_REPLAY_FLAG, PTC_REPLAY_VALUES, "off");
  const tokenisedDa = readFlag(env, TOKENISED_DA_FLAG, TOKENISED_DA_VALUES, "off");
  const tokenisedPtc = readFlag(env, TOKENISED_PTC_FLAG, TOKENISED_PTC_VALUES, "off");
  const primaryCommercial = readFlag(env, PRIMARY_COMMERCIAL_FLAG, PRIMARY_COMMERCIAL_VALUES, "off");
  const conventionalSecondary = readFlag(env, CONVENTIONAL_SECONDARY_FLAG, CONVENTIONAL_SECONDARY_VALUES, "off");
  const venueConduct = readFlag(env, VENUE_CONDUCT_FLAG, VENUE_CONDUCT_VALUES, "off");
  const developerPortal = readFlag(env, DEVELOPER_PORTAL_FLAG, DEVELOPER_PORTAL_VALUES, "off");
  const customerOperations = readFlag(env, CUSTOMER_OPERATIONS_FLAG, CUSTOMER_OPERATIONS_VALUES, "off");
  const hostedAlpha = readFlag(env, HOSTED_ALPHA_FLAG, HOSTED_ALPHA_VALUES, "off");
  const institutionalProduct = readFlag(env, INSTITUTIONAL_PRODUCT_FLAG, INSTITUTIONAL_PRODUCT_VALUES, "off");
  const daProduct = readFlag(env, DA_PRODUCT_FLAG, DA_PRODUCT_VALUES, "off");
  const internalRbac = readFlag(env, INTERNAL_RBAC_FLAG, INTERNAL_RBAC_VALUES, "off");
  return {
    neutralIngress: ingress.value,
    durableRelay: relay.value,
    participantAdmission: admission.value,
    routeEntitlement: entitlement.value,
    transactionCase: transactionCase.value,
    roomReadSource: roomReadSource.value,
    roomWriteSource: roomWriteSource.value,
    completionAcknowledgement: completionAcknowledgement.value,
    legacyRoomProxy: legacyRoomProxy.value,
    externalActionSaga: externalActionSaga.value,
    daReplay: daReplay.value,
    ptcReplay: ptcReplay.value,
    tokenisedDa: tokenisedDa.value,
    tokenisedPtc: tokenisedPtc.value,
    primaryCommercial: primaryCommercial.value,
    conventionalSecondary: conventionalSecondary.value,
    venueConduct: venueConduct.value,
    developerPortal: developerPortal.value,
    customerOperations: customerOperations.value,
    hostedAlpha: hostedAlpha.value,
    institutionalProduct: institutionalProduct.value,
    daProduct: daProduct.value,
    internalRbac: internalRbac.value,
    errors: [ingress.error, relay.error, admission.error, entitlement.error, transactionCase.error,
      roomReadSource.error, roomWriteSource.error, completionAcknowledgement.error, legacyRoomProxy.error,
      externalActionSaga.error, daReplay.error, ptcReplay.error, tokenisedDa.error, tokenisedPtc.error, primaryCommercial.error,
      conventionalSecondary.error, venueConduct.error, developerPortal.error, customerOperations.error, hostedAlpha.error, institutionalProduct.error, daProduct.error,
      internalRbac.error]
      .filter((error): error is string => Boolean(error)),
  };
}
