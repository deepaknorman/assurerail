# AssureRail INBOUND-01 lead qualification and CRM handoff

**Status:** destination selected and code-ready; secure bridge and operating evidence open; disabled
by default, 4 September 2026
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
ASSURERAIL_INBOUND_WEBHOOK_URL=https://<approved-azure-receiver>/<path>
ASSURERAIL_INBOUND_ALLOWED_HOSTS=<exact-approved-azure-host>
ASSURERAIL_INBOUND_WEBHOOK_SECRET=<Key-Vault-injected secret, at least 32 characters>
```

The commercial destination follows the existing AssureLocker arrangement: the Google Sheet Control
Tower is the operating record, with the same event mirrored into Brevo and Agile CRM; Calendly
remains the booking tool. This is a destination decision, not permission to share customer or
transaction evidence between Locker and Rail.

The AssureRail endpoint remains provider-neutral and points first to an Azure-hosted receiver. That
receiver verifies `x-assurerail-signature` over `<timestamp>.<raw-body>`, durably records the event
ID before acknowledging it, rejects stale/replayed events and forwards a bounded projection to the
shared Control Tower using a separate hop secret. It must retry or dead-letter downstream failures
without duplicating the Sheet, Brevo or Agile records.

The public Google Apps Script URL is **not** an approved direct AssureRail destination: Apps Script
does not expose arbitrary HMAC headers to `doPost`, and its cache is not a durable replay ledger.
`tools/gtm-control-tower/AssureRail.gs` implements only the final strict projection after the Azure
receiver has authenticated and durably accepted the event.

Apps Script can return HTTP 200 with `{ "ok": false }`. The Azure receiver must therefore parse the
response body, retain downstream delivery state, and treat anything other than `ok: true` as a
failed attempt. A Control Tower row is not evidence that Brevo and Agile both reconciled; their
required receipt/status is checked independently before the event is terminal.

## Selected destination mapping

| AssureRail field | Control Tower / CRM use |
|---|---|
| `requestId` | idempotency and fixed conversation-note reference |
| `organization` | Account name |
| `workEmail` | Contact work email / upsert key |
| `jobRole` | Corporate title and functional role |
| `institutionType` | governed Rail segment (`NBFC`, bank/transferee, investor, trustee, RTA/depository or provider/advisor) |
| `route` | fixed note value: `DA`, `PTC` or `BOTH` |
| `currentStage` / `transactionOwner` / `timing` | fixed qualification note fields |
| derived qualification | `REPLAY_DISCOVERY_READY`, `NURTURE_TRANSACTION_OWNER` or `QUALIFICATION_REQUIRED` |
| source/motion | `AssureRail Replay Enquiry` / `AssureRail Completed-Deal Replay` |
| Brevo destination | dedicated `ARAIL_REPLAY` list; list ID remains secret configuration |

No name, telephone, free-text message, attachment, transaction identifier, borrower field or deal
economics are added by the mapping. Agile/Brevo follow-up remains human-supervised and may not turn a
qualification signal into a customer, pipeline or capability claim.

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
2. Control Tower/Brevo/Agile owners, data locations, DPA/privacy position and the mapping above
   accepted;
3. Key Vault injection and receiver-side HMAC/replay tests;
4. Front Door/WAF origin and rate-limit negative tests;
5. egress allow-list and DNS-rebinding/redirect negative tests;
6. duplicate, timeout and receiver-failure behaviour tested without lost or duplicate CRM records;
7. lead export/deletion and data-subject request process; and
8. security monitoring, alerting and operational response owner.

Until those rows pass, `ASSURERAIL_INBOUND_ENABLED` stays `no`. Selecting the same destinations used
by AssureLocker closes the vendor-choice question only; it does not close privacy, durable receiver,
security or operating acceptance. The public replay page then withholds
the form and displays a contact-only fallback that asks for organisation, role and route but no deal
data or attachments. Code-ready intake is not a functioning lead pipeline.
