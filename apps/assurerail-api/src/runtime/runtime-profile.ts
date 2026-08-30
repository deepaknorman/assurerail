import {
  inspectPersistenceFlags,
  type CompletionAcknowledgementMode,
  type DurableRelayMode,
  type LegacyRoomProxyMode,
  type NeutralIngressMode,
  type ParticipantAdmissionMode,
  type RouteEntitlementMode,
  type RoomReadSource,
  type RoomWriteSource,
  type TransactionCaseMode,
} from "../persistence/feature-flags";

export const ASSURERAIL_OPERATING_MODES = [
  "DEMO",
  "REPLAY",
  "SHADOW",
  "SANDBOX",
  "CONTROLLED_LIVE",
  "PRODUCTION",
] as const;

export type AssureRailOperatingMode = (typeof ASSURERAIL_OPERATING_MODES)[number];
export type AdapterMode = "demo" | "live";

export interface RuntimeEnvironmentProfile {
  operatingMode: AssureRailOperatingMode;
  demoEndpointsEnabled: boolean;
  persistentStoreRequired: boolean;
  authenticatedRuntimeRequired: boolean;
  liveExternalActionsRequired: boolean;
  adapters: {
    tape: AdapterMode;
    hts: AdapterMode;
    hcs: AdapterMode;
    settlement: AdapterMode;
    digiKyc: AdapterMode;
  };
  features: {
    neutralIngress: NeutralIngressMode;
    durableRelay: DurableRelayMode;
    participantAdmission: ParticipantAdmissionMode;
    routeEntitlement: RouteEntitlementMode;
    transactionCase: TransactionCaseMode;
    roomReadSource: RoomReadSource;
    roomWriteSource: RoomWriteSource;
    completionAcknowledgement: CompletionAcknowledgementMode;
    legacyRoomProxy: LegacyRoomProxyMode;
  };
}

export interface RuntimeEnvironmentInspection {
  profile: RuntimeEnvironmentProfile;
  errors: string[];
}

export class RuntimeConfigurationError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`AssureRail runtime configuration rejected:\n- ${errors.join("\n- ")}`);
    this.name = "RuntimeConfigurationError";
    this.errors = [...errors];
  }
}

type Environment = Readonly<Record<string, string | undefined>>;

const MODE_SET = new Set<string>(ASSURERAIL_OPERATING_MODES);
const ADAPTER_MODES = new Set<string>(["demo", "live"]);

function normaliseOperatingMode(raw: string | undefined, nodeEnv: string | undefined): {
  mode: AssureRailOperatingMode;
  error?: string;
} {
  const candidate = (raw ?? (nodeEnv === "production" ? "PRODUCTION" : "DEMO"))
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (MODE_SET.has(candidate)) return { mode: candidate as AssureRailOperatingMode };
  return {
    mode: "DEMO",
    error: `ASSURERAIL_OPERATING_MODE must be one of ${ASSURERAIL_OPERATING_MODES.join(", ")} (received ${JSON.stringify(raw)})`,
  };
}

function booleanValue(
  env: Environment,
  key: string,
  defaultValue: boolean,
  errors: string[],
): boolean {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return defaultValue;
  if (raw.toLowerCase() === "true") return true;
  if (raw.toLowerCase() === "false") return false;
  errors.push(`${key} must be "true" or "false" (received ${JSON.stringify(raw)})`);
  return defaultValue;
}

function adapterValue(
  env: Environment,
  key: string,
  defaultValue: AdapterMode,
  errors: string[],
): AdapterMode {
  const raw = (env[key] ?? defaultValue).trim().toLowerCase();
  if (ADAPTER_MODES.has(raw)) return raw as AdapterMode;
  errors.push(`${key} must be "demo" or "live" (received ${JSON.stringify(env[key])})`);
  return defaultValue;
}

function requirePresent(env: Environment, key: string, errors: string[], reason: string): void {
  if (!env[key]?.trim()) errors.push(`${key} is required ${reason}`);
}

