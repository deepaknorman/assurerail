export type PublicRoutePage = {
  slug: "direct-assignment" | "ptc";
  shortLabel: string;
  title: string;
  summary: string;
  whoDecides: string;
  authoritativeRecord: string;
  replayInputs: readonly string[];
  railCoordinates: readonly string[];
  unavailable: readonly string[];
};

export const PUBLIC_ROUTE_PAGES: readonly PublicRoutePage[] = [
  {
    slug: "direct-assignment",
    shortLabel: "Direct assignment",
    title: "A governed transaction case for conventional direct assignment",
    summary:
      "Bring the participating institutions and their transaction information into one coordinated process without requiring immediate system replacement.",
    whoDecides:
      "The transferee retains its credit, eligibility and purchase decision. Each institution remains accountable for the acts assigned to it.",
    authoritativeRecord:
      "The institutions continue to rely on the records applicable to their transaction. AssureRail does not become the ownership record merely because it coordinates the process.",
    replayInputs: [
      "One representative completed transaction",
      "The accountable business and operations owners",
      "An agreed, minimised information scope",
    ],
    railCoordinates: [
      "A shared view of progress and responsibility",
      "Transaction evidence and open exceptions",
      "A reproducible review output",
    ],
    unavailable: [
      "No live matching, funds movement or title transfer is currently offered",
      "Each lender retains its own credit and purchase decision",
    ],
  },
  {
    slug: "ptc",
    shortLabel: "PTC",
    title: "Trustee-controlled PTC orchestration with the legal record left intact",
    summary:
      "Coordinate the issuer, investors, trustee and appointed providers through one transaction view while preserving their respective roles.",
    whoDecides:
      "The trustee is the final transaction-control authority in the AssureRail workflow. Investors retain their investment decisions and appointed parties retain their regulated functions.",
    authoritativeRecord:
      "The transaction continues to rely on its applicable holding and ownership records. AssureRail is designed to surface rather than override a disagreement.",
    replayInputs: [
      "One representative completed transaction",
      "The trustee and accountable transaction owners",
      "An agreed, minimised information scope",
    ],
    railCoordinates: [
      "A shared view of progress and responsibility",
      "Transaction evidence and open exceptions",
      "A reproducible review output",
    ],
    unavailable: [
      "No public offer, placement, issuance or trading function is currently offered",
      "PTC decisions and appointed-provider roles remain with the appropriate institutions",
    ],
  },
] as const;

export type PersonaPage = {
  slug: "originators" | "transferees-investors" | "trustees";
  label: string;
  title: string;
  lead: string;
  retains: readonly string[];
  gains: readonly string[];
  firstProof: string;
};

export const PERSONA_PAGES: readonly PersonaPage[] = [
  {
    slug: "originators",
    label: "Originators and transferors",
    title: "Reuse the transaction evidence you already produce",
    lead:
      "Start with one completed transaction, identify every hand-off and return a reusable evidence map without replacing the LMS or source ledger.",
    retains: ["Asset selection and source records", "Commercial decision and counterparty choice", "Execution by its appointed and authorised teams"],
    gains: ["One versioned case and request register", "Explicit evidence gaps and completion breaks", "A portable dossier for the next proof stage"],
    firstProof: "A completed conventional DA and, separately, a completed conventional PTC with a named transaction-file owner.",
  },
  {
    slug: "transferees-investors",
    label: "Transferees and investors",
    title: "Keep the decision; improve the evidence around it",
    lead:
      "AssureRail is designed to present scoped, attributable evidence and exceptions while leaving credit and investment judgement with the institution making it.",
    retains: ["Credit or investment decision", "Risk policy, limits and approvals", "Reliance position and conditions"],
    gains: ["Controlled transaction access", "Clear evidence status", "Visibility of unresolved exceptions"],
    firstProof: "Review the reconstructed evidence pack from a transaction in which your institution already participated.",
  },
  {
    slug: "trustees",
    label: "Trustees and recordkeepers",
    title: "Make the transaction-control record easier to reproduce",
    lead:
      "The trustee keeps its authority and its existing recordkeeper relationships. AssureRail records the decision, the evidence relied upon and any unresolved discrepancy.",
    retains: ["Trustee acceptance and direction", "Appointment and reliance boundaries", "Existing recordkeeping relationships"],
    gains: ["Structured condition and evidence tracking", "Visible unresolved differences", "Exportable decision and lifecycle history"],
    firstProof: "Review one completed PTC with the trustee and other accountable transaction owners.",
  },
] as const;

