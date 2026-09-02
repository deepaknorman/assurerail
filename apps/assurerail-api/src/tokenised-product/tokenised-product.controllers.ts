import { Controller, ForbiddenException, Get, Param, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { RoomActor } from "../rooms/room-authority.service";
import { TokenisedProductService } from "./tokenised-product.service";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };
function context(req: RailRequest): RoomActor {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("an active Rail session is required");
  if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("an active institution session context is required");
  return { actorUserId: req.user.id, actorSessionId: req.user.session.id, actingInstitutionId: req.user.activeInstitution.institutionId };
}

@Controller("v1/rail/tokenised-routes")
export class TokenisedProductRegistryController {
  constructor(private readonly product: TokenisedProductService) {}
  @Get() list(@Req() req: RailRequest) { return this.product.list(context(req)); }
}

@Controller("v1/rail/cases/:caseId/tokenised-product")
export class TokenisedProductController {
  constructor(private readonly product: TokenisedProductService) {}
  @Get() overview(@Req() req: RailRequest, @Param("caseId") caseId: string) { return this.product.overview(context(req), caseId); }
  @Get("evidence-pack") evidencePack(@Req() req: RailRequest, @Param("caseId") caseId: string) { return this.product.evidencePack(context(req), caseId); }
}
