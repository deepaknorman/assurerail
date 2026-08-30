import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AdminOnly } from "../auth/roles.decorator";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { InstitutionAccessService, type RequestedRouteFunction } from "./institution-access.service";
import { InstitutionApplicationService } from "./institution-application.service";
import { InstitutionGovernanceService } from "./institution-governance.service";

type RailRequest = Request & {
  user?: {
    id?: string;
    session?: { id?: string } | null;
    activeInstitution?: { institutionId?: string } | null;
  };
};

function actor(req: RailRequest): string {
  const id = req.user?.id;
  if (!id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user?.session?.id) throw new ForbiddenException("an active Rail session is required");
  return id;
}

function activeInstitution(req: RailRequest): string {
  const institutionId = req.user?.activeInstitution?.institutionId;
  if (!institutionId) throw new ForbiddenException("an active institution session context is required");
  return institutionId;
}

function sessionId(req: RailRequest): string {
  actor(req);
  return req.user!.session!.id!;
}

function actingFor(req: RailRequest, institutionId: string): string {
  const active = activeInstitution(req);
  if (active !== institutionId) throw new ForbiddenException("path institution does not match the active session context");
  return actor(req);
}

function requireRouteComparison(): void {
  if (inspectPersistenceFlags(process.env).routeEntitlement !== "compare") {
    throw new ForbiddenException("route-entitlement comparison is disabled");
  }
}

@Controller("v1/rail/institutions")
export class InstitutionController {
  constructor(
    private readonly applications: InstitutionApplicationService,
    private readonly governance: InstitutionGovernanceService,
    private readonly access: InstitutionAccessService,
  ) {}

  @Get()
  listMine(@Req() req: RailRequest) {
    return this.applications.listForUser(actor(req));
  }

  @Post()
  apply(@Req() req: RailRequest, @Body() body: Parameters<InstitutionApplicationService["apply"]>[1]) {
    return this.applications.apply(actor(req), body);
  }

  @Post(":institutionId/members/invitations")
  inviteMember(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Body() body: Parameters<InstitutionGovernanceService["inviteMember"]>[2],
  ) {
    return this.governance.inviteMember(actingFor(req, institutionId), institutionId, body, sessionId(req));
  }

  @Post("memberships/:memberId/accept")
  acceptMembership(
    @Req() req: RailRequest,
    @Param("memberId") memberId: string,
    @Body() body: Parameters<InstitutionGovernanceService["acceptMembership"]>[2],
  ) {
    return this.governance.acceptMembership(actor(req), memberId, body, sessionId(req));
  }

  @Post(":institutionId/mandates")
  proposeMandate(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Body() body: Parameters<InstitutionGovernanceService["proposeMandate"]>[2],
  ) {
    return this.governance.proposeMandate(actingFor(req, institutionId), institutionId, body, sessionId(req));
  }

  @Post("mandates/:mandateId/review")
  reviewMandate(
    @Req() req: RailRequest,
    @Param("mandateId") mandateId: string,
    @Body() body: Parameters<InstitutionGovernanceService["reviewMandate"]>[2],
  ) {
    return this.governance.reviewMandate(actor(req), mandateId, body, activeInstitution(req), sessionId(req));
  }

  @Post(":institutionId/appointments")
  proposeAppointment(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Body() body: Parameters<InstitutionGovernanceService["proposeAppointment"]>[2],
  ) {
    return this.governance.proposeAppointment(actingFor(req, institutionId), institutionId, body, sessionId(req));
  }

  @Post("appointments/:appointmentId/accept")
  acceptAppointment(
    @Req() req: RailRequest,
    @Param("appointmentId") appointmentId: string,
    @Body() body: Parameters<InstitutionGovernanceService["acceptAppointment"]>[2],
  ) {
    return this.governance.acceptAppointment(actor(req), appointmentId, body, activeInstitution(req), sessionId(req));
  }

  @Post(":institutionId/route-entitlements")
  proposeRouteEntitlement(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Body() body: Parameters<InstitutionGovernanceService["proposeRouteEntitlement"]>[2],
  ) {
    requireRouteComparison();
    return this.governance.proposeRouteEntitlement(actingFor(req, institutionId), institutionId, body, sessionId(req));
  }

  @Post(":institutionId/status-changes")
  proposeStatusChange(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Body() body: Parameters<InstitutionGovernanceService["proposeStatusChange"]>[2],
  ) {
    return this.governance.proposeStatusChange(actingFor(req, institutionId), institutionId, body, sessionId(req));
  }

  @Post("status-changes/:proposalId/review")
  reviewStatusChange(
    @Req() req: RailRequest,
    @Param("proposalId") proposalId: string,
    @Body() body: Parameters<InstitutionGovernanceService["reviewStatusChange"]>[2],
  ) {
    return this.governance.reviewStatusChange(actor(req), proposalId, body, activeInstitution(req), sessionId(req));
  }

  /** Compare-only diagnostic for the caller's own authority; it does not grant or enforce a route. */
  @Post(":institutionId/route-entitlements/evaluate")
  async evaluateRoute(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Body() body: RequestedRouteFunction,
  ) {
    requireRouteComparison();
    await this.access.requireHuman({ userId: actingFor(req, institutionId), institutionId, action: "VIEW_INSTITUTION" });
    return this.access.evaluateRoute(institutionId, body);
  }
}

@AdminOnly()
@Controller("v1/rail/admin")
export class InstitutionAdminController {
  constructor(
    private readonly applications: InstitutionApplicationService,
    private readonly governance: InstitutionGovernanceService,
  ) {}

  @Post("institutions/:institutionId/evidence")
  recordEvidence(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Body() body: Parameters<InstitutionApplicationService["recordEvidence"]>[2],
  ) {
    return this.applications.recordEvidence(actor(req), institutionId, body);
  }

  @Post("institutions/:institutionId/admission-decisions")
  proposeAdmissionDecision(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Body() body: Parameters<InstitutionApplicationService["proposeDecision"]>[2],
  ) {
    return this.applications.proposeDecision(actor(req), institutionId, body, sessionId(req));
  }

  @Post("admission-decisions/:decisionId/review")
  reviewAdmissionDecision(
    @Req() req: RailRequest,
    @Param("decisionId") decisionId: string,
    @Body() body: Parameters<InstitutionApplicationService["reviewDecision"]>[2],
  ) {
    return this.applications.reviewDecision(actor(req), decisionId, body, sessionId(req));
  }

  @Post("route-entitlements/:entitlementId/review")
  reviewRouteEntitlement(
    @Req() req: RailRequest,
    @Param("entitlementId") entitlementId: string,
    @Body() body: Parameters<InstitutionGovernanceService["reviewRouteEntitlement"]>[2],
  ) {
    requireRouteComparison();
    return this.governance.reviewRouteEntitlement(actor(req), entitlementId, body, sessionId(req));
  }
}
