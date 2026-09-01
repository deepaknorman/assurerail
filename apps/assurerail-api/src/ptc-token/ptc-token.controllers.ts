import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { RoomActor } from "../rooms/room-authority.service";
import { PtcTokenService } from "./ptc-token.service";
type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };
function context(req: RailRequest): RoomActor { if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required"); if (!req.user.session?.id) throw new ForbiddenException("active Rail session required"); if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("active institution context required"); return { actorUserId: req.user.id, actorSessionId: req.user.session.id, actingInstitutionId: req.user.activeInstitution.institutionId }; }
@Controller("v1/rail/cases/:caseId/ptc-token")
export class PtcTokenController {
  constructor(private readonly service: PtcTokenService) {}
  @Get() get(@Req() req: RailRequest, @Param("caseId") caseId: string) { return this.service.get(context(req), caseId); }
  @Post() propose(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<PtcTokenService["propose"]>[2]) { return this.service.propose(context(req), caseId, body); }
  @Post(":representationId/gates/:gateCode/evidence") recordGateEvidence(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("representationId") representationId: string, @Param("gateCode") gateCode: string, @Body() body: Parameters<PtcTokenService["recordGateEvidence"]>[4]) { return this.service.recordGateEvidence(context(req), caseId, representationId, gateCode, body); }
  @Post(":representationId/review") review(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("representationId") representationId: string, @Body() body: Parameters<PtcTokenService["review"]>[3]) { return this.service.review(context(req), caseId, representationId, body); }
}
