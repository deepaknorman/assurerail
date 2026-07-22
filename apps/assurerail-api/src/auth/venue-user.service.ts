import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../store/prisma.service";

export interface VenueUserDto {
  id: string;
  firebaseUid: string | null;
  email: string;
  displayName: string | null;
  did: string | null;
  role: string;
  isAdmin: boolean;
  platformRole: string | null; // SUPERADMIN | ADMIN | null
  entityDid: string | null;
  entityRole: string | null; // ORGADMIN | MANAGER | OPERATOR | null
  allowlisted: boolean;
  status: string; // PENDING | ACTIVE | SUSPENDED
}

// VenueUser persistence over the venue's OWN Postgres. Only registered in DB mode (auth requires it).
@Injectable()
export class VenueUserService {
  constructor(private readonly db: PrismaService) {}

  private toDto(u: {
    id: string; firebaseUid: string | null; email: string; displayName: string | null;
    did: string | null; role: string; isAdmin: boolean; platformRole: string | null;
    entityDid: string | null; entityRole: string | null; allowlisted: boolean; status: string;
  }): VenueUserDto {
    return {
      id: u.id, firebaseUid: u.firebaseUid, email: u.email, displayName: u.displayName,
      did: u.did, role: u.role,
      // a user is a platform admin iff they hold a platformRole (keep the isAdmin column in sync too)
      isAdmin: u.isAdmin || !!u.platformRole,
      platformRole: u.platformRole, entityDid: u.entityDid, entityRole: u.entityRole,
      allowlisted: u.allowlisted, status: u.status,
    };
  }

  /**
   * Resolve (or create) the VenueUser for a verified Firebase token. Adopts a row that pre-registered by
   * email (e.g. a seeded admin) so its role/isAdmin survive first login. New users start PENDING.
   */
  async resolveFromToken(t: { uid: string; email?: string; name?: string }): Promise<VenueUserDto> {
    const email = (t.email || "").toLowerCase();
    const existing = await this.db.venueUser.findFirst({
      where: { OR: [{ firebaseUid: t.uid }, ...(email ? [{ email }] : [])] },
    });
    if (existing) {
      const upd = await this.db.venueUser.update({
        where: { id: existing.id },
        data: { firebaseUid: t.uid, email: email || existing.email, displayName: t.name ?? existing.displayName },
      });
      return this.toDto(upd);
    }
    const created = await this.db.venueUser.create({
      data: { id: `vu_${randomUUID()}`, firebaseUid: t.uid, email, displayName: t.name ?? null, role: "INVESTOR", status: "PENDING" },
    });
    return this.toDto(created);
  }

  async getByUid(uid: string): Promise<VenueUserDto | null> {
    const u = await this.db.venueUser.findUnique({ where: { firebaseUid: uid } });
    return u ? this.toDto(u) : null;
  }

  /** Activate a user after the DigiKYC gate passes — record the AssureLocker DID (reference), allow-list. */
  async onboard(uid: string, did: string): Promise<VenueUserDto> {
    const u = await this.db.venueUser.update({
      where: { firebaseUid: uid },
      data: { did, status: "ACTIVE", allowlisted: true },
    });
    return this.toDto(u);
  }

  // ── admin module ──
  async listUsers(): Promise<VenueUserDto[]> {
    const rows = await this.db.venueUser.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((u) => this.toDto(u));
  }

  /**
   * Admin: set a user's function role / status / allow-list, and (RBAC) their entity role/org. The
   * platformRole is handled here too but the CONTROLLER restricts it to superadmins (@SuperAdminOnly);
   * setting platformRole keeps the isAdmin column in sync.
   */
  async adminUpdate(
    id: string,
    patch: { role?: string; status?: string; allowlisted?: boolean; platformRole?: string | null; entityRole?: string | null; entityDid?: string | null },
  ): Promise<VenueUserDto> {
    const data: Record<string, unknown> = {};
    if (patch.role !== undefined) data.role = patch.role;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.allowlisted !== undefined) data.allowlisted = patch.allowlisted;
    if (patch.platformRole !== undefined) {
      data.platformRole = patch.platformRole || null;
      data.isAdmin = !!patch.platformRole; // sync the guard-bypass flag with the platform role
    }
    if (patch.entityRole !== undefined) data.entityRole = patch.entityRole || null;
    if (patch.entityDid !== undefined) data.entityDid = patch.entityDid || null;
    const u = await this.db.venueUser.update({ where: { id }, data });
    return this.toDto(u);
  }

  /**
   * Admin: pre-register a user by email + role (allow-listed, PENDING). On their first Firebase login,
   * resolveFromToken adopts this row by email, so they arrive with the assigned role already set.
   */
  async invite(email: string, role: string, displayName?: string): Promise<VenueUserDto> {
    const e = email.toLowerCase();
    const existing = await this.db.venueUser.findUnique({ where: { email: e } });
    if (existing) {
      const u = await this.db.venueUser.update({ where: { id: existing.id }, data: { role, allowlisted: true, displayName: displayName ?? existing.displayName } });
      return this.toDto(u);
    }
    const u = await this.db.venueUser.create({
      data: { id: `vu_${randomUUID()}`, email: e, displayName: displayName ?? null, role, allowlisted: true, status: "PENDING" },
    });
    return this.toDto(u);
  }
}
