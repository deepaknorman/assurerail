# AssureRail AR-DEMO-01 — Mumbai short-notice demonstration

**Status:** implementation and rehearsal handoff, 7 September 2026

**Audience:** founder/presenter, deployer, product owner and demonstration operator

**Scope:** the entire AssureRail product story; not only AssureLens

**Deployment authority:** none in this document. Deploy and enable only when separately instructed.

## 1. What “demo ready” means

AR-DEMO-01 supplies two deliberately separate demonstration layers:

1. **Private full-system showcase:** a deterministic, password-protected synthetic experience at
   `/sandbox`. It covers institution admission and authority, provider-neutral intake, diligence
   rooms, controlled primary opportunity handling, conventional DA, conventional PTC, lifecycle and
   optional AssureLens monitoring, secondary transfer, token representations, enterprise controls
   and operational readiness. It performs no API write or external action and remains usable if
   every partner system is offline.
2. **Authenticated SHADOW workspace:** the actual Rail API and customer workspaces, enabled only by
   their existing dependency-checked flags and populated with separately governed records. The
   current useful live rehearsal is the signed AssureLens-to-Rail intake ladder. Other workspaces are
   shown only after their precise flag, data and authority prerequisites are rehearsed; there is no
   “turn everything on” shortcut.

These layers answer different questions. The showcase explains the whole product consistently. The
SHADOW workspace proves selected implemented controls against persistent records. Neither is a
historic replay, controlled-live transaction or production acceptance.

## 2. Mandatory claims boundary

The presenter must say this before opening the fixture:

> This is a synthetic, non-operative walkthrough of the system’s control behaviour. It contacts no
> external system and cannot move money, title, allotment, register entries or tokens. Customer,
> trustee, recordkeeper, counsel, security and production gates remain separate.

Never describe a synthetic item as customer evidence, a bank acceptance, a trustee decision, a
recordkeeper acknowledgement, a completed replay, a VAPT result or a live capability. `MATCHED`
means only that the invented expected and observed fixture values match. `NOT_ACTIVATED` is a
positive boundary state, not a missing demonstration feature.

## 3. Full-system demonstration story

| Stage | What the presenter proves | Deliberate tension |
|---|---|---|
| 1. Institutional foundation | A verified person is not automatically an admitted participant; membership and mandate are scoped | maker cannot approve their own authority |
| 2. Evidence intake | source, schema, version, digest, as-of time, coverage and qualifications travel together | 98.7% cycle coverage remains visible |
| 3. Diligence room | named, purpose-bound access; declarations, Q&A, exports and access receipts | expiring grants and open Q&A do not disappear |
| 4. Primary opportunity | named-audience terms and RFQ records can be controlled separately from execution | conflict acknowledgement blocks allocation |
| 5. Conventional DA | documents, consideration, notice and two source acknowledgements are independent saga legs | unknown payment finality and a missing book acknowledgement block completion |
| 6. Conventional PTC | trustee workflow control is distinct from the legally operative RTA/depository/register | qualified assurance and pending finality remain open |
| 7. Lifecycle and monitoring | monthly cycles, pool factor, triggers and provider-neutral monitoring remain scoped evidence | AssureLens reports a partial universe and cannot restrict the transaction |
| 8. Secondary transfer | holder, prior chain, restrictions and new register state must reconcile | expired consent cannot be overwritten or bypassed |
| 9. Token representation | token is a mirror unless an approved route determines otherwise | dispatch is disabled and external gates remain open |
| 10. Operations and readiness | audit, breaks, export, escalation and gate status end in a safe next action | software checks never become external approval |

Use the persona control throughout. The same record shows materially different information and
authority to the originator, bank/investor, trustee, RTA/recordkeeper and Rail operator. This is the
clearest demonstration of the institution/case/appointment boundary.

Suggested 25-minute flow:

- 2 minutes: problem, system boundary and synthetic disclaimer;
- 4 minutes: admission, authority, intake and evidence room;
- 3 minutes: controlled primary opportunity;
- 4 minutes: DA completion and refusal to overclaim;
- 4 minutes: PTC trustee/register separation;
- 3 minutes: lifecycle and AssureLens monitoring;
- 2 minutes: secondary and token-as-mirror;
- 2 minutes: operations/readiness and the next pilot rung; and
- 1 minute: download the synthetic dossier and invite a completed-deal replay.

For a shorter meeting, use **DA / PTC control lab** in the header and run one four-leg comparison.

## 4. Private showcase deployment profile

The private showcase requires both a build-time visibility flag and a server-side credential gate:

```dotenv
NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1=shadow
ASSURERAIL_DEMO_SHOWCASE_ENABLED=yes
ASSURERAIL_DEMO_SHOWCASE_USERNAME=<named-presenter-username>
ASSURERAIL_DEMO_SHOWCASE_PASSWORD=<Key-Vault-injected-random-password-at-least-16-characters>
```

If any server-side value is missing or weak, `/sandbox` returns `404`. With a valid configuration,
an unauthenticated request returns `401`; only the exact Basic credential returns the showcase. The
response is `no-store`, `noindex`, `nofollow` and `noarchive`. Do not reuse investor-diligence,
Firebase, administrator or provider credentials.

`NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1` is compiled into the web build, so the web must be rebuilt after
changing it. The password is server-only and must be injected by the environment/Key Vault at
runtime. Disable and rebuild after the meeting unless a named follow-up access window is approved.

