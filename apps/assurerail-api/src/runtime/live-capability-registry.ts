/**
 * Capabilities that have an implemented, case-scoped controlled-live command path.
 *
 * A signed activation manifest can narrow this set, but cannot make an unimplemented
 * capability executable. PR-12 deliberately starts with an empty registry. Later PRs
 * may add an ID only when the corresponding command calls OperationalActivationGuard
 * and its external-action path is durable, idempotent and reconciled.
 */
export const IMPLEMENTED_LIVE_CAPABILITY_IDS = [] as const;

const IMPLEMENTED = new Set<string>(IMPLEMENTED_LIVE_CAPABILITY_IDS);

export function isLiveCapabilityImplemented(capabilityId: string): boolean {
  return IMPLEMENTED.has(capabilityId);
}
