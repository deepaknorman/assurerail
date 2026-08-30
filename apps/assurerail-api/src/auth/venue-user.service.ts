import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { toCanonicalValue } from "../contracts/v1";
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
  identityProvider: string | null;
  identitySubject: string | null;
  identityVerifiedAt: Date | null;
}

// VenueUser persistence over the venue's OWN Postgres. Only registered in DB mode (auth requires it).
@Injectable()
export class VenueUserService {
  constructor(private readonly db: PrismaService) {}

  private sessionId(idToken: string): string {
    return `vs_${createHash("sha256").update(idToken, "utf8").digest("hex").slice(0, 40)}`;
  }

  private toDto(u: {
    id: string; firebaseUid: string | null; email: string; displayName: string | null;
    did: string | null; role: string; isAdmin: boolean; platformRole: string | null;
    entityDid: string | null; entityRole: string | null; allowlisted: boolean; status: string;
    identityProvider: string | null; identitySubject: string | null; identityVerifiedAt: Date | null;
  }): VenueUserDto {
    return {
      id: u.id, firebaseUid: u.firebaseUid, email: u.email, displayName: u.displayName,
      did: u.did, role: u.role,
      // a user is a platform admin iff they hold a platformRole (keep the isAdmin column in sync too)
      isAdmin: u.isAdmin || !!u.platformRole,
      platformRole: u.platformRole, entityDid: u.entityDid, entityRole: u.entityRole,
      allowlisted: u.allowlisted, status: u.status,
      identityProvider: u.identityProvider,
      identitySubject: u.identitySubject,
      identityVerifiedAt: u.identityVerifiedAt,
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

  /** Bind identity only. Participant admission and legacy venue allow-list are separate decisions. */
  async bindIdentity(uid: string, provider: string, subject: string): Promise<VenueUserDto> {
    const current = await this.db.venueUser.findUnique({ where: { firebaseUid: uid } });
    if (!current || !["PENDING", "ACTIVE"].includes(current.status)) {
      throw new ForbiddenException("account is not eligible for identity binding");
    }
    if ((current.identityProvider && current.identityProvider !== provider)
      || (current.identitySubject && current.identitySubject !== subject)) {
      throw new ConflictException("identity is already bound to a different provider subject");
    }
    const u = await this.db.venueUser.update({
      where: { firebaseUid: uid },
      data: {
        did: subject,
        identityProvider: provider,
        identitySubject: subject,
        identityVerifiedAt: new Date(),
        status: current.status === "PENDING" ? "ACTIVE" : current.status,
        allowlisted: false,
      },
    });
    return this.toDto(u);
  }

  async resolveInstitutionContext(userId: string, institutionId: string) {
    const membership = await this.db.institutionMember.findUnique({
      where: { institutionId_userId: { institutionId, userId } },
      include: {
        institution: { include: { admission: true } },
        mandates: { where: { status: "ACTIVE" }, select: { action: true, scopeType: true, scopeRef: true, expiresAt: true } },
      },
    });
    const now = new Date();
    if (!membership || membership.status !== "ACTIVE"
      || (membership.expiresAt && membership.expiresAt <= now)
      || membership.institution.status !== "ACTIVE"
      || membership.institution.admission?.status !== "ADMITTED"
      || (membership.institution.admission.expiresAt && membership.institution.admission.expiresAt <= now)) {
      return null;
    }
    return {
      institutionId,
      legalName: membership.institution.legalName,
      membershipId: membership.id,
      membershipRole: membership.membershipRole,
      mandates: membership.mandates,
    };
  }

  async recordSession(input: {
    userId: string;
    idToken: string;
    activeInstitutionId?: string | null;
    expiresAt?: Date | null;
    credentialAssurance: string;
    ip?: string | null;
    userAgent?: string | null;
    securityContext?: Record<string, unknown>;
  }) {
    const activeInstitutionId = input.activeInstitutionId?.trim() || null;
    if (activeInstitutionId && !await this.resolveInstitutionContext(input.userId, activeInstitutionId)) {
      throw new ForbiddenException("requested institution context is not active for this user");
    }
    const id = this.sessionId(input.idToken);
    const existing = await this.db.venueSession.findUnique({ where: { id } });
    if (existing && (existing.userId !== input.userId || existing.revokedAt)) {
      throw new ForbiddenException("session is revoked or belongs to a different user");
    }
    const data = {
      activeInstitutionId,
      credentialAssurance: input.credentialAssurance,
      expiresAt: input.expiresAt ?? null,
      ip: input.ip?.slice(0, 200) || null,
      userAgent: input.userAgent?.slice(0, 1_000) || null,
      securityContext: toCanonicalValue(input.securityContext ?? {}) as unknown as Prisma.InputJsonValue,
      lastSeenAt: new Date(),
    };
    const session = await this.db.venueSession.upsert({
      where: { id },
      create: { id, userId: input.userId, ...data },
      update: data,
    });
    if (session.userId !== input.userId || session.revokedAt) {
      throw new ForbiddenException("session is revoked or belongs to a different user");
    }
    return {
      id: session.id,
      activeInstitutionId: session.activeInstitutionId,
      credentialAssurance: session.credentialAssurance,
      expiresAt: session.expiresAt,
    };
  }

  async resolveSession(userId: string, idToken: string) {
    const session = await this.db.venueSession.findUnique({ where: { id: this.sessionId(idToken) } });
    const now = new Date();
    if (!session || session.userId !== userId || session.revokedAt || (session.expiresAt && session.expiresAt <= now)) return null;
    return {
      id: session.id,
      activeInstitutionId: session.activeInstitutionId,
      credentialAssurance: session.credentialAssurance,
      expiresAt: session.expiresAt,
    };
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
