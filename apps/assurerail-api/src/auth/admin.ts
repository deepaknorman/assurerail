// Platform-admin resolution — env allowlist, fail-closed on unverified email (AssureLocker parity:
// elevated access requires emailVerified === true). Set VENUE_ADMIN_EMAILS="a@x.com,b@y.com" on the box.
export function adminEmails(): string[] {
  return (process.env.VENUE_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | undefined, emailVerified: boolean | undefined): boolean {
  if (!email || emailVerified !== true) return false;
  return adminEmails().includes(email.toLowerCase());
}
