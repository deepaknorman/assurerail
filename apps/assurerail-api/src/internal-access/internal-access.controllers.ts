import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { InternalAccessService } from "./internal-access.service";
import { INTERNAL_PERMISSIONS, INTERNAL_ROLES, INTERNAL_SCOPE_TYPES } from "./internal-access-policy";

type RailRequest = Request & { user?: { id?: string; platformRole?: string | null; session?: { id?: string; activeInstitutionId?: string | null } | null } };

function actor(req: RailRequest): { userId: string; sessionId: string } {
  const userId = req.user?.id;
  const sessionId = req.user?.session?.id;
  if (!userId || !sessionId) throw new UnauthorizedException("an authenticated Rail user with an active session is required");
  if (req.user?.session?.activeInstitutionId) {
    throw new ForbiddenException("internal staff workspace requires a session with no active participant institution");
  }
  return { userId, sessionId };
}

function requireEnabled() {
  if (inspectPersistenceFlags(process.env).internalRbac === "off") {
    throw new UnauthorizedException("internal RBAC control plane is disabled");
  }
}

async function requireGovernance(access: InternalAccessService, req: RailRequest, permission: "GOVERNANCE_ASSIGNMENT_PROPOSE" | "GOVERNANCE_ASSIGNMENT_APPROVE" | "GOVERNANCE_ASSIGNMENT_REVOKE" | "GOVERNANCE_ELEVATION_APPROVE" | "GOVERNANCE_RECERTIFY") {
  const current = actor(req);
  const mode = inspectPersistenceFlags(process.env).internalRbac;
  if (mode === "shadow") {
    if (req.user?.platformRole !== "SUPERADMIN") throw new ForbiddenException("legacy bootstrap requires SUPERADMIN while internal RBAC is shadow-only");
    return current;
  }
  await access.require({ userId: current.userId, permission, scopeType: "GLOBAL", scopeRef: null });
  return current;
}

@Controller("v1/rail/internal-access")
export class InternalAccessSelfController {
  constructor(private readonly access: InternalAccessService) {}

  @Get("me")
  mine(@Req() req: RailRequest) {
    requireEnabled();
    return this.access.listForUser(actor(req).userId);
  }

  @Get("workspaces")
  workspaces(@Req() req: RailRequest) {
    requireEnabled();
    return this.access.workspaceForUser(actor(req).userId);
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

@Controller("v1/rail/admin/internal-access")
export class InternalAccessAdminController {
  constructor(private readonly access: InternalAccessService) {}

  @Get("assignments")
  async assignments(@Req() req: RailRequest) {
    requireEnabled();
    await requireGovernance(this.access, req, "GOVERNANCE_RECERTIFY");
    return this.access.listAssignments();
  }

  @Post("assignments")
  async proposeAssignment(@Req() req: RailRequest, @Body() body: Parameters<InternalAccessService["proposeAssignment"]>[2]) {
    requireEnabled();
    const current = await requireGovernance(this.access, req, "GOVERNANCE_ASSIGNMENT_PROPOSE");
    return this.access.proposeAssignment(current.userId, current.sessionId, body);
  }

  @Post("assignments/:assignmentId/review")
  async reviewAssignment(@Req() req: RailRequest, @Param("assignmentId") assignmentId: string, @Body() body: Parameters<InternalAccessService["reviewAssignment"]>[3]) {
    requireEnabled();
    const current = await requireGovernance(this.access, req, "GOVERNANCE_ASSIGNMENT_APPROVE");
    return this.access.reviewAssignment(current.userId, current.sessionId, assignmentId, body);
  }

  @Post("assignments/:assignmentId/revoke")
  async revokeAssignment(@Req() req: RailRequest, @Param("assignmentId") assignmentId: string, @Body() body: Parameters<InternalAccessService["revokeAssignment"]>[3]) {
    requireEnabled();
    const current = await requireGovernance(this.access, req, "GOVERNANCE_ASSIGNMENT_REVOKE");
    return this.access.revokeAssignment(current.userId, current.sessionId, assignmentId, body);
  }

  @Post("elevations/:elevationId/review")
  async reviewElevation(@Req() req: RailRequest, @Param("elevationId") elevationId: string, @Body() body: Parameters<InternalAccessService["reviewElevation"]>[3]) {
    requireEnabled();
    const current = await requireGovernance(this.access, req, "GOVERNANCE_ELEVATION_APPROVE");
    return this.access.reviewElevation(current.userId, current.sessionId, elevationId, body);
  }
}
