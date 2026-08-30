/**
 * AssureRail neutral contract taxonomy v1.
 *
 * These codes classify transaction records; they do not decide whether a route, asset or function
 * is legally permitted. Permission remains an effective-dated route-pack decision. Unknown and
 * missing values are rejected rather than coerced to an apparently safe or successful value.
 */

export const ASSURERAIL_TAXONOMY_VERSION = "1.0.0" as const;

export const TRANSACTION_ROUTES = ["DA", "PTC"] as const;
export type TransactionRoute = (typeof TRANSACTION_ROUTES)[number];

export const REPRESENTATIONS = ["CONVENTIONAL", "TOKENISED"] as const;
export type Representation = (typeof REPRESENTATIONS)[number];

/** `DEMO` is deliberately runtime-only and cannot be serialized as transaction evidence. */
export const OPERATING_MODES = ["REPLAY", "SHADOW", "SANDBOX", "CONTROLLED_LIVE", "PRODUCTION"] as const;
export type OperatingMode = (typeof OPERATING_MODES)[number];

export const LIFECYCLE_LEGS = ["INITIAL_TRANSFER_OR_ISSUE", "SECONDARY_TRANSFER_OR_TRADE"] as const;
export type LifecycleLeg = (typeof LIFECYCLE_LEGS)[number];

