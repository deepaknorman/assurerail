import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { RegistrationResponseJSON } from "@simplewebauthn/typescript-types";
import { MfaService } from "./mfa.service";
import { WebAuthnService } from "./webauthn.service";

// Both surfaces key on the Firebase uid (stable per account); the global AuthGuard sets req.firebase.
function reqUid(req: Request): string {
  const uid = (req as { firebase?: { uid?: string } }).firebase?.uid;
  if (!uid) throw new UnauthorizedException("authentication required");
  return uid;
}
function reqUser(req: Request): { email?: string; displayName?: string } {
  return (req as { user?: { email?: string; displayName?: string } }).user ?? {};
}

@Controller("venue/auth/mfa")
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get("status")
  status(@Req() req: Request) {
    return this.mfa.status(reqUid(req));
  }

  @Post("enroll/totp")
  enroll(@Req() req: Request) {
    return this.mfa.enrollTotp(reqUid(req), reqUser(req).email ?? reqUid(req));
  }

  @Post("verify/totp")
  verify(@Req() req: Request, @Body() b: { code?: string }) {
    if (!b?.code) throw new BadRequestException("code is required");
    return this.mfa.verifyTotp(reqUid(req), b.code);
  }

  @Delete(":method")
  disable(@Req() req: Request, @Param("method") method: string) {
    return this.mfa.disable(reqUid(req), method.toUpperCase());
  }
}

@Controller("venue/auth/webauthn")
export class WebAuthnController {
  constructor(private readonly wa: WebAuthnService) {}

  @Get("credentials")
  list(@Req() req: Request) {
    return this.wa.listCredentials(reqUid(req));
  }

  @Post("register/options")
  options(@Req() req: Request) {
    const u = reqUser(req);
    return this.wa.registrationOptions(reqUid(req), u.email ?? reqUid(req), u.displayName ?? u.email ?? "AssureRail user");
  }

  @Post("register/verify")
  verify(@Req() req: Request, @Body() b: { response?: RegistrationResponseJSON; name?: string }) {
    if (!b?.response) throw new BadRequestException("response is required");
    return this.wa.verifyRegistration(reqUid(req), b.response, b.name);
  }

  @Delete("credentials/:id")
  del(@Req() req: Request, @Param("id") id: string) {
    return this.wa.deleteCredential(reqUid(req), id);
  }
}
