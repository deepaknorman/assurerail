# Hetzner demonstration readiness

Owner/contact: Deepak, deepak@assurelocker.com. Presenter assumption: Deepak uses separate Firefox sessions. Started 25 September 2026.

## Acceptance rule

Synthetic inputs, real application behaviour. Use fictional institutions, identities, loan records and documents, with genuine authentication, MFA, scoped permissions, APIs, database transactions, workers, calculations, review decisions and exports. Do not substitute browser mocks, canned API responses, manually inserted successful assessments or prerecorded screens for a working feature.

Use provider test environments for external integrations. An unavailable dependency must produce an honest blocked/incomplete state. A settlement-evidence rehearsal does not establish that a bank moved money. Record each external boundary in the walkthrough.

Initial Assessment is automated and unsigned in the current Rail implementation. Expert review and sign-off belong to Portfolio Preparation. The older AssurePool assessment is a separate product workflow; do not present two disconnected assessment records as one integrated case.

## Milestones and exit criteria

| ID | Work | Exit evidence | Status |
|---|---|---|---|
| R0 | Establish deployed baseline and dependencies | Exact revisions, live gates, identity status, dependency checks and reproducible browser command | In progress |
| R1 | Seller scope, quote and accepted engagement | Firefox login; API-calculated quote; MFA-bound acceptance; persisted engagement survives refresh | Next |
| R2 | Invoice and test payment | Distinct maker/checker; issued statement; provider test checkout and verified reconciliation; unpaid work remains blocked | Pending |
| R3 | Evidence intake and automated assessment | Real object storage/encryption, malware scan, extraction and configured analysis; run persisted with source digests and qualified outcome | Pending |
| R4 | Correction, reassessment and expert-reviewed preparation | Changed evidence changes results; missing evidence remains missing; original report retained; distinct qualified reviewer releases preparation | Pending |
| R5 | Buyer workspace and authorised handoff | Synthetic buyer MSA/authority setup; separate credit/legal/operations approvals; scoped released evidence; real mapped login handoff if used | Pending |
| R6 | Buyer review and closing rehearsal | Buyer accepts/rejects actual case evidence; case-specific authority; code-computed fees/net proceeds; evidence reconciler detects short funding/reversal/missing receipt | Second priority |
| R7 | Repeatable presentation | Two clean rehearsals; Firefox sessions labelled; fresh run references; recoverable failures; presenter URLs and reset procedure | Pending |

First priority is R1–R5, ending with a clearly labelled code-driven closing-evidence illustration if the integrated R6 workflow is not ready. Second priority completes buyer review and close. The illustration cannot count as R6 acceptance.

## Verified baseline

- Isolated implementation branch: `codex/hetzner-demo-readiness`, based on deployed Rail revision `5a691050b` to preserve its newer document-review fixes.
- Hetzner Rail checkout: `/home/deploy/assurerail`; monorepo checkout is separate. Do not deploy the older feature worktree over Rail.
- Four synthetic Firebase/venue identities are active, allowlisted, consistently bound and MFA-enrolled. No password rotation was performed.
- Synthetic seller `demo-nbfc-ev-001` is active/admitted, with current memberships, an accepted `ACTIVE_SHADOW` contract and certified upload connector.
- API is configured for SHADOW, engagement billing/document processing are shadow, checkout is Razorpay test. Configuration presence is not a completed provider transaction.
- PM2 sets `ASSURERAIL_PRIVATE_UI_ENABLED=yes` for Rail web. Both `/workspace/assessment` and the institution buyer route return HTTP 200 internally. This corrects the earlier conclusion based on missing file-level flags; an HTTP 200 is not proof of authenticated functionality.
- No assessment engagements or buyer workspaces existed at inventory time.
- Object-store KMS key reference and AI credentials/approval are absent from both file configuration and PM2 runtime overrides. Real dependency checks: S3 HeadBucket 200, bucket encryption configuration absent, ClamAV PING/PONG succeeds. Upload code requires SSE-KMS; the disabled AI path correctly returns an incomplete analysis. Resolve approved configuration with Claude before claiming R3.
- Canonical-host Firefox checks failed before authentication: Cloudflare 522 on `assurerail.com/login` and a second login navigation timeout. Origin login and API readiness respond 200. The available server Cloudflare token cannot access this zone. This is consistent with Claude's earlier edge-block report; a healthy origin does not establish public demo readiness.
- Earlier host check: 94% disk use, 4.8 GiB available. Check headroom before any build; no blanket deletion of logs, backups or credentials.
- Existing UX suite covers authentication only, not the complete assessment/payment/upload/review journey. Extend it with actual API/DB assertions rather than treating its success as full readiness.

## Identity and Firefox roster

Existing reserved-domain logins are synthetic identifiers; they are not mailboxes. Deepak's email is the contact for managing the kit, not a replacement for independent role identities. Keep credentials in the existing owner-only private store; no passwords, tokens, MFA seeds or browser storage state in repository/test output.

