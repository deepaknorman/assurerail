import { Body, Controller, Get, Patch, Post, Query } from "@nestjs/common";
import { Roles, ALL_ROLES, AdminOnly, SuperAdminOnly } from "../auth/roles.decorator";
import { audit } from "../common/audit";
import { OpsService } from "./ops.service";

// Agentic ops surface (Crawl phase — deterministic + read-only). Health + findings are visible to any
// onboarded member; running a sweep is admin; the kill-switch/agent-mode is superadmin-only (out-of-band
// control that must not sit behind a governed prod-config change).
@Controller("venue/ops")
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Roles(...ALL_ROLES)
  @Get("health")
  health() {
    return this.ops.health();
  }

  @Roles(...ALL_ROLES)
  @Get("findings")
  findings(@Query("status") status?: string) {
    return this.ops.findings((status || "OPEN").toUpperCase());
  }

  @AdminOnly()
  @Post("run")
  async run() {
    const r = await this.ops.sweep();
    audit("ops.sweep", r as unknown as Record<string, unknown>);
    return r;
  }

  @SuperAdminOnly()
  @Patch("control")
  async control(@Body() body: { killSwitch?: boolean; agentMode?: string }) {
    const c = await this.ops.setControl(body);
    audit("ops.control.set", { killSwitch: c.killSwitch, agentMode: c.agentMode });
    return c;
  }
}
