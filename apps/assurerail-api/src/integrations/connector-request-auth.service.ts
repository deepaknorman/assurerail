import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sha256Digest } from "../contracts/v1";
import { PrismaService } from "../store/prisma.service";
import { ConnectorSecretVaultService } from "./connector-secret-vault.service";

export type SignedConnectorRequest = {
  method?: string;
  originalUrl?: string;
  path?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

function header(req: SignedConnectorRequest, name: string): string | null {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0]?.trim() || null : typeof value === "string" ? value.trim() || null : null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8"); const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Authenticates a certified connector without promoting its claims into participant authority. */
@Injectable()
export class ConnectorRequestAuthService {
  constructor(private readonly db: PrismaService, private readonly vault: ConnectorSecretVaultService) {}

  async authenticate(req: SignedConnectorRequest, profileRef: string) {
    const connectorId = header(req, "x-assurerail-connector-id");
    const timestamp = header(req, "x-assurerail-signature-timestamp");
    const signature = header(req, "x-assurerail-signature");
    const requestId = header(req, "x-assurerail-request-id");
    if (!connectorId || !timestamp || !signature || !requestId) throw new UnauthorizedException("complete signed connector headers are required");
    if (!/^[0-9]{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 5 * 60_000) {
      throw new ForbiddenException("connector request timestamp is outside the allowed window");
    }
    if (!/^[a-zA-Z0-9._:-]{8,200}$/.test(requestId)) throw new ForbiddenException("connector request ID is invalid");
    const connector = await this.db.connectorRegistration.findUnique({
      where: { id: connectorId },
      include: {
        providerReference: true,
        certifications: { where: { status: "APPROVED", profileRef }, orderBy: { effectiveAt: "desc" } },
      },
    });
    const certification = connector?.certifications.find((item) => (!item.effectiveAt || item.effectiveAt <= new Date()) && (!item.expiresAt || item.expiresAt > new Date()));
    if (!connector || connector.status !== "CERTIFIED_SHADOW" || !connector.providerReferenceId
      || connector.providerReference?.status !== "ACTIVE" || !certification || certification.operatingMode !== "SHADOW") {
      throw new ForbiddenException("connector is not actively certified for the requested profile");
    }
    if (!connector.credentialVaultRef?.startsWith("vault-kv-v2://")) throw new ForbiddenException("connector has no approved Vault credential reference");
    const path = (req.originalUrl ?? req.path ?? "").split("?")[0];
    if (!path.startsWith("/")) throw new ForbiddenException("connector request path is invalid");
    const bodyDigest = sha256Digest(req.body ?? {});
    const canonical = [String(req.method ?? "").toUpperCase(), path, timestamp, requestId, bodyDigest].join("\n");
    const expected = createHmac("sha256", await this.vault.get(connector.credentialVaultRef)).update(canonical).digest("hex");
    if (!safeEqual(signature, expected)) throw new ForbiddenException("connector request signature verification failed");
    return { connector, certification, requestId, bodyDigest };
  }
}
