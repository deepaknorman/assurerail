// Out-of-band bootstrap of a platform admin / superadmin — the first
// platform staff is NEVER created through an authenticated endpoint). Upserts a VenueUser by email with
// platformRole + isAdmin + ACTIVE + allow-listed, so on their first Firebase login resolveFromToken
// adopts the row and they arrive with platform authority already set.
//
//   Usage:  node dist/seed-admin.js <email> [superadmin|admin]     (default: superadmin)
//   or:     npm run seed:admin -- <email> [superadmin|admin]
import { config } from "dotenv";
config();
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/assurerail-client";

async function main(): Promise<void> {
  const email = (process.argv[2] || "").toLowerCase();
  const roleArg = (process.argv[3] || "superadmin").toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("usage: node dist/seed-admin.js <email> [superadmin|admin]");
    process.exit(1);
  }
  const platformRole = roleArg === "admin" ? "ADMIN" : "SUPERADMIN";
  const p = new PrismaClient();
  const existing = await p.venueUser.findUnique({ where: { email } });
  const data = { platformRole, isAdmin: true, allowlisted: true, status: "ACTIVE" };
  const u = existing
    ? await p.venueUser.update({ where: { id: existing.id }, data })
    : await p.venueUser.create({ data: { id: `vu_${randomUUID()}`, email, role: "ISSUER", ...data } });
  console.log(`✓ ${email} → platformRole=${u.platformRole}, isAdmin=${u.isAdmin}, status=${u.status}`);
  await p.$disconnect();
}

main().catch((e) => {
  console.error("seed-admin failed:", (e as Error).message);
  process.exit(1);
});
