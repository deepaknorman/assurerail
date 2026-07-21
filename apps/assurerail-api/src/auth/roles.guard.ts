import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

// Global authorization guard. Enforces @Roles: platform admin bypasses; otherwise the caller must be
// ONBOARDED (status ACTIVE + allow-listed via the DigiKYC gate) AND hold one of the required roles. A
// route with no @Roles is authentication-only (the AuthGuard already handled it).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles || roles.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { role?: string; isAdmin?: boolean; status?: string; allowlisted?: boolean } | undefined;
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
