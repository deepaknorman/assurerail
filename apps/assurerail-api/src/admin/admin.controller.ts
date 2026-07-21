import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { AdminOnly } from "../auth/roles.decorator";
import { VenueUserService } from "../auth/venue-user.service";
import { MintRepository } from "../mint/note.repository";
import { VENUE_ROLES } from "../access/roles";
import { config } from "../config";
import { audit } from "../common/audit";

const ROLES: readonly string[] = VENUE_ROLES;
const STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"];

interface UpdateUserBody {
  role?: string;
  status?: string;
  allowlisted?: boolean;
}
interface InviteBody {
  email?: string;
  role?: string;
  displayName?: string;
}

// Admin module — user access management + a system panel. Class-level @AdminOnly ⇒ every route requires
// req.user.isAdmin (env allowlist VENUE_ADMIN_EMAILS + emailVerified, or VenueUser.isAdmin).
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

  @Patch("users/:id")
  async updateUser(@Param("id") id: string, @Body() body: UpdateUserBody) {
    if (body.role !== undefined && !ROLES.includes(body.role)) throw new BadRequestException(`role must be one of: ${ROLES.join(", ")}`);
    if (body.status !== undefined && !STATUSES.includes(body.status)) throw new BadRequestException(`status must be one of: ${STATUSES.join(", ")}`);
    const u = await this.users.adminUpdate(id, body);
    audit("admin.user.updated", { id, ...body });
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
    const notes = await this.repo.listNotes();
    return {
      store: process.env.DATABASE_URL ? "postgres" : "in-memory",
      adapters: { tape: config.tapeSource, hts: config.htsAdapter, hcs: config.hcsAnchor, settlement: config.settlementAdapter },
      digikycGate: (process.env.DIGIKYC_GATE ?? (config.assureLockerApiKey ? "live" : "demo")).toLowerCase(),
      recaptchaEnforce: process.env.RECAPTCHA_ENFORCE === "true",
      roles: ROLES,
      counts: {
        notes: notes.length,
        issued: notes.filter((n) => n.state === "ISSUED").length,
        active: notes.filter((n) => n.state === "ACTIVE").length,
        redeemed: notes.filter((n) => n.state === "REDEEMED").length,
      },
    };
  }
}
