import { Body, Controller, ForbiddenException, Get, Post, Req, UnauthorizedException } from "@nestjs/common";
import { audit } from "../common/audit";
import { Public } from "./public.decorator";
import { FirebaseAdminService } from "./firebase-admin.service";
import { RecaptchaService } from "./recaptcha.service";
import { DigiKycGateService } from "./digikyc-gate.service";
import { VenueUserService } from "./venue-user.service";
import { isAdminEmail } from "./admin";

interface SessionBody {
  idToken?: string;
  recaptchaToken?: string;
}

@Controller("venue/auth")
export class AuthController {
  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly recaptcha: RecaptchaService,
    private readonly gate: DigiKycGateService,
    private readonly users: VenueUserService,
  ) {}

  /** Public: verify a Firebase ID token (defended by reCAPTCHA Enterprise) → resolve the venue user. */
  @Public()
  @Post("session")
  async session(@Body() body: SessionBody, @Req() req: { ip?: string }) {
    if (!body?.idToken) throw new UnauthorizedException("idToken required");
    const assess = await this.recaptcha.assess(body.recaptchaToken, "LOGIN", req.ip);
    if (!assess.ok) throw new UnauthorizedException(`reCAPTCHA rejected: ${assess.reason}`);

    const decoded = await this.firebase.verifyIdToken(body.idToken);
    const user = await this.users.resolveFromToken({ uid: decoded.uid, email: decoded.email, name: decoded.name });
    const isAdmin = user.isAdmin || isAdminEmail(decoded.email, decoded.email_verified);
    audit("auth.session", { uid: decoded.uid, email: decoded.email, onboarded: user.status === "ACTIVE" });
    return {
      user: { ...user, isAdmin, emailVerified: decoded.email_verified === true },
      recaptchaScore: assess.score,
      needsOnboarding: user.status !== "ACTIVE",
    };
  }

  /** Authenticated: the current venue user (as attached by the guard). */
  @Get("me")
  me(@Req() req: { user: unknown }) {
    return req.user;
  }

  /** Authenticated: run the DigiKYC gate → activate + record the AssureLocker DID (reference only). */
  @Post("onboard")
  async onboard(@Req() req: { user: { email: string; firebaseUid: string } }, @Body() body: { did?: string }) {
    const result = await this.gate.verify(req.user.email, body?.did);
    if (!result.ok) throw new ForbiddenException(`DigiKYC gate failed: ${result.reason}`);
    const user = await this.users.onboard(req.user.firebaseUid, result.did!);
    audit("auth.onboarded", { uid: req.user.firebaseUid, did: result.did, mode: result.reason });
    return { user, did: result.did };
  }
}
