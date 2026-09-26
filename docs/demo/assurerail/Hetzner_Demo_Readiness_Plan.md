# Hetzner demonstration readiness

Owner/contact: Deepak, deepak@assurelocker.com. Presenter assumption: Deepak uses separate Firefox sessions. Started 25 September 2026.

## Acceptance rule

Synthetic inputs, real application behaviour. Use fictional institutions, identities, loan records and documents, with genuine authentication, MFA, scoped permissions, APIs, database transactions, workers, calculations, review decisions and exports. Do not substitute browser mocks, canned API responses, manually inserted successful assessments or prerecorded screens for a working feature.

Use provider test environments for external integrations. An unavailable dependency must produce an honest blocked/incomplete state. A settlement-evidence rehearsal does not establish that a bank moved money. Record each external boundary in the walkthrough.

Initial Assessment is automated and unsigned in the current Rail implementation. Expert review and sign-off belong to Portfolio Preparation. The older AssurePool assessment is a separate product workflow; do not present two disconnected assessment records as one integrated case.

## Current execution queue — reconciled 27 September 2026

The founder’s later requests added scale fixtures and a Step-3 comparison view; they did not
cancel the original hosted seller/buyer proof or decommissioning work. Keep one queue here,
and reconcile it against the shared brain before status reports. Local tests, provisioning,
provider smoke checks and recordings are not substitutes for the complete hosted journey.

Completed foundations: working alternate hostname/reCAPTCHA, dedicated AI key activation and
provider smoke check, login/quote authority fixes, Rail-owned evidence storage and scanner
health, nine distinct demo identities, reviewer read permission and visible synthetic
qualification, and the validated 3,000-loan / INR 55 crore input pack. Claude’s 27 September
release notice reports main and box at `107834ad1`; the last runtime change is `6bc3f5afb`.

| Priority | Outstanding work | Completion evidence still required |
|---|---|---|
| 1 | Hosted seller acceptance, finance maker/checker invoice, test payment and Book A intake (R1–R3) | Persisted engagement, actual test-payment reconciliation, uploaded/scanned evidence and a real processing job with its honest outcome/coverage reason |
| 2 | Assessment processing at scale and supporting documents (R3) | Keep loan tapes entirely out of the model; deterministic full-tape checks; persisted/resumable bounded document-review attempts; explicit reviewed/unreviewed coverage and costs. Supply fictional supporting evidence, rather than treating clean tapes as complete portfolios |
| 3 | Correction, reassessment and reviewed Portfolio Preparation, including seller offer preparation (R4) | Original run retained, changed evidence changes outputs, current synthetic reviewer qualification, report-bound evidence and fresh MFA, independently released preparation and recorded seller-offer membership |
| 4 | NBFC 2 and buyer access/onboarding (R5) | Separate admitted NBFC 2; guarded membership/authority; accepted MSA, valid signed evidence and independent workspace propose/verify; separated buyer approvals; released synthetic pool visible to authorised buyer |
| 5 | Portfolio progression and clickable final-offer cohort view | Implement the approved versioned membership, shared visibility checks, allocation overlap protection, projection and accessible drill-down; bind all displayed values to actual assessed/presented/selected records |
| 6 | Buyer review and closing rehearsal (R6) | Actual case decisions/authority, computed fees/net proceeds and negative tests for short funding, reversal and missing receipt; no assertion that shadow evidence means money moved |
| 7 | Repeatable Firefox proof and recordings (R7) | Two repeatable clean rehearsals, presenter/reset instructions, Book A seller re-recording after hosted proof, buyer recording after released-pool gate |
| Alongside relevant slices | Known correctness/security follow-ups | Reviewer-read InternalAccessEvent; explicit preparer-cannot-sign regression; investigate /cases institution selector; reduce synthetic MinIO application credential scope |
| After replacement proof | Legacy decommissioning and supporting demos | Retire superseded presenter/deployment paths with dependency checks and rollback; separately verify Lens/CLA supporting demonstrations |

The original document-review gaps also remain open: page-only locators, empty document-level
fields/fieldAssessments/contradictions, page rendering/events and golden-corpus evaluation.
Treat each as a separately evidenced capability; do not conceal them behind an overall green
assessment label. The canonical assurerail.com Cloudflare issue remains separate from the
working demo hostname and is not a reason to ask the founder to repeat completed key/domain work.

INR 55 crore across two NBFCs is demonstration scale only. It does not replace the separate
live INR 48 crore opportunity, commercial policy, pricing tests or deck figures. The product
quotes per engagement; manual billing-cohort allocation must remain distinct from chart
presentation membership and seller-specific closing groups.

Immediate next hosted proof is Book A’s real acceptance/payment/upload/processing path, reporting
the current AI budget skip if encountered. Runtime scale remediation and the approved chart
implementation remain separate deliverables, followed by the complete R4–R6 evidence chain.

## Milestones and exit criteria

