import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY, ADMIN_KEY } from "./roles.decorator";

// Global authorization guard. Enforces @AdminOnly (req.user.isAdmin) and @Roles: platform admin bypasses
// role checks; otherwise the caller must be ONBOARDED (status ACTIVE + allow-listed via the DigiKYC gate)
// AND hold one of the required roles. A route with neither decorator is authentication-only.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { role?: string; isAdmin?: boolean; status?: string; allowlisted?: boolean } | undefined;

    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (adminOnly) {
      if (!user?.isAdmin) throw new ForbiddenException("admin only");
      return true;
    }

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles || roles.length === 0) return true;

    if (!user) throw new ForbiddenException("authentication required");
    if (user.isAdmin) return true; // platform admin bypasses role + onboarding checks

    if (user.status !== "ACTIVE" || !user.allowlisted) {
      throw new ForbiddenException("account not onboarded — complete DigiKYC onboarding first");
    }
    if (!user.role || !roles.includes(user.role)) {
      throw new ForbiddenException(`requires one of the roles: ${roles.join(", ")}`);
    }
    return true;
  }
}
