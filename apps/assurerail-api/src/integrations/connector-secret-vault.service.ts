import { Injectable, ServiceUnavailableException } from "@nestjs/common";

interface VaultLoginResponse { readonly auth?: { readonly client_token?: string; readonly lease_duration?: number } }
interface VaultReadResponse { readonly data?: { readonly data?: Readonly<Record<string, unknown>> } }

function cleanSegment(value: string, name: string): string {
  const cleaned = value.trim().replace(/^\/+|\/+$/g, "");
  if (!cleaned || !/^[a-zA-Z0-9_./-]+$/.test(cleaned) || cleaned.includes("..")) throw new Error(`${name} contains an invalid Vault path`);
  return cleaned;
}

/** Read-only Vault KV-v2 boundary for institution connector HMAC credentials. */
@Injectable()
export class ConnectorSecretVaultService {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  private configuration() {
    const rawAddr = (process.env.VAULT_ADDR ?? "").trim();
    if (!rawAddr) throw new ServiceUnavailableException("connector credential Vault is not configured");
    let parsed: URL;
    try { parsed = new URL(rawAddr); } catch { throw new ServiceUnavailableException("connector credential Vault address is malformed"); }
    if (parsed.username || parsed.password || parsed.search || parsed.hash || !["", "/"].includes(parsed.pathname)) {
      throw new ServiceUnavailableException("connector credential Vault address must be an origin without credentials, path, query or fragment");
    }
    if (parsed.protocol !== "https:" && process.env.ASSURERAIL_OPERATING_MODE?.toUpperCase() !== "DEMO") {
      throw new ServiceUnavailableException("connector credential Vault must use https outside DEMO mode");
    }
    if (!["https:", "http:"].includes(parsed.protocol)) throw new ServiceUnavailableException("connector credential Vault address must use http or https");
    return {
      addr: parsed.origin,
      mount: cleanSegment(process.env.ARAIL_CONNECTOR_VAULT_MOUNT ?? "secret", "ARAIL_CONNECTOR_VAULT_MOUNT"),
      prefix: cleanSegment(process.env.ARAIL_CONNECTOR_VAULT_PREFIX ?? "assurerail/connectors", "ARAIL_CONNECTOR_VAULT_PREFIX"),
    };
  }

  private async token(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) return this.tokenCache.token;
    const direct = (process.env.VAULT_TOKEN ?? "").trim();
    const roleId = (process.env.VAULT_APPROLE_ROLE_ID ?? "").trim();
    const secretId = (process.env.VAULT_APPROLE_SECRET_ID ?? "").trim();
    if (!roleId || !secretId) {
      if (direct) return direct;
      throw new ServiceUnavailableException("connector credential Vault authentication is not configured");
    }
    const { addr } = this.configuration();
    const response = await fetch(`${addr}/v1/auth/approle/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
      signal: AbortSignal.timeout(5_000), redirect: "error",
    });
    if (!response.ok) throw new ServiceUnavailableException(`connector credential Vault AppRole login failed (${response.status})`);
    const body = await response.json() as VaultLoginResponse;
    const token = body.auth?.client_token;
    if (!token) throw new ServiceUnavailableException("connector credential Vault AppRole login returned no token");
    this.tokenCache = { token, expiresAt: Date.now() + Math.max(120, body.auth?.lease_duration ?? 3_600) * 1_000 };
    return token;
  }

  async get(reference: string): Promise<string> {
    const { addr, mount, prefix } = this.configuration();
    const expectedPrefix = `vault-kv-v2://${mount}/${prefix}/`;
    if (!reference.startsWith(expectedPrefix) || !reference.endsWith("#hmacSecret")) {
      throw new ServiceUnavailableException("connector credential reference is outside the configured Vault namespace");
    }
    const path = reference.slice(`vault-kv-v2://${mount}/`.length, -"#hmacSecret".length);
    const response = await fetch(`${addr}/v1/${mount}/data/${path}`, {
      headers: { "X-Vault-Token": await this.token() }, signal: AbortSignal.timeout(5_000), redirect: "error",
    });
    if (!response.ok) throw new ServiceUnavailableException(`connector credential Vault read failed (${response.status})`);
    const body = await response.json() as VaultReadResponse;
    const secret = body.data?.data?.hmacSecret;
    if (typeof secret !== "string" || secret.length < 32) throw new ServiceUnavailableException("connector HMAC secret is absent or invalid");
    return secret;
  }
}
