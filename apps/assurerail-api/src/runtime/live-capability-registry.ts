/**
 * Capabilities that have an implemented, case-scoped controlled-live command path.
 *
 * A signed activation manifest can narrow this set, but cannot make an unimplemented
 * capability executable. PR-12 deliberately starts with an empty registry. Later PRs
 * may add an ID only when the corresponding command calls OperationalActivationGuard
 * and its external-action path is durable, idempotent and reconciled. PR-15 builds the tokenised-DA
 * connector path but deliberately leaves its candidate IDs out of this registry until independent
 * connector, custody, legal/finality and operating-acceptance evidence has been reviewed.
 */
export type LiveAdapterDependency = "tape" | "hts" | "hcs" | "settlement";

export interface ImplementedLiveCapability {
  readonly id: string;
  readonly requiredAdapters: readonly LiveAdapterDependency[];
}

// Register the capability and its exact provider dependencies together. This prevents a future DA,
// PTC or token function from making every connector mandatory merely because the runtime is live.
export const IMPLEMENTED_LIVE_CAPABILITIES: readonly ImplementedLiveCapability[] = [];
export const IMPLEMENTED_LIVE_CAPABILITY_IDS = IMPLEMENTED_LIVE_CAPABILITIES.map((item) => item.id);

const IMPLEMENTED = new Map(IMPLEMENTED_LIVE_CAPABILITIES.map((item) => [item.id, item]));

export function isLiveCapabilityImplemented(capabilityId: string): boolean {
  return IMPLEMENTED.has(capabilityId);
}

export function requiredLiveAdapters(capabilityIds: readonly string[]): ReadonlySet<LiveAdapterDependency> {
  const result = new Set<LiveAdapterDependency>();
  for (const capabilityId of capabilityIds) {
    for (const adapter of IMPLEMENTED.get(capabilityId)?.requiredAdapters ?? []) result.add(adapter);
  }
  return result;
}
