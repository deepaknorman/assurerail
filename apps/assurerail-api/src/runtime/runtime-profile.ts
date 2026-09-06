import {
  inspectPersistenceFlags,
  type CompletionAcknowledgementMode,
  type ConventionalSecondaryMode,
  type CustomerOperationsMode,
  type DaProductMode,
  type DurableRelayMode,
  type DaReplayMode,
  type DeveloperPortalMode,
  type EnterpriseIntegrationMode,
  type ExternalActionSagaMode,
  type HostedAlphaMode,
  type InstitutionalProductMode,
  type InternalRbacMode,
  type LegacyRoomProxyMode,
  type LifecycleProductMode,
  type NeutralIngressMode,
  type PrimaryVenueProductMode,
  type ParticipantAdmissionMode,
  type PtcProductMode,
  type PtcReplayMode,
  type PrimaryCommercialMode,
  type ProductionScaleMode,
  type RouteEntitlementMode,
  type SecondaryProductMode,
  type RoomReadSource,
  type RoomWriteSource,
  type TransactionCaseMode,
  type TokenisedDaMode,
  type TokenisedProductMode,
  type TokenisedPtcMode,
  type VenueConductMode,
} from "../persistence/feature-flags";
import { inspectActivationManifest } from "./activation-manifest";
import { isLiveCapabilityImplemented, requiredLiveAdapters } from "./live-capability-registry";

export const ASSURERAIL_OPERATING_MODES = [
  "DEMO",
  "REPLAY",
  "SHADOW",
  "SANDBOX",
  "CONTROLLED_LIVE",
  "PRODUCTION",
] as const;

export type AssureRailOperatingMode =
  (typeof ASSURERAIL_OPERATING_MODES)[number];
export type AdapterMode = "off" | "demo" | "live";

export interface RuntimeEnvironmentProfile {
  operatingMode: AssureRailOperatingMode;
  demoEndpointsEnabled: boolean;
  persistentStoreRequired: boolean;
  authenticatedRuntimeRequired: boolean;
  liveExternalActionsRequired: boolean;
  activation: {
    manifestId: string | null;
    manifestDigest: string | null;
    capabilityIds: string[];
  };
  adapters: {
    tape: AdapterMode;
    hts: AdapterMode;
    hcs: AdapterMode;
    settlement: AdapterMode;
    identityAssurance: AdapterMode;
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
    ptcProduct: PtcProductMode;
    lifecycleProduct: LifecycleProductMode;
    primaryVenueProduct: PrimaryVenueProductMode;
    secondaryProduct: SecondaryProductMode;
    tokenisedProduct: TokenisedProductMode;
    enterpriseIntegration: EnterpriseIntegrationMode;
    productionScale: ProductionScaleMode;
    internalRbac: InternalRbacMode;
  };
}

export interface RuntimeEnvironmentInspection {
  profile: RuntimeEnvironmentProfile;
  errors: string[];
}

export class RuntimeConfigurationError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(
      `AssureRail runtime configuration rejected:\n- ${errors.join("\n- ")}`
    );
    this.name = "RuntimeConfigurationError";
    this.errors = [...errors];
  }
}

type Environment = Readonly<Record<string, string | undefined>>;

const MODE_SET = new Set<string>(ASSURERAIL_OPERATING_MODES);
const ADAPTER_MODES = new Set<string>(["off", "demo", "live"]);

function normaliseOperatingMode(
  raw: string | undefined,
  nodeEnv: string | undefined
): {
  mode: AssureRailOperatingMode;
  error?: string;
} {
  const candidate = (raw ?? (nodeEnv === "production" ? "PRODUCTION" : "DEMO"))
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (MODE_SET.has(candidate))
    return { mode: candidate as AssureRailOperatingMode };
  return {
    mode: "DEMO",
    error: `ASSURERAIL_OPERATING_MODE must be one of ${ASSURERAIL_OPERATING_MODES.join(
      ", "
    )} (received ${JSON.stringify(raw)})`,
  };
}

function booleanValue(
  env: Environment,
  key: string,
  defaultValue: boolean,
  errors: string[]
): boolean {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return defaultValue;
  if (raw.toLowerCase() === "true") return true;
  if (raw.toLowerCase() === "false") return false;
  errors.push(
    `${key} must be "true" or "false" (received ${JSON.stringify(raw)})`
  );
  return defaultValue;
}

