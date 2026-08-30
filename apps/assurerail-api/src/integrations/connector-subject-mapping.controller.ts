import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { RoomActor } from "../rooms/room-authority.service";
import { ConnectorSubjectMappingService } from "./connector-subject-mapping.service";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };

function context(req: RailRequest): RoomActor {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("an active Rail session is required");
  if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("an active institution session context is required");
  return { actorUserId: req.user.id, actingInstitutionId: req.user.activeInstitution.institutionId, actorSessionId: req.user.session.id };
}

@Controller("v1/rail/connectors/:connectorId/subject-mappings")
export class ConnectorSubjectMappingController {
  constructor(private readonly mappings: ConnectorSubjectMappingService) {}

  @Get()
  list(@Req() req: RailRequest, @Param("connectorId") connectorId: string) {
    return this.mappings.list(context(req), connectorId);
  }

  @Post()
  propose(@Req() req: RailRequest, @Param("connectorId") connectorId: string, @Body() body: Parameters<ConnectorSubjectMappingService["propose"]>[2]) {
    return this.mappings.propose(context(req), connectorId, body);
  }

  @Post(":mappingId/review")
  review(@Req() req: RailRequest, @Param("connectorId") connectorId: string, @Param("mappingId") mappingId: string, @Body() body: Parameters<ConnectorSubjectMappingService["review"]>[3]) {
    return this.mappings.review(context(req), connectorId, mappingId, body);
  }
}
