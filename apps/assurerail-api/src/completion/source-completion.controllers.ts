import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../auth/public.decorator";
import { ConnectorRequestAuthService } from "../integrations/connector-request-auth.service";
import type { RoomActor } from "../rooms/room-authority.service";
import { SourceCompletionService, type SourceCompletionObservation } from "./source-completion.service";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };
function context(req: RailRequest): RoomActor {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("an active Rail session is required");
  if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("an active institution session context is required");
  return { actorUserId: req.user.id, actingInstitutionId: req.user.activeInstitution.institutionId, actorSessionId: req.user.session.id };
}

@Controller("v1/rail/cases/:caseId/source-completions")
export class SourceCompletionController {
  constructor(private readonly completions: SourceCompletionService) {}
  @Get() list(@Req() req: RailRequest, @Param("caseId") caseId: string) { return this.completions.list(context(req), caseId); }
  @Post() initiate(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<SourceCompletionService["initiate"]>[2]) { return this.completions.initiate(context(req), caseId, body); }
  @Post(":completionId/reconcile") reconcile(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("completionId") completionId: string, @Body() body: Parameters<SourceCompletionService["reconcile"]>[3]) { return this.completions.reconcile(context(req), caseId, completionId, body); }
}

@Public()
@Controller("internal/v1/source-completions")
export class SourceCompletionInternalController {
  constructor(private readonly completions: SourceCompletionService, private readonly auth: ConnectorRequestAuthService) {}
  @Post(":completionId/acknowledgements")
  async acknowledge(@Req() req: Request, @Param("completionId") completionId: string, @Body() body: SourceCompletionObservation) {
    const authenticated = await this.auth.authenticate(req, "assurepool.completion-ack.v1");
    return this.completions.recordSignedObservation(completionId, authenticated.connector.id, body);
  }
}