| ID | Work | Exit evidence | Status |
|---|---|---|---|
| R0 | Establish deployed baseline and dependencies | Exact revisions, live gates, identity status, dependency checks and reproducible browser command | In progress |
| R1 | Seller scope, quote and accepted engagement | Firefox login; API-calculated quote; MFA-bound acceptance; persisted engagement survives refresh | Quote/session checks passed on 95d62d192; acceptance pending |
| R2 | Invoice and test payment | Distinct maker/checker; issued statement; provider test checkout and verified reconciliation; unpaid work remains blocked | Pending |
| R3 | Evidence intake and automated assessment | Real object storage/encryption, malware scan, extraction and configured analysis; run persisted with source digests and qualified outcome | Local full-tape checks pass; hosted proof and AI scale remediation pending |
| R4 | Correction, reassessment and expert-reviewed preparation | Changed evidence changes results; missing evidence remains missing; original report retained; distinct qualified reviewer releases preparation | Reviewer access/disclosure fixes deployed; workflow proof pending |
| R5 | Buyer workspace and authorised handoff | Synthetic buyer MSA/authority setup; separate credit/legal/operations approvals; scoped released evidence; real mapped login handoff if used | Four identities provisioned; onboarding, authority and released-pool proof pending |
| R6 | Buyer review and closing rehearsal | Buyer accepts/rejects actual case evidence; case-specific authority; code-computed fees/net proceeds; evidence reconciler detects short funding/reversal/missing receipt | Second priority |
| R7 | Repeatable presentation | Two clean rehearsals; Firefox sessions labelled; fresh run references; recoverable failures; presenter URLs and reset procedure | Seller sizing/navigation recording delivered; full-journey proof and buyer recording pending |

First priority is R1–R5, ending with a clearly labelled code-driven closing-evidence illustration if the integrated R6 workflow is not ready. Second priority completes buyer review and close. The illustration cannot count as R6 acceptance.

## Verified baseline

- Isolated implementation branch: `codex/hetzner-demo-readiness`, based on deployed Rail revision `5a691050b` to preserve its newer document-review fixes.
- Hetzner Rail checkout: `/home/deploy/assurerail`; monorepo checkout is separate. Do not deploy the older feature worktree over Rail.
- Nine synthetic Firebase/venue identities are provisioned and MFA-enrolled per Claude’s DB verification: four original seller/finance identities, an independent preparation reviewer and four buyers. Existing credentials were preserved; buyer identities have no seeded membership, mandates or active workspace.
- Synthetic seller `demo-nbfc-ev-001` is active/admitted, with current memberships, an accepted `ACTIVE_SHADOW` contract and certified upload connector.
- API is configured for SHADOW, engagement billing/document processing are shadow, checkout is Razorpay test. Configuration presence is not a completed provider transaction.
- PM2 sets `ASSURERAIL_PRIVATE_UI_ENABLED=yes` for Rail web. Both `/workspace/assessment` and the institution buyer route return HTTP 200 internally. This corrects the earlier conclusion based on missing file-level flags; an HTTP 200 is not proof of authenticated functionality.
- No assessment engagements or buyer workspaces existed at inventory time.
- Storage blocker resolved on 26 September: Claude provisioned a Rail-owned MinIO instance on loopback port 9010 with separate volume/credentials, configured SSE-KMS and verified an encrypted object write. Codex independently rechecked HeadBucket 200, GetBucketEncryption 200/`aws:kms`, runtime KMS reference present and ClamAV PING/PONG. Application upload acceptance is still pending. The synthetic-tier application credential is the instance root credential, not least privilege; scope reduction remains outstanding.
- Founder supplied a dedicated Rail key locally as `ARAIL_OPENAI_KEY`. Model access returned 200, and the actual Rail adapter returned the expected strict-JSON synthetic marker using OpenAI with no fallback. Claude subsequently activated the canonical key and synthetic-demo processing flags on Hetzner and verified the deployed adapter: OpenAI `gpt-5.6-luna`, exact synthetic marker, no fallback. This provider check is not a completed hosted assessment; preserve incomplete markers whenever an actual run has no completed analysis.
- Initial canonical-host Firefox checks failed before authentication (Cloudflare 522 / navigation timeout). On 26 September a host Firefox diagnostic waited for the form to become interactive, then obtained Firebase sign-in 200 and venue session 201; subsequent `/console` requests returned Cloudflare 403/challenges. Local input also raced hydration before React handlers attached. A successful session or changed URL does not prove console availability. The available server Cloudflare token cannot access this zone; the hostname/access decision remains open.
- After founder added the alternate reCAPTCHA domain, host Firefox on `arail.assurelocker.com` completed login and rendered the seller identity. Quote preview then returned the application denial `SCOPE_REFERENCE_MISMATCH`: the access service omitted the request's institution reference while the synthetic mandate correctly named it. The scope-reference fix is released in `95d62d192`. The host Firefox retest passed: actual quote previews returned HTTP 201 at 12 and 2500 units, changed their scope digest and increased the Initial Assessment amount from 31200000 to 48750000 minor units. Commercial and Data Preparer identities remained distinct after refresh. No engagement was created and no payment submitted in this check.
- Claude reports 7.6 GiB free after bounded journal/cache/obsolete-browser cleanup on 26 September (earlier check: 4.8 GiB). Recheck headroom before builds.
- Existing UX suite covers authentication only, not the complete assessment/payment/upload/review journey. Extend it with actual API/DB assertions rather than treating its success as full readiness.

