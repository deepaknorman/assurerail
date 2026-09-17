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
    title: "Move a prepared loan portfolio into buyer diligence with fewer surprises",
    summary:
      "Assess every loan in scope, repair evidence gaps and progress through expert-reviewed preparation to a coordinated direct-assignment closing.",
    whoDecides:
      "The seller chooses whether to proceed and the buyer retains its credit, eligibility, pricing and purchase decision. Appointed parties approve the work assigned to them.",
    authoritativeRecord:
      "AssureRail keeps the case, evidence, questions and decisions traceable while the applicable lender, buyer, bank and recordkeeper records remain authoritative.",
    replayInputs: [
      "Declared corpus, unique loan–borrower units and linked parties",
      "Loan tape, performance history and supporting evidence",
      "Named seller owners, selected services and an accepted quote",
    ],
    railCoordinates: [
      "Evidence-linked findings, eligibility range and indicative deal economics",
      "Full-population loan, document and principal reconciliation",
      "Prioritised remediation, comparable reassessments and a clear next-step decision",
    ],
    unavailable: [
      "Assessment and preparation improve transaction readiness; they do not guarantee a buyer, purchase price or closing date.",
      "A buyer independently completes its diligence and decides whether, what and on which terms to purchase.",
      "Live execution, funds movement and legal transfer begin under separate mandates with the required appointed parties and closing documents.",
    ],
  },
  {
    slug: "ptc",
    shortLabel: "PTC",
    title: "Prepare for a controlled PTC programme",
    summary:
      "Start with a completed-deal replay to map the parties, evidence and controls needed for a future PTC workflow while AssureRail delivers direct assignment first.",
    whoDecides:
      "Investors retain their investment decisions, and the trustee and other appointed parties retain their contractual, fiduciary and regulated responsibilities.",
    authoritativeRecord:
      "The applicable trustee, depository, account and transaction records remain authoritative. AssureRail links the workflow to those records and makes unresolved differences visible.",
    replayInputs: [
      "One representative completed PTC transaction",
      "The trustee and accountable transaction owners",
      "An agreed, minimised evidence and data scope",
    ],
    railCoordinates: [
      "A route-specific map of parties, responsibilities and approvals",
      "A traceable view of transaction evidence and open exceptions",
      "A reproducible output and a practical readiness plan",
    ],
    unavailable: [
      "PTC production onboarding follows the Phase 1 direct-assignment programme and a separate institutional readiness decision.",
      "Any future offer, placement, issuance, holding or trading capability will require its own approved structure and appointed providers.",
      "The relevant institutions remain responsible for PTC approvals, investment decisions and appointed-provider functions.",
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
    title: "Prepare your loan book before buyer diligence begins",
    lead:
      "Declare the portfolio, upload the tape and evidence, and receive a practical assessment of readiness, gaps and indicative economics before committing to preparation or execution.",
    retains: ["Portfolio selection and source records", "Commercial decision and buyer choice", "Approval of every stage, mandate and closing instruction"],
    gains: ["Full-population loan, principal and document coverage measures", "Prioritised gaps, indicative economics and assigned remediation", "Comparable reassessments and a route into expert-reviewed preparation"],
    firstProof: "A paid Initial Assessment that turns one declared direct-assignment portfolio into evidence-linked findings, an eligibility range and an actionable repair plan.",
  },
  {
    slug: "transferees-investors",
    label: "Transferees and investors",
    title: "Receive portfolios prepared against your requirements",
    lead:
      "After an MSA, configure eligibility, evidence and delivery preferences in a private workspace, then review prepared portfolios through a consistent diligence path.",
    retains: ["Credit and purchase decisions", "Risk policy, exposure limits and approvals", "Reliance terms, conditions and final pricing"],
    gains: ["A structured, versioned buyer-requirement profile", "Case-scoped evidence status, exceptions and seller responses", "Controlled delivery, acknowledgement and decision records when activated"],
    firstProof: "Align one requirement profile and review a prepared seller case, or replay a completed transaction to test the fit before live use.",
  },
  {
    slug: "trustees",
    label: "Trustees and recordkeepers",
    title: "Make transaction evidence and decisions easier to reproduce",
    lead:
      "Use a controlled replay to connect transaction decisions to the evidence relied upon, preserve open discrepancies and test a future PTC operating model.",
    retains: ["Trustee acceptance and direction", "Appointment, reliance and control boundaries", "Existing recordkeeping relationships"],
    gains: ["Structured condition and evidence tracking", "Visible, attributable unresolved differences", "Exportable decision and lifecycle history"],
    firstProof: "Reconstruct one completed PTC with the trustee and accountable transaction owners, then agree what a controlled future workflow would need.",
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
    slug: "how-assurerail-reviews-a-loan-book",
    title: "How AssureRail reviews a loan book before buyer diligence",
    description:
      "The evidence ladder, full-population controls, remediation cycle and boundary between automated assessment and qualified review.",
    publishedAt: "2026-09-17",
    reviewedAt: "2026-09-17",
    readingMinutes: 7,
    sections: [
      {
        heading: "A portfolio needs more than an uploaded spreadsheet",
        paragraphs: [
          "The Initial Assessment brings the declared loan population, supporting documents and portfolio history into one versioned engagement. It checks whether every admitted loan can be traced to the expected evidence and whether the tape, documents and principal agree. An uploaded file is an input, not proof that the portfolio is complete or transferable.",
          "The assessment is automated and unsigned. It is designed to tell the seller what is present, what conflicts, what remains missing and what the stated economics may look like before qualified experts or a buyer spend time on the case.",
        ],
      },
      {
        heading: "Use the least complex extraction method that works",
        paragraphs: [
          "AssureRail first uses bounded native libraries for supported spreadsheet, delimited-text and digitally readable document content. AI-assisted extraction is used where native parsing is inadequate or a separate validation pass is required. Provider fallback is an availability control, not a way to turn an uncertain answer into an accepted fact.",
          "Each extracted field keeps an evidence state and source locator. Observed, inferred, absent, unreadable and contradictory values remain different. Inferred values may help direct remediation, but deterministic totals and eligibility checks use observed source values unless the accepted rule says otherwise.",
        ],
      },
      {
        heading: "Measure coverage across the admitted population",
        paragraphs: [
          "The review accounts for every admitted unique loan–borrower unit, not merely a sample. It reports matched and unmatched loan files, missing evidence families, unresolved principal, records found outside the tape and contradictions that need attention. A coverage percentage does not itself establish legal enforceability, eligibility or buyer acceptance.",
        ],
        bullets: [
          "Loan-tape and source-total reconciliation",
          "Required document-family inventory",
          "Loan-file matching and unresolved principal",
          "Repayment, arrears, security and authority evidence status",
          "Portfolio concentrations, exceptions and stated-economics scenarios",
        ],
      },
      {
        heading: "Repair the source and reassess",
        paragraphs: [
          "A material gap becomes a task with an owner, requested evidence and status. The seller can correct its source data or upload better evidence and run the assessment again. Pilot terms ordinarily allow three automated reassessments within 30 days; the accepted quote controls the engagement-specific allowance.",
          "The platform remains open if the seller pauses. Time-sensitive evidence, buyer requirements and third-party quotes must be refreshed before later reliance.",
        ],
      },
      {
        heading: "Qualified review begins in Portfolio Preparation",
        paragraphs: [
          "If the seller proceeds, Portfolio Preparation brings qualified legal, financial or technical reviewers into the scope for which they are appointed. They review the evidence, assumptions and exceptions, record qualifications and approve the prepared output. Automation organises the population and evidence; it does not impersonate professional judgement or sign an opinion.",
          "A buyer still performs its own diligence and decides whether to purchase, at what price and subject to which conditions. AssureRail's prepared output is intended to make that review more consistent and less wasteful, not to bind the buyer.",
        ],
      },
      {
        heading: "Execution is a separate mandate",
        paragraphs: [
          "Execution begins only after the relevant parties and providers are activated. Buyer questions, conditions, document versions, delivery acknowledgements and settlement instructions remain attributable to their owners. AssureRail may coordinate an appointed bank or provider, but it does not receive gross consideration or unilaterally deduct fees.",
          "The fixed preparation quote depends on the declared portfolio and selected work. The execution fee is seller-specific and tied to actual purchase consideration successfully settled. Buyer arrangement, file integration, escrow coordination, counsel, registry work, field checks and monitoring are selected and priced for the work actually required.",
        ],
      },
    ],
  },
  {
    slug: "five-ev-loan-books-one-buyer-transaction",
    title: "A ₹48 crore declared EV cohort: pricing an illustrative ₹30 crore transfer",
    description:
      "A worked illustration of how three or four NBFCs can prepare an analytical EV cohort, allocate AssureRail fees and preserve separate seller closings.",
    publishedAt: "2026-09-16",
    reviewedAt: "2026-09-17",
    readingMinutes: 10,
    sections: [
      {
        heading: "₹48 crore declared is the starting point, not the sale amount",
        paragraphs: [
          "Assume three or four NBFCs declare ₹48 crore of EV receivables at a common cutoff date. The cohort lets them use one preparation framework and approach a buyer with a meaningful analytical opportunity. It does not make ₹48 crore eligible, transferable or saleable.",
          "For this illustration, screening, evidence work and the proposed transaction design reduce the working transferable amount to about ₹30 crore. That number remains indicative until each seller's evidence is reviewed, the buyer completes diligence and the parties agree the final pool, price and closing conditions.",
        ],
        table: {
          caption: "Keep the transaction measures separate",
          columns: ["Measure", "Illustrative treatment", "What it means"],
          rows: [
            ["Declared principal", "₹48.00cr across 3–4 sellers", "The population offered for assessment"],
            ["Indicative eligible range", "Produced after rules and evidence checks", "Excludes loans that currently fail the accepted criteria"],
            ["Indicative transferable amount", "About ₹30.00cr in this scenario", "Eligible principal after the confirmed transaction design and retention"],
            ["Gross consideration", "Transferable principal × agreed price ÷ 100", "Cash payable before deductions; it is not automatically ₹30cr"],
            ["Indicative net cash", "Gross consideration less debt release, fees, tax and expenses", "The seller-specific treasury outcome"],
          ],
        },
      },
      {
        heading: "Explain why loans leave the proposed pool",
        paragraphs: [
          "The eligible range should show three exclusion buckets rather than one unexplained haircut. Time-cured loans fail a timing criterion today and may be tested again later. Remediable or evidence-conditional loans need corrected data, documents or deeper evidence before they can enter the high case. Structural or concentration-cap exclusions remain outside this proposed cohort unless the accepted rules change.",
          "The low eligible case removes all three buckets. The high eligible case may include remediable loans after the stated evidence condition is satisfied, while continuing to exclude time-cured and structural loans. The indicative transferable range then applies the confirmed transaction structure and retention to the eligible range. Net cash comes only after price, debt release, fees, tax and expenses are applied seller by seller.",
        ],
        bullets: [
          "Time-cured — potentially re-screened when the relevant timing condition is met",
          "Remediable or evidence-conditional — potentially restored after a stated data or evidence condition is resolved",
          "Structural or cap exclusion — outside the proposed cohort under the accepted product, buyer or concentration rules",
        ],
      },
      {
        heading: "Count the work correctly",
        paragraphs: [
          "Loan count alone does not price the fixed stages. One primary unit is each unique seller–loan–borrower or seller–loan–co-borrower combination. Every co-borrower creates another primary unit. A guarantor, security provider or other separately linked party creates a separate loan–linked-party unit. The seller remains part of the primary key, so a borrower appearing in two sellers' books is counted in each and flagged as a cross-seller concentration signal.",
          "The table uses the ₹48 crore declared population, co-borrowers on 40% of loans and separately linked parties on 25% of loans. These are planning assumptions, not facts about an incoming book; the quote uses the seller-declared and reconciled counts.",
        ],
        table: {
          caption: "Illustrative countable work at different average outstanding balances",
          columns: ["Average outstanding", "Loans", "Primary units", "Linked-party units"],
          rows: [
            ["₹1.5L", "3,200", "4,480", "800"],
            ["₹3L", "1,600", "2,240", "400"],
            ["₹5L", "960", "1,344", "240"],
            ["₹8L", "600", "840", "150"],
          ],
        },
      },
      {
        heading: "The three paid stages remain gated",
        paragraphs: [
          "Each seller accepts its own quote and pays the Initial Assessment amount before processing. The automated, unsigned assessment reconciles the admitted tape and evidence, returns evidence-linked gaps and indicative economics, and supports the same-scope reassessments included in the accepted quote. It has no qualified human content review or professional sign-off.",
          "A seller that proceeds pays the remaining accepted fixed-stage balance before Portfolio Preparation. Qualified legal, financial or technical professionals then review and approve only the sections for which they are appointed. Execution starts under a separate seller mandate, and its success fee is earned only on that seller's actual purchase consideration successfully settled.",
        ],
        bullets: [
          "Initial Assessment — automated, paid upfront and unsigned",
          "Portfolio Preparation — qualified expert review and sign-off within the accepted scope",
          "Execution — coordinated buyer diligence and closing under separate seller mandates",
        ],
      },
      {
        heading: "Core pricing reflects the countable population and the successful outcome",
        paragraphs: [
          "On the execution-committed route, the fixed stages are ₹500 per primary unit plus ₹250 per linked-party unit, subject to one ₹8 lakh minimum for the formed cohort. The standalone route uses ₹650 and ₹325 respectively with one ₹10.4 lakh cohort minimum. The Initial Assessment invoice is 30% of the complete standalone fixed-stage quote and is credited once to the route the seller selects; the accepted seller quote gives the actual staged amounts.",
          "For the execution illustration, assume the final seller-specific closings produce ₹30 crore of aggregate purchase consideration successfully settled. Every seller's settled share is below ₹25 crore, so 40 basis points produces ₹12 lakh in aggregate. The one ₹5 lakh cohort execution-floor backstop does not bind. A seller that does not close owes no execution success fee.",
        ],
        table: {
          caption: "Standard committed-route core fees before GST, selected services and pass-through costs",
          columns: ["Average outstanding", "Fixed stages", "Execution on ₹30cr settled", "Core total", "Share of ₹30cr"],
          rows: [
            ["₹1.5L", "₹24.40L", "₹12.00L", "₹36.40L", "1.21%"],
            ["₹3L", "₹12.20L", "₹12.00L", "₹24.20L", "0.81%"],
            ["₹5L", "₹8.00L cohort floor", "₹12.00L", "₹20.00L", "0.67%"],
            ["₹8L", "₹8.00L cohort floor", "₹12.00L", "₹20.00L", "0.67%"],
          ],
        },
      },
      {
        heading: "Allocate the cohort once, then freeze each seller's amount",
        paragraphs: [
          "AssureRail calculates the cohort minimum once before the sellers accept their separate orders. If the fixed-stage floor binds, it is allocated pro rata by each seller's declared primary-unit and linked-party charges. If the execution floor were to bind, it would be allocated by expected settled share. Unit charges govern whenever their aggregate is higher than the applicable floor.",
          "The seller amounts are frozen at cohort formation. A later withdrawal, scope reduction or failed closing by another member does not increase a signed seller's allocation; AssureRail bears that cohort under-fill risk. Any approved design-partner discount is applied to that seller's allocation only after allocation and is not redistributed to the other sellers.",
        ],
      },
      {
        heading: "One analytical cohort still means separate seller closings",
        paragraphs: [
          "The cohort is an analytical, preparation and buyer-presentation structure. It does not commingle ownership. Each NBFC retains its seller identity, source records, representations, mandate, invoice, assignment documents, settlement instruction and closing record.",
          "The parties may reuse a common data dictionary, eligibility vocabulary, evidence index, buyer format and timetable. The buyer and counsel determine whether the three or four seller closings run sequentially, conditionally or concurrently. A common presentation must never hide seller-level exceptions or create a cross-seller closing promise.",
        ],
      },
      {
        heading: "Additional services and external charges stay visible",
        paragraphs: [
          "The ₹20.0–36.4 lakh range covers standard committed-route fixed stages and the illustrated execution success fee only. It excludes GST, additional AssureRail services and third-party or statutory amounts. The accepted quote should show any arrangement, secure file connection, escrow coordination, buyer counsel, registry action, field work or monitoring separately and only when the case requires it.",
          "A shared supplier scope should use a disclosed allocation basis, while seller-specific work stays with the seller that creates it. This keeps the economics comparable and prevents an unpriced external assumption from being presented as part of the core fee.",
        ],
      },
      {
        heading: "Take a credible case to the right buyer classes",
        paragraphs: [
          "An approximately ₹30 crore transferable opportunity may be relevant to small finance banks, old private-sector banks, appropriate public-sector-bank desks and larger NBFC acquirers. These are buyer classes to validate against the asset, policy, timing and actual transferable size; they are not commitments, rankings or statements that any institution will buy.",
          "Large private-bank outreach is most credible after demonstrated execution or evidenced interest in the specific opportunity. No institution should be named in seller material without permission and current, opportunity-specific evidence of interest.",
        ],
      },
      {
        heading: "What the CFO should compare",
        paragraphs: [
          "The seller should compare its own gross consideration, debt release, AssureRail fees, external charges, tax, retained exposure, servicing obligations and net cash. The final price matters: a one-point price change on ₹30 crore changes gross consideration by ₹30 lakh, which can outweigh small differences in workflow cost.",
          "The operating gain is also material even when it cannot be expressed as a guaranteed saving. The sellers receive population-wide rule testing, seller-specific remediation, common buyer formatting, a traceable evidence and question record, and a governed route from automated assessment to expert preparation. The buyer still completes its diligence and decides whether, what and on which terms to purchase.",
        ],
        bullets: [
          "Declared principal is not the eligible range",
          "The eligible range is not the transferable amount",
          "Transferable principal is not gross consideration unless the agreed price is ₹100 per ₹100",
          "Gross consideration is not net cash until seller-specific deductions are applied",
          "The illustration is not a quote, buyer commitment or guaranteed saving",
        ],
      },
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