export type ResourceArticle = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  reviewedAt: string;
  readingMinutes: number;
  sections: readonly {
    heading: string;
    paragraphs: readonly string[];
    bullets?: readonly string[];
    table?: { caption: string; columns: readonly string[]; rows: readonly (readonly string[])[] };
  }[];
  sources?: readonly { label: string; href: string }[];
};

export const RESOURCE_ARTICLES: readonly ResourceArticle[] = [
  {
    slug: "completed-deal-replay-before-platform-replacement",
    title: "Why begin with a completed-deal replay before changing systems?",
    description:
      "A practical explanation of the lowest-risk first proof for institutional DA and PTC infrastructure.",
    publishedAt: "2026-09-03",
    reviewedAt: "2026-09-07",
    readingMinutes: 5,
    sections: [
      {
        heading: "Replay separates evidence quality from execution risk",
        paragraphs: [
          "A completed transaction already has an outcome and an incumbent system of record. Reconstructing it lets the parties test evidence coverage, authority, sequence and reconciliation without moving money, changing title or asking an institution to abandon its operating process.",
          "The result is diagnostic. It must not be presented as a retroactive legal opinion, assurance conclusion or certification of the completed deal.",
        ],
      },
      {
        heading: "What a useful replay returns",
        paragraphs: ["A serious replay makes missing or contradictory evidence visible instead of manufacturing a clean story."],
        bullets: [
          "A source and authority map for every material transaction fact",
          "An expected-versus-observed timeline",
          "An evidence-gap and reconciliation-break register",
          "A versioned dossier and comparison workbook",
          "A bounded recommendation for shadowing the next transaction",
        ],
      },
      {
        heading: "What it cannot prove",
        paragraphs: [
          "Replay does not establish that a live service is available or that any regulated function may be performed. Any further evaluation is a separate decision.",
        ],
      },
    ],
  },
  {
    slug: "direct-assignment-and-ptc-need-different-control-maps",
    title: "Direct assignment and PTC need different control maps",
    description:
      "The common transaction spine is useful, but route-specific authority and evidence cannot be collapsed into one renamed workflow.",
    publishedAt: "2026-09-03",
    reviewedAt: "2026-09-07",
    readingMinutes: 6,
    sections: [
      {
        heading: "The common spine",
        paragraphs: [
          "Both routes need attributable institutions and people, versioned evidence, conditions, decisions, documents, completion observations, reconciliation and lifecycle records. These are shared infrastructure responsibilities.",
        ],
      },
      {
        heading: "The DA route",
        paragraphs: [
          "A conventional direct assignment is a bilateral loan-transfer route. The transferee owns its decision and the approved route pack defines the documents, notices, consideration and source-record acknowledgements required for completion.",
        ],
      },
      {
        heading: "The PTC route",
        paragraphs: [
          "A PTC transaction brings additional parties, responsibilities and records. It should not be treated as a renamed bilateral transfer workflow.",
        ],
      },
      {
        heading: "Why the distinction matters",
        paragraphs: [
          "A common platform can share a transaction foundation while keeping the responsibilities and records of each route clear.",
        ],
      },
    ],
  },
  {
    slug: "authoritative-records-reconciliation-and-digital-representations",
    title: "Authoritative records, reconciliation and digital representations",
    description:
      "Why an internal status—or a token—must not silently become a second ownership truth.",
    publishedAt: "2026-09-03",
    reviewedAt: "2026-09-07",
    readingMinutes: 6,
    sections: [
      {
        heading: "Coordination is not legal finality",
        paragraphs: [
          "A transaction platform can record instructions, acknowledgements and decisions. That does not automatically make its database the legally operative record. The route must identify the accountable recordkeeper and the evidence that makes an external result final.",
        ],
      },
      {
        heading: "Four states that should remain visible",
        paragraphs: ["Operational dashboards should distinguish each stage rather than compressing them into a green completion badge."],
        bullets: [
          "Expected — the route requires the fact or acknowledgement",
          "Received — a carrier delivered something claiming to be that fact",
          "Verified — identity, scope, integrity, currency and qualification checks succeeded",
          "Reconciled — the verified observation agrees with the declared authoritative record",
        ],
      },
      {
        heading: "Tokenisation adds a representation; it does not remove the problem",
        paragraphs: [
          "Until an approved route expressly provides otherwise, a token should be treated as a mirror. Supply, holders, economic interests and the legal record need one-to-one reconciliation, with movement blocked when they disagree.",
        ],
      },
    ],
  },
  {
    slug: "signed-evidence-packages-still-require-institutional-review",
    title: "A signed evidence package still requires institutional review",
    description:
      "Digital signatures prove origin and integrity; they do not turn a provider result into a transaction decision.",
    publishedAt: "2026-09-07",
    reviewedAt: "2026-09-07",
    readingMinutes: 5,
    sections: [
      {
        heading: "What the signature can establish",
        paragraphs: [
          "A correctly verified digital signature can bind an identified provider, a precise payload and a signing key. Content hashes can also reveal whether a package, manifest or result changed after publication.",
          "Those controls are valuable because a reviewer can reproduce the integrity check without relying on an email attachment name or a platform status label.",
        ],
      },
      {
        heading: "What the signature cannot establish",
        paragraphs: [
          "A signature does not prove that the underlying source data was complete, that the provider was appointed for the relevant purpose, or that the result satisfies the receiving institution's policy. It does not make the provider the trustee, recordkeeper, counsel or decision-maker.",
        ],
        bullets: [
          "Provider identity and appointment remain separate questions",
          "Scope, as-of date, expiry and qualifications remain visible",
          "Internal consistency is checked again by the receiving system",
          "The accountable institution records its own review and decision",
        ],
      },
      {
        heading: "The practical control",
        paragraphs: [
          "AssureRail treats accepted provider material as evidence requiring review. An adverse, stale, incomplete or internally inconsistent result remains visible and cannot silently become a green transaction state.",
        ],
      },
    ],
  },
  {
    slug: "from-completed-deal-replay-to-a-controlled-shadow",
    title: "From completed-deal replay to a controlled shadow",
    description:
      "How institutions can test transaction infrastructure in stages without surrendering their incumbent process or authority.",
    publishedAt: "2026-09-07",
    reviewedAt: "2026-09-07",
    readingMinutes: 6,
    sections: [
      {
        heading: "Replay answers whether the record is reproducible",
        paragraphs: [
          "A completed-deal replay starts with a known historical outcome. The parties agree a minimised evidence scope, reconstruct the expected sequence and identify which facts can be verified, which depend on an accountable external record and which remain unavailable.",
        ],
      },
      {
        heading: "Shadow answers whether the process adds value in time",
        paragraphs: [
          "If replay is useful, a current transaction can be observed beside the incumbent process. The incumbent remains authoritative. The comparison should measure evidence coverage, exception discovery, response time, duplicated work and reconciliation—not manufacture a favourable demonstration result.",
        ],
      },
      {
        heading: "A live pilot is a separate gate",
        paragraphs: [
          "A successful shadow does not itself authorise transaction execution. Any controlled-live step needs an agreed function map, named performers, legal and security acceptance, operating procedures, external-system readiness and a safe-pause plan.",
        ],
        bullets: [
          "Name the transaction, data and decision owners",
          "Keep money, title and authoritative records with approved parties",
          "Define the evidence that closes each leg",
          "Record open gates instead of replacing them with synthetic evidence",
        ],
      },
    ],
  },
  {
    slug: "five-ev-loan-books-one-buyer-transaction",
    title: "Five EV loan books, one ₹55 crore buyer transaction: the numbers and the work",
    description:
      "A worked illustration of how five NBFCs with ₹10–12 crore EV books can prepare one buyer-sized cohort, allocate costs and preserve seller-level records.",
    publishedAt: "2026-09-16",
    reviewedAt: "2026-09-16",
    readingMinutes: 14,
    sections: [
      {
        heading: "Start with the structure, not the headline pool size",
        paragraphs: [
          "This example uses five NBFCs, each offering ₹11 crore of performing EV receivables at the same cutoff date. Together they present a ₹55 crore economic cohort to one buyer. The working assumption is 825 admitted loans per seller, or 4,125 loans in total, based on an average outstanding balance of about ₹1.33 lakh.",
          "The loans do not lose their seller-level identity. Each account keeps its originator, source record, repayment history, security evidence and transfer chain. A buyer may acquire the five seller pools through coordinated assignments. If the parties instead issue securitisation notes, the SPE, trustee, tranching, retention and other applicable requirements must be separately designed and approved. Under the RBI definition, securitisation involves at least two tranches with different credit risk, so ‘single tranche’ should not be used as a legal description without counsel confirming the structure.",
        ],
        table: {
          caption: "Illustrative cohort at the midpoint of the ₹10–12 crore range",
          columns: ["Item", "Per NBFC", "Five-NBFC cohort"],
          rows: [
            ["Offered principal / assumed settled consideration", "₹11.00cr", "₹55.00cr"],
            ["Admitted loans", "825", "4,125"],
            ["Average outstanding per loan", "≈₹1.33L", "≈₹1.33L"],
            ["Buyer", "One common buyer", "One coordinated transaction"],
          ],
        },
      },
      {
        heading: "The gated preparation process",
        paragraphs: [
          "Each seller first accepts its own scope and pays for an automated Initial Assessment. AssureRail ingests the loan tape and evidence, reconciles totals, identifies missing fields and documents, calculates portfolio measures, tests stated economics and returns an unsigned preliminary report. There is no consultant or qualified human sign-off in this stage. A seller may correct the source material and use up to three included automated reassessments within 30 days.",
          "A seller that proceeds then pays the remaining fixed fee for Portfolio Preparation. This is where qualified experts review the evidence, exceptions, legal and financial work within their accepted scope and sign off the prepared output. The five prepared seller packs are then mapped to one common cutoff, eligibility vocabulary, buyer data schema and transaction timetable. The buyer still performs its own diligence and makes its own credit and purchase decision.",
        ],
        bullets: [
          "Gate 1 — each seller uploads its loan tape, evidence index and portfolio history",
          "Gate 2 — automated assessment returns reconciliation, exceptions, concentration measures and indicative economics",
          "Gate 3 — the seller fixes gaps and reassesses before paying for expert preparation",
          "Gate 4 — qualified reviewers approve seller-specific prepared packs",
          "Gate 5 — AssureRail forms the common buyer view without hiding seller-level differences",
          "Gate 6 — buyer diligence, conditions, documents and settlement remain attributable to the responsible parties",
        ],
      },
      {
        heading: "What each NBFC pays before execution",
        paragraphs: [
          "The execution-committed route is ₹500 per admitted loan with an ₹8 lakh minimum for Initial Assessment plus Portfolio Preparation. The standalone route is ₹650 per loan with a ₹10.4 lakh minimum. In this example both routes are governed by their minimums because 825 multiplied by either per-loan rate is lower than the relevant minimum.",
          "The Initial Assessment invoice is 30% of the standalone fixed-stage quote. It is credited once against either route. Each seller therefore pays ₹3.12 lakh before automated processing, then ₹4.88 lakh before Portfolio Preparation if it commits execution to AssureRail. A seller choosing standalone preparation pays ₹7.28 lakh at that point instead.",
        ],
        table: {
          caption: "Fixed-stage invoices, before applicable tax",
          columns: ["Payment", "Per NBFC", "Five NBFCs"],
          rows: [
            ["Initial Assessment: 30% × ₹10.4L", "₹3.12L", "₹15.60L"],
            ["Committed Portfolio Preparation balance", "₹4.88L", "₹24.40L"],
            ["Committed fixed-stage total", "₹8.00L", "₹40.00L"],
            ["Standalone Portfolio Preparation balance", "₹7.28L", "₹36.40L"],
            ["Standalone fixed-stage total", "₹10.40L", "₹52.00L"],
          ],
        },
      },
      {
        heading: "One cohort fee, allocated back to each seller",
        paragraphs: [
          "Under one accepted cohort execution mandate, the marginal success-fee schedule is applied once to the cohort’s actual purchase consideration successfully settled: 50 basis points on the first ₹10 crore, 40 basis points on the next ₹40 crore, 35 basis points on the next ₹50 crore and 30 basis points above ₹100 crore, subject to a proposed ₹5 lakh minimum. The resulting fee is allocated to each seller by its share of settled consideration. Separate mandates or closings are quoted separately and do not automatically receive cohort pricing.",
          "At ₹55 crore settled, the calculation is ₹5 lakh on the first ₹10 crore, ₹16 lakh on the next ₹40 crore and ₹1.75 lakh on the final ₹5 crore. The ₹22.75 lakh cohort execution fee is ₹4.55 lakh per seller when all five settle ₹11 crore. Together with the committed fixed stages, core AssureRail fees are ₹62.75 lakh, or about 1.14% of the illustration, before tax and external charges.",
        ],
        table: {
          caption: "Core fees at ₹55 crore settled under one cohort mandate",
          columns: ["Fee component", "Per NBFC", "Five NBFCs"],
          rows: [
            ["Committed fixed stages", "₹8.00L", "₹40.00L"],
            ["Execution: first ₹10cr × 50bps", "₹1.00L allocated", "₹5.00L"],
            ["Execution: next ₹40cr × 40bps", "₹3.20L allocated", "₹16.00L"],
            ["Execution: final ₹5cr × 35bps", "₹0.35L allocated", "₹1.75L"],
            ["Total core AssureRail fee", "₹12.55L", "₹62.75L"],
            ["Core fee as share of consideration", "≈1.14%", "≈1.14%"],
          ],
        },
      },
      {
        heading: "The ₹50–60 crore range",
        paragraphs: [
          "If all five sellers settle at the same amount, the committed fixed-stage total remains ₹40 lakh in this loan-count illustration. The execution fee changes with actual consideration. Purchase price, excluded accounts and a partial close can therefore change the final invoice.",
        ],
        table: {
          caption: "Sensitivity before tax, external costs and optional services",
          columns: ["Settled per NBFC", "Cohort settled", "Execution fee total", "Core fees including ₹40L fixed"],
          rows: [
            ["₹10cr", "₹50cr", "₹21.00L", "₹61.00L"],
            ["₹11cr", "₹55cr", "₹22.75L", "₹62.75L"],
            ["₹12cr", "₹60cr", "₹24.50L", "₹64.50L"],
          ],
        },
      },
      {
        heading: "Shared costs need a disclosed allocation rule",
        paragraphs: [
          "Seller-specific work stays with that seller. A common trustee, counsel, escrow provider, rating process, verification exercise or buyer interface may create a shared bill. Before anyone commits spend, the engagement schedule should state whether that bill is divided equally, by admitted principal, by settled consideration or by measured use. At equal ₹11 crore contributions, each seller would bear 20% of a genuinely common expense. If one seller closes at a different amount, pro-rata settled consideration is usually easier to defend than an equal split.",
          "AssureRail charges ₹50,000 for each accepted point-to-point secure file connection covering setup, testing and validation. Reusing one validated buyer interface is not five new setup charges. APIs, recurring connector operations and third-party provider fees need separate accepted scopes. No supplier expense should be hidden inside the success-fee calculation.",
        ],
      },
      {
        heading: "A practical external-cost budget",
        paragraphs: [
          "For this 4,125-loan illustration, the standard external allowance is ₹20.40 lakh before GST, or about ₹4.08 lakh per seller and 0.37% of ₹55 crore. This includes transaction counsel, administration, contingency, conditional registry work other than the separately modelled RTO, ROC and NeSL items, and conditional assignment duty. It is a constructed procurement budget, not an industry tariff or supplier quote.",
          "Assignment duty and registry treatment depend on the actual documents, security interests and relevant states. The table uses ₹1 lakh of conditional duty per seller and ₹2.48 lakh of conditional registry charges across the cohort. Counsel and the buyer must confirm whether those assumptions apply before a quote becomes binding.",
          "Portfolio Preparation already includes qualified expert review. An external CA factual-verification engagement and EV field programme should be added only when the buyer requires independent reliance or work outside that scope. In the model those conditional services add ₹15.62 lakh, taking external costs to ₹36.02 lakh, or 0.65%. Escrow-provider, bank, bureau, RTO, ROC, NeSL and extra buyer-counsel charges remain unpriced until quoted.",
        ],
        table: {
          caption: "Standard external-cost allowance for the five-seller cohort, before GST",
          columns: ["External item", "Cohort allowance", "Share of ₹55cr"],
          rows: [
            ["Transaction counsel: common documents and five seller schedules", "₹10.50L", "0.19%"],
            ["Execution, travel and administration", "₹1.25L", "0.02%"],
            ["Professional-cost contingency", "₹1.18L", "0.02%"],
            ["Conditional registry searches and modifications", "₹2.48L", "0.05%"],
            ["Conditional assignment duty", "₹5.00L", "0.09%"],
            ["Standard external allowance", "₹20.40L", "0.37%"],
            ["Conditional independent CA, EV checks and related contingency", "+₹15.62L", "+0.28%"],
            ["Expanded external allowance if required", "₹36.02L", "0.65%"],
          ],
        },
      },
      {
        heading: "Deriving the remaining quote-dependent items",
        paragraphs: [
          "The previously unpriced items can be converted into a controlled reserve rather than left blank. The working base is ₹10.21 lakh before GST and before any RTO re-endorsement. It is additive to the ₹20.40 lakh standard external allowance, taking working external costs to ₹30.61 lakh, or 0.56% of ₹55 crore. Every row remains conditional: procure a quote, confirm who bears it and release unused reserves at closing. Fresh bureau pulls also require a permitted purpose and the necessary borrower authority; reuse recent reports when the buyer accepts them.",
          "RTO treatment is the largest binary item. A coordinated assignment may preserve the originator as servicer and security-holder of record for the buyer, in which case no per-vehicle RTO action is assumed. If counsel requires one ₹100 action for every admitted vehicle, add about ₹4.13 lakh; cancellation plus a fresh endorsement at two ₹100 actions adds about ₹8.25 lakh, before state, smart-card and service charges.",
        ],
        table: {
          caption: "Quote-dependent external items for 4,125 EV loans, before GST",
          columns: ["Item", "Derivation", "Working base", "Planning range"],
          rows: [
            ["Escrow bank, orchestration and VAN", "Public bank anchors span 0.10% with a ₹0.20L cap to 0.10% of ₹55cr; negotiate one fixed cohort scope", "₹3.00L", "₹0.20–5.50L"],
            ["Fresh bureau portfolio pulls", "4,125 × ₹40 planning rate; obtain institutional quote", "₹1.65L", "₹1.03–2.48L"],
            ["RTO hypothecation actions", "₹100 × vehicles × required actions", "₹0", "₹0–8.25L"],
            ["ROC charge filing and professional support", "5 × ₹600 government fee plus ₹10,000 filing support in base", "₹0.53L", "₹0.28–1.28L"],
            ["NeSL individual debt records", "4,125 × ₹25 if fresh submission is required", "₹1.03L", "₹0–1.03L"],
            ["Additional buyer counsel passed to sellers", "32-hour base; 20–50 hours × ₹12,500 blended planning rate", "₹4.00L", "₹2.50–6.25L"],
            ["Working reserve, excluding RTO", "Sum of working-base rows", "₹10.21L", "₹4.01–16.54L"],
          ],
        },
      },
      {
        heading: "What that makes the total transaction cost",
        paragraphs: [
          "Core AssureRail fees of ₹62.75 lakh plus ₹30.61 lakh of working external costs produce ₹93.36 lakh before GST, or about 1.70% of the ₹55 crore settled consideration. At equal participation, that is about ₹18.67 lakh per seller: ₹12.55 lakh of core AssureRail fees and ₹6.12 lakh of external costs. One RTO action per vehicle would increase the pre-GST total to about ₹97.49 lakh, or 1.77%.",
          "For working-base cash planning, applying 18% GST to the modelled taxable services produces an illustrative gross outlay of about ₹108.81 lakh, or 1.98%. The economic cost after input-tax credit depends on each NBFC’s tax position. If 50% of all that GST were eligible and claimed, the illustrative net cost would be about ₹101.09 lakh, or 1.84%. Tax advisers must confirm the actual treatment.",
        ],
        table: {
          caption: "Illustrative all-in cost of the core route",
          columns: ["Measure", "Cohort", "Per NBFC at equal shares", "Share of ₹55cr"],
          rows: [
            ["Core AssureRail fees", "₹62.75L", "₹12.55L", "1.14%"],
            ["Standard external allowance", "₹20.40L", "₹4.08L", "0.37%"],
            ["Quote-dependent working reserve", "₹10.21L", "₹2.04L", "0.19%"],
            ["Working total before GST", "₹93.36L", "₹18.67L", "1.70%"],
            ["Gross cash outlay with illustrative GST", "₹108.81L", "₹21.76L", "1.98%"],
            ["Illustrative net with 50% eligible GST credit", "₹101.09L", "₹20.22L", "1.84%"],
            ["Add if independent CA and EV work is required", "+₹15.62L", "+₹3.12L", "+0.28%"],
          ],
        },
      },
      {
        heading: "Net proceeds versus other funding routes",
        paragraphs: [
          "The clean comparison separates asset-sale proceeds from borrowing. The table assumes a ₹55 crore pool, ₹35.75 crore of existing debt to release (65% of principal), a par DA sale, the ₹93.36 lakh working pre-GST DA cost above, and the user-supplied 8–11% borrowing-cost range. It excludes credit losses, servicing income, tax on sale profit, cash timing and any premium paid by a buyer.",
          "DA produces the greatest day-one cash because the asset is sold. A loan or NCD leaves the receivables and their future spread with the NBFC, but also leaves a repayment obligation, capital usage and credit risk. For a PTC backed by loans whose original maturity exceeds 24 months, the illustration retains 10% MRR; actual tranches, credit enhancement and investor price control the cash result. Co-lending is shown separately because the current RBI framework requires an ex-ante arrangement and transfer of the partner share shortly after origination, so it is not a general retrofit for this seasoned book.",
        ],
        table: {
          caption: "Illustrative day-one liquidity comparison, ₹ crore",
          columns: ["Route", "Gross cash / funding", "Upfront cost or retention", "Net before debt release", "Cash after ₹35.75cr debt release", "Continuing economics"],
          rows: [
            ["DA at ₹100", "₹55.00", "₹0.93 cost", "₹54.07", "₹18.32", "Sold share has no funding liability; seller gives up future loan spread"],
            ["DA at ₹99", "₹54.45", "₹0.93 cost", "₹53.52", "₹17.77", "One price point reduces proceeds by about ₹55L before the small fee adjustment"],
            ["Other DA route at assumed all-in 1.5%", "₹55.00", "₹0.83 cost", "₹54.18", "₹18.43", "Only comparable if 1.5% includes every external and platform item"],
            ["PTC with 10% MRR", "₹49.50", "₹0.69 assumed transaction cost", "₹48.81", "₹13.06", "₹5.50cr retained exposure; waterfall, servicing and investor yield continue"],
            ["PTC plus 5% cash enhancement", "₹49.50", "₹0.69 cost + ₹2.75 cash support", "₹46.06", "₹10.31", "Credit enhancement remains at risk; avoid double-counting it if it forms part of MRR"],
            ["80% warehouse / term refinance", "₹44.00", "₹0.44 assumed 1% setup", "₹43.56", "₹7.81", "₹44cr debt remains; annual interest at 8–11% is ₹3.52–4.84cr at full utilisation"],
            ["Co-lending for new production", "Up to ₹49.50 partner share at 90:10", "Ongoing escrow, servicing and integration", "Not a sale of this pool", "Not comparable", "Both lenders retain at least 10% of each new loan and share revenue and risk"],
          ],
        },
      },
      {
        heading: "Optional services change the comparison",
        paragraphs: [
          "A seller that already has its buyer need not purchase buyer arrangement. Managed transaction and escrow coordination is proposed at ₹1 lakh per seller programme. Buyer arrangement, only when selected and actually provided, is 5 basis points of attributable settled consideration with a ₹1.25 lakh minimum and ₹10 lakh cap. Monitoring activation and ongoing monitoring are separate because they continue after closing.",
          "At the ₹55 crore midpoint, core fees are ₹62.75 lakh. Adding managed coordination for all five sellers adds ₹5 lakh. Adding one new shared buyer file connection adds ₹0.5 lakh. If AssureRail also arranged the buyer for every seller, the ₹1.25 lakh per-seller minimum would add ₹6.25 lakh. AssureRail fees would then be ₹74.5 lakh. With ₹30.61 lakh of working external costs, the total becomes ₹105.11 lakh before GST, or about 1.91% of consideration. It becomes ₹120.73 lakh, or 2.19%, if the independent CA and EV scopes are also required. These are selectable services, not a forced package.",
        ],
      },
      {
        heading: "What the sellers gain—and what must still be proven",
        paragraphs: [
          "The practical gain is access to a buyer-sized opportunity while preserving a clear account-by-account and seller-by-seller record. The cohort can share a buyer timetable, common data dictionary, diligence index, agreed interface and some third-party work. Earlier automated gap discovery also reduces the chance of paying for full expert preparation on an unusable book.",
          "The financial gain cannot be stated from pool size alone. Each seller’s net economic proceeds are its actual purchase consideration, less debt released, AssureRail fees, its allocated external costs, taxes and any other agreed deductions. Price below par can overwhelm fee savings: one percentage point on ₹55 crore is ₹55 lakh. The seller should compare that full proceeds bridge, retained risks, servicing duties and timing against keeping the loans or using another route.",
          "For scale only, 1.5% of ₹55 crore is ₹82.5 lakh. AssureRail’s ₹62.75 lakh core fee is ₹19.75 lakh lower. The ₹93.36 lakh working total including the additional quote reserve is ₹10.86 lakh above a genuinely all-inclusive 1.5% price. If the competing 1.5% excludes escrow, legal, duty, registry, bureau, buyer-counsel or technical costs, those must be added before comparing. This is an arithmetic comparator, not a claimed market benchmark or guaranteed saving.",
        ],
        bullets: [
          "A buyer large enough to consider a ₹50–60 crore opportunity",
          "Every admitted loan tested against the declared machine-readable rules, with document coverage reported separately",
          "Seller-specific remediation instead of one opaque pooled exception list",
          "Common buyer formatting and a controlled diligence room",
          "Transparent allocation of shared costs and settlement deductions",
          "No guarantee of eligibility, buyer approval, price, timing or closing",
        ],
      },
    ],
    sources: [
      { label: "RBI Securitisation of Standard Assets Directions, 2021", href: "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12165" },
      { label: "RBI Transfer of Loan Exposures Directions, 2021", href: "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12166" },
      { label: "CBIC GST rates for legal, accounting and professional services", href: "https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html" },
      { label: "CGST Act section 17(4): NBFC input-tax-credit option", href: "https://cbic-gst.gov.in/hindi/CGST-bill-e.html" },
      { label: "Bank of Baroda escrow-account charges", href: "https://bankofbaroda.bank.in/accounts/current-accounts/bob-escrow-current-account-scheme" },
      { label: "Federal Bank escrow charges", href: "https://federal.bank.in/escrow-current-account" },
      { label: "MCA CHG-1 filing instruction kit", href: "https://www.mca.gov.in/content/dam/mca/mca-forms-instruction-kit/Instruction%20Kit_CHG-1.pdf" },
      { label: "NeSL fee structure effective 1 August 2026", href: "https://www.nesl.co.in/wp-content/uploads/2026/08/Revised-IU-Fee-Structure-effective-1-Aug-2026.pdf" },
      { label: "MoRTH Central Motor Vehicles Rules fee table", href: "https://morth.gov.in/sites/default/files/CMVR-chapter3.pdf" },
      { label: "RBI Co-Lending Arrangements Directions, 2025", href: "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12888&Mode=0" },
    ],
  },
] as const;

export function findRoutePage(slug: string) {
  return PUBLIC_ROUTE_PAGES.find((route) => route.slug === slug);
}

export function findPersonaPage(slug: string) {
  return PERSONA_PAGES.find((persona) => persona.slug === slug);
}

export function findResourceArticle(slug: string) {
  return RESOURCE_ARTICLES.find((article) => article.slug === slug);
}
