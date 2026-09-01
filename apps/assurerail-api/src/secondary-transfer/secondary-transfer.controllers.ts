import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { RoomActor } from "../rooms/room-authority.service";
import { SecondaryTransferService } from "./secondary-transfer.service";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };

function context(req: RailRequest): RoomActor {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("an active Rail session is required");
  if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("an active institution session context is required");
  return { actorUserId: req.user.id, actorSessionId: req.user.session.id, actingInstitutionId: req.user.activeInstitution.institutionId };
}

@Controller("v1/rail/cases/:caseId/secondary-transfer")
export class SecondaryTransferController {
  constructor(private readonly secondary: SecondaryTransferService) {}

  @Get()
  get(@Req() req: RailRequest, @Param("caseId") caseId: string) { return this.secondary.get(context(req), caseId); }

  @Post()
  create(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<SecondaryTransferService["create"]>[2]) {
    return this.secondary.create(context(req), caseId, body);
  }

  @Post("evidence")
  evidence(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<SecondaryTransferService["addEvidence"]>[2]) {
    return this.secondary.addEvidence(context(req), caseId, body);
  }

  @Post("propose")
  propose(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<SecondaryTransferService["propose"]>[2]) {
    return this.secondary.propose(context(req), caseId, body);
  }

  @Post("review")
  review(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<SecondaryTransferService["review"]>[2]) {
    return this.secondary.review(context(req), caseId, body);
  }
}
