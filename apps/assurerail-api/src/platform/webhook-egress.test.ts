import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublicWebhookEndpoint,
  isBlockedWebhookIp,
  parseWebhookEndpoint,
  WebhookEgressError,
} from "./webhook-egress.service";

test("[PR02][AR-H09] webhook URL syntax is HTTPS-only and rejects URL credentials/internal literals", () => {
  const blocked = [
    "http://example.com/hook",
    "https://localhost/hook",
    "https://metadata.google.internal/latest",
    "https://127.0.0.1/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://10.0.0.8/hook",
    "https://[::1]/hook",
    "https://user:password@example.com/hook",
    "https://example.com/hook?token=secret",
    "https://example.com/hook#fragment",
  ];
  for (const url of blocked) {
    assert.throws(() => parseWebhookEndpoint(url), WebhookEgressError, url);
  }
  assert.equal(parseWebhookEndpoint("https://hooks.example.com/assurerail").hostname, "hooks.example.com");
});

test("[PR02][AR-H09] DNS resolution fails closed if any answer is private, link-local or metadata", async () => {
  for (const address of [
    "127.0.0.1",
    "10.4.3.2",
    "172.16.0.1",
    "192.168.10.2",
    "169.254.169.254",
    "::1",
    "fd00::1",
    "fe80::1",
    "fe90::1",
    "febf::1",
    "ff02::1",
    "2001:db8::1",
  ]) {
    await assert.rejects(
      () => assertPublicWebhookEndpoint("https://hooks.example.com/path", async () => ["93.184.216.34", address]),
      (error: unknown) => error instanceof WebhookEgressError && error.code === "SSRF_BLOCKED",
      address,
    );
  }
  await assert.rejects(
    () => assertPublicWebhookEndpoint("https://hooks.example.com/path", async () => []),
    (error: unknown) => error instanceof WebhookEgressError && error.code === "DNS_FAILED",
  );
});

test("[PR02][AR-H09] a syntactically valid endpoint with only public DNS answers passes preflight", async () => {
  const endpoint = await assertPublicWebhookEndpoint(
    "https://hooks.example.com:8443/assurerail",
    async () => ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"],
  );
  assert.equal(endpoint.protocol, "https:");
  assert.equal(endpoint.port, "8443");
  assert.equal(isBlockedWebhookIp("93.184.216.34"), false);
});
