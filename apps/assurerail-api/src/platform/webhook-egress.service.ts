import { BadRequestException, Injectable } from "@nestjs/common";
import { lookup as dnsLookupCallback } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent } from "undici";

export class WebhookEgressError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "WebhookEgressError";
  }
}

export interface WebhookHttpResult {
  readonly status: number;
  readonly ok: boolean;
  readonly body: string;
  readonly challengeSignature: string | null;
}

export type WebhookDnsResolver = (host: string) => Promise<readonly string[]>;

export function isBlockedWebhookIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const octets = ip.split(".").map(Number);
    return octets[0] === 0
      || octets[0] === 10
      || octets[0] === 127
      || (octets[0] === 169 && octets[1] === 254)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
      || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
      || (octets[0] === 192 && octets[1] === 0 && (octets[2] === 0 || octets[2] === 2))
      || (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19))
      || (octets[0] === 198 && octets[1] === 51 && octets[2] === 100)
      || (octets[0] === 203 && octets[1] === 0 && octets[2] === 113)
      || octets[0] >= 224;
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    const firstHextet = Number.parseInt(normalized.split(":")[0] || "0", 16);
    if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
    if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((firstHextet & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    if (normalized.startsWith("64:ff9b:")) return true;
    if (normalized.startsWith("::ffff:")) return isBlockedWebhookIp(normalized.slice(7));
    if (normalized.startsWith("2001:db8:") || normalized === "2001:db8::") return true; // documentation
    if (normalized.startsWith("2002:")) return true; // 6to4 may embed a private IPv4 destination
  }
  return version === 0;
}

function normalizedHost(parsed: URL): string {
  return parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function assertHostSyntax(host: string): void {
  if (
    host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.endsWith(".internal")
    || host === "metadata"
    || host === "metadata.google.internal"
  ) {
    throw new WebhookEgressError("webhook endpoint uses an internal hostname", "SSRF_BLOCKED");
  }
  if (isIP(host)) {
    if (isBlockedWebhookIp(host)) throw new WebhookEgressError("webhook endpoint uses a private or reserved address", "SSRF_BLOCKED");
    return;
  }
  const firstLabel = host.split(".")[0] ?? "";
  if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host) || /^0[0-7]+$/.test(firstLabel)) {
    throw new WebhookEgressError("webhook endpoint uses a non-canonical numeric host", "SSRF_BLOCKED");
  }
}

export function parseWebhookEndpoint(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new WebhookEgressError("webhook endpoint is malformed", "BAD_URL");
  }
  if (parsed.protocol !== "https:") throw new WebhookEgressError("webhook endpoint must use https", "HTTPS_REQUIRED");
  if (parsed.username || parsed.password) throw new WebhookEgressError("webhook endpoint must not contain URL credentials", "URL_CREDENTIALS_BLOCKED");
  if (parsed.search) throw new WebhookEgressError("webhook endpoint must not contain query parameters", "URL_QUERY_BLOCKED");
  if (parsed.hash) throw new WebhookEgressError("webhook endpoint must not contain a fragment", "URL_FRAGMENT_BLOCKED");
  assertHostSyntax(normalizedHost(parsed));
  return parsed;
}

async function systemResolver(host: string): Promise<readonly string[]> {
  try {
    return (await dnsLookup(host, { all: true })).map((address) => address.address);
  } catch {
    throw new WebhookEgressError("webhook endpoint hostname did not resolve", "DNS_FAILED");
  }
}

export async function assertPublicWebhookEndpoint(
  raw: string,
  resolver: WebhookDnsResolver = systemResolver,
): Promise<URL> {
  const parsed = parseWebhookEndpoint(raw);
  const host = normalizedHost(parsed);
  if (isIP(host)) return parsed;
  const addresses = await resolver(host);
  if (addresses.length === 0) throw new WebhookEgressError("webhook endpoint hostname did not resolve", "DNS_FAILED");
  if (addresses.some((address) => isBlockedWebhookIp(address))) {
    throw new WebhookEgressError("webhook endpoint resolves to a private or reserved address", "SSRF_BLOCKED");
  }
  return parsed;
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address?: string | Array<{ address: string; family: number }>,
  family?: number,
) => void;

function guardedConnectLookup(
  hostname: string,
  options: { all?: boolean; family?: number } | undefined,
  callback: LookupCallback,
): void {
  dnsLookupCallback(hostname, { ...(options ?? {}), all: true }, (error, addresses) => {
    if (error) return callback(error);
    const list = Array.isArray(addresses) ? addresses : [];
    const blocked = list.find((address) => isBlockedWebhookIp(address.address));
    if (blocked) {
      return callback(Object.assign(new Error("connect-time DNS resolved to a blocked address"), { code: "SSRF_BLOCKED" }));
    }
    if (list.length === 0) return callback(Object.assign(new Error("hostname did not resolve"), { code: "ENOTFOUND" }));
    if (options?.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new WebhookEgressError("webhook response exceeded the evidence limit", "RESPONSE_TOO_LARGE");
    }
    chunks.push(result.value);
  }
  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  return body;
}

@Injectable()
export class WebhookEgressService {
  async validateEndpoint(raw: string): Promise<void> {
    try {
      await assertPublicWebhookEndpoint(raw);
    } catch (error) {
      if (error instanceof WebhookEgressError) throw new BadRequestException(`${error.code}: ${error.message}`);
      throw error;
    }
  }

  async post(
    raw: string,
    body: string,
    headers: Readonly<Record<string, string>>,
    timeoutMs = 10_000,
  ): Promise<WebhookHttpResult> {
    const parsed = await assertPublicWebhookEndpoint(raw);
    const agent = new Agent({
      connect: {
        rejectUnauthorized: true,
        lookup: guardedConnectLookup as unknown as import("node:net").LookupFunction,
      },
    });
    try {
      const init = {
        method: "POST",
        headers,
        body,
        redirect: "manual" as const,
        signal: AbortSignal.timeout(timeoutMs),
        dispatcher: agent,
      } as RequestInit & { dispatcher: Agent };
      const response = await fetch(parsed, init);
      if (response.status >= 300 && response.status < 400) {
        throw new WebhookEgressError("webhook endpoint attempted a redirect", "REDIRECT_BLOCKED");
      }
      return {
        status: response.status,
        ok: response.ok,
        body: await readBoundedBody(response, 16 * 1024),
        challengeSignature: response.headers.get("x-arail-challenge-signature"),
      };
    } finally {
      await agent.close();
    }
  }
}
