import { Controller, ForbiddenException, Get, Param, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { HostedAlphaService } from "./hosted-alpha.service";

type RailRequest = Request & {
  user?: {
    id?: string;
    session?: { id?: string } | null;
    activeInstitution?: { institutionId?: string } | null;
  };
};

function participant(req: RailRequest, institutionId: string) {
  if (!req.user?.id || !req.user.session?.id) throw new UnauthorizedException("authenticated Rail session required");
  if (req.user.activeInstitution?.institutionId !== institutionId) {
    throw new ForbiddenException("path institution must match active session context");
  }
  return { actorUserId: req.user.id, actingInstitutionId: institutionId };
}

@Controller("v1/rail/institutions/:institutionId/hosted-alpha")
export class HostedAlphaController {
  constructor(private readonly service: HostedAlphaService) {}

  @Get("tasks")
  tasks(@Req() req: RailRequest, @Param("institutionId") institutionId: string) {
    return this.service.tasks(participant(req, institutionId));
  }
}
