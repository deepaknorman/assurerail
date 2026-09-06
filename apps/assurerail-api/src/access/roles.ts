// Legacy venue-role compatibility. Governed institution, mandate and internal-RBAC records supersede
// these global roles for controlled-live operation.
export const VENUE_ROLES = ["ISSUER", "DESK", "INVESTOR", "TRUSTEE", "REGULATOR"] as const;
export type VenueRole = (typeof VENUE_ROLES)[number];

// Platform tier — AssureRail's own staff. SUPERADMIN acts directly; ADMIN can
// manage entity users but not other platform staff. Bootstrapped out-of-band via the seed-admin script.
export const PLATFORM_ROLES = ["SUPERADMIN", "ADMIN"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

// Legacy entity tier. ORGADMIN assigns roles to their team; MANAGER runs operations; OPERATOR acts.
export const ENTITY_ROLES = ["ORGADMIN", "MANAGER", "OPERATOR"] as const;
export type EntityRole = (typeof ENTITY_ROLES)[number];

export type VenueAction = "MINT" | "HOLD" | "VIEW" | "BREAK_GLASS";

const MATRIX: Record<VenueRole, VenueAction[]> = {
  ISSUER: ["MINT", "VIEW"],
  DESK: ["VIEW"],
  INVESTOR: ["HOLD", "VIEW"],
  TRUSTEE: ["VIEW"],
  REGULATOR: ["VIEW", "BREAK_GLASS"], // regulator gets break-glass to T2 (audited), never market actions
};

/** Coarse capability check placeholder — replaced by real authz + allow-list at 2b / Trigger-1. */
export function can(role: VenueRole, action: VenueAction): boolean {
  return MATRIX[role]?.includes(action) ?? false;
}
