import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
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
    req.firebase = decoded;
    req.user = { ...user, emailVerified, isAdmin: user.isAdmin || isAdminEmail(decoded.email, emailVerified) };
  }
}
