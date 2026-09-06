# AssureRail SEC-01 dependency posture

**Date:** 3 September 2026
**Scope:** production dependencies of standalone workspaces `@assurerail/api` and `@assurerail/web`;
development-only tooling and external products are excluded
**Gate:** `npm run security:deps`

## Result

| Audit point | Critical | High | Moderate | Low |
|---|---:|---:|---:|---:|
| Before SEC-01 lock remediation | 0 | 11 | 14 | 1 |
| SEC-01 resolved lockfile | 0 | 0 | 6 | 0 |

The audit gate fails on any critical/high, any unexpected moderate package, a count above the bounded
baseline, malformed JSON or an unavailable npm advisory service. This prevents a network failure from
being reported as a clean audit.

Framework/runtime changes made in this tranche include NestJS 11.2.3, Schedule 5.0.1, Firebase Admin
14.3.0, Undici 6.28.0 and Next.js 16.3.4. Existing root overrides for Undici, Next and multipart are
raised to their patched releases; four additional, narrowly required overrides pin patched gRPC,
deep-merge, URI and query-string transitives. Updated framework dependency trees supply the patched
request-parser, file-type, identifier, CSS and image-processing releases without further overrides.
The full API test corpus and both production builds must remain green after the resolved lockfile is
installed.

## Six open moderate findings

The remaining finding set is exact and machine-checked:

- `firebase-admin`;
- `@google-cloud/storage`;
- `retry-request`;
- `teeny-request`;
- `gaxios`; and
- `uuid`.

These form one transitive Google Cloud Storage transport chain under Firebase Admin. AssureRail imports
Firebase Admin authentication (`getAuth`/token verification); it does not import or use Firebase/Google
Cloud Storage. A repository search and runtime dependency trace therefore place the vulnerable buffer
and transport functions outside the intended request path. That lowers reachability; it does not erase
the advisory.

At the checked lockfile, npm proposes Firebase Admin 10.3.0 as the available remediation. That is a
major downgrade and still conflicts with the current aggregate advisory information, so it is not an
acceptable security fix. Forcing unrelated `uuid` copies across Google libraries is also rejected
without their upstream compatibility support.

**Decision:** accept temporarily at moderate, monitor upstream, re-run on every lock/dependency change
and review no later than 3 October 2026. A new direct import of Cloud Storage, a change in package set,
an elevated advisory, or a patched compatible Firebase release reopens the decision immediately.

This is an internal reachability decision, not an independent finding closure. The external VAPT firm
receives this record and may challenge or supersede the assessment.

## Verification commands

```bash
npm ci
npm run security:deps
npm test --workspace=@assurerail/api
npm run build --workspace=@assurerail/api
npm run build --workspace=@assurerail/web
```

The committed lockfile installs reproducibly with `npm ci`. The gate audits the resolved production
tree, not version ranges alone.
