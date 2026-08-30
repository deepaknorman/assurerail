import { Body, Controller, Get, Param, Post, Req, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import type { Request } from "express";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { ActiveRoomsService } from "./active-rooms.service";
import { RoomAuthorityService } from "./room-authority.service";
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
  constructor(private readonly rooms: RoomsService, private readonly active: ActiveRoomsService) {}

  @Get()
  list(@Req() req: RailRequest, @Param("caseId") caseId: string) {
    return inspectPersistenceFlags(process.env).roomReadSource === "rail"
      ? this.active.list(context(req), caseId)
      : this.rooms.list(context(req), caseId);
  }

  @Post()
  create(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<ActiveRoomsService["create"]>[2]) {
    return this.active.create(context(req), caseId, body);
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
    return inspectPersistenceFlags(process.env).roomReadSource === "rail"
      ? this.active.get(context(req), caseId, roomId)
      : this.rooms.get(context(req), caseId, roomId);
  }

  @Get(":roomId/compatibility")
  compatibility(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string) {
    return this.rooms.compatibility(context(req), caseId, roomId);
  }

  @Get(":roomId/source-views/:view")
  sourceView(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string, @Param("view") view: string) {
    return inspectPersistenceFlags(process.env).roomReadSource === "rail"
      ? this.active.sourceView(context(req), caseId, roomId, view)
      : this.rooms.sourceView(context(req), caseId, roomId, view);
  }

  @Get(":roomId/messages")
  messages(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string) {
    return inspectPersistenceFlags(process.env).roomReadSource === "rail"
      ? this.active.messages(context(req), caseId, roomId)
      : this.rooms.messages(context(req), caseId, roomId);
  }

  @Post(":roomId/messages")
  postMessage(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string, @Body() body: Parameters<ActiveRoomsService["postMessage"]>[3]) {
    return this.active.postMessage(context(req), caseId, roomId, body);
  }

  @Post(":roomId/invitations")
  invite(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string, @Body() body: Parameters<ActiveRoomsService["invite"]>[3]) {
    return this.active.invite(context(req), caseId, roomId, body);
  }

  @Post(":roomId/close")
  close(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string, @Body() body: Parameters<ActiveRoomsService["close"]>[3]) {
    return this.active.close(context(req), caseId, roomId, body);
  }

  @Get(":roomId/access-events")
  accessEvents(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string) {
    return inspectPersistenceFlags(process.env).roomReadSource === "rail"
      ? this.active.accessEvents(context(req), caseId, roomId)
      : this.rooms.accessEvents(context(req), caseId, roomId);
  }

  @Post(":roomId/parity-runs")
  runParity(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("roomId") roomId: string, @Body() body: Parameters<RoomsService["runParity"]>[3]) {
    return this.rooms.runParity(context(req), caseId, roomId, body);
  }
}

@Controller("v1/rail/cases/:caseId/room-authority")
export class RoomAuthorityController {
  constructor(private readonly authority: RoomAuthorityService) {}

  @Get()
  get(@Req() req: RailRequest, @Param("caseId") caseId: string) {
    return this.authority.get(context(req), caseId);
  }

  @Post("proposals")
  propose(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<RoomAuthorityService["propose"]>[2]) {
    return this.authority.propose(context(req), caseId, body);
  }

  @Post("proposals/:changeId/review")
  review(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("changeId") changeId: string, @Body() body: Parameters<RoomAuthorityService["review"]>[3]) {
    return this.authority.review(context(req), caseId, changeId, body);
  }
}

@Controller("v1/rail/room-invitations")
export class RoomInvitationsController {
  constructor(private readonly active: ActiveRoomsService) {}

  @Get(":token")
  get(@Req() req: RailRequest, @Param("token") token: string) {
    return this.active.invitationContext(context(req), token);
  }

  @Post(":token/accept")
  accept(@Req() req: RailRequest, @Param("token") token: string, @Body() body: Parameters<ActiveRoomsService["acceptInvitation"]>[2]) {
    return this.active.acceptInvitation(context(req), token, body);
  }
}
