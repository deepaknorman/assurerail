import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { InternalAccessService } from "../internal-access/internal-access.service";
import type { InternalPermission } from "../internal-access/internal-access-policy";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { OperationalReadinessService } from "./operational-readiness.service";

type RailRequest = Request & { user?: { id?: string; platformRole?: string | null; session?: { id?: string; activeInstitutionId?: string | null } | null } };

function actor(req: RailRequest) {
  const userId = req.user?.id;
  const sessionId = req.user?.session?.id;
  if (!userId || !sessionId) throw new UnauthorizedException("authenticated Rail staff session required");
  if (req.user?.session?.activeInstitutionId) throw new ForbiddenException("readiness governance requires no active participant institution context");
  return { userId, sessionId, platformRole: req.user?.platformRole ?? null };
}

@Controller("v1/rail/internal/readiness")
export class OperationalReadinessController {
  constructor(private readonly readiness: OperationalReadinessService, private readonly access: InternalAccessService) {}

  private async authorise(req: RailRequest, permission: InternalPermission) {
    const current = actor(req);
    const mode = inspectPersistenceFlags(process.env).internalRbac;
    if (mode === "off") throw new ForbiddenException("internal RBAC is disabled");
    if (mode === "shadow") {
      if (current.platformRole !== "SUPERADMIN") throw new ForbiddenException("legacy bootstrap requires SUPERADMIN while internal RBAC is shadow-only");
      return current;
    }
    await this.access.require({ userId: current.userId, permission, scopeType: "GLOBAL", scopeRef: null });
    return current;
  }

  @Get("gates")
  async gates(@Req() req: RailRequest, @Query("environment") environment?: string) {
    await this.authorise(req, "READINESS_VIEW");
    return this.readiness.list(environment?.trim() || undefined);
  }

  @Post("gates")
  async proposeGate(@Req() req: RailRequest, @Body() body: Parameters<OperationalReadinessService["proposeGate"]>[1]) {
    const current = await this.authorise(req, "READINESS_GATE_PROPOSE");
    return this.readiness.proposeGate(current, body);
  }

  @Post("gates/:gateId/review")
  async reviewGate(@Req() req: RailRequest, @Param("gateId") gateId: string, @Body() body: Parameters<OperationalReadinessService["reviewGate"]>[2]) {
    const current = await this.authorise(req, "READINESS_GATE_REVIEW");
    return this.readiness.reviewGate(current, gateId, body);
  }

  @Get("activations")
  async activations(@Req() req: RailRequest, @Query("environment") environment?: string) {
    await this.authorise(req, "READINESS_VIEW");
    return this.readiness.listActivations(environment?.trim() || undefined);
  }

  @Post("activations")
  async proposeActivation(@Req() req: RailRequest, @Body() body: Parameters<OperationalReadinessService["proposeActivation"]>[1]) {
    const current = await this.authorise(req, "DEPLOYMENT_ACTIVATION_REGISTER");
    return this.readiness.proposeActivation(current, body);
  }

  @Post("activations/:activationId/review")
  async reviewActivation(@Req() req: RailRequest, @Param("activationId") activationId: string, @Body() body: Parameters<OperationalReadinessService["reviewActivation"]>[2]) {
    const current = await this.authorise(req, "DEPLOYMENT_ACTIVATION_REGISTER");
    return this.readiness.reviewActivation(current, activationId, body);
  }

  @Post("activations/:activationId/revoke")
  async revokeActivation(@Req() req: RailRequest, @Param("activationId") activationId: string, @Body() body: Parameters<OperationalReadinessService["revokeActivation"]>[2]) {
    const current = await this.authorise(req, "DEPLOYMENT_ACTIVATION_REVOKE");
    return this.readiness.revokeActivation(current, activationId, body);
  }
}
