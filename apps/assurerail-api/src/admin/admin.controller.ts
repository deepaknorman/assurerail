import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { AdminOnly, SuperAdminOnly } from "../auth/roles.decorator";
import { VenueUserService } from "../auth/venue-user.service";
import { MintRepository } from "../mint/note.repository";
import { VENUE_ROLES, ENTITY_ROLES, PLATFORM_ROLES } from "../access/roles";
import { config } from "../config";
import { audit } from "../common/audit";

const ROLES: readonly string[] = VENUE_ROLES;
const EROLES: readonly string[] = ENTITY_ROLES;
const PROLES: readonly string[] = PLATFORM_ROLES;
const STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"];

interface UpdateUserBody {
  role?: string;
  status?: string;
  allowlisted?: boolean;
  entityRole?: string | null;
  entityDid?: string | null;
}
interface InviteBody {
  email?: string;
  role?: string;
  displayName?: string;
}
interface PlatformRoleBody {
  platformRole?: string | null; // SUPERADMIN | ADMIN | null (clear)
}

// Admin module. Class-level @AdminOnly ⇒ every route requires a platform admin (SUPERADMIN or ADMIN).
// The platform-role assignment route is further gated @SuperAdminOnly (only a superadmin makes admins).
@AdminOnly()
@Controller("venue/admin")
export class AdminController {
  constructor(
    private readonly users: VenueUserService,
    private readonly repo: MintRepository,
  ) {}

  @Get("users")
  listUsers() {
    return this.users.listUsers();
  }

  /** Set function role / status / allow-list + entity RBAC (org + entity role). NOT platformRole. */
  @Patch("users/:id")
  async updateUser(@Param("id") id: string, @Body() body: UpdateUserBody) {
    if (body.role !== undefined && !ROLES.includes(body.role)) throw new BadRequestException(`role must be one of: ${ROLES.join(", ")}`);
    if (body.status !== undefined && !STATUSES.includes(body.status)) throw new BadRequestException(`status must be one of: ${STATUSES.join(", ")}`);
    if (body.entityRole != null && body.entityRole !== "" && !EROLES.includes(body.entityRole)) {
      throw new BadRequestException(`entityRole must be one of: ${EROLES.join(", ")}`);
    }
    // whitelist — platformRole is unreachable from this admin-tier route
    const u = await this.users.adminUpdate(id, {
      role: body.role,
      status: body.status,
      allowlisted: body.allowlisted,
      entityRole: body.entityRole,
      entityDid: body.entityDid,
    });
    audit("admin.user.updated", { id, role: body.role, status: body.status, entityRole: body.entityRole });
    return u;
  }

  /** SUPERADMIN only — grant/revoke a platform role (make/unmake an admin or superadmin). */
  @SuperAdminOnly()
  @Patch("users/:id/platform-role")
  async setPlatformRole(@Param("id") id: string, @Body() body: PlatformRoleBody) {
    const pr = body.platformRole || null;
    if (pr !== null && !PROLES.includes(pr)) throw new BadRequestException(`platformRole must be one of: ${PROLES.join(", ")} (or null to clear)`);
    const u = await this.users.adminUpdate(id, { platformRole: pr });
    audit("admin.platformRole.set", { id, platformRole: pr });
    return u;
  }

  @Post("users/invite")
  async invite(@Body() body: InviteBody) {
    if (!body.email || !body.email.includes("@")) throw new BadRequestException("a valid email is required");
    const role = body.role && ROLES.includes(body.role) ? body.role : "INVESTOR";
    const u = await this.users.invite(body.email, role, body.displayName);
    audit("admin.user.invited", { email: body.email, role });
    return u;
  }

  @Get("status")
  async status() {
    // De-scanned: index-only count-by-state instead of hydrating every note's t1Aggregates.
    const counts = await this.repo.countNotesByState();
    return {
      store: process.env.DATABASE_URL ? "postgres" : "in-memory",
      adapters: { tape: config.tapeSource, hts: config.htsAdapter, hcs: config.hcsAnchor, settlement: config.settlementAdapter },
      digikycGate: (process.env.DIGIKYC_GATE ?? (config.assureLockerApiKey ? "live" : "demo")).toLowerCase(),
      recaptchaEnforce: process.env.RECAPTCHA_ENFORCE === "true",
      roles: ROLES,
      entityRoles: EROLES,
      platformRoles: PROLES,
      counts: {
        notes: counts.total ?? 0,
        issued: counts.ISSUED ?? 0,
        active: counts.ACTIVE ?? 0,
        redeemed: counts.REDEEMED ?? 0,
      },
    };
  }
}
