import { ServiceUnavailableException } from "@nestjs/common";

type Environment = Readonly<Record<string, string | undefined>>;

/**
 * Legacy Note services call adapters directly and therefore cannot satisfy the PR-12
 * activation contract. They remain available in demo/replay/shadow for regression and
 * comparison, but are never a controlled-live or production execution path.
 */
export function assertLegacyExternalEffectPathAllowed(
  operation: string,
  env: Environment = process.env,
): void {
  const mode = env.ASSURERAIL_OPERATING_MODE?.trim().toUpperCase().replace(/[\s-]+/g, "_")
    ?? (env.NODE_ENV === "production" ? "PRODUCTION" : "DEMO");
  if (mode === "CONTROLLED_LIVE" || mode === "PRODUCTION") {
    throw new ServiceUnavailableException(
      `${operation} is a legacy direct external-effect path and is disabled in ${mode}; use an activated case-scoped saga capability`,
    );
  }
}
