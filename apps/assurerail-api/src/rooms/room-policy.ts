export const ROOM_PURPOSES = ["PASSIVE_DILIGENCE", "COMMERCIAL_NEGOTIATION"] as const;
export const PASSIVE_ROOM_POLICY_VERSION = "assurerail.room.passive-diligence.v1";
export const DARK_IMPORTED_GRANT_STATUS = "MIGRATED_DARK" as const;
export const COMMERCIAL_REDACTION_MARKER = "[redacted:commercial]";

const COMMERCIAL_KEY = /(price|pricing|bid|bids|yield|quote|coupon|term[_-]?sheet|discount[_-]?rate|spread|margin)/i;
const COMMERCIAL_TOKENS = new Set(["rate", "apr", "irr", "roi", "wac", "wal", "spread", "margin"]);

function keyTokens(key: string): string[] {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^a-z0-9]+/i).filter(Boolean).map((part) => part.toLowerCase());
}

function commercialKey(key: string): boolean {
  return COMMERCIAL_KEY.test(key) || keyTokens(key).some((part) => COMMERCIAL_TOKENS.has(part));
}

export function redactPassiveRoomView(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPassiveRoomView);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    result[key] = commercialKey(key) ? COMMERCIAL_REDACTION_MARKER : redactPassiveRoomView(nested);
  }
  return result;
}

export function mapLegacyRoomPurpose(_legacyPurpose: string): "PASSIVE_DILIGENCE" {
  return "PASSIVE_DILIGENCE";
}

export function assertRoomPurposeAvailable(purpose: string): void {
  if (purpose !== "PASSIVE_DILIGENCE") {
    throw new Error("commercial negotiation is deliberately unavailable before the separately governed PR-13 function series");
  }
}