## Identity and Firefox roster

Existing reserved-domain logins are synthetic identifiers; they are not mailboxes. Deepak's email is the contact for managing the kit, not a replacement for independent role identities. Keep credentials in the existing owner-only private store; no passwords, tokens, MFA seeds or browser storage state in repository/test output.

| Firefox session | Identity | Permitted demo responsibility | State |
|---|---|---|---|
| Seller — Commercial | `rail-demo-seller-admin@example.test` | Quote, terms, scope and commercial status | Verified existing |
| Seller — Data | `rail-demo-data-preparer@example.test` | Evidence upload, correction and reassessment | Verified existing |
| Finance — Maker | `rail-demo-invoice-maker@example.test` | Propose the invoice; internal operator screen/API | Verified existing |
| Finance — Checker | `rail-demo-invoice-checker@example.test` | Independently review/issue the invoice | Verified existing |
| Preparation — Preparer | Reuse Seller — Data | Preparation on the selected synthetic case | Roster approved; real preparation pending |
| Preparation — Reviewer | `rail-demo-preparation-reviewer@example.test` | Independent preparation review; synthetic qualification clearly labelled | Provisioned, institution-scoped; qualification configuration and real release proof pending |
| Buyer — Desk | `rail-demo-buyer-desk@example.test` | Prepare requirements and review disclosed case evidence | Identity provisioned; onboarding/authority pending |
| Buyer — Credit | `rail-demo-buyer-credit@example.test` | Credit-profile approval; separately scoped transaction authority | Identity provisioned; onboarding/authority pending |
| Buyer — Legal | `rail-demo-buyer-legal@example.test` | Legal-profile approval; separately scoped transaction authority | Identity provisioned; onboarding/authority pending |
| Buyer — Operations | `rail-demo-buyer-operations@example.test` | Operations-profile approval and closing-evidence review | Identity provisioned; onboarding/authority pending |

The roster has nine distinct identities: the seller workflow separates commercial acceptance from evidence preparation, and Data Preparer also requests preparation. Claude approved one separate reviewer and four buyers. The optional guarded bootstrap extension provisions those identities; buyer onboarding and scoped approval mandates remain application workflows. Do not add broad administrator rights to make a failing path work. Buyer-profile approval does not itself authorise a purchase or closing. Scope and expire new grants; preserve existing grants unless a reviewed change requires adjustment.

## Browser acceptance

Add Firefox to the existing authenticated UX harness. Use separate Playwright browser contexts for independently authenticated sessions; they must exercise the same application and APIs that the presenter's Firefox sessions use. Do not access or change the presenter's personal browser profile.

For the first seller slice, require:

1. Anonymous access returns to login.
2. Seller credentials reach an authenticated screen and survive refresh.
3. The synthetic institution is selected and the assessment capability renders.
4. Changing loan counts/consideration calls the real quote endpoint and changes the returned quote, without creating an engagement during the read-only readiness check.
5. Capture only non-secret status, numeric quote outcomes and assertion results. Keep traces/screenshots/videos off around credentials.

For full acceptance add real test payment, uploaded synthetic files, changed-input outputs, cross-role denials, buyer isolation and code-driven closing defects. Unit tests and provider doubles remain development evidence, not hosted end-to-end acceptance.

Document-review limitations from Claude's original-design review remain explicit gates: evidence locators are page-only, with no bounding boxes or exact-field highlighting; document-level envelopes still leave `fields`, `fieldAssessments` and `contradictions` empty. Do not present those outputs as implemented, or replace them with invented display data. Page rendering, events, batch budgets and the golden-corpus evaluation also remain acceptance work.

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
| Missing `/tmp/assurerail-main.bundle` Git origin on server | Verified durable repository remote and explicit release revision | Closed by Claude on 26 September: origin corrected to `git@github.com:deepaknorman/assurerail.git`; he verified remote resolution and deployed/main alignment at `5a691050b`. |
| Recorded mini-demo / deterministic sandbox as readiness evidence | Live authenticated browser acceptance | Decommission their use as proof of working features immediately. They may remain separately labelled marketing/offline fallbacks. |

No code, host service, database or credential has been deleted in this initial planning slice. The AssurePool product, existing regression corpus, audit history and backups are not classified as superseded merely because Rail now has its own assessment flow.
