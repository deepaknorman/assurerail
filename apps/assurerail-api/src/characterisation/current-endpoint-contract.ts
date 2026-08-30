export type CurrentHttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type CurrentAccessContract =
  | "PUBLIC"
  | "AUTHENTICATED"
  | "ONBOARDED_ANY"
  | "ROLE:ISSUER"
  | "ROLES:ISSUER,DESK"
  | "ROLES:ISSUER,DESK,TRUSTEE"
  | "ROLES:ISSUER,TRUSTEE"
  | "ROLE:REGULATOR"
  | "ROLES:REGULATOR,TRUSTEE"
  | "PLATFORM_ADMIN"
  | "SUPERADMIN";

export type CurrentDataClass =
  | "PUBLIC_OPERATIONAL"
  | "ACCOUNT_IDENTITY"
  | "SECURITY_CONTROL"
  | "PLATFORM_CONTROL"
  | "POOL_T1"
  | "NOTE_T1"
  | "HOLDINGS_CONFIDENTIAL"
  | "DOCUMENT_CONFIDENTIAL"
  | "T2_ACCESS_METADATA"
  | "AUDIT_CONFIDENTIAL"
  | "BILLING_CONFIDENTIAL"
  | "INTEGRATION_SECRET"
  | "OPERATIONS_CONFIDENTIAL";

/**
 * This is a description of the CURRENT query/authorisation boundary, not the target boundary.
 * `GLOBAL_VENUE` and `RESOURCE_ID_ONLY` are deliberately explicit so a passing characterisation test
 * cannot be mistaken for tenant/case isolation.
 */
export type CurrentScope = "PUBLIC" | "CALLER" | "PLATFORM" | "GLOBAL_VENUE" | "RESOURCE_ID_ONLY";

export interface CurrentEndpointContract {
  method: CurrentHttpMethod;
  path: string;
  access: CurrentAccessContract;
  dataClass: CurrentDataClass;
  currentScope: CurrentScope;
  findings?: readonly string[];
  availability?: "ALWAYS" | "DB_MODE" | "DEMO_MODULE";
  authorizationEnforcement: "PUBLIC" | "DB_MODE_GLOBAL_GUARDS";
}

const e = (
  method: CurrentHttpMethod,
  path: string,
  access: CurrentAccessContract,
  dataClass: CurrentDataClass,
  currentScope: CurrentScope,
  findings: readonly string[] = [],
  availability: CurrentEndpointContract["availability"] = "DB_MODE",
): CurrentEndpointContract => ({
  method,
  path,
  access,
  dataClass,
  currentScope,
  findings,
  availability,
  authorizationEnforcement: access === "PUBLIC" ? "PUBLIC" : "DB_MODE_GLOBAL_GUARDS",
});

/**
 * Audited controller surface at PR-00. The metadata characterisation test compares this list with
 * Nest's decorator metadata, so a route or access-decorator change is a reviewed contract change.
 * Data classes/scopes are a manual risk classification and are also guarded by assertions below.
 */
