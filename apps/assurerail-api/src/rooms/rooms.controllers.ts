import { Body, Controller, Get, Param, Post, Req, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import type { Request } from "express";
import { RoomsService } from "./rooms.service";

type RailRequest = Request & {
  user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null };
};

function context(req: RailRequest) {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("an active Rail session is required");
  if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("an active institution session context is required");
  return { actorUserId: req.user.id, actingInstitutionId: req.user.activeInstitution.institutionId, actorSessionId: req.user.session.id };
}

@Controller("v1/rail/cases/:caseId/rooms")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@Req() req: RailRequest, @Param("caseId") caseId: string) {
    return this.rooms.list(context(req), caseId);
  }

  @Post("legacy-imports")
  importLegacy(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<RoomsService["importLegacy"]>[2]) {
    return this.rooms.importLegacy(context(req), caseId, body);
  }

  @Get("parity-breaks")
  parityBreaks(@Req() req: RailRequest, @Param("caseId") caseId: string) {
    return this.rooms.openBreaks(context(req), caseId);
  }

  @Post("parity-breaks/:breakId/resolve")
  resolveParityBreak(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("breakId") breakId: string, @Body() body: Parameters<RoomsService["resolveBreak"]>[3]) {
    return this.rooms.resolveBreak(context(req), caseId, breakId, body);
  }

  @Get(":roomId")
  get(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string) {
    return this.rooms.get(context(req), caseId, roomId);
  }

  @Get(":roomId/compatibility")
  compatibility(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string) {
    return this.rooms.compatibility(context(req), caseId, roomId);
  }

  @Get(":roomId/source-views/:view")
  sourceView(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string, @Param("view") view: string) {
    return this.rooms.sourceView(context(req), caseId, roomId, view);
  }

  @Get(":roomId/messages")
  messages(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string) {
    return this.rooms.messages(context(req), caseId, roomId);
  }

  @Get(":roomId/access-events")
  accessEvents(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string) {
    return this.rooms.accessEvents(context(req), caseId, roomId);
  }

  @Post(":roomId/parity-runs")
  runParity(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string, @Body() body: Parameters<RoomsService["runParity"]>[3]) {
    return this.rooms.runParity(context(req), caseId, roomId, body);
  }
}
