# AssureRail CX-01 and SIM-01 — guided customer journey and synthetic sandbox

**Status:** implemented behind disabled web controls, 3 September 2026

## CX-01 outcome

The authenticated institution workspace now offers a guided DA/PTC setup path. A user selects the
transaction route and either historic replay or live shadow. The guide reads the existing Rail-local
institution record and displays admission, active membership, route entitlement, connector,
historic-data-owner and external-authority readiness separately.

The guide deliberately does not create an institution, mandate, entitlement or case. It cannot
promote missing evidence to ready. All action links return the user to the existing governed systems
where the API performs its own authority check.

## SIM-01 outcome

The customer sandbox is a static, deterministic and non-operative walkthrough with one conventional
DA fixture and one conventional PTC fixture. Both contain seeded defects. The DA fixture leaves an
unknown payment-finality classification and missing source acknowledgement; the PTC fixture exposes
a trustee-schedule versus authoritative-record quantity mismatch.

The sandbox performs no API call and no write. It cannot move money or title, issue or allot an
instrument, send a notice, update a register or operate a token. Synthetic results are rejected as
customer, trustee, recordkeeper, security, legal or production evidence.

## Controls

```text
NEXT_PUBLIC_ASSURERAIL_GUIDED_JOURNEY_V1=off
NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1=off
```

Both controls accept only the exact value `shadow`. The sandbox route returns `404` while disabled
and carries `noindex, nofollow` metadata when built.

## Verification

```sh
npm --workspace @code/assurerail run check:cx01-sim01
npm --workspace @code/assurerail run build
```

The structural check pins both flags off, the authenticated journey boundary, both fixtures, the
UNKNOWN/review-required and blocking outcomes, the absence of write/network calls from the sandbox,
and the disabled-route `notFound()` control.
