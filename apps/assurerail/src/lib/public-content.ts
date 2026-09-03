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
