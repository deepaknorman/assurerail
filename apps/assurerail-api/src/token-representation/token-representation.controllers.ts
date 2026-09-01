import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { RoomActor } from "../rooms/room-authority.service";
import { TokenRepresentationService } from "./token-representation.service";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };

function context(req: RailRequest): RoomActor {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("an active Rail session is required");
  if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("an active institution session context is required");
  return { actorUserId: req.user.id, actorSessionId: req.user.session.id, actingInstitutionId: req.user.activeInstitution.institutionId };
}

@Controller("v1/rail/cases/:caseId/token-representation")
export class TokenRepresentationController {
  constructor(private readonly representations: TokenRepresentationService) {}

  @Get()
  get(@Req() req: RailRequest, @Param("caseId") caseId: string) {
    return this.representations.get(context(req), caseId);
  }

  @Post("link")
  link(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<TokenRepresentationService["link"]>[2]) {
    return this.representations.link(context(req), caseId, body);
  }

  @Post("actions")
  prepareAction(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<TokenRepresentationService["prepareAction"]>[2]) {
    return this.representations.prepareAction(context(req), caseId, body);
  }

  @Post("actions/:actionId/observations")
  observeAction(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("actionId") actionId: string, @Body() body: Parameters<TokenRepresentationService["observeAction"]>[3]) {
    return this.representations.observeAction(context(req), caseId, actionId, body);
  }

  @Post("reconciliations")
  reconcile(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<TokenRepresentationService["reconcile"]>[2]) {
    return this.representations.reconcile(context(req), caseId, body);
  }
}
