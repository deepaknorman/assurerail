// AssureRail's OWN access management (segregation primitive) — the venue's roles are distinct from
// AssureLocker's. Real authz + KYC allow-list onboarding is Trigger-1; enumerated now so authorization
// has a home from commit 1.
export const VENUE_ROLES = ["ISSUER", "DESK", "INVESTOR", "TRUSTEE", "REGULATOR"] as const;
export type VenueRole = (typeof VENUE_ROLES)[number];

// Platform tier — our own staff (mirrors plaza SUPER_ADMIN/ADMIN). SUPERADMIN acts directly; ADMIN can
// manage entity users but not other platform staff. Bootstrapped out-of-band via the seed-admin script.
export const PLATFORM_ROLES = ["SUPERADMIN", "ADMIN"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

// Entity tier — a lender/issuer org's own staff (mirrors AssureLocker's InstitutionMembership, simplified
// to three). ORGADMIN assigns roles to their team; MANAGER runs operations; OPERATOR acts in the app.
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
