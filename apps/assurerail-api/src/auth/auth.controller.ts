import { Body, Controller, ForbiddenException, Get, Post, Req, UnauthorizedException } from "@nestjs/common";
import { audit } from "../common/audit";
import { Public } from "./public.decorator";
import { FirebaseAdminService } from "./firebase-admin.service";
import { RecaptchaService } from "./recaptcha.service";
import { IdentityBindingService } from "./identity-binding.service";
import { VenueUserService } from "./venue-user.service";
import { isAdminEmail } from "./admin";

interface SessionBody {
  idToken?: string;
  recaptchaToken?: string;
  activeInstitutionId?: string;
}

@Controller("venue/auth")
export class AuthController {
  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly recaptcha: RecaptchaService,
    private readonly identityBinding: IdentityBindingService,
    private readonly users: VenueUserService,
  ) {}

  /** Public: verify a Firebase ID token (defended by reCAPTCHA Enterprise) → resolve the venue user. */
  @Public()
  @Post("session")
  async session(@Body() body: SessionBody, @Req() req: { ip?: string; headers?: Record<string, string | string[] | undefined> }) {
    if (!body?.idToken) throw new UnauthorizedException("idToken required");
    const assess = await this.recaptcha.assess(body.recaptchaToken, "LOGIN", req.ip);
    if (!assess.ok) throw new UnauthorizedException(`reCAPTCHA rejected: ${assess.reason}`);

    const decoded = await this.firebase.verifyIdToken(body.idToken);
    const user = await this.users.resolveFromToken({ uid: decoded.uid, email: decoded.email, name: decoded.name });
    const isAdmin = user.isAdmin || isAdminEmail(decoded.email, decoded.email_verified);
    const session = await this.users.recordSession({
      userId: user.id,
      idToken: body.idToken,
      activeInstitutionId: body.activeInstitutionId,
      expiresAt: decoded.exp ? new Date(decoded.exp * 1_000) : null,
      credentialAssurance: decoded.firebase?.sign_in_provider ? `FIREBASE:${decoded.firebase.sign_in_provider}` : "FIREBASE",
      ip: req.ip,
      userAgent: Array.isArray(req.headers?.["user-agent"])
        ? req.headers?.["user-agent"]?.[0]
        : req.headers?.["user-agent"],
      securityContext: { emailVerified: decoded.email_verified === true, authTime: decoded.auth_time ?? null },
    });
    audit("auth.session", { uid: decoded.uid, email: decoded.email, identityBound: !!user.identityVerifiedAt });
    return {
      user: { ...user, isAdmin, emailVerified: decoded.email_verified === true },
      recaptchaScore: assess.score,
      needsOnboarding: !user.identityVerifiedAt,
      session,
    };
  }

  /** Authenticated: the current venue user (as attached by the guard). */
  @Get("me")
  me(@Req() req: { user: unknown }) {
    return req.user;
  }

  /** Authenticated: bind a verified external identity. This grants no participant admission. */
  @Post("onboard")
  async onboard(
    @Req() req: { user: { email: string; firebaseUid: string } },
    @Body() body: { did?: string; provider?: string },
  ) {
    const result = await this.identityBinding.verify({
      provider: body?.provider,
      email: req.user.email,
      claimedSubject: body?.did,
    });
    if (!result.ok || !result.subject) throw new ForbiddenException(`identity binding failed: ${result.reason}`);
    const user = await this.users.bindIdentity(req.user.firebaseUid, result.providerKey, result.subject);
    audit("auth.identity_bound", { uid: req.user.firebaseUid, provider: result.providerKey, mode: result.reason });
    return { user, provider: result.providerKey, subject: result.subject, grantsAdmission: false };
  }
}
