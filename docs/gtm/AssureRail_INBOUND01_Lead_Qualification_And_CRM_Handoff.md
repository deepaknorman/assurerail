# AssureRail INBOUND-01 lead qualification and CRM handoff

**Status:** code-ready, disabled by default, 3 September 2026
**Endpoint:** `POST /api/inquiries` on the AssureRail web application
**Data class:** business contact and fixed qualification fields only

## Purpose

Convert a public replay enquiry into an attributable, provider-neutral CRM event without accepting a
pool tape, borrower record, transaction document, account number or free-text deal description. The
form asks only who the institution is, the contact's role, route, current stage, whether a completed-
deal owner is named and the desired timing.

The handoff assigns one of three initial stages:

- `REPLAY_DISCOVERY_READY` when a completed case and named owner are indicated;
- `NURTURE_TRANSACTION_OWNER` when no owner exists; or
- `QUALIFICATION_REQUIRED` for every other enquiry.

These are routing signals, not product acceptance or sales-qualified-opportunity claims.

## Fail-closed configuration

The endpoint returns unavailable unless all of the following are deliberately configured:

```text
ASSURERAIL_INBOUND_ENABLED=yes
ASSURERAIL_PUBLIC_ORIGINS=https://assurerail.com
ASSURERAIL_INBOUND_WEBHOOK_URL=https://<approved-crm-adapter>/<path>
ASSURERAIL_INBOUND_ALLOWED_HOSTS=<exact-approved-host>
ASSURERAIL_INBOUND_WEBHOOK_SECRET=<Key-Vault-injected secret, at least 32 characters>
```

The destination is a provider-neutral adapter contract; no CRM vendor has been selected in code.
The receiver verifies `x-assurerail-signature` over `<timestamp>.<raw-body>`, rejects replayed event
IDs/timestamps and returns a 2xx only after durable receipt. Its own retry/dead-letter/CRM mapping must
be accepted before public enablement.

## Application controls

- exact origin allow-list and JSON-only body;
- 8 KiB declared and measured body limit;
- strict field allow-list, lengths, enums, email shape and required consent;
- hidden honeypot and a process-local five-per-15-minute backstop;
- exact configured HTTPS destination host, DNS resolution and private/link-local/loopback rejection;
- no redirect following, five-second timeout and no local lead persistence;
- HMAC-signed, versioned event with UUID and timestamp; and
- generic customer errors with no PII logging.

The process-local limiter is not a distributed abuse control. Azure Front Door/WAF rate limiting,
bot rules, origin isolation and default-deny egress remain required before enablement. DNS preflight
reduces SSRF exposure but the Azure egress allow-list is the decisive boundary.

## Enablement evidence

1. privacy notice/consent text approved and retention/controller/processor roles recorded;
2. approved CRM/adapter owner, data location, DPA and field mapping;
3. Key Vault injection and receiver-side HMAC/replay tests;
4. Front Door/WAF origin and rate-limit negative tests;
5. egress allow-list and DNS-rebinding/redirect negative tests;
6. duplicate, timeout and receiver-failure behaviour tested without lost or duplicate CRM records;
7. lead export/deletion and data-subject request process; and
8. security monitoring, alerting and operational response owner.

Until those rows pass, `ASSURERAIL_INBOUND_ENABLED` stays `no`. The public replay page then withholds
the form and displays a contact-only fallback that asks for organisation, role and route but no deal
data or attachments. Code-ready intake is not a functioning lead pipeline.
