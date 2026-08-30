import { Body, Controller, Get, Param, Post, Req, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import type { Request } from "express";
import { CasesService } from "./cases.service";

type RailRequest = Request & {
  user?: {
    id?: string;
    session?: { id?: string } | null;
    activeInstitution?: { institutionId?: string } | null;
  };
};

function context(req: RailRequest): { actorUserId: string; actingInstitutionId: string; actorSessionId: string } {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("an active Rail session is required");
  if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("an active institution session context is required");
  return {
    actorUserId: req.user.id,
    actingInstitutionId: req.user.activeInstitution.institutionId,
    actorSessionId: req.user.session.id,
  };
}

@Controller("v1/rail/cases")
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  list(@Req() req: RailRequest) {
    const { actorUserId, actingInstitutionId } = context(req);
    return this.cases.list(actorUserId, actingInstitutionId);
  }

  @Post()
  create(@Req() req: RailRequest, @Body() body: Parameters<CasesService["create"]>[3]) {
    const { actorUserId, actingInstitutionId, actorSessionId } = context(req);
    return this.cases.create(actorUserId, actingInstitutionId, actorSessionId, body);
  }

  @Get(":caseId")
  get(@Req() req: RailRequest, @Param("caseId") caseId: string) {
    const { actorUserId, actingInstitutionId } = context(req);
    return this.cases.get(actorUserId, actingInstitutionId, caseId);
  }

  @Post(":caseId/versions")
  createVersion(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<CasesService["createVersion"]>[4]) {
    const { actorUserId, actingInstitutionId, actorSessionId } = context(req);
    return this.cases.createVersion(actorUserId, actingInstitutionId, actorSessionId, caseId, body);
  }

  @Post(":caseId/parties")
  addParty(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<CasesService["addParty"]>[4]) {
    const { actorUserId, actingInstitutionId, actorSessionId } = context(req);
    return this.cases.addParty(actorUserId, actingInstitutionId, actorSessionId, caseId, body);
  }

  @Post(":caseId/parties/:partyId/accept")
  acceptParty(
    @Req() req: RailRequest,
    @Param("caseId") caseId: string,
    @Param("partyId") partyId: string,
    @Body() body: Parameters<CasesService["acceptParty"]>[5],
  ) {
    const { actorUserId, actingInstitutionId, actorSessionId } = context(req);
    return this.cases.acceptParty(actorUserId, actingInstitutionId, actorSessionId, caseId, partyId, body);
  }

  @Post(":caseId/function-assignments")
  assignFunction(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<CasesService["assignFunction"]>[4]) {
    const { actorUserId, actingInstitutionId, actorSessionId } = context(req);
    return this.cases.assignFunction(actorUserId, actingInstitutionId, actorSessionId, caseId, body);
  }

  @Post(":caseId/conditions")
  addCondition(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<CasesService["addCondition"]>[4]) {
    const { actorUserId, actingInstitutionId, actorSessionId } = context(req);
    return this.cases.addCondition(actorUserId, actingInstitutionId, actorSessionId, caseId, body);
  }

  @Post(":caseId/conditions/:conditionId/resolve")
  resolveCondition(
    @Req() req: RailRequest,
    @Param("caseId") caseId: string,
    @Param("conditionId") conditionId: string,
    @Body() body: Parameters<CasesService["resolveCondition"]>[5],
  ) {
    const { actorUserId, actingInstitutionId, actorSessionId } = context(req);
    return this.cases.resolveCondition(actorUserId, actingInstitutionId, actorSessionId, caseId, conditionId, body);
  }

  @Post(":caseId/decisions")
  proposeDecision(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<CasesService["proposeDecision"]>[4]) {
    const { actorUserId, actingInstitutionId, actorSessionId } = context(req);
    return this.cases.proposeDecision(actorUserId, actingInstitutionId, actorSessionId, caseId, body);
  }

  @Post(":caseId/decisions/:decisionId/review")
  reviewDecision(
    @Req() req: RailRequest,
    @Param("caseId") caseId: string,
    @Param("decisionId") decisionId: string,
    @Body() body: Parameters<CasesService["reviewDecision"]>[5],
  ) {
    const { actorUserId, actingInstitutionId, actorSessionId } = context(req);
    return this.cases.reviewDecision(actorUserId, actingInstitutionId, actorSessionId, caseId, decisionId, body);
  }

  @Post(":caseId/transitions")
  transition(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<CasesService["transition"]>[4]) {
    const { actorUserId, actingInstitutionId, actorSessionId } = context(req);
    return this.cases.transition(actorUserId, actingInstitutionId, actorSessionId, caseId, body);
  }

  @Post(":caseId/replay")
  replay(@Req() req: RailRequest, @Param("caseId") caseId: string) {
    const { actorUserId, actingInstitutionId } = context(req);
    return this.cases.replay(actorUserId, actingInstitutionId, caseId);
  }
}
