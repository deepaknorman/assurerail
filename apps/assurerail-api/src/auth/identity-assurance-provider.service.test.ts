import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../config";
import { IdentityAssuranceProviderService } from "./identity-assurance-provider.service";

function withEnvironment(values: Record<string, string | undefined>, run: () => Promise<void>): Promise<void> {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return run().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("[SEP01][IDENTITY] demo binding is Rail-owned and does not expose the email", async () => {
  await withEnvironment({ IDENTITY_ASSURANCE_ADAPTER: "demo", IDENTITY_PROVIDER_KEY: undefined }, async () => {
    const result = await new IdentityAssuranceProviderService().verify("Person@Example.invalid");
    assert.equal(result.ok, true);
    assert.equal(result.providerKey, "ASSURERAIL_DEMO_IDENTITY");
    assert.match(result.subject ?? "", /^urn:assurerail:demo-subject:[a-f0-9]{24}$/);
    assert.doesNotMatch(result.subject ?? "", /person|example/i);
    assert.equal(result.assuranceLevel, "DEMO_ONLY");
  });
});

test("[SEP01][IDENTITY] an off or invalid adapter fails closed instead of behaving like demo", async () => {
  for (const mode of ["off", "unexpected"]) {
    await withEnvironment({ IDENTITY_ASSURANCE_ADAPTER: mode }, async () => {
      const result = await new IdentityAssuranceProviderService().verify("person@example.invalid");
      assert.equal(result.ok, false);
      assert.equal(
        result.reason,
        mode === "off" ? "identity-assurance-disabled" : "identity-assurance-mode-invalid",
      );
    });
  }
});

test("[SEP01][IDENTITY] live provider contract is generic, authenticated and fail-closed", async () => {
  const previousFetch = globalThis.fetch;
  const previousUrl = config.identityProviderApiUrl;
  const previousKey = config.identityProviderApiKey;
  const previousPath = config.identityProviderStatusPath;
  const previousTimeout = config.identityProviderTimeoutMs;
  try {
    config.identityProviderApiUrl = "https://identity.example.invalid";
    config.identityProviderApiKey = "test-only-bearer";
    config.identityProviderStatusPath = "/v1/identity-assurance/status";
    config.identityProviderTimeoutMs = 1_000;
    let request: { input: string; init?: RequestInit } | undefined;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      request = { input: String(input), init };
      return new Response(JSON.stringify({
        active: true,
        subject: "subject:provider:123",
        evidenceRef: "evidence:identity:123",
        assuranceLevel: "INSTITUTION_APPROVED_HIGH",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    await withEnvironment({
      IDENTITY_ASSURANCE_ADAPTER: "live",
      IDENTITY_PROVIDER_KEY: "customer_identity_provider",
    }, async () => {
      const service = new IdentityAssuranceProviderService();
      const result = await service.verify("person@example.invalid", "subject:provider:123");
      assert.equal(result.ok, true);
      assert.equal(result.providerKey, "CUSTOMER_IDENTITY_PROVIDER");
      assert.equal(result.subject, "subject:provider:123");
      assert.equal(request?.input, "https://identity.example.invalid/v1/identity-assurance/status");
      assert.equal(request?.init?.redirect, "error");
      assert.equal(new Headers(request?.init?.headers).get("authorization"), "Bearer test-only-bearer");
      assert.deepEqual(JSON.parse(String(request?.init?.body)), {
        email: "person@example.invalid",
        claimedSubject: "subject:provider:123",
      });
    });
  } finally {
    globalThis.fetch = previousFetch;
    config.identityProviderApiUrl = previousUrl;
    config.identityProviderApiKey = previousKey;
    config.identityProviderStatusPath = previousPath;
    config.identityProviderTimeoutMs = previousTimeout;
  }
});

test("[SEP01][IDENTITY] mismatched or expired provider evidence cannot bind", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = config.identityProviderApiKey;
  try {
    config.identityProviderApiKey = "test-only-bearer";
    await withEnvironment({
      IDENTITY_ASSURANCE_ADAPTER: "live",
      IDENTITY_PROVIDER_KEY: "INDEPENDENT_PROVIDER",
    }, async () => {
      globalThis.fetch = (async () => new Response(JSON.stringify({
        active: true,
        subject: "subject:other",
      }), { status: 200 })) as typeof fetch;
      const mismatch = await new IdentityAssuranceProviderService().verify("person@example.invalid", "subject:expected");
      assert.equal(mismatch.ok, false);
      assert.equal(mismatch.reason, "identity-subject-mismatch");

      globalThis.fetch = (async () => new Response(JSON.stringify({
        active: true,
        subject: "subject:expected",
        expiresAt: "2020-01-01T00:00:00.000Z",
      }), { status: 200 })) as typeof fetch;
      const expired = await new IdentityAssuranceProviderService().verify("person@example.invalid", "subject:expected");
      assert.equal(expired.ok, false);
      assert.equal(expired.reason, "identity-evidence-expired");
    });
  } finally {
    globalThis.fetch = previousFetch;
    config.identityProviderApiKey = previousKey;
  }
});
