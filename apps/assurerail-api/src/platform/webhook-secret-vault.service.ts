import { Injectable, ServiceUnavailableException } from "@nestjs/common";

interface VaultLoginResponse {
  readonly auth?: { readonly client_token?: string; readonly lease_duration?: number };
}

interface VaultReadResponse {
  readonly data?: { readonly data?: Readonly<Record<string, unknown>> };
}

function cleanSegment(value: string, name: string): string {
  const cleaned = value.trim().replace(/^\/+|\/+$/g, "");
  if (!cleaned || !/^[a-zA-Z0-9_./-]+$/.test(cleaned) || cleaned.includes("..")) {
    throw new Error(`${name} contains an invalid Vault path`);
  }
  return cleaned;
}

/** HashiCorp Vault KV-v2 adapter. Only opaque vault-kv-v2 references enter Postgres. */
@Injectable()
export class WebhookSecretVaultService {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  private configuration(): { addr: string; mount: string; prefix: string } {
    const rawAddr = (process.env.VAULT_ADDR ?? "").trim();
    if (!rawAddr) throw new ServiceUnavailableException("webhook secret Vault is not configured");
    let parsed: URL;
    try {
      parsed = new URL(rawAddr);
    } catch {
      throw new ServiceUnavailableException("webhook secret Vault address is malformed");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== "/" && parsed.pathname !== "")) {
      throw new ServiceUnavailableException("webhook secret Vault address must be an origin without credentials, path, query or fragment");
    }
    const demo = process.env.ASSURERAIL_OPERATING_MODE?.trim().toUpperCase() === "DEMO";
    if (parsed.protocol !== "https:" && !demo) {
      throw new ServiceUnavailableException("webhook secret Vault must use https outside DEMO mode");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new ServiceUnavailableException("webhook secret Vault address must use http or https");
    }
    return {
      addr: parsed.origin,
      mount: cleanSegment(process.env.ARAIL_WEBHOOK_VAULT_MOUNT ?? "secret", "ARAIL_WEBHOOK_VAULT_MOUNT"),
      prefix: cleanSegment(process.env.ARAIL_WEBHOOK_VAULT_PREFIX ?? "assurerail/webhooks", "ARAIL_WEBHOOK_VAULT_PREFIX"),
    };
  }

  private async token(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) return this.tokenCache.token;
    const direct = (process.env.VAULT_TOKEN ?? "").trim();
    const roleId = (process.env.VAULT_APPROLE_ROLE_ID ?? "").trim();
    const secretId = (process.env.VAULT_APPROLE_SECRET_ID ?? "").trim();
    if (!roleId || !secretId) {
      if (direct) return direct;
      throw new ServiceUnavailableException("webhook secret Vault authentication is not configured");
    }
    const { addr } = this.configuration();
    const response = await fetch(`${addr}/v1/auth/approle/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
      signal: AbortSignal.timeout(5_000),
      redirect: "error",
    });
    if (!response.ok) throw new ServiceUnavailableException(`webhook secret Vault AppRole login failed (${response.status})`);
    const body = await response.json() as VaultLoginResponse;
    const token = body.auth?.client_token;
    if (!token) throw new ServiceUnavailableException("webhook secret Vault AppRole login returned no token");
    this.tokenCache = {
      token,
      expiresAt: Date.now() + Math.max(120, body.auth?.lease_duration ?? 3_600) * 1_000,
    };
    return token;
  }

  async put(subscriptionId: string, secret: string): Promise<string> {
    const { addr, mount, prefix } = this.configuration();
    const path = `${prefix}/${encodeURIComponent(subscriptionId)}`;
    const response = await fetch(`${addr}/v1/${mount}/data/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Vault-Token": await this.token() },
      body: JSON.stringify({ data: { hmacSecret: secret } }),
      signal: AbortSignal.timeout(5_000),
      redirect: "error",
    });
    if (!response.ok) throw new ServiceUnavailableException(`webhook secret Vault write failed (${response.status})`);
    return `vault-kv-v2://${mount}/${path}#hmacSecret`;
  }

  async get(reference: string): Promise<string> {
    const { addr, mount, prefix } = this.configuration();
    const expectedPrefix = `vault-kv-v2://${mount}/${prefix}/`;
    if (!reference.startsWith(expectedPrefix) || !reference.endsWith("#hmacSecret")) {
      throw new ServiceUnavailableException("webhook secret reference is outside the configured Vault namespace");
    }
    const path = reference.slice(`vault-kv-v2://${mount}/`.length, -"#hmacSecret".length);
    const response = await fetch(`${addr}/v1/${mount}/data/${path}`, {
      headers: { "X-Vault-Token": await this.token() },
      signal: AbortSignal.timeout(5_000),
      redirect: "error",
    });
    if (!response.ok) throw new ServiceUnavailableException(`webhook secret Vault read failed (${response.status})`);
    const body = await response.json() as VaultReadResponse;
    const secret = body.data?.data?.hmacSecret;
    if (typeof secret !== "string" || secret.length < 32) {
      throw new ServiceUnavailableException("webhook secret Vault value is absent or invalid");
    }
    return secret;
  }
}
