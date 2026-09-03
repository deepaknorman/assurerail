export const INSTITUTION_TYPES = ["NBFC_ORIGINATOR", "BANK_OR_TRANSFEREE", "INVESTOR", "TRUSTEE", "RTA_OR_DEPOSITORY", "ADVISOR_OR_PROVIDER"] as const;
export const INQUIRY_ROUTES = ["DA", "PTC", "BOTH"] as const;
export const CURRENT_STAGES = ["EXPLORING", "COMPLETED_DEAL_AVAILABLE", "LIVE_PIPELINE", "EXISTING_PLATFORM_REVIEW"] as const;
export const OWNER_STATES = ["NAMED", "IDENTIFYING", "NOT_YET"] as const;
export const TIMINGS = ["WITHIN_30_DAYS", "ONE_TO_THREE_MONTHS", "THREE_TO_SIX_MONTHS", "LATER"] as const;

export type ReplayInquiry = {
  organization: string;
  workEmail: string;
  jobRole: string;
  institutionType: typeof INSTITUTION_TYPES[number];
  route: typeof INQUIRY_ROUTES[number];
  currentStage: typeof CURRENT_STAGES[number];
  transactionOwner: typeof OWNER_STATES[number];
  timing: typeof TIMINGS[number];
  consent: boolean;
  website: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateReplayInquiry(value: unknown): { ok: true; data: ReplayInquiry } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "Invalid request." };
  const data = value as Record<string, unknown>;
  const allowed = new Set(["organization", "workEmail", "jobRole", "institutionType", "route", "currentStage", "transactionOwner", "timing", "consent", "website"]);
  if (Object.keys(data).some((key) => !allowed.has(key))) return { ok: false, error: "Unexpected field." };
  if (typeof data.website !== "string" || data.website.length > 0) return { ok: false, error: "Request rejected." };
  if (typeof data.organization !== "string" || data.organization.trim().length < 2 || data.organization.trim().length > 120) return { ok: false, error: "Enter an organisation name." };
  if (typeof data.workEmail !== "string" || data.workEmail.length > 180 || !emailPattern.test(data.workEmail)) return { ok: false, error: "Enter a valid work email." };
  if (typeof data.jobRole !== "string" || data.jobRole.trim().length < 2 || data.jobRole.trim().length > 100) return { ok: false, error: "Enter your role." };
  if (!INSTITUTION_TYPES.includes(data.institutionType as never)) return { ok: false, error: "Choose an institution type." };
  if (!INQUIRY_ROUTES.includes(data.route as never)) return { ok: false, error: "Choose a transaction route." };
  if (!CURRENT_STAGES.includes(data.currentStage as never)) return { ok: false, error: "Choose the current stage." };
  if (!OWNER_STATES.includes(data.transactionOwner as never)) return { ok: false, error: "Choose the transaction-owner status." };
  if (!TIMINGS.includes(data.timing as never)) return { ok: false, error: "Choose a timing." };
  if (data.consent !== true) return { ok: false, error: "Consent is required." };
  return {
    ok: true,
    data: {
      organization: data.organization.trim(),
      workEmail: data.workEmail.trim().toLowerCase(),
      jobRole: data.jobRole.trim(),
      institutionType: data.institutionType as ReplayInquiry["institutionType"],
      route: data.route as ReplayInquiry["route"],
      currentStage: data.currentStage as ReplayInquiry["currentStage"],
      transactionOwner: data.transactionOwner as ReplayInquiry["transactionOwner"],
      timing: data.timing as ReplayInquiry["timing"],
      consent: true,
      website: "",
    },
  };
}

export function qualificationStage(data: ReplayInquiry) {
  if (data.currentStage === "COMPLETED_DEAL_AVAILABLE" && data.transactionOwner === "NAMED") return "REPLAY_DISCOVERY_READY";
  if (data.transactionOwner === "NOT_YET") return "NURTURE_TRANSACTION_OWNER";
  return "QUALIFICATION_REQUIRED";
}
