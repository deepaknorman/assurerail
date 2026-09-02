export const CUSTOMER_WORKSPACE_FLAG =
  "NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1";
export const CUSTOMER_OPERATIONS_FLAG =
  "NEXT_PUBLIC_ASSURERAIL_CUSTOMER_OPERATIONS_V1";
export const HOSTED_ALPHA_FLAG = "NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1";
export const INSTITUTIONAL_PRODUCT_FLAG =
  "NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1";
export const DA_PRODUCT_FLAG = "NEXT_PUBLIC_ASSURERAIL_DA_PRODUCT_V1";
export const PTC_PRODUCT_FLAG = "NEXT_PUBLIC_ASSURERAIL_PTC_PRODUCT_V1";
export const LIFECYCLE_PRODUCT_FLAG =
  "NEXT_PUBLIC_ASSURERAIL_LIFECYCLE_PRODUCT_V1";
export const PRIMARY_VENUE_PRODUCT_FLAG =
  "NEXT_PUBLIC_ASSURERAIL_PRIMARY_VENUE_PRODUCT_V1";
export const SECONDARY_PRODUCT_FLAG =
  "NEXT_PUBLIC_ASSURERAIL_SECONDARY_PRODUCT_V1";
export const TOKENISED_PRODUCT_FLAG =
  "NEXT_PUBLIC_ASSURERAIL_TOKENISED_PRODUCT_V1";
export const ENTERPRISE_INTEGRATION_FLAG =
  "NEXT_PUBLIC_ASSURERAIL_ENTERPRISE_INTEGRATION_V1";
export const PRODUCTION_SCALE_FLAG =
  "NEXT_PUBLIC_ASSURERAIL_PRODUCTION_SCALE_V1";
export const GUIDED_JOURNEY_FLAG =
  "NEXT_PUBLIC_ASSURERAIL_GUIDED_JOURNEY_V1";
export const SANDBOX_FLAG = "NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1";

export function customerWorkspaceEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function customerOperationsEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_CUSTOMER_OPERATIONS_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function hostedAlphaEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function institutionalProductEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function daProductEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_DA_PRODUCT_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function ptcProductEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_PTC_PRODUCT_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function lifecycleProductEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_LIFECYCLE_PRODUCT_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function primaryVenueProductEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_PRIMARY_VENUE_PRODUCT_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function secondaryProductEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_SECONDARY_PRODUCT_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function tokenisedProductEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_TOKENISED_PRODUCT_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function enterpriseIntegrationEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_ENTERPRISE_INTEGRATION_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function productionScaleEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_PRODUCTION_SCALE_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function guidedJourneyEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_GUIDED_JOURNEY_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export function sandboxEnabled(
  value = process.env.NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1
): boolean {
  return value?.trim().toLowerCase() === "shadow";
}

export type HostedAlphaTaskCategory =
  | "GOVERNANCE"
  | "CASE"
  | "EVIDENCE"
  | "RECONCILIATION"
  | "COMMERCIAL"
  | "SERVICE";
export type HostedAlphaTaskPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
export type HostedAlphaDueState = "OVERDUE" | "DUE_SOON" | "OPEN" | "WATCH";

export interface HostedAlphaTask {
  id: string;
  category: HostedAlphaTaskCategory;
  priority: HostedAlphaTaskPriority;
  dueState: HostedAlphaDueState;
  title: string;
  summary: string;
  href: string;
  sourceType: string;
  sourceId: string;
  transactionCaseId: string | null;
  requiredAction: string;
  dueAt: string | null;
  operatingBoundary: "SHADOW";
}

export interface HostedAlphaTaskResponse {
  generatedAt: string;
  institutionId: string;
  actorUserId: string;
  operatingBoundary: "SHADOW";
  authorityNotice: string;
  counts: {
    total: number;
    actionRequired: number;
    watch: number;
    critical: number;
    overdue: number;
    dueSoon: number;
    byCategory: Record<HostedAlphaTaskCategory, number>;
  };
  tasks: HostedAlphaTask[];
}

export function hostedAlphaTaskTone(
  task: Pick<HostedAlphaTask, "priority" | "dueState">
): string {
  if (task.priority === "CRITICAL" || task.dueState === "OVERDUE")
    return "task-critical";
  if (task.priority === "HIGH" || task.dueState === "DUE_SOON")
    return "task-attention";
  return "";
}

export type Availability<T> =
  | { status: "AVAILABLE"; data: T }
  | { status: "UNAVAILABLE"; reason: string };

export function availability<T>(
  result: PromiseSettledResult<T>
): Availability<T> {
  return result.status === "fulfilled"
    ? { status: "AVAILABLE", data: result.value }
    : {
        status: "UNAVAILABLE",
        reason:
          result.reason instanceof Error
            ? result.reason.message
            : "Capability unavailable",
      };
}

export type EvidenceDisplayState =
  | "EXPECTED"
  | "RECEIVED"
  | "VERIFIED"
  | "RECONCILED"
  | "LEGALLY_EFFECTIVE";

export function evidenceDisplayState(input: {
  legallyEffective?: boolean;
  reconciled?: boolean;
  result?: string | null;
  received?: boolean;
}): EvidenceDisplayState {
  if (input.legallyEffective) return "LEGALLY_EFFECTIVE";
  if (input.reconciled) return "RECONCILED";
  if (input.result === "VERIFIED") return "VERIFIED";
  if (input.received || input.result) return "RECEIVED";
  return "EXPECTED";
}

export function stateTone(state: EvidenceDisplayState): string {
  if (state === "LEGALLY_EFFECTIVE" || state === "RECONCILED") return "pill-ok";
  if (state === "EXPECTED" || state === "RECEIVED") return "pill-warn";
  return "";
}

export function activeMandateActions(
  mandates: Array<{
    action: string;
    status?: string;
    effectiveAt?: string | null;
    expiresAt?: string | null;
  }>,
  at = new Date()
): Set<string> {
  return new Set(
    mandates
      .filter((item) => item.status === undefined || item.status === "ACTIVE")
      .filter((item) => !item.effectiveAt || new Date(item.effectiveAt) <= at)
      .filter((item) => !item.expiresAt || new Date(item.expiresAt) > at)
      .map((item) => item.action)
  );
}

export function qualificationText(value: unknown): string {
  if (value === null || value === undefined) return "No qualification supplied";
  if (typeof value === "string") return value || "No qualification supplied";
  if (Array.isArray(value))
    return value.length
      ? value.map(String).join("; ")
      : "No qualification supplied";
  return JSON.stringify(value);
}