function adapterValue(
  env: Environment,
  key: string,
  defaultValue: AdapterMode,
  errors: string[]
): AdapterMode {
  const raw = (env[key] ?? defaultValue).trim().toLowerCase();
  if (ADAPTER_MODES.has(raw)) return raw as AdapterMode;
  errors.push(
    `${key} must be "off", "demo" or "live" (received ${JSON.stringify(env[key])})`
  );
  return defaultValue;
}

function requirePresent(
  env: Environment,
  key: string,
  errors: string[],
  reason: string
): void {
  if (!env[key]?.trim()) errors.push(`${key} is required ${reason}`);
}

function requireAbsoluteProviderPath(
  env: Environment,
  key: string,
  errors: string[]
): void {
  const value = env[key]?.trim();
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("?") || value.includes("#")) {
    errors.push(`${key} must be an absolute path without authority, query or fragment in live operation`);
  }
}

function validateFirebaseAdminConfig(env: Environment, errors: string[]): void {
  const encoded = env.FIREBASE_ADMIN_CONFIG?.trim();
  if (!encoded) return;
  try {
    const decoded = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8")
    ) as Record<string, unknown>;
    if (!decoded.project_id || !decoded.client_email || !decoded.private_key) {
      throw new Error("missing project_id/client_email/private_key");
    }
  } catch {
    errors.push(
      "FIREBASE_ADMIN_CONFIG must be valid base64 service-account JSON with project_id, client_email and private_key"
    );
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
export function inspectRuntimeEnvironment(
  env: Environment
): RuntimeEnvironmentInspection {
  const errors: string[] = [];
  const persistenceFlags = inspectPersistenceFlags(env);
  errors.push(...persistenceFlags.errors);
  if (
    persistenceFlags.neutralIngress !== "off" &&
    persistenceFlags.participantAdmission === "off"
  ) {
    errors.push(
      "ARAIL_NEUTRAL_INGRESS_V1=shadow|on requires participant admission"
    );
  }
  if (
    persistenceFlags.neutralIngress === "on" &&
    persistenceFlags.participantAdmission !== "enforce"
  ) {
    errors.push(
      "ARAIL_NEUTRAL_INGRESS_V1=on requires ARAIL_PARTICIPANT_ADMISSION_V1=enforce"
    );
  }
  if (
    persistenceFlags.transactionCase !== "off" &&
    (persistenceFlags.participantAdmission === "off" ||
      persistenceFlags.neutralIngress === "off")
  ) {
    errors.push(
      "ARAIL_TRANSACTION_CASE_V1=shadow|on requires participant admission and neutral ingress"
    );
  }
  if (
    persistenceFlags.transactionCase === "on" &&
    (persistenceFlags.participantAdmission !== "enforce" ||
      persistenceFlags.neutralIngress !== "on" ||
      persistenceFlags.routeEntitlement !== "enforce" ||
      persistenceFlags.internalRbac !== "enforce")
  ) {
    errors.push(
      "ARAIL_TRANSACTION_CASE_V1=on requires enforced participant admission, neutral ingress, route entitlement and internal RBAC"
    );
  }
  if (
    persistenceFlags.roomReadSource !== "legacy" &&
    persistenceFlags.transactionCase === "off"
  ) {
    errors.push(
      "ARAIL_ROOM_READ_SOURCE=compare|rail requires transaction cases"
    );
  }
  if (
    persistenceFlags.roomWriteSource === "rail" &&
    persistenceFlags.transactionCase === "off"
  ) {
    errors.push("ARAIL_ROOM_WRITE_SOURCE=rail requires transaction cases");
  }
  if (
    persistenceFlags.roomReadSource === "rail" &&
    persistenceFlags.roomWriteSource !== "rail"
  ) {
    errors.push(
      "ARAIL_ROOM_READ_SOURCE=rail requires the PR-08 case allocation gate and ARAIL_ROOM_WRITE_SOURCE=rail"
    );
  }
  if (
    persistenceFlags.completionAcknowledgement === "shadow" &&
    (persistenceFlags.transactionCase !== "shadow" ||
      persistenceFlags.neutralIngress !== "shadow")
  ) {
    errors.push(
      "ARAIL_COMPLETION_ACK_V1=shadow requires transaction cases and neutral ingress in shadow mode"
    );
  }
  if (
    persistenceFlags.completionAcknowledgement === "on" &&
    (persistenceFlags.transactionCase !== "on" ||
      persistenceFlags.neutralIngress !== "on")
  ) {
    errors.push(
      "ARAIL_COMPLETION_ACK_V1=on requires transaction cases and neutral ingress on"
    );
  }
  if (
    persistenceFlags.externalActionSaga !== "off" &&
    persistenceFlags.transactionCase === "off"
  ) {
    errors.push(
      "ARAIL_EXTERNAL_ACTION_SAGA_V1=shadow|required requires transaction cases"
    );
  }
  if (
    persistenceFlags.daReplay !== "off" &&
    (persistenceFlags.transactionCase !== "shadow" ||
      persistenceFlags.externalActionSaga !== "required")
  ) {
    errors.push(
      "ARAIL_DA_REPLAY_V1=allow_list requires transaction cases in shadow mode and ARAIL_EXTERNAL_ACTION_SAGA_V1=required"
    );
  }
  if (
    persistenceFlags.ptcReplay !== "off" &&
    (persistenceFlags.transactionCase !== "shadow" ||
      persistenceFlags.externalActionSaga !== "required")
  ) {
    errors.push(
      "ARAIL_PTC_REPLAY_V1=allow_list requires transaction cases in shadow mode and ARAIL_EXTERNAL_ACTION_SAGA_V1=required"
    );
  }
  if (
    persistenceFlags.tokenisedDa === "allow_list" &&
    (persistenceFlags.transactionCase !== "shadow" ||
      persistenceFlags.externalActionSaga !== "required")
  ) {
    errors.push(
      "ARAIL_TOKENISED_DA_V1=allow_list requires transaction cases in shadow mode and ARAIL_EXTERNAL_ACTION_SAGA_V1=required"
    );
  }
  if (
    persistenceFlags.tokenisedDa === "live" &&
    (persistenceFlags.transactionCase !== "on" ||
      persistenceFlags.externalActionSaga !== "required")
  ) {
    errors.push(
      "ARAIL_TOKENISED_DA_V1=live requires transaction cases on and ARAIL_EXTERNAL_ACTION_SAGA_V1=required"
    );
  }
  if (
    persistenceFlags.tokenisedPtc !== "off" &&
    (persistenceFlags.transactionCase !== "shadow" ||
      persistenceFlags.externalActionSaga !== "required" ||
      persistenceFlags.ptcReplay !== "allow_list")
  ) {
    errors.push(
      "ARAIL_TOKENISED_PTC_V1=shadow requires transaction cases in shadow, required saga and PTC replay allow-list"
    );
  }
  if (
    persistenceFlags.primaryCommercial !== "off" &&
    persistenceFlags.transactionCase !== "shadow"
  ) {
    errors.push(
      "ARAIL_PRIMARY_COMMERCIAL_V1=shadow requires ARAIL_TRANSACTION_CASE_V1=shadow"
    );
  }
  if (
    persistenceFlags.conventionalSecondary !== "off" &&
    (persistenceFlags.transactionCase !== "shadow" ||
      persistenceFlags.externalActionSaga !== "required")
  ) {
    errors.push(
      "ARAIL_CONVENTIONAL_SECONDARY_V1=shadow requires transaction cases in shadow mode and ARAIL_EXTERNAL_ACTION_SAGA_V1=required"
    );
  }
  if (
    persistenceFlags.venueConduct !== "off" &&
    (persistenceFlags.primaryCommercial !== "shadow" ||
      persistenceFlags.internalRbac === "off" ||
      persistenceFlags.transactionCase !== "shadow")
  ) {
    errors.push(
      "ARAIL_VENUE_CONDUCT_V1=shadow requires primary commercial and transaction cases in shadow plus internal RBAC"
    );
  }
  if (
    persistenceFlags.developerPortal !== "off" &&
    (persistenceFlags.participantAdmission !== "shadow" ||
      persistenceFlags.neutralIngress !== "shadow" ||
      persistenceFlags.durableRelay !== "shadow")
  ) {
    errors.push(
      "ARAIL_DEVELOPER_PORTAL_V1=shadow requires participant admission, neutral ingress and durable relay in shadow"
    );
  }
  if (
    persistenceFlags.customerOperations !== "off" &&
    (persistenceFlags.participantAdmission !== "shadow" ||
      persistenceFlags.internalRbac === "off" ||
      persistenceFlags.developerPortal !== "shadow")
  ) {
    errors.push(
      "ARAIL_CUSTOMER_OPERATIONS_V1=shadow requires participant admission and developer portal in shadow plus internal RBAC"
    );
  }
  if (
    persistenceFlags.hostedAlpha !== "off" &&
    (persistenceFlags.participantAdmission === "off" ||
      persistenceFlags.transactionCase === "off")
  ) {
    errors.push(
      "ARAIL_HOSTED_ALPHA_V1=shadow requires participant admission and transaction cases"
    );
  }
  if (
    persistenceFlags.institutionalProduct !== "off" &&
    (persistenceFlags.hostedAlpha !== "shadow" ||
      persistenceFlags.participantAdmission !== "shadow" ||
      persistenceFlags.developerPortal !== "shadow" ||
      persistenceFlags.internalRbac === "off")
  ) {
    errors.push(
      "ARAIL_INSTITUTIONAL_PRODUCT_V1=shadow requires hosted alpha, participant admission and developer portal in shadow plus internal RBAC"
    );
  }
  if (
    persistenceFlags.daProduct !== "off" &&
    (persistenceFlags.institutionalProduct !== "shadow" ||
      persistenceFlags.daReplay !== "allow_list" ||
      persistenceFlags.externalActionSaga !== "required" ||
      persistenceFlags.roomReadSource === "legacy")
  ) {
    errors.push(
      "ARAIL_DA_PRODUCT_V1=shadow requires institutional product shadow, DA replay allow-list, required saga and Rail/compare rooms"
    );
  }
  if (
    persistenceFlags.ptcProduct !== "off" &&
    (persistenceFlags.institutionalProduct !== "shadow" ||
      persistenceFlags.ptcReplay !== "allow_list" ||
      persistenceFlags.externalActionSaga !== "required" ||
      persistenceFlags.roomReadSource === "legacy")
  ) {
    errors.push(
      "ARAIL_PTC_PRODUCT_V1=shadow requires institutional product shadow, PTC replay allow-list, required saga and Rail/compare rooms"
    );
  }
  if (
    persistenceFlags.lifecycleProduct !== "off" &&
    (persistenceFlags.institutionalProduct !== "shadow" ||
      persistenceFlags.externalActionSaga !== "required" ||
      (persistenceFlags.daProduct !== "shadow" &&
        persistenceFlags.ptcProduct !== "shadow"))
  ) {
    errors.push(
      "ARAIL_LIFECYCLE_PRODUCT_V1=shadow requires institutional product shadow, required saga and at least one DA/PTC product in shadow"
    );
  }
  if (
    persistenceFlags.primaryVenueProduct !== "off" &&
    (persistenceFlags.institutionalProduct !== "shadow" ||
      persistenceFlags.primaryCommercial !== "shadow" ||
      persistenceFlags.venueConduct !== "shadow" ||
      persistenceFlags.internalRbac === "off" ||
      (persistenceFlags.daProduct !== "shadow" &&
        persistenceFlags.ptcProduct !== "shadow"))
  ) {
    errors.push(
      "ARAIL_PRIMARY_VENUE_PRODUCT_V1=shadow requires institutional product, primary commercial and venue conduct in shadow, internal RBAC, and at least one DA/PTC product in shadow"
    );
  }
  if (
    persistenceFlags.secondaryProduct !== "off" &&
    (persistenceFlags.institutionalProduct !== "shadow" ||
      persistenceFlags.conventionalSecondary !== "shadow" ||
      persistenceFlags.externalActionSaga !== "required" ||
      persistenceFlags.internalRbac === "off" ||
      (persistenceFlags.daProduct !== "shadow" &&
        persistenceFlags.ptcProduct !== "shadow"))
  ) {
    errors.push(
      "ARAIL_SECONDARY_PRODUCT_V1=shadow requires institutional product and conventional secondary in shadow, required saga, internal RBAC, and at least one DA/PTC product in shadow"
    );
  }
  if (
    persistenceFlags.tokenisedProduct !== "off" &&
    (persistenceFlags.institutionalProduct !== "shadow" ||
      persistenceFlags.daProduct !== "shadow" ||
      persistenceFlags.ptcProduct !== "shadow" ||
      persistenceFlags.lifecycleProduct !== "shadow" ||
      persistenceFlags.tokenisedDa !== "allow_list" ||
      persistenceFlags.tokenisedPtc !== "shadow" ||
      persistenceFlags.externalActionSaga !== "required" ||
      persistenceFlags.internalRbac === "off")
  ) {
    errors.push(
      "ARAIL_TOKENISED_PRODUCT_V1=shadow requires institutional, DA, PTC and lifecycle products in shadow; tokenised DA allow-list; tokenised PTC shadow; required saga; and internal RBAC"
    );
  }
  if (
    persistenceFlags.enterpriseIntegration !== "off" &&
    (persistenceFlags.institutionalProduct !== "shadow" ||
      persistenceFlags.developerPortal !== "shadow" ||
      persistenceFlags.customerOperations !== "shadow" ||
      persistenceFlags.internalRbac === "off" ||
      persistenceFlags.durableRelay !== "shadow")
  ) {
    errors.push(
      "ARAIL_ENTERPRISE_INTEGRATION_V1=shadow requires institutional product, developer portal, customer operations and durable relay in shadow plus internal RBAC"
    );
  }
  if (
    persistenceFlags.productionScale !== "off" &&
    (persistenceFlags.internalRbac === "off" ||
      persistenceFlags.durableRelay === "legacy")
  ) {
    errors.push(
      "ARAIL_PRODUCTION_SCALE_V1=shadow requires internal RBAC and the durable relay outside legacy mode"
    );
  }
  if (
    persistenceFlags.productionScale !== "off" &&
    (!env.ASSURERAIL_ENVIRONMENT?.trim() ||
      !/^[a-f0-9]{40}$/.test(env.ASSURERAIL_BUILD_COMMIT?.trim() ?? ""))
  ) {
    errors.push(
      "ARAIL_PRODUCTION_SCALE_V1=shadow requires ASSURERAIL_ENVIRONMENT and an exact lowercase ASSURERAIL_BUILD_COMMIT"
    );
  }
  const resolvedMode = normaliseOperatingMode(
    env.ASSURERAIL_OPERATING_MODE,
    env.NODE_ENV
  );
  if (resolvedMode.error) errors.push(resolvedMode.error);
  const operatingMode = resolvedMode.mode;
  if (
    persistenceFlags.transactionCase === "shadow" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_TRANSACTION_CASE_V1=shadow is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.transactionCase === "on" &&
    !["CONTROLLED_LIVE", "PRODUCTION"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_TRANSACTION_CASE_V1=on is available only in CONTROLLED_LIVE or PRODUCTION runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.completionAcknowledgement === "on" &&
    !["CONTROLLED_LIVE", "PRODUCTION"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_COMPLETION_ACK_V1=on is forbidden in ${operatingMode}; use shadow until a controlled-live case foundation is approved`
    );
  }
  if (
    persistenceFlags.externalActionSaga !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode) &&
    !(
      persistenceFlags.tokenisedDa === "live" &&
      ["CONTROLLED_LIVE", "PRODUCTION"].includes(operatingMode)
    )
  ) {
    errors.push(
      `PR-09 external-action sagas are observe-only and available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.daReplay !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_DA_REPLAY_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.ptcReplay !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_PTC_REPLAY_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.tokenisedDa === "allow_list" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_TOKENISED_DA_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.tokenisedDa === "live" &&
    !["CONTROLLED_LIVE", "PRODUCTION"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_TOKENISED_DA_V1=live is available only in CONTROLLED_LIVE or PRODUCTION runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.tokenisedPtc !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_TOKENISED_PTC_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.primaryCommercial !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_PRIMARY_COMMERCIAL_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.conventionalSecondary !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_CONVENTIONAL_SECONDARY_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.venueConduct !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_VENUE_CONDUCT_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.developerPortal !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_DEVELOPER_PORTAL_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.customerOperations !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_CUSTOMER_OPERATIONS_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.hostedAlpha !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_HOSTED_ALPHA_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.institutionalProduct !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_INSTITUTIONAL_PRODUCT_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.daProduct !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_DA_PRODUCT_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.ptcProduct !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_PTC_PRODUCT_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.lifecycleProduct !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_LIFECYCLE_PRODUCT_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.primaryVenueProduct !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_PRIMARY_VENUE_PRODUCT_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.secondaryProduct !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_SECONDARY_PRODUCT_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.tokenisedProduct !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_TOKENISED_PRODUCT_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.enterpriseIntegration !== "off" &&
    !["REPLAY", "SHADOW"].includes(operatingMode)
  ) {
    errors.push(
      `ARAIL_ENTERPRISE_INTEGRATION_V1 is available only in REPLAY or SHADOW runtime, not ${operatingMode}`
    );
  }
  if (
    persistenceFlags.productionScale !== "off" &&
    !["SHADOW", "SANDBOX", "CONTROLLED_LIVE", "PRODUCTION"].includes(
      operatingMode
    )
  ) {
    errors.push(
      `ARAIL_PRODUCTION_SCALE_V1 is unavailable in ${operatingMode} runtime`
    );
  }

  const demoEndpointsEnabled = booleanValue(
    env,
    "ARAIL_DEMO_ENDPOINTS_ENABLED",
    operatingMode === "DEMO",
    errors
  );
  const adapters = {
    tape: adapterValue(env, "TAPE_SOURCE", "demo", errors),
    hts: adapterValue(env, "HTS_ADAPTER", "demo", errors),
    hcs: adapterValue(env, "HCS_ANCHOR", "demo", errors),
    settlement: adapterValue(env, "SETTLEMENT_ADAPTER", "demo", errors),
    identityAssurance: adapterValue(env, "IDENTITY_ASSURANCE_ADAPTER", "demo", errors),
  };

  const persistentStoreRequired = operatingMode !== "DEMO";
  const authenticatedRuntimeRequired = operatingMode !== "DEMO";
  const liveExternalActionsRequired =
    operatingMode === "CONTROLLED_LIVE" || operatingMode === "PRODUCTION";
  const activation = liveExternalActionsRequired
    ? inspectActivationManifest(env)
    : { manifest: null, manifestDigest: null, errors: [] as string[] };
  errors.push(...activation.errors);
  for (const capability of activation.manifest?.capabilities ?? []) {
    if (!isLiveCapabilityImplemented(capability.id)) {
      errors.push(
        `activation capability ${capability.id} has no implemented controlled-live command path in this build`
      );
    }
  }

  if (operatingMode === "DEMO") {
    const liveAdapters = Object.entries(adapters)
      .filter(([, value]) => value === "live")
      .map(([name]) => name);
    if (liveAdapters.length > 0) {
      errors.push(
        `DEMO mode forbids live adapters: ${liveAdapters.join(", ")}`
      );
    }
  }
  if (operatingMode === "REPLAY" || operatingMode === "SHADOW") {
    const mutatingLiveAdapters = [
      ["hts", adapters.hts],
      ["hcs", adapters.hcs],
      ["settlement", adapters.settlement],
    ]
      .filter(([, value]) => value === "live")
      .map(([name]) => name);
    if (mutatingLiveAdapters.length > 0) {
      errors.push(
        `${operatingMode} mode forbids live mutating adapters: ${mutatingLiveAdapters.join(
          ", "
        )}`
      );
    }
    if (persistenceFlags.durableRelay === "durable") {
      errors.push(
        `${operatingMode} mode forbids durable webhook egress; use ARAIL_DURABLE_RELAY_MODE=shadow`
      );
    }
  }

  if (demoEndpointsEnabled && operatingMode !== "DEMO") {
    errors.push(
      `ARAIL_DEMO_ENDPOINTS_ENABLED=true is forbidden in ${operatingMode} mode`
    );
  }
  if (persistentStoreRequired) {
    requirePresent(env, "DATABASE_URL", errors, `in ${operatingMode} mode`);
  }
  if (authenticatedRuntimeRequired) {
    requirePresent(
      env,
      "FIREBASE_ADMIN_CONFIG",
      errors,
      `in ${operatingMode} mode`
    );
    validateFirebaseAdminConfig(env, errors);
  }
  if (operatingMode !== "DEMO" && env.ASSURERAIL_CORS_ANY === "true") {
    errors.push(
      `ASSURERAIL_CORS_ANY=true is forbidden in ${operatingMode} mode`
    );
  }

  if (adapters.tape === "live") {
    requirePresent(env, "TAPE_PROVIDER_API_KEY", errors, `for signed provider-v2 intake in ${operatingMode} mode`);
    requirePresent(env, "TAPE_PROVIDER_EXPECTED_ID", errors, `for signed provider-v2 intake in ${operatingMode} mode`);
    requirePresent(env, "TAPE_PROVIDER_PUBLIC_KEYS_JSON", errors, `for signed provider-v2 intake in ${operatingMode} mode`);
    const providerUrl = env.TAPE_PROVIDER_API_URL?.trim();
    if (!providerUrl?.startsWith("https://")) {
      errors.push(`TAPE_PROVIDER_API_URL must use https:// for live signed provider-v2 intake in ${operatingMode} mode`);
    }
    const rawKeys = env.TAPE_PROVIDER_PUBLIC_KEYS_JSON?.trim();
    if (rawKeys) {
      try {
        const keys = JSON.parse(rawKeys) as unknown;
        if (!keys || typeof keys !== "object" || Array.isArray(keys) || Object.keys(keys).length === 0) {
          throw new Error("empty or non-object key set");
        }
        for (const [keyId, pem] of Object.entries(keys as Record<string, unknown>)) {
          if (!/^[0-9a-f]{32}$/.test(keyId) || typeof pem !== "string" || !pem.includes("BEGIN PUBLIC KEY")) {
            throw new Error("invalid keyId or public-key PEM");
          }
        }
      } catch {
        errors.push("TAPE_PROVIDER_PUBLIC_KEYS_JSON must be a non-empty JSON object mapping 32-hex keyIds to public-key PEM strings");
      }
    }
    const timeoutMs = Number(env.TAPE_PROVIDER_TIMEOUT_MS ?? "10000");
    if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 15_000) {
      errors.push("TAPE_PROVIDER_TIMEOUT_MS must be an integer between 500 and 15000 for live provider-v2 intake");
    }
    const maxBytes = Number(env.TAPE_PROVIDER_MAX_RESPONSE_BYTES ?? "52428800");
    if (!Number.isInteger(maxBytes) || maxBytes < 1_048_576 || maxBytes > 104_857_600) {
      errors.push("TAPE_PROVIDER_MAX_RESPONSE_BYTES must be an integer between 1048576 and 104857600 for live provider-v2 intake");
    }
  }

  if (liveExternalActionsRequired) {
    if (persistenceFlags.internalRbac !== "enforce") {
      errors.push(
        `${operatingMode} mode requires ARAIL_INTERNAL_RBAC_V1=enforce`
      );
    }
    if (persistenceFlags.durableRelay !== "durable") {
      errors.push(
        `${operatingMode} mode requires ARAIL_DURABLE_RELAY_MODE=durable`
      );
    }
    const demoAdapters = Object.entries(adapters)
      .filter(([, value]) => value === "demo")
      .map(([name]) => name);
    if (demoAdapters.length > 0) {
      errors.push(
        `${operatingMode} mode forbids demo adapters; set unused adapters off and required adapters live: ${demoAdapters.join(
          ", "
        )}`
      );
    }
    if (adapters.identityAssurance !== "live") {
      errors.push(`${operatingMode} mode requires the provider-neutral identity assurance adapter live`);
    }
    const requiredAdapters = requiredLiveAdapters(
      activation.manifest?.capabilities.map((capability) => capability.id) ?? []
    );
    for (const adapter of requiredAdapters) {
      if (adapters[adapter] !== "live") {
        errors.push(`${operatingMode} activation requires ${adapter} adapter live`);
      }
    }
    if (demoEndpointsEnabled) {
      errors.push(`${operatingMode} mode cannot expose demo endpoints`);
    }
    const providerRequirements = [
      ["tape", "TAPE_PROVIDER_API_KEY", "TAPE_PROVIDER_API_URL"],
      ["identityAssurance", "IDENTITY_PROVIDER_API_KEY", "IDENTITY_PROVIDER_API_URL"],
      ["hcs", "ANCHOR_PROVIDER_API_KEY", "ANCHOR_PROVIDER_API_URL"],
      ["settlement", "SETTLEMENT_PROVIDER_API_KEY", "SETTLEMENT_PROVIDER_API_URL"],
    ] as const;
    for (const [adapter, credentialKey, urlKey] of providerRequirements) {
      if (adapters[adapter] !== "live") continue;
      requirePresent(env, credentialKey, errors, `for its live provider adapter in ${operatingMode} mode`);
      const providerUrl = env[urlKey]?.trim();
      if (!providerUrl?.startsWith("https://")) {
        errors.push(`${urlKey} must use https:// in ${operatingMode} mode`);
      }
    }
    requirePresent(env, "IDENTITY_PROVIDER_KEY", errors, `for live identity assurance in ${operatingMode} mode`);
    requireAbsoluteProviderPath(env, "IDENTITY_PROVIDER_STATUS_PATH", errors);
    if (adapters.hcs === "live") requireAbsoluteProviderPath(env, "ANCHOR_PROVIDER_SUBMIT_PATH", errors);
    if (adapters.settlement === "live") requireAbsoluteProviderPath(env, "SETTLEMENT_PROVIDER_TRANSFER_PATH", errors);
    const identityTimeout = Number(env.IDENTITY_PROVIDER_TIMEOUT_MS);
    if (!Number.isInteger(identityTimeout) || identityTimeout < 500 || identityTimeout > 15_000) {
      errors.push("IDENTITY_PROVIDER_TIMEOUT_MS must be an integer between 500 and 15000 in live operation");
    }
    requirePresent(
      env,
      "RECAPTCHA_SITE_KEY",
      errors,
      `in ${operatingMode} mode`
    );
    if (env.RECAPTCHA_ENFORCE !== "true") {
      errors.push(
        `RECAPTCHA_ENFORCE=true is required in ${operatingMode} mode`
      );
    }
  }

  if (persistenceFlags.durableRelay === "durable") {
    const vaultUrl = env.VAULT_ADDR?.trim();
    if (!vaultUrl)
      errors.push(
        "VAULT_ADDR is required when ARAIL_DURABLE_RELAY_MODE=durable"
      );
    if (
      operatingMode !== "DEMO" &&
      vaultUrl &&
      !vaultUrl.startsWith("https://")
    ) {
      errors.push(`VAULT_ADDR must use https:// in ${operatingMode} mode`);
    }
    const hasAppRole = Boolean(
      env.VAULT_APPROLE_ROLE_ID?.trim() && env.VAULT_APPROLE_SECRET_ID?.trim()
    );
    const hasToken = Boolean(env.VAULT_TOKEN?.trim());
    if (liveExternalActionsRequired && !hasAppRole) {
      errors.push(
        `Vault AppRole credentials are required in ${operatingMode} mode; VAULT_TOKEN is not accepted for live operation`
      );
    } else if (!hasAppRole && !hasToken) {
      errors.push(
        "Vault AppRole credentials or VAULT_TOKEN are required when ARAIL_DURABLE_RELAY_MODE=durable"
      );
    }
  }

  if (persistenceFlags.completionAcknowledgement === "on") {
    const vaultUrl = env.VAULT_ADDR?.trim();
    if (!vaultUrl)
      errors.push("VAULT_ADDR is required for signed connector traffic");
    if (
      operatingMode !== "DEMO" &&
      vaultUrl &&
      !vaultUrl.startsWith("https://")
    ) {
      errors.push(
        `VAULT_ADDR must use https:// for signed connector traffic in ${operatingMode} mode`
      );
    }
    const hasAppRole = Boolean(
      env.VAULT_APPROLE_ROLE_ID?.trim() && env.VAULT_APPROLE_SECRET_ID?.trim()
    );
    const hasToken = Boolean(env.VAULT_TOKEN?.trim());
    if (!hasAppRole && !hasToken)
      errors.push(
        "Vault AppRole credentials or VAULT_TOKEN are required for signed connector traffic"
      );
  }

  return {
    profile: {
      operatingMode,
      demoEndpointsEnabled,
      persistentStoreRequired,
      authenticatedRuntimeRequired,
      liveExternalActionsRequired,
      activation: {
        manifestId: activation.manifest?.manifestId ?? null,
        manifestDigest: activation.manifestDigest ?? null,
        capabilityIds:
          activation.manifest?.capabilities.map(
            (capability) => capability.id
          ) ?? [],
      },
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
        externalActionSaga: persistenceFlags.externalActionSaga,
        daReplay: persistenceFlags.daReplay,
        ptcReplay: persistenceFlags.ptcReplay,
        tokenisedDa: persistenceFlags.tokenisedDa,
        tokenisedPtc: persistenceFlags.tokenisedPtc,
        primaryCommercial: persistenceFlags.primaryCommercial,
        conventionalSecondary: persistenceFlags.conventionalSecondary,
        venueConduct: persistenceFlags.venueConduct,
        developerPortal: persistenceFlags.developerPortal,
        customerOperations: persistenceFlags.customerOperations,
        hostedAlpha: persistenceFlags.hostedAlpha,
        institutionalProduct: persistenceFlags.institutionalProduct,
        daProduct: persistenceFlags.daProduct,
        ptcProduct: persistenceFlags.ptcProduct,
        lifecycleProduct: persistenceFlags.lifecycleProduct,
        primaryVenueProduct: persistenceFlags.primaryVenueProduct,
        secondaryProduct: persistenceFlags.secondaryProduct,
        tokenisedProduct: persistenceFlags.tokenisedProduct,
        enterpriseIntegration: persistenceFlags.enterpriseIntegration,
        productionScale: persistenceFlags.productionScale,
        internalRbac: persistenceFlags.internalRbac,
      },
    },
    errors,
  };
}

export function assertRuntimeEnvironment(
  env: Environment
): RuntimeEnvironmentProfile {
  const inspected = inspectRuntimeEnvironment(env);
  if (inspected.errors.length > 0)
    throw new RuntimeConfigurationError(inspected.errors);
  return inspected.profile;
}

/**
 * Module assembly runs while imports are evaluated, before `bootstrap()` can produce its normal
 * startup error. On invalid configuration this deliberately returns false: the demo controller is
 * never mounted speculatively. `assertRuntimeEnvironment` then rejects startup with the full error.
 */
export function shouldMountDemoEndpoints(env: Environment): boolean {
  const inspected = inspectRuntimeEnvironment(env);
  return (
    inspected.errors.length === 0 && inspected.profile.demoEndpointsEnabled
  );
}
