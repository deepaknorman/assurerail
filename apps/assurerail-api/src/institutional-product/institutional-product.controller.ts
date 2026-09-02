import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { InstitutionalProductService } from "./institutional-product.service";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };
function actor(req: RailRequest, institutionId: string) {
  if (!req.user?.id || !req.user.session?.id) throw new UnauthorizedException("authenticated Rail session required");
  if (req.user.activeInstitution?.institutionId !== institutionId) throw new ForbiddenException("path institution must match active session context");
  return { actorUserId: req.user.id, actorSessionId: req.user.session.id, actingInstitutionId: institutionId };
}

@Controller("v1/rail/institutions/:institutionId/product")
export class InstitutionalProductController {
  constructor(private readonly service: InstitutionalProductService) {}
  @Get("overview") overview(@Req() req: RailRequest, @Param("institutionId") institutionId: string) { return this.service.overview(actor(req, institutionId)); }
  @Post("identity-connections") proposeConnection(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: Record<string, unknown>) { return this.service.proposeIdentityConnection(actor(req, institutionId), body); }
  @Post("identity-connections/:connectionId/review") reviewConnection(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Param("connectionId") connectionId: string, @Body() body: Record<string, unknown>) { return this.service.reviewIdentityConnection(actor(req, institutionId), connectionId, body); }
  @Post("service-identities") proposeServiceIdentity(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: Record<string, unknown>) { return this.service.proposeServiceIdentity(actor(req, institutionId), body); }
  @Post("service-identities/:principalId/review") reviewServiceIdentity(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Param("principalId") principalId: string, @Body() body: Record<string, unknown>) { return this.service.reviewServiceIdentity(actor(req, institutionId), principalId, body); }
  @Post("access-reviews") proposeAccessReview(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: Record<string, unknown>) { return this.service.proposeAccessReview(actor(req, institutionId), body); }
  @Post("access-reviews/:reviewId/review") reviewAccessReview(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Param("reviewId") reviewId: string, @Body() body: Record<string, unknown>) { return this.service.reviewAccessReview(actor(req, institutionId), reviewId, body); }
  @Post("exit-plans") proposeExit(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: Record<string, unknown>) { return this.service.proposeExit(actor(req, institutionId), body); }
  @Post("exit-plans/:exitPlanId/review") reviewExit(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Param("exitPlanId") exitPlanId: string, @Body() body: Record<string, unknown>) { return this.service.reviewExit(actor(req, institutionId), exitPlanId, body); }
}
