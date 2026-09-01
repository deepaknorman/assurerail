import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { InternalAccessService } from "../internal-access/internal-access.service";
import type { InternalPermission } from "../internal-access/internal-access-policy";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { VenueConductService } from "./venue-conduct.service";

type RailRequest = Request & { user?: { id?: string; platformRole?: string | null; session?: { id?: string; activeInstitutionId?: string | null } | null } };

function actor(req: RailRequest) {
  const userId = req.user?.id;
  const sessionId = req.user?.session?.id;
  if (!userId || !sessionId) throw new UnauthorizedException("authenticated Rail staff session required");
  if (req.user?.session?.activeInstitutionId) throw new ForbiddenException("venue conduct controls require no active participant institution context");
  return { userId, sessionId, platformRole: req.user?.platformRole ?? null };
}

@Controller("v1/rail/internal/venue-conduct")
export class VenueConductController {
  constructor(private readonly conduct: VenueConductService, private readonly access: InternalAccessService) {}

  private async authorise(req: RailRequest, permission: InternalPermission) {
    const current = actor(req);
    const flags = inspectPersistenceFlags(process.env);
    if (flags.venueConduct !== "shadow" || flags.internalRbac === "off") throw new ForbiddenException("venue conduct control plane is disabled");
    if (flags.internalRbac === "shadow") {
      if (current.platformRole !== "SUPERADMIN") throw new ForbiddenException("legacy bootstrap requires SUPERADMIN while internal RBAC is shadow-only");
      return current;
    }
    await this.access.require({ userId: current.userId, permission, scopeType: "GLOBAL", scopeRef: null });
    return current;
  }

  @Get("dashboard")
  async dashboard(@Req() req: RailRequest) { await this.authorise(req, "OPERATIONS_QUEUE_VIEW"); return this.conduct.dashboard(); }

  @Get("policies")
  async policies(@Req() req: RailRequest) { await this.authorise(req, "RISK_EXCEPTION_REVIEW"); return this.conduct.listPolicies(); }

  @Post("policies")
  async proposePolicy(@Req() req: RailRequest, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "CONDUCT_POLICY_PROPOSE"); return this.conduct.proposePolicy(current, body);
  }

  @Post("policies/:policyId/review")
  async reviewPolicy(@Req() req: RailRequest, @Param("policyId") policyId: string, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "CONDUCT_POLICY_REVIEW"); return this.conduct.reviewPolicy(current, policyId, body);
  }

  @Post("signals")
  async recordSignal(@Req() req: RailRequest, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "CONDUCT_SIGNAL_RECORD"); return this.conduct.recordSignal(current, body);
  }

  @Get("alerts")
  async alerts(@Req() req: RailRequest) { await this.authorise(req, "OPERATIONS_QUEUE_VIEW"); return this.conduct.listAlerts(); }

  @Post("alerts/:alertId/review")
  async reviewAlert(@Req() req: RailRequest, @Param("alertId") alertId: string, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "CONDUCT_ALERT_REVIEW"); return this.conduct.reviewAlert(current, alertId, body);
  }

  @Post("investigations")
  async investigate(@Req() req: RailRequest, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "CONDUCT_INVESTIGATION_MANAGE"); return this.conduct.createInvestigation(current, body);
  }

  @Post("investigations/:investigationId/change")
  async changeInvestigation(@Req() req: RailRequest, @Param("investigationId") investigationId: string, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "CONDUCT_INVESTIGATION_MANAGE"); return this.conduct.changeInvestigation(current, investigationId, body);
  }

  @Get("complaints")
  async complaints(@Req() req: RailRequest) { await this.authorise(req, "RISK_COMPLAINT_MANAGE"); return this.conduct.listComplaints(); }

  @Post("complaints")
  async recordComplaint(@Req() req: RailRequest, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "RISK_COMPLAINT_MANAGE"); return this.conduct.recordComplaint(current, body);
  }

  @Post("complaints/:complaintId/resolve")
  async resolveComplaint(@Req() req: RailRequest, @Param("complaintId") complaintId: string, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "RISK_COMPLAINT_MANAGE"); return this.conduct.resolveComplaint(current, complaintId, body);
  }

  @Post("corrections")
  async proposeCorrection(@Req() req: RailRequest, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "RISK_COMPLAINT_MANAGE"); return this.conduct.proposeCorrection(current, body);
  }

  @Post("corrections/:correctionId/review")
  async reviewCorrection(@Req() req: RailRequest, @Param("correctionId") correctionId: string, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "CONDUCT_CONTROL_REVIEW"); return this.conduct.reviewCorrection(current, correctionId, body);
  }

  @Post("controls")
  async proposeControl(@Req() req: RailRequest, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "CONDUCT_CONTROL_PROPOSE"); return this.conduct.proposeControl(current, body);
  }

  @Post("controls/:controlId/review")
  async reviewControl(@Req() req: RailRequest, @Param("controlId") controlId: string, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "CONDUCT_CONTROL_REVIEW"); return this.conduct.reviewControl(current, controlId, body);
  }

  @Post("capacity/budgets")
  async setCapacity(@Req() req: RailRequest, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "CAPACITY_BUDGET_MANAGE"); return this.conduct.setCapacityBudget(current, body);
  }

  @Post("capacity/budgets/:budgetId/observations")
  async observeCapacity(@Req() req: RailRequest, @Param("budgetId") budgetId: string, @Body() body: Record<string, unknown>) {
    const current = await this.authorise(req, "CAPACITY_BUDGET_MANAGE"); return this.conduct.recordCapacity(current, budgetId, body);
  }
}