The showcase does **not** require a change to `ASSURERAIL_OPERATING_MODE`, API product flags,
Firebase, Postgres, AssureLens, AssurePool, Plaza, HTS, payment or recordkeeper connectivity. Keep
the deployed API on its separately approved profile.

## 5. Current SHADOW system and real AssureLens handshake

The deployer reported on 7 September 2026 that the standalone repository is deployed in `SHADOW`,
the Rail API and web are healthy, and the four admission/intake/case/AssureLens connector flags are
at `shadow`. Treat that as deployer-supplied state and reconfirm it immediately before a meeting.

The authentic signed-package rehearsal is:

1. admit a synthetic demonstration institution using the ordinary maker/checker path;
2. register the AssureLens provider reference and connector profile;
3. have a different authorised reviewer approve the evidence profile;
4. create a Rail case and accept the relevant institution as a case party;
5. create or select a non-production AssureLens book and run an evaluation;
6. export its signed Ed25519 package from the producer;
7. submit that exact package through the Rail connector; and
8. verify the Rail receipt is `REVIEW_REQUIRED`, retains provider/source/as-of/qualification and
   creates no decision, transition, restriction or external instruction.

Use synthetic organisations and borrowers only. Do not improvise real PAN, GSTIN, CIN, LLPIN,
Udyam, LEI or DID values. Record the two users who act as maker and checker; never use one person to
simulate both approvals on the shared rehearsal environment.

This handshake proves the optional provider boundary and signature verification. It does not prove
the rest of the full-system story; the private showcase supplies that reliable narrative until each
real workspace receives approved scenario data.

## 6. Pre-meeting rehearsal

Run source verification from the standalone repository:

```bash
bash scripts/assurerail-demo-preflight.sh --source
```

With a built local server running, use the same non-production Basic credential to run the Chromium
and WebKit interaction gate at desktop and mobile widths:

```bash
ARAIL_DEMO_BASE_URL=http://127.0.0.1:3017 \
ARAIL_DEMO_USERNAME=<presenter> \
ARAIL_DEMO_PASSWORD=<dedicated-demo-password> \
npm run demo:browser
```

After the deployer has separately enabled the private showcase, export the four values below in the
operator shell without writing them to history or a committed file, then run:

```bash
bash scripts/assurerail-demo-preflight.sh --remote
```

Required runtime inputs are `ASSURERAIL_DEMO_WEB_URL`, `ASSURERAIL_DEMO_API_URL`,
`ASSURERAIL_DEMO_USERNAME` and `ASSURERAIL_DEMO_PASSWORD`. The remote check verifies API liveness
and readiness, login availability, unauthenticated denial, authenticated showcase access and the
visible synthetic markers. It does not log the credential.

Manual rehearsal checklist:

- [ ] presentation laptop uses power and a tested hotspot/Wi-Fi fallback;
- [ ] current Chrome and Safari/Edge render at 1440×900 and 390×844 without horizontal page scroll;
- [ ] keyboard focus reaches view, persona, stage and download controls in a sensible order;
- [ ] every persona can be selected and all ten stages render;
- [ ] DA and PTC control-lab reset works;
- [ ] downloaded JSON says `SYNTHETIC_NON_EVIDENCE`, `externalEffects: false` and
      `canSatisfyExternalGate: false`;
- [ ] unauthenticated `/sandbox` is denied;
- [ ] presenter credential is not visible in slides, notes, browser password export or terminal
      history;
- [ ] API `/healthz` and `/readyz` are green before showing any authenticated workspace; and
- [ ] one operator owns screen sharing while another records questions and follow-up evidence needs.

## 7. Network-independent fallback

Before travel, prepare a clean local clone at the exact reviewed commit, install from the lockfile,
build the web with the sandbox flag at `shadow`, and test `next start` locally with the three
server-side showcase values. The showcase has no client API calls and therefore remains functional
without the venue API or internet. Keep the local credential distinct from the remote credential.

Also retain a PDF/screenshot sequence of stages 1, 2, 5, 6, 7, 9 and 10. Static captures are a
last-resort presentation aid only; label them synthetic and record the reviewed commit. Do not copy
database dumps, private keys, Firebase configuration, provider credentials or customer evidence to
the presentation laptop.

## 8. What remains external

The following remain open until their accountable owner supplies real evidence:

- participant-authorised historic DA replay and comparison;
- trustee-authorised all-leg historic PTC replay with the route-defined register evidence;
- counsel-ratified route/function packs;
- Azure Hyderabad-primary/Pune-recovery rehearsal and restore evidence;
- authenticated two-tenant E2E/DAST and independent VAPT closure;
- connector/provider certification and ambiguity recovery;
- customer/trustee operating acceptance; and
- controlled-live and production activation records.

The next commercial step after a successful showcase is a completed-deal replay under NDA, not a
request to enable live execution.

## 9. Disable and retain

After the approved demonstration window:

1. set `ASSURERAIL_DEMO_SHOWCASE_ENABLED=no`;
2. set `NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1=off` and rebuild if the route should disappear entirely;
3. rotate or destroy the dedicated showcase password;
4. retain only the commit, preflight result, attendee list, questions and approved follow-up actions;
5. do not promote downloaded synthetic dossiers into a customer evidence store; and
6. leave the API operating mode and capability flags unchanged unless a separate activation change
   is approved.
