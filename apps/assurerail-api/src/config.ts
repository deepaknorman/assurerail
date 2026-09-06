// AssureRail venue configuration, read once at startup.
function boundedTimeout(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= 500 && parsed <= 15_000 ? parsed : fallback;
}

export const config = {
  tapeSource: (process.env.TAPE_SOURCE ?? "demo").toLowerCase() as "off" | "demo" | "live",
  tapeProviderApiUrl: (process.env.TAPE_PROVIDER_API_URL ?? "http://tape-provider.invalid").replace(/\/$/, ""),
  tapeProviderApiKey: process.env.TAPE_PROVIDER_API_KEY ?? "",
  identityProviderApiUrl: (process.env.IDENTITY_PROVIDER_API_URL ?? "http://identity-provider.invalid").replace(/\/$/, ""),
  identityProviderApiKey: process.env.IDENTITY_PROVIDER_API_KEY ?? "",
  identityProviderStatusPath: process.env.IDENTITY_PROVIDER_STATUS_PATH ?? "/v1/identity-assurance/status",
  identityProviderTimeoutMs: boundedTimeout(process.env.IDENTITY_PROVIDER_TIMEOUT_MS, 5_000),
  anchorProviderApiUrl: (process.env.ANCHOR_PROVIDER_API_URL ?? "http://anchor-provider.invalid").replace(/\/$/, ""),
  anchorProviderApiKey: process.env.ANCHOR_PROVIDER_API_KEY ?? "",
  anchorProviderSubmitPath: process.env.ANCHOR_PROVIDER_SUBMIT_PATH ?? "/v1/anchors",
  settlementProviderApiUrl: (process.env.SETTLEMENT_PROVIDER_API_URL ?? "http://settlement-provider.invalid").replace(/\/$/, ""),
  settlementProviderApiKey: process.env.SETTLEMENT_PROVIDER_API_KEY ?? "",
  settlementProviderTransferPath: process.env.SETTLEMENT_PROVIDER_TRANSFER_PATH ?? "/v1/settlements",
  htsAdapter: (process.env.HTS_ADAPTER ?? "demo").toLowerCase() as "off" | "demo" | "live",
  // Optional anchoring adapter. DEMO fakes an anchor; LIVE calls the deployment-selected provider.
  hcsAnchor: (process.env.HCS_ANCHOR ?? "demo").toLowerCase() as "off" | "demo" | "live",
  // Settlement is an ADAPTER; the token is a PARAMETER. Domestic default e₹; GIFT/FCY later.
  settlementToken: process.env.SETTLEMENT_TOKEN ?? "eRupee",
  settlementAdapter: (process.env.SETTLEMENT_ADAPTER ?? "demo").toLowerCase() as "off" | "demo" | "live",
  port: Number(process.env.PORT ?? "3006"),
};
