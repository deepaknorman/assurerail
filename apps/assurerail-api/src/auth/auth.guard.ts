import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { FirebaseAdminService } from "./firebase-admin.service";
import { VenueUserService } from "./venue-user.service";
import { isAdminEmail } from "./admin";

// Global authentication guard. Secure-by-default: every route requires a valid AssureRail Firebase ID
// token unless marked @Public(). On a public route it opportunistically attaches req.user if a valid
// token is present but never rejects (matches AssureLocker).
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseAdminService,
    private readonly users: VenueUserService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    const token = this.bearer(req);

    if (isPublic) {
      if (token) {
        try {
          await this.attach(req, token);
        } catch {
          /* public route — ignore a bad/absent token */
        }
      }
      return true;
    }

    if (!token) throw new UnauthorizedException("missing bearer token");
    await this.attach(req, token);
    return true;
  }

  private bearer(req: { headers?: Record<string, string | undefined> }): string | undefined {
    const h = req.headers?.authorization;
    return h?.startsWith("Bearer ") ? h.slice(7) : undefined;
  }

  private async attach(req: Record<string, unknown>, token: string): Promise<void> {
    const decoded = await this.firebase.verifyIdToken(token);
    const user = await this.users.resolveFromToken({ uid: decoded.uid, email: decoded.email, name: decoded.name });
    const emailVerified = decoded.email_verified === true;
    const session = await this.users.resolveSession(user.id, token);
    const requestedInstitution = ((req.headers as Record<string, string | undefined> | undefined)?.["x-assurerail-institution-id"] ?? "").trim();
    const activeInstitution = requestedInstitution
      ? await this.users.resolveInstitutionContext(user.id, requestedInstitution)
      : null;
    if (requestedInstitution && !activeInstitution) {
      throw new ForbiddenException("requested institution context is not active for this user");
    }
    if (requestedInstitution && (!session || session.activeInstitutionId !== requestedInstitution)) {
      throw new ForbiddenException("requested institution context is not bound to the active session");
    }
    req.firebase = decoded;
    req.user = {
      ...user,
      emailVerified,
      isAdmin: user.isAdmin || isAdminEmail(decoded.email, emailVerified),
      activeInstitution,
      session,
    };
  }
}