export const ASSET_CLASSES = [
  "CORPORATE_LOAN",
  "MSME_LOAN",
  "RESIDENTIAL_MORTGAGE",
  "COMMERCIAL_REAL_ESTATE_LOAN",
  "VEHICLE_LOAN",
  "GOLD_LOAN",
  "MICROFINANCE_LOAN",
  "CONSUMER_LOAN",
  "EDUCATION_LOAN",
  "CREDIT_CARD_RECEIVABLE",
  "TRADE_RECEIVABLE",
  "LEASE_RECEIVABLE",
  "OTHER_APPROVED_EXPOSURE",
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const EVIDENCE_RESULTS = [
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "UNVERIFIED",
  "FAILED",
  "EXPIRED",
  "NOT_APPLICABLE",
  "REVIEW_REQUIRED",
] as const;
export type EvidenceResult = (typeof EVIDENCE_RESULTS)[number];

export const RECONCILIATION_STATES = [
  "PENDING",
  "MATCHED",
  "BREAK_OPEN",
  "REPAIR_IN_PROGRESS",
  "RESOLVED",
] as const;
export type ReconciliationState = (typeof RECONCILIATION_STATES)[number];

export const FUNCTION_PERFORMERS = [
  "OWNED_AUTHORISED",
  "LICENSED_PARTNER",
  "PARTICIPANT_OWNED",
  "EXTERNAL_AUTHORITY",
  "PROHIBITED",
] as const;
export type FunctionPerformer = (typeof FUNCTION_PERFORMERS)[number];

export const MARKET_CONTEXTS = ["DOMESTIC", "IFSC", "OTHER_APPROVED"] as const;
export type MarketContext = (typeof MARKET_CONTEXTS)[number];

export const PLACEMENT_OR_LISTING_VALUES = [
  "BILATERAL",
  "PRIVATE_PLACEMENT",
  "LISTED",
  "OTHER_APPROVED",
] as const;
export type PlacementOrListing = (typeof PLACEMENT_OR_LISTING_VALUES)[number];

export const MATERIAL_FUNCTIONS = [
  "PARTICIPANT_ADMISSION",
  "ASSET_OR_INSTRUMENT_ADMISSION",
  "DISCLOSURES",
  "TERM_DISPLAY",
  "SOLICITATION",
  "RECOMMENDATION_OR_RANKING",
  "QUOTE_INVITATION",
  "NEGOTIATION",
  "MATCHING",
  "ALLOCATION",
  "EXECUTION",
  "ISSUANCE_OR_ALLOTMENT",
  "CLEARING",
  "CASH_SETTLEMENT",
  "AUTHORITATIVE_REGISTER_UPDATE",
  "CUSTODY",
  "SECONDARY_TRANSFER_OR_TRADING",
  "LIFECYCLE_CALCULATION",
  "SURVEILLANCE",
  "COMPLAINTS",
  "DEFAULT_HANDLING",
  "REGULATORY_REPORTING",
] as const;
export type MaterialFunction = (typeof MATERIAL_FUNCTIONS)[number];

export const SOURCE_AUTHORITY_CLASSES = [
  "AUTHORITATIVE",
  "EVIDENTIARY",
  "RECONCILED_MIRROR",
  "UNDECLARED",
] as const;
export type SourceAuthorityClass = (typeof SOURCE_AUTHORITY_CLASSES)[number];

export type TaxonomyOwner =
  | "LEGAL_AND_COMPLIANCE"
  | "OPERATIONS_AND_RISK"
  | "PRODUCT_AND_DOMAIN_GOVERNANCE"
  | "SECURITY_AND_PLATFORM";

export interface TaxonomyTerm<TCode extends string> {
  readonly code: TCode;
  readonly displayLabel: string;
  readonly definition: string;
  readonly owner: TaxonomyOwner;
  /** Empty means immutable classification; it never means that an arbitrary transition is allowed. */
  readonly allowedTransitions: readonly TCode[];
}

export interface VersionedTaxonomy<TCode extends string> {
  readonly taxonomyId: string;
  readonly version: typeof ASSURERAIL_TAXONOMY_VERSION;
  readonly terms: readonly TaxonomyTerm<TCode>[];
}

function term<TCode extends string>(
  code: TCode,
  displayLabel: string,
  definition: string,
  owner: TaxonomyOwner,
  allowedTransitions: readonly TCode[] = [],
): TaxonomyTerm<TCode> {
  return { code, displayLabel, definition, owner, allowedTransitions };
}

export const TRANSACTION_ROUTE_TAXONOMY: VersionedTaxonomy<TransactionRoute> = {
  taxonomyId: "assurerail.transaction-route",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: [
    term("DA", "Direct assignment", "Bilateral transfer of one or more loan exposures under an approved direct-assignment route pack.", "LEGAL_AND_COMPLIANCE"),
    term("PTC", "Pass-through certificate", "Securitisation route in which a trust or other approved SPE receives a pool and qualifying investors receive issued interests.", "LEGAL_AND_COMPLIANCE"),
  ],
};

export const REPRESENTATION_TAXONOMY: VersionedTaxonomy<Representation> = {
  taxonomyId: "assurerail.representation",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: [
    term("CONVENTIONAL", "Conventional", "A digitally orchestrated transaction whose operative ownership or holding record is not a token.", "LEGAL_AND_COMPLIANCE"),
    term("TOKENISED", "Tokenised", "A permissioned digital representation used only within an approved legal-record mapping; it is a mirror unless the route pack says otherwise.", "LEGAL_AND_COMPLIANCE"),
  ],
};

export const OPERATING_MODE_TAXONOMY: VersionedTaxonomy<OperatingMode> = {
  taxonomyId: "assurerail.operating-mode",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: [
    term("REPLAY", "Replay", "Deterministic processing of previously captured or synthetic inputs with no live mutating external action.", "SECURITY_AND_PLATFORM", ["SHADOW", "SANDBOX"]),
    term("SHADOW", "Shadow", "Authenticated and durable comparison processing that cannot create an operative external transaction effect.", "SECURITY_AND_PLATFORM", ["REPLAY", "SANDBOX", "CONTROLLED_LIVE"]),
    term("SANDBOX", "Sandbox", "Isolated integration testing against non-operative provider or market-infrastructure environments.", "SECURITY_AND_PLATFORM", ["REPLAY", "SHADOW", "CONTROLLED_LIVE"]),
    term("CONTROLLED_LIVE", "Controlled live", "Restricted live cohort with approved adapters, operating procedures, reconciliation and explicit participant scope.", "OPERATIONS_AND_RISK", ["SHADOW", "SANDBOX", "PRODUCTION"]),
    term("PRODUCTION", "Production", "Approved general live operation within the route, participant, function and jurisdiction permissions recorded for the case.", "OPERATIONS_AND_RISK", ["SHADOW", "CONTROLLED_LIVE"]),
  ],
};

export const LIFECYCLE_LEG_TAXONOMY: VersionedTaxonomy<LifecycleLeg> = {
  taxonomyId: "assurerail.lifecycle-leg",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: [
    term("INITIAL_TRANSFER_OR_ISSUE", "Initial transfer or issue", "The first DA transfer or the primary issue/allotment of a PTC instrument.", "LEGAL_AND_COMPLIANCE"),
    term("SECONDARY_TRANSFER_OR_TRADE", "Secondary transfer or trade", "A subsequent transfer or trade after the initial transfer or issue has completed.", "LEGAL_AND_COMPLIANCE"),
  ],
};

const ASSET_LABELS: Readonly<Record<AssetClass, string>> = {
  CORPORATE_LOAN: "Corporate loan",
  MSME_LOAN: "MSME loan",
  RESIDENTIAL_MORTGAGE: "Residential mortgage",
  COMMERCIAL_REAL_ESTATE_LOAN: "Commercial real-estate loan",
  VEHICLE_LOAN: "Vehicle loan",
  GOLD_LOAN: "Gold loan",
  MICROFINANCE_LOAN: "Microfinance loan",
  CONSUMER_LOAN: "Consumer loan",
  EDUCATION_LOAN: "Education loan",
  CREDIT_CARD_RECEIVABLE: "Credit-card receivable",
  TRADE_RECEIVABLE: "Trade receivable",
  LEASE_RECEIVABLE: "Lease receivable",
  OTHER_APPROVED_EXPOSURE: "Other approved exposure",
};

export const ASSET_CLASS_TAXONOMY: VersionedTaxonomy<AssetClass> = {
  taxonomyId: "assurerail.asset-class",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: ASSET_CLASSES.map((code) => term(
    code,
    ASSET_LABELS[code],
    code === "OTHER_APPROVED_EXPOSURE"
      ? "An exposure class explicitly introduced by a versioned, approved extension profile; never a fallback for an unknown value."
      : `Governed classification for ${ASSET_LABELS[code].toLowerCase()} exposures; classification alone does not establish route eligibility.`,
    "PRODUCT_AND_DOMAIN_GOVERNANCE",
  )),
};

export const EVIDENCE_RESULT_TAXONOMY: VersionedTaxonomy<EvidenceResult> = {
  taxonomyId: "assurerail.evidence-result",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: [
    term("VERIFIED", "Verified", "All checks declared in the evidence scope were completed successfully by the identified provider using the stated method.", "OPERATIONS_AND_RISK"),
    term("PARTIALLY_VERIFIED", "Partially verified", "Only the explicitly identified subset of the evidence scope was verified; qualifications are mandatory.", "OPERATIONS_AND_RISK"),
    term("UNVERIFIED", "Unverified", "Evidence was supplied or observed but the declared verification was not completed.", "OPERATIONS_AND_RISK"),
    term("FAILED", "Failed", "One or more declared evidence checks produced an adverse result.", "OPERATIONS_AND_RISK"),
    term("EXPIRED", "Expired", "The evidence is beyond its explicit validity time or applicable freshness policy.", "OPERATIONS_AND_RISK"),
    term("NOT_APPLICABLE", "Not applicable", "A governed rule determined that the evidence type is outside this exact scope; absence alone never produces this value.", "LEGAL_AND_COMPLIANCE"),
    term("REVIEW_REQUIRED", "Review required", "The result cannot be classified safely without an authorised review or an approved rule release.", "OPERATIONS_AND_RISK"),
  ],
};

export const RECONCILIATION_STATE_TAXONOMY: VersionedTaxonomy<ReconciliationState> = {
  taxonomyId: "assurerail.reconciliation-state",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: [
    term("PENDING", "Pending", "The expected and observed records have not yet been conclusively compared.", "OPERATIONS_AND_RISK", ["MATCHED", "BREAK_OPEN"]),
    term("MATCHED", "Matched", "The governed comparison completed with no unresolved difference.", "OPERATIONS_AND_RISK", ["BREAK_OPEN"]),
    term("BREAK_OPEN", "Break open", "A material difference or missing authoritative response is unresolved.", "OPERATIONS_AND_RISK", ["REPAIR_IN_PROGRESS", "RESOLVED"]),
    term("REPAIR_IN_PROGRESS", "Repair in progress", "An accountable owner is executing an approved repair while affected capabilities remain blocked as required.", "OPERATIONS_AND_RISK", ["BREAK_OPEN", "RESOLVED"]),
    term("RESOLVED", "Resolved", "An open break has independent closure evidence; history is retained and not rewritten to MATCHED.", "OPERATIONS_AND_RISK", ["BREAK_OPEN"]),
  ],
};

export const FUNCTION_PERFORMER_TAXONOMY: VersionedTaxonomy<FunctionPerformer> = {
  taxonomyId: "assurerail.function-performer",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: [
    term("OWNED_AUTHORISED", "Owned and authorised", "AssureRail is expressly permitted, contracted, staffed and accountable for the function.", "LEGAL_AND_COMPLIANCE"),
    term("LICENSED_PARTNER", "Licensed partner", "An identified licensed or recognised intermediary performs the act and supplies an attributable acknowledgement.", "LEGAL_AND_COMPLIANCE"),
    term("PARTICIPANT_OWNED", "Participant owned", "A transaction participant retains the decision or duty; AssureRail may support but cannot substitute its judgement.", "LEGAL_AND_COMPLIANCE"),
    term("EXTERNAL_AUTHORITY", "External authority", "An external register, trustee-designated recordkeeper, bank or statutory system creates or confirms the operative result.", "LEGAL_AND_COMPLIANCE"),
    term("PROHIBITED", "Prohibited", "The function is unavailable in this exact product and regulatory mode and must fail closed across UI and API.", "LEGAL_AND_COMPLIANCE"),
  ],
};

export const MARKET_CONTEXT_TAXONOMY: VersionedTaxonomy<MarketContext> = {
  taxonomyId: "assurerail.market-context",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: [
    term("DOMESTIC", "Domestic", "Domestic Indian establishment and transaction context.", "LEGAL_AND_COMPLIANCE"),
    term("IFSC", "IFSC", "An expressly approved international financial services centre context; never inferred from a party address.", "LEGAL_AND_COMPLIANCE"),
    term("OTHER_APPROVED", "Other approved", "A jurisdictional market context introduced by an approved, versioned extension profile.", "LEGAL_AND_COMPLIANCE"),
  ],
};

export const PLACEMENT_OR_LISTING_TAXONOMY: VersionedTaxonomy<PlacementOrListing> = {
  taxonomyId: "assurerail.placement-or-listing",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: [
    term("BILATERAL", "Bilateral", "A transaction between identified counterparties without a securities placement or listing classification.", "LEGAL_AND_COMPLIANCE"),
    term("PRIVATE_PLACEMENT", "Private placement", "An issuance or placement governed by the approved private-placement route pack.", "LEGAL_AND_COMPLIANCE"),
    term("LISTED", "Listed", "An instrument or transaction admitted to an approved listing route under its effective rule pack.", "LEGAL_AND_COMPLIANCE"),
    term("OTHER_APPROVED", "Other approved", "A placement or listing classification introduced by an approved, versioned extension profile.", "LEGAL_AND_COMPLIANCE"),
  ],
};

export const MATERIAL_FUNCTION_TAXONOMY: VersionedTaxonomy<MaterialFunction> = {
  taxonomyId: "assurerail.material-function",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: MATERIAL_FUNCTIONS.map((code) => term(
    code,
    code.toLowerCase().split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "),
    `Governed performer assignment for the ${code.toLowerCase().replaceAll("_", " ")} function.`,
    "LEGAL_AND_COMPLIANCE",
  )),
};

export const SOURCE_AUTHORITY_TAXONOMY: VersionedTaxonomy<SourceAuthorityClass> = {
  taxonomyId: "assurerail.source-authority",
  version: ASSURERAIL_TAXONOMY_VERSION,
  terms: [
    term("AUTHORITATIVE", "Authoritative", "The declared legal or operative source of truth for the scoped fact under the approved route pack.", "LEGAL_AND_COMPLIANCE"),
    term("EVIDENTIARY", "Evidentiary", "A source contributes evidence but does not itself create or conclusively determine the operative result.", "OPERATIONS_AND_RISK"),
    term("RECONCILED_MIRROR", "Reconciled mirror", "A non-authoritative copy that is explicitly reconciled to the declared authoritative source.", "OPERATIONS_AND_RISK"),
    term("UNDECLARED", "Undeclared", "No authority classification has been approved; the record cannot be treated as operative or matched.", "LEGAL_AND_COMPLIANCE"),
  ],
};

export const ASSURERAIL_TAXONOMIES = [
  TRANSACTION_ROUTE_TAXONOMY,
  REPRESENTATION_TAXONOMY,
  OPERATING_MODE_TAXONOMY,
  LIFECYCLE_LEG_TAXONOMY,
  ASSET_CLASS_TAXONOMY,
  EVIDENCE_RESULT_TAXONOMY,
  RECONCILIATION_STATE_TAXONOMY,
  FUNCTION_PERFORMER_TAXONOMY,
  MARKET_CONTEXT_TAXONOMY,
  PLACEMENT_OR_LISTING_TAXONOMY,
  MATERIAL_FUNCTION_TAXONOMY,
  SOURCE_AUTHORITY_TAXONOMY,
] as const;

export function assertTaxonomyValue<TCode extends string>(
  taxonomy: VersionedTaxonomy<TCode>,
  value: unknown,
  fieldName: string,
): TCode {
  if (typeof value !== "string" || !taxonomy.terms.some((candidate) => candidate.code === value)) {
    const received = value === undefined ? "missing" : JSON.stringify(value);
    throw new Error(`${fieldName} must be a known ${taxonomy.taxonomyId}@${taxonomy.version} value (received ${received})`);
  }
  return value as TCode;
}

export function assertAllowedTaxonomyTransition<TCode extends string>(
  taxonomy: VersionedTaxonomy<TCode>,
  from: unknown,
  to: unknown,
): void {
  const fromCode = assertTaxonomyValue(taxonomy, from, "from");
  const toCode = assertTaxonomyValue(taxonomy, to, "to");
  if (fromCode === toCode) return;
  const source = taxonomy.terms.find((candidate) => candidate.code === fromCode);
  if (!source?.allowedTransitions.includes(toCode)) {
    throw new Error(`${taxonomy.taxonomyId}@${taxonomy.version} forbids transition ${fromCode} -> ${toCode}`);
  }
}
