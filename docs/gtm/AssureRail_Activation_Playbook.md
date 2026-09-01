# AssureRail activation playbook — replay → shadow → partner-executed pilot

**Written 2 Sep 2026.** The question this answers: the venue is built to facilitate *bilateral*
DA/PTC (no ₹100 Cr MII bootstrap needed) — so how do we crank it up, who do we talk to, and how do
we position it? Consolidates the deck's slide-14 roadmap, the implementation register's PR ladder,
the Model-B design memo and GTM v1.6 into one actionable sequence.

## 0. What's already true (the assets you sell with)

- **PR-09 is built**: conventional-DA replay + external-action saga, `OBSERVE_ONLY` — no cash,
  title, register or notice ever dispatched. PR-10 (conventional PTC replay) has its first route
  pack committed, gated on your review.
- The **fences are the regulatory posture**: bilateral, invitation-only, no price/bid/yield
  discovery, settlement through the parties' banks, trustee keeps legal finality. This keeps
  AssureRail a technology facilitator under the RBI TLE frame — the service-provider side of the
  MII line — which is exactly why no venue net-worth bar applies.
- The **register's named precondition** (§"still required before PR-09/PR-10"): *name the
  historic DA and PTC replay data owners and obtain access.* That is a founder conversation, not
  code, and it is the single item gating the first external artefact.

## 1. The ladder — four rungs, each with its own ask and its own proof

| Rung | What runs | What the partner risks | What it produces | Permission needed |
|---|---|---|---|---|
| **1 · REPLAY** (now) | A *completed* historic DA (then PTC) re-run through the rail | A data pull under NDA. Nothing live. | The replay dossier: "here is your last transfer, evidence-graded — every gap, clock breach and unverifiable completion fact named" | None. Consent of the deal parties + NDA |
| **2 · SHADOW** (next) | A *live* deal runs in parallel on the rail; their process stays authoritative | Read-only feeds; a DPA | Divergence report: where the rail caught what e-mail diligence missed; cycle-time and evidence-coverage deltas | None (no execution). Expect a vendor security review — this is where VAPT bites for banks |
| **3 · PARTNER-EXECUTED PILOT** | One real transaction; every regulated act performed by its licensed actor (trustee, registrar, banks); AssureRail coordinates + records completion facts | Real deal, familiar actors, new coordination layer | The reference transaction — the thing the next ten conversations open with | Counsel-ratified route pack (the hard gate); each partner acts under its own licence |
| **4 · OWNED FUNCTIONS** | AssureRail performs a regulated function itself | — | — | Explicit permission per function; not before |

Never skip a rung: each one's output is the sales artefact for the next.

## 2. Who to talk to, in order, and the ask per person

1. **Counsel — dispatch Stage 1 this week (ACTIONS #12+17, already drafted and in ~/Downloads).**
   Pre-NDA letter + mutual NDA, then the factual memorandum. The route-pack ratification that
   gates rung 3 starts here; every external conversation below is stronger with "counsel is
   instructed" true. NDA-before-model rule applies everywhere on this list.
2. **The historic-deal data owner(s) — the register's named precondition.** You need one friendly
   CFO/treasury head at an NBFC that has *sold* DA pools (and ideally one PTC issuance) willing to
   hand over a completed deal's file under NDA. Natural candidates are the same institutions on
   the co-lending target list — UGRO and Poonawalla are already queued for the #20 soft-sound;
   that meeting can carry a second question: *"would you let us replay one completed DA you've
   already done — under NDA, nothing live — and give you back an evidence-graded dossier on it,
   free?"* A free replay dossier is the cheapest yes in this whole plan.
3. **One trustee — IDBI Trusteeship first** (Model-B memo's candidate; Catalyst / Axis Trustee /
   Beacon as alternates). Position: *"you keep legal finality on every PTC; we make the servicer
   reports, investor notices and completion facts you rely on evidence-grade — zero displacement
   of your role, your fees, or your registers."* The Prof. Thenmozhi introduction chain
   (→ IDBI / Indian Bank / HDFC at top levels, per the master roadmap) is the warm path.
4. **A transferor–transferee pair for the DA shadow.** Transferor: the NBFC from step 2.
   Transferee: a mid-sized private bank from the GTM v1.6 bank-led track — which is VAPT-gated,
   so this conversation *starts* after #6 lands, or starts now on the explicit basis that the
   shadow begins post-VAPT.
5. **Later, not now:** a rating agency's surveillance feed (completes the PTC shadow), the RBI
   CGM conversation as scheduled (its brief already fences tokenisation to Phase 2), and SEBI's
   bond-tokenisation pilot only when the tokenised adapter becomes live business — it is an
   adapter, not the entry ticket.

## 3. Positioning — one paragraph, used everywhere

*"Every DA and PTC in India closes over e-mail diligence and un-governed files; the platforms that
do exist are marketplaces that arrange your deal and take economics on it. AssureRail is neither.
It is the neutral, governed rail for the transfer you already decided to do: bilateral,
invitation-only, no price discovery, no funds, no custody — the trustee and your banks keep every
regulated act, and what you gain is an evidence-graded, replayable record of the whole transfer
that your audit, your counterparty and your regulator can all reproduce."*

Against Yubi Pool / arranger platforms: they are buyer-led marketplaces with arrangement
economics and the conflicts that come with them; we are Switzerland with receipts. Against the
status quo: the replay dossier makes that argument empirically on the partner's own deal — that's
why rung 1 exists.

## 4. The crank, concretely

**This week:** send the counsel Stage-1 pack (#12+17) · pick the two names for the replay-data
conversation and put the free-dossier ask on the UGRO/Poonawalla agenda (#20) · founder review of
PR-09 so PR-10 unblocks (register note: "PR-10 remains untouched pending founder review").

**This month:** NDA + one historic DA file in hand → first replay dossier produced · trustee
warm-up via the Thenmozhi chain · VAPT started (#6 — it gates the bank-side shadow and, notably,
rung 2 with any bank).

**The quarter:** DA shadow live with the NBFC pair · PTC replay done with trustee data · counsel
route-pack ratification under way → partner-executed pilot on one real transaction is the exit
criterion, and it is the moment AssureRail's second ₹2.5 Cr tranche prices.

That last line is the loop closed: the raise structure now *depends* on this ladder — the pilot
is not just GTM, it is the pricing event for Rail's next capital.
