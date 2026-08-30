export const NEUTRAL_INGRESS_FLAG = "ARAIL_NEUTRAL_INGRESS_V1" as const;
export const NEUTRAL_INGRESS_VALUES = ["off", "shadow"] as const;
export type NeutralIngressMode = (typeof NEUTRAL_INGRESS_VALUES)[number];

export const DURABLE_RELAY_FLAG = "ARAIL_DURABLE_RELAY_MODE" as const;
export const DURABLE_RELAY_VALUES = ["legacy", "shadow", "durable"] as const;
export type DurableRelayMode = (typeof DURABLE_RELAY_VALUES)[number];

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
  errors: readonly string[];
} {
  const ingress = readFlag(env, NEUTRAL_INGRESS_FLAG, NEUTRAL_INGRESS_VALUES, "off");
  const relay = readFlag(env, DURABLE_RELAY_FLAG, DURABLE_RELAY_VALUES, "legacy");
  return {
    neutralIngress: ingress.value,
    durableRelay: relay.value,
    errors: [ingress.error, relay.error].filter((error): error is string => Boolean(error)),
  };
}
