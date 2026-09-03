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
      "Reconstruct the tape, parties, diligence, approvals, documents, consideration, notices and source-record acknowledgements without replacing the transferor or transferee systems.",
    whoDecides:
      "The transferee retains its credit, eligibility and purchase decision. Each institution remains accountable for the acts assigned to it.",
    authoritativeRecord:
      "The approved route pack identifies the operative source/register acknowledgements for the transaction. AssureRail is not legal title merely because it records the workflow.",
    replayInputs: [
      "Final tape or pool version and source references",
      "Diligence requests, exceptions, decisions and conditions",
      "Executed assignment and transaction documents",
      "Consideration, notice and source-book acknowledgements",
      "Completion decision, known breaks and lifecycle hand-off",
    ],
    railCoordinates: [
      "Named parties, memberships, mandates and action authority",
      "Immutable evidence versions, access receipts and decisions",
      "Expected-versus-observed completion and reconciliation",
      "Case timeline, exception register and exportable dossier",
    ],
    unavailable: [
      "No live matching, funds movement or title transfer is offered",
      "No lender credit decision is made or outsourced by AssureRail",
      "No controlled-live route exists before counsel, security and operating gates close",
    ],
  },
  {
    slug: "ptc",
    shortLabel: "PTC",
    title: "Trustee-controlled PTC orchestration with the legal record left intact",
    summary:
      "Bring programme and trust evidence, pool transfer, rating, assurance, subscription, allotment, recordkeeper acknowledgements and lifecycle setup into one governed case.",
    whoDecides:
      "The trustee is the final transaction-control authority in the AssureRail workflow. Investors retain their investment decisions and appointed parties retain their regulated functions.",
    authoritativeRecord:
      "The route-defined depository, RTA or register remains legally operative where applicable. Trustee acceptance cannot conceal a disagreement with that record.",
    replayInputs: [
      "Programme, trust and appointment documents",
      "Pool transfer, eligibility and retained-interest evidence",
      "Tranche terms, rating, assurance and subscription records",
      "Consideration, allotment and RTA/depository acknowledgements",
      "Waterfall, surveillance and lifecycle setup",
    ],
    railCoordinates: [
      "Trustee decision, reliance and referenced external acknowledgements",
      "Function-by-function performer and authority assignments",
      "Document, tranche and allotment version reconciliation",
      "Lifecycle obligations, notices, breaks and evidence export",
    ],
    unavailable: [
      "No public offer, placement, issuance or trading function is claimed",
      "No compulsory AssureLocker, AssurePlane or named trustee dependency",
      "Tokenised PTC remains a separately gated representation and is not inferred from conventional PTC",
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
    gains: ["Named and expiring diligence access", "Evidence source, as-of date and qualification", "Reconciliation and unresolved-break visibility"],
    firstProof: "Review the reconstructed evidence pack from a transaction in which your institution already participated.",
  },
  {
    slug: "trustees",
    label: "Trustees and recordkeepers",
    title: "Make the transaction-control record easier to reproduce",
    lead:
      "The trustee keeps its authority and its existing recordkeeper relationships. AssureRail records the decision, the evidence relied upon and any unresolved discrepancy.",
    retains: ["Trustee acceptance and direction", "Appointment and reliance boundaries", "RTA, depository and register operating relationships"],
    gains: ["Structured condition and evidence tracking", "A visible trustee-versus-recordkeeper reconciliation", "Exportable decision and lifecycle history"],
    firstProof: "Authorise one all-leg historic PTC replay and identify the RTA/depository/register evidence relied upon at completion.",
  },
] as const;

export type ResourceArticle = {
  slug: string;
  title: string;
  description: string;
  reviewedAt: string;
  readingMinutes: number;
  sections: readonly { heading: string; paragraphs: readonly string[]; bullets?: readonly string[] }[];
};

export const RESOURCE_ARTICLES: readonly ResourceArticle[] = [
  {
    slug: "completed-deal-replay-before-platform-replacement",
    title: "Why begin with a completed-deal replay before changing systems?",
    description:
      "A practical explanation of the lowest-risk first proof for institutional DA and PTC infrastructure.",
    reviewedAt: "2026-09-03",
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
          "Replay does not establish customer acceptance under live pressure, connector finality, production security, recovery performance or permission to perform a regulated function. Those remain separate shadow, pilot and activation gates.",
        ],
      },
    ],
  },
  {
    slug: "direct-assignment-and-ptc-need-different-control-maps",
    title: "Direct assignment and PTC need different control maps",
    description:
      "The common transaction spine is useful, but route-specific authority and evidence cannot be collapsed into one renamed workflow.",
    reviewedAt: "2026-09-03",
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
          "A PTC transaction introduces trust or programme evidence, trustee control, classes or tranches, rating and assurance relationships, subscription and allotment, and a route-defined RTA, depository or register. A field called PTC is not the same thing as implementing these controls.",
        ],
      },
      {
        heading: "Why the distinction matters",
        paragraphs: [
          "A generic platform should share neutral primitives while making route-specific rules, performers and authoritative records explicit. Unknown or unsupported facts should remain open, not inherit a passing result from the other route.",
        ],
      },
    ],
  },
  {
    slug: "authoritative-records-reconciliation-and-digital-representations",
    title: "Authoritative records, reconciliation and digital representations",
    description:
      "Why an internal status—or a token—must not silently become a second ownership truth.",
    reviewedAt: "2026-09-03",
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
