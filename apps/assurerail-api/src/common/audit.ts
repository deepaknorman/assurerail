// Segregation primitive (from commit 1): every venue action is attributed to the AssureRail audit
// actor namespace `system:tokenco`, distinct from AssureLocker's actors. At 2b this writes to the
// venue's own append-only log; for now it emits a structured line.
export const AUDIT_ACTOR = "system:tokenco";

export function audit(event: string, detail: Record<string, unknown> = {}): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ actor: AUDIT_ACTOR, event, ...detail }));
}
