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
  allowlisted: boolean;
  status: string; // PENDING | ACTIVE | SUSPENDED
}

// VenueUser persistence over the venue's OWN Postgres. Only registered in DB mode (auth requires it).
@Injectable()
export class VenueUserService {
  constructor(private readonly db: PrismaService) {}

  private toDto(u: {
    id: string; firebaseUid: string | null; email: string; displayName: string | null;
    did: string | null; role: string; isAdmin: boolean; allowlisted: boolean; status: string;
  }): VenueUserDto {
    return {
      id: u.id, firebaseUid: u.firebaseUid, email: u.email, displayName: u.displayName,
      did: u.did, role: u.role, isAdmin: u.isAdmin, allowlisted: u.allowlisted, status: u.status,
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
}
