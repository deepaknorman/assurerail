// AssureRail venue configuration, read once at startup.
export const config = {
  tapeSource: (process.env.TAPE_SOURCE ?? "demo").toLowerCase() as "demo" | "live",
  tapeProviderApiUrl: (process.env.TAPE_PROVIDER_API_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  tapeProviderApiKey: process.env.TAPE_PROVIDER_API_KEY ?? "",
  identityProviderApiUrl: (process.env.IDENTITY_PROVIDER_API_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  identityProviderApiKey: process.env.IDENTITY_PROVIDER_API_KEY ?? "",
  anchorProviderApiUrl: (process.env.ANCHOR_PROVIDER_API_URL ?? "http://localhost:3003").replace(/\/$/, ""),
  anchorProviderApiKey: process.env.ANCHOR_PROVIDER_API_KEY ?? "",
  settlementProviderApiUrl: (process.env.SETTLEMENT_PROVIDER_API_URL ?? "http://localhost:3003").replace(/\/$/, ""),
  settlementProviderApiKey: process.env.SETTLEMENT_PROVIDER_API_KEY ?? "",
  htsAdapter: (process.env.HTS_ADAPTER ?? "demo").toLowerCase() as "demo" | "live",
  // HCS anchoring of surveillance verdicts via plaza. DEMO fakes the anchor; LIVE calls plaza's HCS.
  hcsAnchor: (process.env.HCS_ANCHOR ?? "demo").toLowerCase() as "demo" | "live",
  // Settlement is an ADAPTER; the token is a PARAMETER. Domestic default e₹; GIFT/FCY later.
  settlementToken: process.env.SETTLEMENT_TOKEN ?? "eRupee",
  settlementAdapter: (process.env.SETTLEMENT_ADAPTER ?? "demo").toLowerCase() as "demo" | "live",
  port: Number(process.env.PORT ?? "3006"),
};
