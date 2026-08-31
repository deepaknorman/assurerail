import { Body, Controller, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { SuperAdminOnly } from "../auth/roles.decorator";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { InternalAccessService } from "./internal-access.service";
import { INTERNAL_PERMISSIONS, INTERNAL_ROLES, INTERNAL_SCOPE_TYPES } from "./internal-access-policy";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null } };

function actor(req: RailRequest): { userId: string; sessionId: string } {
  const userId = req.user?.id;
  const sessionId = req.user?.session?.id;
  if (!userId || !sessionId) throw new UnauthorizedException("an authenticated Rail user with an active session is required");
  return { userId, sessionId };
}

function requireEnabled() {
  if (inspectPersistenceFlags(process.env).internalRbac === "off") {
    throw new UnauthorizedException("internal RBAC control plane is disabled");
  }
}

@Controller("v1/rail/internal-access")
export class InternalAccessSelfController {
  constructor(private readonly access: InternalAccessService) {}

  @Get("me")
  mine(@Req() req: RailRequest) {
    requireEnabled();
    return this.access.listForUser(actor(req).userId);
  }

  @Get("vocabulary")
  vocabulary() {
    requireEnabled();
    return { roles: INTERNAL_ROLES, permissions: INTERNAL_PERMISSIONS, scopeTypes: INTERNAL_SCOPE_TYPES };
  }

  @Post("elevations")
  requestElevation(@Req() req: RailRequest, @Body() body: Parameters<InternalAccessService["requestElevation"]>[2]) {
    requireEnabled();
    const current = actor(req);
    return this.access.requestElevation(current.userId, current.sessionId, body);
  }
}

// Bootstrap-only controller while OP-01 runs in shadow. Once the explicit enforcement cutover has
// verified assignment coverage, these routes move to InternalAccessService.require(...) permissions.
@SuperAdminOnly()
@Controller("v1/rail/admin/internal-access")
export class InternalAccessAdminController {
  constructor(private readonly access: InternalAccessService) {}

  @Get("assignments")
  assignments() {
    requireEnabled();
    return this.access.listAssignments();
  }

  @Post("assignments")
  proposeAssignment(@Req() req: RailRequest, @Body() body: Parameters<InternalAccessService["proposeAssignment"]>[2]) {
    requireEnabled();
    const current = actor(req);
    return this.access.proposeAssignment(current.userId, current.sessionId, body);
  }

  @Post("assignments/:assignmentId/review")
  reviewAssignment(@Req() req: RailRequest, @Param("assignmentId") assignmentId: string, @Body() body: Parameters<InternalAccessService["reviewAssignment"]>[3]) {
    requireEnabled();
    const current = actor(req);
    return this.access.reviewAssignment(current.userId, current.sessionId, assignmentId, body);
  }

  @Post("assignments/:assignmentId/revoke")
  revokeAssignment(@Req() req: RailRequest, @Param("assignmentId") assignmentId: string, @Body() body: Parameters<InternalAccessService["revokeAssignment"]>[3]) {
    requireEnabled();
    const current = actor(req);
    return this.access.revokeAssignment(current.userId, current.sessionId, assignmentId, body);
  }

  @Post("elevations/:elevationId/review")
  reviewElevation(@Req() req: RailRequest, @Param("elevationId") elevationId: string, @Body() body: Parameters<InternalAccessService["reviewElevation"]>[3]) {
    requireEnabled();
    const current = actor(req);
    return this.access.reviewElevation(current.userId, current.sessionId, elevationId, body);
  }
}
