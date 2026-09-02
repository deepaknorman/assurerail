import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY, ADMIN_KEY, SUPERADMIN_KEY, ENTITY_ROLES_KEY } from "./roles.decorator";
import { inspectPersistenceFlags } from "../persistence/feature-flags";

// Global authorization guard. Tiers (a platform SUPERADMIN bypasses every check):
//   @SuperAdminOnly  → platformRole === "SUPERADMIN"
//   @AdminOnly       → platform admin (isAdmin — SUPERADMIN or ADMIN)
//   @EntityRoles(…)  → one of the given entity roles (platform admin bypasses)
//   @Roles(…)        → one of the function roles AND onboarded (ACTIVE + allow-listed); admin bypasses
// A route with none of these is authentication-only. When the neutral internal control plane is
// enforced, every legacy decorator-gated route is retired: new Rail services perform their own
// institution/case/internal-permission checks and must not fall back to global legacy roles.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as
      | { role?: string; isAdmin?: boolean; platformRole?: string | null; entityRole?: string | null; status?: string; allowlisted?: boolean }
      | undefined;
    const internalEnforced = inspectPersistenceFlags(process.env).internalRbac === "enforce";

    const superAdminOnly = this.reflector.getAllAndOverride<boolean>(SUPERADMIN_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (superAdminOnly) {
      if (internalEnforced) throw new ForbiddenException("legacy SUPERADMIN route is disabled while internal RBAC enforcement is active");
      if (user?.platformRole !== "SUPERADMIN") throw new ForbiddenException("superadmin only");
      return true;
    }

    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (adminOnly) {
      if (internalEnforced) throw new ForbiddenException("legacy platform-admin route is disabled while internal RBAC enforcement is active");
      if (!user?.isAdmin) throw new ForbiddenException("admin only");
      return true;
    }

    const entityRoles = this.reflector.getAllAndOverride<string[]>(ENTITY_ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (entityRoles && entityRoles.length > 0) {
      if (internalEnforced) {
        throw new ForbiddenException("legacy entity-role route is disabled while internal RBAC enforcement is active");
      }
      if (user?.isAdmin && !internalEnforced) return true; // legacy-only bypass
      if (user?.status !== "ACTIVE" || !user.allowlisted) {
        throw new ForbiddenException("legacy entity-role access requires an active allow-listed account");
      }
      if (!user?.entityRole || !entityRoles.includes(user.entityRole)) {
        throw new ForbiddenException(`requires one of the entity roles: ${entityRoles.join(", ")}`);
      }
      return true;
    }

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles || roles.length === 0) return true;

    if (!user) throw new ForbiddenException("authentication required");
    if (internalEnforced) {
      throw new ForbiddenException("legacy function-role route is disabled while internal RBAC enforcement is active");
    }
    if (user.isAdmin && !internalEnforced) return true; // legacy-only bypass

    if (user.status !== "ACTIVE" || !user.allowlisted) {
      throw new ForbiddenException("account not onboarded — complete DigiKYC onboarding first");
    }
    if (!user.role || !roles.includes(user.role)) {
      throw new ForbiddenException(`requires one of the roles: ${roles.join(", ")}`);
    }
    return true;
  }
}
