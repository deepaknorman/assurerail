export const NEUTRAL_INGRESS_FLAG = "ARAIL_NEUTRAL_INGRESS_V1" as const;
export const NEUTRAL_INGRESS_VALUES = ["off", "shadow"] as const;
export type NeutralIngressMode = (typeof NEUTRAL_INGRESS_VALUES)[number];

export const DURABLE_RELAY_FLAG = "ARAIL_DURABLE_RELAY_MODE" as const;
export const DURABLE_RELAY_VALUES = ["legacy", "shadow", "durable"] as const;
export type DurableRelayMode = (typeof DURABLE_RELAY_VALUES)[number];

export const PARTICIPANT_ADMISSION_FLAG = "ARAIL_PARTICIPANT_ADMISSION_V1" as const;
export const PARTICIPANT_ADMISSION_VALUES = ["off", "shadow"] as const;
export type ParticipantAdmissionMode = (typeof PARTICIPANT_ADMISSION_VALUES)[number];

export const ROUTE_ENTITLEMENT_FLAG = "ARAIL_ROUTE_ENTITLEMENT_ENFORCE" as const;
export const ROUTE_ENTITLEMENT_VALUES = ["off", "compare"] as const;
export type RouteEntitlementMode = (typeof ROUTE_ENTITLEMENT_VALUES)[number];

export const TRANSACTION_CASE_FLAG = "ARAIL_TRANSACTION_CASE_V1" as const;
export const TRANSACTION_CASE_VALUES = ["off", "shadow"] as const;
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
    errors: [ingress.error, relay.error, admission.error, entitlement.error, transactionCase.error,
      roomReadSource.error, roomWriteSource.error, completionAcknowledgement.error, legacyRoomProxy.error]
      .filter((error): error is string => Boolean(error)),
  };
}
