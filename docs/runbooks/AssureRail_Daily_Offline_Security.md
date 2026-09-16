# AssureRail daily offline security check

## Purpose

This lane gives operations a deterministic daily security result without Docker, network access, provider credentials or live customer data. It runs local source, policy, classification, authentication, pricing and parser-abuse checks inside an operating-system network sandbox. A missing isolation mechanism fails the run closed.

Run it from the AssureRail repository root:

```bash
npm run security:offline-daily
```

The existing scheduled daily QA entry point runs this lane against its refreshed shadow checkout after dependency preparation. It also supports running only the offline lane, without the pull/install/Strix stages:

```bash
bash scripts/assurerail-daily-qa.sh --offline-security
```

## What the run covers

- shell syntax for every repository shell script;
- high-confidence secret patterns in tracked text, with values always redacted;
- `package-lock.json` integrity, HTTPS registry hashes and installed-version agreement using local metadata only;
- core AssureRail security invariants and public-claim exposure checks;
- generated commercial-policy and pricing invariants;
- Phase-1 DA operations artifact, link and claims checks;
- download packaging and PUBLIC/SHARED_PASSWORD/AUTHENTICATED/INTERNAL classification boundaries;
- web access-control and download negative tests;
- API authentication/RBAC negative tests compiled from the current source into a temporary directory;
- pricing tests for assessment, preparation and execution rules; and
- deterministic PDF/XLSX/CSV parser and OCR-routing abuse fixtures.

It deliberately does not perform online advisory refreshes, live payment/bank/bureau/settlement calls, browser DAST, Docker scans, database integration or model-provider OCR calls. Those require separate controlled evidence and must never be silently counted as an offline pass.

## Evidence and exit codes

Each invocation writes mode `0600` evidence under `docs/qa/daily/arail/offline-security/`:

- `OFFLINE_SECURITY_<UTC timestamp>.json` for automation;
- `OFFLINE_SECURITY_<UTC timestamp>.txt` for human review;
- atomically replaced `latest.json` and `latest.txt` pointers.

Evidence is ignored by Git. The default retention is 30 days. Set `ARAIL_OFFLINE_SECURITY_RETENTION_DAYS` from 1 to 365 to change it. Set `ARAIL_OFFLINE_SECURITY_EVIDENCE_DIR` to an absolute protected operations path when evidence must survive checkout cleanup.

Exit codes are meaningful:

| Code | Meaning |
|---:|---|
| `0` | Every required offline check passed. |
| `1` | One or more security checks failed or were blocked. |
| `2` | Harness prerequisite, isolation or evidence failure. |
| `75` | Another daily offline run holds the lock. |

No check is converted to a pass when a prerequisite is missing. Failed API compilation blocks the dependent RBAC and pricing tests and the overall result remains failed.

## Cron-safe scheduling

Use an absolute repository path and a restricted evidence directory. Do not inject product/provider `.env` files.

```cron
17 2 * * * cd /srv/assurerail && /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/var/lib/assurerail-security ARAIL_OFFLINE_SECURITY_EVIDENCE_DIR=/var/lib/assurerail-security/evidence npm run security:offline-daily >>/var/log/assurerail-offline-security.log 2>&1
```

The runner sanitises the environment again before each child process, uses an empty temporary `HOME`, sets npm to offline mode and passes no live credential variables. On macOS it requires `sandbox-exec` with `deny network*`; on Linux it requires permission to create an `unshare --net` namespace. Validate that prerequisite on the actual scheduler host before relying on the job.

## Triage

1. Read `latest.json` and its named timestamped report.
2. Treat `HARNESS_ERROR`, `FAIL` and `BLOCKED` as non-green results.
3. Reproduce the named command locally without adding credentials or network access.
4. Correct the source, lock/install state, policy artifact or fixture failure.
5. Rerun the complete lane and retain both the failed and passing timestamped evidence until the incident is closed.

Strix remains an optional online/Docker lane. When `ARAIL_OFFLINE_ONLY=1`, `scripts/assurerail-strix-daily.sh` exits `3` with an explicit skip instead of making a provider call.
