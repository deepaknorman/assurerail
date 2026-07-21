import { SetMetadata } from "@nestjs/common";
import { VENUE_ROLES, type VenueRole } from "../access/roles";

// @Roles(...) — the RolesGuard requires the caller to hold one of these venue roles (platform admin
// bypasses) AND to be onboarded (ACTIVE + allow-listed via the DigiKYC gate). A route with no @Roles is
// authentication-only.
export const ROLES_KEY = "arail:roles";
export const Roles = (...roles: VenueRole[]) => SetMetadata(ROLES_KEY, roles);

// Any onboarded venue member (used to gate reads behind the onboarding requirement).
export const ALL_ROLES: VenueRole[] = [...VENUE_ROLES];

// Platform-admin only (the RolesGuard requires req.user.isAdmin) — for the admin module.
export const ADMIN_KEY = "arail:adminOnly";
export const AdminOnly = () => SetMetadata(ADMIN_KEY, true);
