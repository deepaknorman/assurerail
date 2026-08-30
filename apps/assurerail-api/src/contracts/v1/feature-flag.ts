export const NEUTRAL_TAXONOMY_FLAG = "ARAIL_NEUTRAL_TAXONOMY_V1" as const;
export const NEUTRAL_TAXONOMY_FLAG_VALUES = ["off", "read_only"] as const;
export type NeutralTaxonomyFlagValue = (typeof NEUTRAL_TAXONOMY_FLAG_VALUES)[number];

/**
 * PR-01 is contract-only. The only enabled state is read-only serialization/mapping; write,
 * enforce, live and truthy aliases are intentionally rejected until later PRs own persistence.
 */
export function inspectNeutralTaxonomyFlag(
  env: Readonly<Record<string, string | undefined>>,
): { value: NeutralTaxonomyFlagValue; error?: string } {
  const raw = env[NEUTRAL_TAXONOMY_FLAG];
  if (raw === undefined || raw.trim() === "") return { value: "off" };
  const normalized = raw.trim().toLowerCase().replaceAll("-", "_");
  if (normalized === "off" || normalized === "read_only") return { value: normalized };
  return {
    value: "off",
    error: `${NEUTRAL_TAXONOMY_FLAG} must be "off" or "read_only"; PR-01 has no write/enforcement mode (received ${JSON.stringify(raw)})`,
  };
}