function validateFirebaseAdminConfig(env: Environment, errors: string[]): void {
  const encoded = env.FIREBASE_ADMIN_CONFIG?.trim();
  if (!encoded) return;
  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Record<string, unknown>;
    if (!decoded.project_id || !decoded.client_email || !decoded.private_key) {
      throw new Error("missing project_id/client_email/private_key");
    }
  } catch {
    errors.push("FIREBASE_ADMIN_CONFIG must be valid base64 service-account JSON with project_id, client_email and private_key");
  }
}

/**
 * Resolve and validate the venue's declared evidence/operating mode without reading secrets or making
 * network calls. `NODE_ENV` controls Node/framework optimisation only. The explicit AssureRail mode
 * controls what the application is allowed to do and what evidence its test/run output represents.
 *
 * The explicit override is important for the current isolated demo box, which legitimately runs an
 * optimised Node build (`NODE_ENV=production`) but must still declare itself `DEMO` and keep every
 * external adapter in demo mode. An undeclared production container defaults to `PRODUCTION` and is
 * therefore rejected unless all production preconditions below are present.
 */
export function inspectRuntimeEnvironment(env: Environment): RuntimeEnvironmentInspection {
  const errors: string[] = [];
  const persistenceFlags = inspectPersistenceFlags(env);
  errors.push(...persistenceFlags.errors);
  if (persistenceFlags.neutralIngress === "shadow" && persistenceFlags.participantAdmission !== "shadow") {
    errors.push("ARAIL_NEUTRAL_INGRESS_V1=shadow requires ARAIL_PARTICIPANT_ADMISSION_V1=shadow");
  }
  if (persistenceFlags.transactionCase === "shadow"
    && (persistenceFlags.participantAdmission !== "shadow" || persistenceFlags.neutralIngress !== "shadow")) {
    errors.push("ARAIL_TRANSACTION_CASE_V1=shadow requires participant admission and neutral ingress in shadow mode");
  }
  if (persistenceFlags.roomReadSource !== "legacy" && persistenceFlags.transactionCase !== "shadow") {
    errors.push("ARAIL_ROOM_READ_SOURCE=compare|rail requires ARAIL_TRANSACTION_CASE_V1=shadow");
  }
  if (persistenceFlags.roomWriteSource === "rail" && persistenceFlags.transactionCase !== "shadow") {
    errors.push("ARAIL_ROOM_WRITE_SOURCE=rail requires ARAIL_TRANSACTION_CASE_V1=shadow");
  }
  if (persistenceFlags.roomReadSource === "rail" && persistenceFlags.roomWriteSource !== "rail") {
    errors.push("ARAIL_ROOM_READ_SOURCE=rail requires the PR-08 case allocation gate and ARAIL_ROOM_WRITE_SOURCE=rail");
  }
  if (persistenceFlags.legacyRoomProxy === "shadow"
    && (persistenceFlags.roomReadSource !== "rail" || persistenceFlags.roomWriteSource !== "rail")) {
    errors.push("ARAIL_LEGACY_ROOM_PROXY_V1=shadow requires Rail room read/write capability; each case still needs an approved allocation");
  }
  if (persistenceFlags.completionAcknowledgement !== "off"
    && (persistenceFlags.transactionCase !== "shadow" || persistenceFlags.neutralIngress !== "shadow")) {
    errors.push("ARAIL_COMPLETION_ACK_V1=shadow|on requires transaction cases and neutral ingress in shadow mode");
  }
  const resolvedMode = normaliseOperatingMode(env.ASSURERAIL_OPERATING_MODE, env.NODE_ENV);
  if (resolvedMode.error) errors.push(resolvedMode.error);
  const operatingMode = resolvedMode.mode;
  if (persistenceFlags.transactionCase === "shadow" && !["REPLAY", "SHADOW"].includes(operatingMode)) {
    errors.push(`ARAIL_TRANSACTION_CASE_V1=shadow is available only in REPLAY or SHADOW runtime, not ${operatingMode}`);
  }
  if (persistenceFlags.completionAcknowledgement === "on" && !["CONTROLLED_LIVE", "PRODUCTION"].includes(operatingMode)) {
    errors.push(`ARAIL_COMPLETION_ACK_V1=on is forbidden in ${operatingMode}; use shadow until a controlled-live case foundation is approved`);
  }

  const demoEndpointsEnabled = booleanValue(
    env,
    "ARAIL_DEMO_ENDPOINTS_ENABLED",
    operatingMode === "DEMO",
    errors,
  );
  const adapters = {
    tape: adapterValue(env, "TAPE_SOURCE", "demo", errors),
    hts: adapterValue(env, "HTS_ADAPTER", "demo", errors),
    hcs: adapterValue(env, "HCS_ANCHOR", "demo", errors),
    settlement: adapterValue(env, "SETTLEMENT_ADAPTER", "demo", errors),
    digiKyc: adapterValue(
      env,
      "DIGIKYC_GATE",
      "demo",
      errors,
    ),
  };

  const persistentStoreRequired = operatingMode !== "DEMO";
  const authenticatedRuntimeRequired = operatingMode !== "DEMO";
  const liveExternalActionsRequired = operatingMode === "CONTROLLED_LIVE" || operatingMode === "PRODUCTION";

  if (operatingMode === "DEMO") {
    const liveAdapters = Object.entries(adapters)
      .filter(([, value]) => value === "live")
      .map(([name]) => name);
    if (liveAdapters.length > 0) {
      errors.push(`DEMO mode forbids live adapters: ${liveAdapters.join(", ")}`);
    }
  }
  if (operatingMode === "REPLAY" || operatingMode === "SHADOW") {
    const mutatingLiveAdapters = [
      ["hts", adapters.hts],
      ["hcs", adapters.hcs],
      ["settlement", adapters.settlement],
    ].filter(([, value]) => value === "live").map(([name]) => name);
    if (mutatingLiveAdapters.length > 0) {
      errors.push(`${operatingMode} mode forbids live mutating adapters: ${mutatingLiveAdapters.join(", ")}`);
    }
    if (persistenceFlags.durableRelay === "durable") {
      errors.push(`${operatingMode} mode forbids durable webhook egress; use ARAIL_DURABLE_RELAY_MODE=shadow`);
    }
  }

  if (demoEndpointsEnabled && operatingMode !== "DEMO") {
    errors.push(`ARAIL_DEMO_ENDPOINTS_ENABLED=true is forbidden in ${operatingMode} mode`);
  }
  if (persistentStoreRequired) {
    requirePresent(env, "DATABASE_URL", errors, `in ${operatingMode} mode`);
  }
  if (authenticatedRuntimeRequired) {
    requirePresent(env, "FIREBASE_ADMIN_CONFIG", errors, `in ${operatingMode} mode`);
    validateFirebaseAdminConfig(env, errors);
  }
  if (operatingMode !== "DEMO" && env.ASSURERAIL_CORS_ANY === "true") {
    errors.push(`ASSURERAIL_CORS_ANY=true is forbidden in ${operatingMode} mode`);
  }

  if (liveExternalActionsRequired) {
    if (persistenceFlags.durableRelay !== "durable") {
      errors.push(`${operatingMode} mode requires ARAIL_DURABLE_RELAY_MODE=durable`);
    }
    const demoAdapters = Object.entries(adapters)
      .filter(([, value]) => value !== "live")
      .map(([name]) => name);
    if (demoAdapters.length > 0) {
      errors.push(`${operatingMode} mode requires live adapters; demo/non-live: ${demoAdapters.join(", ")}`);
    }
    if (demoEndpointsEnabled) {
      errors.push(`${operatingMode} mode cannot expose demo endpoints`);
    }
    requirePresent(env, "ASSURELOCKER_API_KEY", errors, `for the current live source/connector adapters in ${operatingMode} mode`);
    requirePresent(env, "DIGIKYC_STATUS_SERVICE_SECRET", errors, `for live DigiKYC in ${operatingMode} mode`);
    requirePresent(env, "RECAPTCHA_SITE_KEY", errors, `in ${operatingMode} mode`);
    if (env.RECAPTCHA_ENFORCE !== "true") {
      errors.push(`RECAPTCHA_ENFORCE=true is required in ${operatingMode} mode`);
    }
    const sourceUrl = env.ASSURELOCKER_API_URL?.trim();
    if (!sourceUrl?.startsWith("https://")) {
      errors.push(`ASSURELOCKER_API_URL must use https:// in ${operatingMode} mode`);
    }
  }

  if (persistenceFlags.durableRelay === "durable") {
    const vaultUrl = env.VAULT_ADDR?.trim();
    if (!vaultUrl) errors.push("VAULT_ADDR is required when ARAIL_DURABLE_RELAY_MODE=durable");
    if (operatingMode !== "DEMO" && vaultUrl && !vaultUrl.startsWith("https://")) {
      errors.push(`VAULT_ADDR must use https:// in ${operatingMode} mode`);
    }
    const hasAppRole = Boolean(env.VAULT_APPROLE_ROLE_ID?.trim() && env.VAULT_APPROLE_SECRET_ID?.trim());
    const hasToken = Boolean(env.VAULT_TOKEN?.trim());
    if (liveExternalActionsRequired && !hasAppRole) {
      errors.push(`Vault AppRole credentials are required in ${operatingMode} mode; VAULT_TOKEN is not accepted for live operation`);
    } else if (!hasAppRole && !hasToken) {
      errors.push("Vault AppRole credentials or VAULT_TOKEN are required when ARAIL_DURABLE_RELAY_MODE=durable");
    }
  }

  if (persistenceFlags.legacyRoomProxy === "shadow" || persistenceFlags.completionAcknowledgement === "on") {
    const vaultUrl = env.VAULT_ADDR?.trim();
    if (!vaultUrl) errors.push("VAULT_ADDR is required for signed connector traffic");
    if (operatingMode !== "DEMO" && vaultUrl && !vaultUrl.startsWith("https://")) {
      errors.push(`VAULT_ADDR must use https:// for signed connector traffic in ${operatingMode} mode`);
    }
    const hasAppRole = Boolean(env.VAULT_APPROLE_ROLE_ID?.trim() && env.VAULT_APPROLE_SECRET_ID?.trim());
    const hasToken = Boolean(env.VAULT_TOKEN?.trim());
    if (!hasAppRole && !hasToken) errors.push("Vault AppRole credentials or VAULT_TOKEN are required for signed connector traffic");
  }

  return {
    profile: {
      operatingMode,
      demoEndpointsEnabled,
      persistentStoreRequired,
      authenticatedRuntimeRequired,
      liveExternalActionsRequired,
      adapters,
      features: {
        neutralIngress: persistenceFlags.neutralIngress,
        durableRelay: persistenceFlags.durableRelay,
        participantAdmission: persistenceFlags.participantAdmission,
        routeEntitlement: persistenceFlags.routeEntitlement,
        transactionCase: persistenceFlags.transactionCase,
        roomReadSource: persistenceFlags.roomReadSource,
        roomWriteSource: persistenceFlags.roomWriteSource,
        completionAcknowledgement: persistenceFlags.completionAcknowledgement,
        legacyRoomProxy: persistenceFlags.legacyRoomProxy,
      },
    },
    errors,
  };
}

export function assertRuntimeEnvironment(env: Environment): RuntimeEnvironmentProfile {
  const inspected = inspectRuntimeEnvironment(env);
  if (inspected.errors.length > 0) throw new RuntimeConfigurationError(inspected.errors);
  return inspected.profile;
}

/**
 * Module assembly runs while imports are evaluated, before `bootstrap()` can produce its normal
 * startup error. On invalid configuration this deliberately returns false: the demo controller is
 * never mounted speculatively. `assertRuntimeEnvironment` then rejects startup with the full error.
 */
export function shouldMountDemoEndpoints(env: Environment): boolean {
  const inspected = inspectRuntimeEnvironment(env);
  return inspected.errors.length === 0 && inspected.profile.demoEndpointsEnabled;
}
