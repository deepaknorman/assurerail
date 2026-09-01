import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { RoomActor } from "../rooms/room-authority.service";
import { PtcReplayService } from "./ptc-replay.service";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };

function context(req: RailRequest): RoomActor {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("an active Rail session is required");
  if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("an active institution session context is required");
  return { actorUserId: req.user.id, actorSessionId: req.user.session.id, actingInstitutionId: req.user.activeInstitution.institutionId };
}

@Controller("v1/rail/cases/:caseId/ptc-replay")
export class PtcReplayController {
  constructor(private readonly replay: PtcReplayService) {}

  @Get("authorisation")
  authorisation(@Req() req: RailRequest, @Param("caseId") caseId: string) {
    return this.replay.getAuthorisation(context(req), caseId);
  }

  @Post("authorisation")
  proposeAuthorisation(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<PtcReplayService["proposeAuthorisation"]>[2]) {
    return this.replay.proposeAuthorisation(context(req), caseId, body);
  }

  @Post("authorisation/:authorisationId/review")
  reviewAuthorisation(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("authorisationId") authorisationId: string, @Body() body: Parameters<PtcReplayService["reviewAuthorisation"]>[3]) {
    return this.replay.reviewAuthorisation(context(req), caseId, authorisationId, body);
  }

  @Get("sagas")
  sagas(@Req() req: RailRequest, @Param("caseId") caseId: string) {
    return this.replay.listSagas(context(req), caseId);
  }

  @Post("sagas")
  createSaga(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<PtcReplayService["createSaga"]>[2]) {
    return this.replay.createSaga(context(req), caseId, body);
  }
}
