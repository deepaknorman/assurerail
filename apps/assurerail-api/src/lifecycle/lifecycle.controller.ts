import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { RoomActor } from "../rooms/room-authority.service";
import { LifecycleService } from "./lifecycle.service";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };
function actor(req: RailRequest): RoomActor {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("an active Rail session is required");
  if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("an active institution session context is required");
  return { actorUserId: req.user.id, actorSessionId: req.user.session.id, actingInstitutionId: req.user.activeInstitution.institutionId };
}
@Controller("v1/rail/cases/:caseId/lifecycle")
export class LifecycleController {
  constructor(private readonly lifecycle: LifecycleService) {}
  @Get("overview") overview(@Req() req: RailRequest, @Param("caseId") caseId: string) { return this.lifecycle.overview(actor(req), caseId); }
  @Post("plans") createPlan(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<LifecycleService["createPlan"]>[2]) { return this.lifecycle.createPlan(actor(req), caseId, body); }
  @Post("plans/:planId/obligations/:obligationId/events") recordEvent(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("planId") planId: string, @Param("obligationId") obligationId: string, @Body() body: Parameters<LifecycleService["recordEvent"]>[4]) { return this.lifecycle.recordEvent(actor(req), caseId, planId, obligationId, body); }
  @Post("plans/:planId/obligations/:obligationId/reconcile") reconcile(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("planId") planId: string, @Param("obligationId") obligationId: string, @Body() body: Parameters<LifecycleService["reconcile"]>[4]) { return this.lifecycle.reconcile(actor(req), caseId, planId, obligationId, body); }
}
