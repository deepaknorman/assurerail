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

  @Post("sagas/:sagaId/legs/:legId/observations")
  observe(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("sagaId") sagaId: string, @Param("legId") legId: string, @Body() body: Parameters<PtcReplayService["recordObservation"]>[4]) {
    return this.replay.recordObservation(context(req), caseId, sagaId, legId, body);
  }

  @Post("sagas/:sagaId/legs/:legId/reconcile")
  reconcile(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("sagaId") sagaId: string, @Param("legId") legId: string, @Body() body: Parameters<PtcReplayService["reconcileLeg"]>[4]) {
    return this.replay.reconcileLeg(context(req), caseId, sagaId, legId, body);
  }

  @Get("breaks")
  breaks(@Req() req: RailRequest, @Param("caseId") caseId: string) {
    return this.replay.listBreaks(context(req), caseId);
  }

  @Post("breaks/:breakId/repairs")
  proposeRepair(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("breakId") breakId: string, @Body() body: Parameters<PtcReplayService["proposeRepair"]>[3]) {
    return this.replay.proposeRepair(context(req), caseId, breakId, body);
  }

  @Post("breaks/:breakId/repairs/:repairId/review")
  reviewRepair(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("breakId") breakId: string, @Param("repairId") repairId: string, @Body() body: Parameters<PtcReplayService["reviewRepair"]>[4]) {
    return this.replay.reviewRepair(context(req), caseId, breakId, repairId, body);
  }

  @Get("sagas/:sagaId/comparison")
  comparison(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("sagaId") sagaId: string) {
    return this.replay.comparison(context(req), caseId, sagaId);
  }

  @Get("sagas/:sagaId/evidence-pack")
  evidencePack(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("sagaId") sagaId: string) {
    return this.replay.evidencePack(context(req), caseId, sagaId);
  }
}