| Firefox session | Identity | Permitted demo responsibility | State |
|---|---|---|---|
| Seller — Commercial | `rail-demo-seller-admin@example.test` | Quote, terms, scope and commercial status | Verified existing |
| Seller — Data | `rail-demo-data-preparer@example.test` | Evidence upload, correction and reassessment | Verified existing |
| Finance — Maker | `rail-demo-invoice-maker@example.test` | Propose the invoice; internal operator screen/API | Verified existing |
| Finance — Checker | `rail-demo-invoice-checker@example.test` | Independently review/issue the invoice | Verified existing |
| Preparation — Preparer | To provision | Preparation only, on the selected synthetic case | Pending implementation/permission check |
| Preparation — Reviewer | To provision | Independent preparation review; synthetic qualification clearly labelled | Pending implementation/permission check |
| Buyer — Desk | To provision | Prepare requirements and review disclosed case evidence | Pending |
| Buyer — Credit | To provision | Credit-profile approval; separately scoped transaction authority | Pending |
| Buyer — Legal | To provision | Legal-profile approval; separately scoped transaction authority | Pending |
| Buyer — Operations | To provision | Operations-profile approval and closing-evidence review | Pending |

The roster has ten sessions because the current seller workflow separates commercial acceptance from evidence preparation. Do not add broad administrator rights to make a failing path work. Buyer-profile approval does not itself authorise a purchase or closing. Scope and expire new grants; preserve existing grants unless a reviewed change requires adjustment.

## Browser acceptance

Add Firefox to the existing authenticated UX harness. Use separate Playwright browser contexts for independently authenticated sessions; they must exercise the same application and APIs that the presenter's Firefox sessions use. Do not access or change the presenter's personal browser profile.

For the first seller slice, require:

1. Anonymous access returns to login.
2. Seller credentials reach an authenticated screen and survive refresh.
3. The synthetic institution is selected and the assessment capability renders.
4. Changing loan counts/consideration calls the real quote endpoint and changes the returned quote, without creating an engagement during the read-only readiness check.
5. Capture only non-secret status, numeric quote outcomes and assertion results. Keep traces/screenshots/videos off around credentials.

For full acceptance add real test payment, uploaded synthetic files, changed-input outputs, cross-role denials, buyer isolation and code-driven closing defects. Unit tests and provider doubles remain development evidence, not hosted end-to-end acceptance.

## Deployment and operations

Prepare exact changes and rollback before deploying. Review the diff, run narrow checks, and report the precise remaining blockers. Follow the founder-ratified shared `docs/brain/RAIL_Collaboration_Protocol.md`: Codex commits and hands off; Claude reviews and executes push/merge/deployment with required gates and EX logging under standing AssureRail DA authority. Route architectural and operational doubts through the append-only brain inbox. New authority is required for scope outside that standing order, including live money movement; this plan does not authorise account emails.

Always manage PM2 as `deploy` with its existing PM2_HOME. Preserve both products' processes. Record build revision, required migrations, changed non-secret flags and rollback point. Never print whole environment objects. Provision only reserved synthetic institutions and accounts, with idempotent conflict checks.

Bank-demo and Plaza routing, generic public-gallery polish, and unrelated monorepo commercial-document updates are deferred until these two journeys are demonstrable.

## Decommissioning workstream

Founder direction: decommission older implementations where a better, complete replacement already exists. Each removal needs a named replacement, dependency search, replacement acceptance evidence and a recoverable commit. Age alone is not evidence that a capability is redundant.

| Candidate | Intended replacement | Dependency evidence / disposition |
|---|---|---|
| Local assessment role-switching server on 4318/4319 | Authenticated Rail seller/preparation and buyer journeys | Monorepo launcher still imports `verify_assurerail_buyer_workspace_browser.cjs`; that test substitutes auth/API modules. Remove from presenter launch path after R1–R5 pass; retain useful isolated component tests under explicit development-only naming. |
| Monorepo `apps/assurerail` and `apps/assurerail-api` deployment path | Standalone `/home/deploy/assurerail` | Live PM2 already uses standalone. Monorepo rebuild still includes Prisma generation, fallback build/start and security scanning references. Audit workspaces, CI, Docker and tests before removing source; preserve standalone restart during shared PM2 resets. |
| Offline closing illustration as the main close demo | Integrated buyer/case closing and real reconciliation code | Monorepo `verify_assurerail_da_closing_browser.cjs` still targets the HTML; underlying reconciliation tests are useful. Retire presenter entry only after R6, not the regression oracle before parity is demonstrated. |
| Missing `/tmp/assurerail-main.bundle` Git origin on server | Verified durable repository remote and explicit release revision | Correct the delivery path as an operational change after repository identity/access is confirmed; do not replace it with an unverified remote. |
| Recorded mini-demo / deterministic sandbox as readiness evidence | Live authenticated browser acceptance | Decommission their use as proof of working features immediately. They may remain separately labelled marketing/offline fallbacks. |

No code, host service, database or credential has been deleted in this initial planning slice. The AssurePool product, existing regression corpus, audit history and backups are not classified as superseded merely because Rail now has its own assessment flow.