export const CURRENT_ENDPOINT_CONTRACT: readonly CurrentEndpointContract[] = [
  e("GET", "/health", "PUBLIC", "PUBLIC_OPERATIONAL", "PUBLIC", [], "ALWAYS"),
  e("GET", "/healthz", "PUBLIC", "PUBLIC_OPERATIONAL", "PUBLIC", [], "ALWAYS"),
  e("GET", "/readyz", "PUBLIC", "PUBLIC_OPERATIONAL", "PUBLIC", [], "ALWAYS"),
  e("GET", "/metrics", "PUBLIC", "PUBLIC_OPERATIONAL", "PUBLIC", [], "ALWAYS"),

  e("POST", "/venue/auth/session", "PUBLIC", "ACCOUNT_IDENTITY", "CALLER"),
  e("GET", "/venue/auth/me", "AUTHENTICATED", "ACCOUNT_IDENTITY", "CALLER"),
  e("POST", "/venue/auth/onboard", "AUTHENTICATED", "ACCOUNT_IDENTITY", "CALLER", ["AR-C03"]),
  e("GET", "/venue/auth/mfa/status", "AUTHENTICATED", "SECURITY_CONTROL", "CALLER"),
  e("POST", "/venue/auth/mfa/enroll/totp", "AUTHENTICATED", "SECURITY_CONTROL", "CALLER"),
  e("POST", "/venue/auth/mfa/verify/totp", "AUTHENTICATED", "SECURITY_CONTROL", "CALLER"),
  e("DELETE", "/venue/auth/mfa/:method", "AUTHENTICATED", "SECURITY_CONTROL", "CALLER", ["AR-M18"]),
  e("GET", "/venue/auth/webauthn/credentials", "AUTHENTICATED", "SECURITY_CONTROL", "CALLER"),
  e("POST", "/venue/auth/webauthn/register/options", "AUTHENTICATED", "SECURITY_CONTROL", "CALLER"),
  e("POST", "/venue/auth/webauthn/register/verify", "AUTHENTICATED", "SECURITY_CONTROL", "CALLER"),
  e("DELETE", "/venue/auth/webauthn/credentials/:id", "AUTHENTICATED", "SECURITY_CONTROL", "CALLER", ["AR-M18"]),

  e("GET", "/venue/admin/users", "PLATFORM_ADMIN", "PLATFORM_CONTROL", "PLATFORM"),
  e("PATCH", "/venue/admin/users/:id", "PLATFORM_ADMIN", "PLATFORM_CONTROL", "PLATFORM", ["AR-C02", "AR-C03"]),
  e("PATCH", "/venue/admin/users/:id/platform-role", "SUPERADMIN", "PLATFORM_CONTROL", "PLATFORM"),
  e("POST", "/venue/admin/users/invite", "PLATFORM_ADMIN", "PLATFORM_CONTROL", "PLATFORM", ["AR-C03"]),
  e("GET", "/venue/admin/status", "PLATFORM_ADMIN", "OPERATIONS_CONFIDENTIAL", "PLATFORM"),

  e("GET", "/venue/notes", "ONBOARDED_ANY", "NOTE_T1", "GLOBAL_VENUE", ["AR-C01"], "ALWAYS"),
  e("POST", "/venue/mint/:poolId", "ROLE:ISSUER", "NOTE_T1", "RESOURCE_ID_ONLY", ["AR-C01", "AR-C05"], "ALWAYS"),
  e("POST", "/venue/demo/run/:poolId", "ROLE:ISSUER", "NOTE_T1", "RESOURCE_ID_ONLY", ["AR-C01", "AR-H13"], "DEMO_MODULE"),
  e("POST", "/venue/demo/receivables/run/:poolId", "ROLE:ISSUER", "NOTE_T1", "RESOURCE_ID_ONLY", ["AR-C01", "AR-H13"], "DEMO_MODULE"),
  e("GET", "/venue/tape/:poolId", "ONBOARDED_ANY", "POOL_T1", "RESOURCE_ID_ONLY", ["AR-C01"], "ALWAYS"),
  e("GET", "/venue/tape/:poolId/underlying", "ONBOARDED_ANY", "POOL_T1", "RESOURCE_ID_ONLY", ["AR-C01"], "ALWAYS"),
  e("POST", "/venue/notes/:noteId/surveillance/sync", "ROLES:ISSUER,DESK,TRUSTEE", "NOTE_T1", "RESOURCE_ID_ONLY", ["AR-C01", "AR-C06"], "ALWAYS"),
  e("GET", "/venue/notes/:noteId/surveillance", "ONBOARDED_ANY", "NOTE_T1", "RESOURCE_ID_ONLY", ["AR-C01"], "ALWAYS"),
  e("POST", "/venue/notes/:noteId/dvp", "ROLES:ISSUER,DESK", "HOLDINGS_CONFIDENTIAL", "RESOURCE_ID_ONLY", ["AR-C01", "AR-C04", "AR-H07", "AR-H08"], "ALWAYS"),
  e("GET", "/venue/notes/:noteId/dvp", "ONBOARDED_ANY", "HOLDINGS_CONFIDENTIAL", "RESOURCE_ID_ONLY", ["AR-C01"], "ALWAYS"),
  e("GET", "/venue/notes/:noteId/holdings", "ONBOARDED_ANY", "HOLDINGS_CONFIDENTIAL", "RESOURCE_ID_ONLY", ["AR-C01", "AR-H14"], "ALWAYS"),
  e("POST", "/venue/notes/:noteId/amortise", "ROLES:ISSUER,TRUSTEE", "HOLDINGS_CONFIDENTIAL", "RESOURCE_ID_ONLY", ["AR-C01", "AR-C05"], "ALWAYS"),
  e("POST", "/venue/notes/:noteId/close", "ROLES:ISSUER,TRUSTEE", "HOLDINGS_CONFIDENTIAL", "RESOURCE_ID_ONLY", ["AR-C01", "AR-C05"], "ALWAYS"),
  e("POST", "/venue/notes/:noteId/break-glass", "ROLE:REGULATOR", "T2_ACCESS_METADATA", "RESOURCE_ID_ONLY", ["AR-C01", "AR-H07"], "ALWAYS"),
  e("GET", "/venue/notes/:noteId/break-glass", "ROLES:REGULATOR,TRUSTEE", "T2_ACCESS_METADATA", "RESOURCE_ID_ONLY", ["AR-C01"], "ALWAYS"),
  e("GET", "/venue/reports/portfolio", "ONBOARDED_ANY", "NOTE_T1", "GLOBAL_VENUE", ["AR-C01"], "ALWAYS"),
  e("GET", "/venue/notes/:id/report", "ONBOARDED_ANY", "HOLDINGS_CONFIDENTIAL", "RESOURCE_ID_ONLY", ["AR-C01"], "ALWAYS"),
  e("GET", "/venue/notes/:id/export.csv", "ONBOARDED_ANY", "HOLDINGS_CONFIDENTIAL", "RESOURCE_ID_ONLY", ["AR-C01"], "ALWAYS"),
  e("GET", "/venue/activity", "ONBOARDED_ANY", "AUDIT_CONFIDENTIAL", "GLOBAL_VENUE", ["AR-C01", "AR-M17"]),

  e("GET", "/venue/documents", "ONBOARDED_ANY", "DOCUMENT_CONFIDENTIAL", "GLOBAL_VENUE", ["AR-C01", "AR-H11"]),
  e("POST", "/venue/documents", "ROLES:ISSUER,DESK,TRUSTEE", "DOCUMENT_CONFIDENTIAL", "RESOURCE_ID_ONLY", ["AR-C01", "AR-H11"]),
  e("GET", "/venue/documents/:id/download", "ONBOARDED_ANY", "DOCUMENT_CONFIDENTIAL", "RESOURCE_ID_ONLY", ["AR-C01", "AR-H11"]),
  e("GET", "/venue/ingress/pools", "ONBOARDED_ANY", "POOL_T1", "GLOBAL_VENUE", ["AR-C01", "AR-H12"]),
  e("POST", "/venue/ingress/pools", "ROLES:ISSUER,DESK", "POOL_T1", "GLOBAL_VENUE", ["AR-C01", "AR-H12"]),
  e("GET", "/venue/billing/statement", "ROLES:ISSUER,DESK", "BILLING_CONFIDENTIAL", "GLOBAL_VENUE", ["AR-C01"]),
  e("GET", "/venue/billing/events", "ROLES:ISSUER,DESK", "BILLING_CONFIDENTIAL", "GLOBAL_VENUE", ["AR-C01"]),
  e("GET", "/venue/webhooks", "PLATFORM_ADMIN", "INTEGRATION_SECRET", "PLATFORM", ["AR-H09"]),
  e("POST", "/venue/webhooks", "PLATFORM_ADMIN", "INTEGRATION_SECRET", "PLATFORM", ["AR-H09"]),
  e("DELETE", "/venue/webhooks/:id", "PLATFORM_ADMIN", "INTEGRATION_SECRET", "PLATFORM", ["AR-H09"]),
  e("GET", "/venue/webhooks/deliveries", "PLATFORM_ADMIN", "OPERATIONS_CONFIDENTIAL", "PLATFORM", ["AR-H09"]),
  e("GET", "/venue/support/events", "PLATFORM_ADMIN", "OPERATIONS_CONFIDENTIAL", "PLATFORM"),
  e("GET", "/venue/support/overview", "PLATFORM_ADMIN", "OPERATIONS_CONFIDENTIAL", "PLATFORM"),
  e("GET", "/venue/ops/health", "ONBOARDED_ANY", "OPERATIONS_CONFIDENTIAL", "GLOBAL_VENUE", ["AR-C01", "AR-M19"]),
  e("GET", "/venue/ops/findings", "ONBOARDED_ANY", "OPERATIONS_CONFIDENTIAL", "GLOBAL_VENUE", ["AR-C01", "AR-M19"]),
  e("POST", "/venue/ops/run", "PLATFORM_ADMIN", "OPERATIONS_CONFIDENTIAL", "PLATFORM"),
  e("PATCH", "/venue/ops/control", "SUPERADMIN", "PLATFORM_CONTROL", "PLATFORM"),
] as const;
