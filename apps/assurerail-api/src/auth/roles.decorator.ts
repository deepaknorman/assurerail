import { SetMetadata } from "@nestjs/common";
import { VENUE_ROLES, type VenueRole, type EntityRole } from "../access/roles";

// @Roles(...) — the RolesGuard requires the caller to hold one of these venue roles (platform admin
// bypasses) AND to be onboarded (ACTIVE + allow-listed after identity binding). A route with no @Roles is
// authentication-only.
export const ROLES_KEY = "arail:roles";
export const Roles = (...roles: VenueRole[]) => SetMetadata(ROLES_KEY, roles);

// Any onboarded venue member (used to gate reads behind the onboarding requirement).
export const ALL_ROLES: VenueRole[] = [...VENUE_ROLES];

// Platform-admin only (SUPERADMIN or ADMIN — the RolesGuard requires req.user.isAdmin).
export const ADMIN_KEY = "arail:adminOnly";
export const AdminOnly = () => SetMetadata(ADMIN_KEY, true);

// Platform SUPERADMIN only (top of the platform tier — manage other staff, irreversible platform ops).
export const SUPERADMIN_KEY = "arail:superAdminOnly";
export const SuperAdminOnly = () => SetMetadata(SUPERADMIN_KEY, true);

// Entity-tier gate — caller must hold one of these entity roles (platform admin bypasses).
export const ENTITY_ROLES_KEY = "arail:entityRoles";
export const EntityRoles = (...roles: EntityRole[]) => SetMetadata(ENTITY_ROLES_KEY, roles);
