import { createHash } from "node:crypto";
import { validateBuyerCriteria, type BuyerCriteria } from "./buyer-criteria";

export type PolicyResult = "PASS" | "FAIL" | "REVIEW";
export type PolicyDecision = "BUYER_POLICY_MATCH" | "BUYER_REVIEW_REQUIRED" | "BUYER_POLICY_MISMATCH";

export type BuyerPolicyCandidate = {
  asset: string;
  subtype: string;
  originatorAcceptance: "APPROVED_ORIGINATORS" | "NEW_SUBJECT_TO_ONBOARDING";
  borrowerTypes: string[];
  pslStatus: "PSL" | "NON_PSL" | "MIXED" | "UNVERIFIED";
  programmeCorpusMinor: string;
  sellerTickets: { sellerRef: string; corpusMinor: string }[];
  remainingMonths: [number, number];
  sellerCount: number;
  maxDpd: number;
  minSeasoningMonths: number;
  maxLtvPct: number | null;
  maxOemPct: number | null;
  maxStatePct: number | null;
  geography: "ALL_INDIA" | "SELECTED_STATES";
  states: string[];
  exclusionsPresent: string[];
  evidenceAvailable: string[];
  historyMonths: number;
  servicing: string;
  remittance: string;
  reporting: string;
  formats: string[];
  priceBasis: string;
  closingMode: string;
  buyerPrecheckCompleted: boolean;
};

export type BuyerPolicyCheck = {
  id: string;
  section: "PORTFOLIO" | "CREDIT" | "EVIDENCE" | "OPERATIONS";
  result: PolicyResult;
  expected: string;
  observed: string;
  reasonCode: string;
};

const CRORE_MINOR = 1_000_000_000n;

function boundedCandidateRef(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 160) throw new Error(`${label}: bounded reference required`);
  return value.trim();
}

function exactNonNegativeMinor(value: string, label: string): bigint {
  if (!/^(0|[1-9][0-9]{0,29})$/.test(value)) throw new Error(`${label}: non-negative minor-unit integer required`);
  return BigInt(value);
}

function sortedDistinct(values: string[], label: string): string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value.trim())) throw new Error(`${label}: bounded values required`);
  const normalized = values.map((value) => value.trim());
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label}: duplicate values are not permitted`);
  return [...normalized].sort();
}

function result(id: string, section: BuyerPolicyCheck["section"], pass: boolean, expected: string, observed: string, reasonCode: string): BuyerPolicyCheck {
  return { id, section, result: pass ? "PASS" : "FAIL", expected, observed, reasonCode };
}

function review(id: string, section: BuyerPolicyCheck["section"], expected: string, observed: string, reasonCode: string): BuyerPolicyCheck {
  return { id, section, result: "REVIEW", expected, observed, reasonCode };
}

function within(value: number, range: number[]): boolean {
  return value >= range[0] && value <= range[1];
}

function croreRangeContains(valueMinor: bigint, range: number[]): boolean {
  const lowerBasisPoints = BigInt(Math.round(range[0] * 100));
  const upperBasisPoints = BigInt(Math.round(range[1] * 100));
  const valueBasisPoints = valueMinor * 100n;
  return valueBasisPoints >= lowerBasisPoints * CRORE_MINOR && valueBasisPoints <= upperBasisPoints * CRORE_MINOR;
}

function ratioCheck(id: string, observed: number | null, maximum: number, label: string): BuyerPolicyCheck {
  if (observed === null) return review(id, "CREDIT", `<= ${maximum}%`, "not established", `${label}_UNVERIFIED`);
  return result(id, "CREDIT", observed <= maximum, `<= ${maximum}%`, `${observed}%`, `${label}_LIMIT`);
}

export function evaluateBuyerPolicy(rawCriteria: BuyerCriteria, rawCandidate: BuyerPolicyCandidate) {
  const criteria = validateBuyerCriteria(rawCriteria, true);
  const candidate: BuyerPolicyCandidate = {
    ...rawCandidate,
    borrowerTypes: sortedDistinct(rawCandidate.borrowerTypes, "borrowerTypes"),
    sellerTickets: rawCandidate.sellerTickets.map((item) => ({
      sellerRef: boundedCandidateRef(item.sellerRef, "sellerRef"),
      corpusMinor: exactNonNegativeMinor(item.corpusMinor, "seller ticket").toString(),
    })),
    states: sortedDistinct(rawCandidate.states, "states"),
    exclusionsPresent: sortedDistinct(rawCandidate.exclusionsPresent, "exclusionsPresent"),
    evidenceAvailable: sortedDistinct(rawCandidate.evidenceAvailable, "evidenceAvailable"),
    formats: sortedDistinct(rawCandidate.formats, "formats"),
  };
  const corpus = exactNonNegativeMinor(candidate.programmeCorpusMinor, "programmeCorpusMinor");
  if (corpus === 0n || !candidate.sellerTickets.length) throw new Error("positive corpus and at least one seller ticket required");
  if (!Number.isInteger(candidate.sellerCount) || candidate.sellerCount !== candidate.sellerTickets.length || candidate.sellerCount < 1) throw new Error("seller count must equal seller ticket count");
  if (new Set(candidate.sellerTickets.map((item) => item.sellerRef)).size !== candidate.sellerTickets.length) throw new Error("seller references must be distinct");
  if (candidate.sellerTickets.reduce((sum, item) => sum + BigInt(item.corpusMinor), 0n) !== corpus) throw new Error("seller tickets must reconcile exactly to programme corpus");
  if (candidate.remainingMonths.length !== 2 || candidate.remainingMonths.some((value) => !Number.isInteger(value) || value < 0) || candidate.remainingMonths[0] > candidate.remainingMonths[1]) throw new Error("ordered remaining-month range required");
  if (!candidate.borrowerTypes.length) throw new Error("at least one borrower type required");
  for (const [label, value, minimum, maximum] of [
    ["maxDpd", candidate.maxDpd, 0, 3650],
    ["minSeasoningMonths", candidate.minSeasoningMonths, 0, 120],
    ["historyMonths", candidate.historyMonths, 0, 120],
  ] as const) if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${label}: integer ${minimum} to ${maximum} required`);
  for (const [label, value] of [["maxLtvPct", candidate.maxLtvPct], ["maxOemPct", candidate.maxOemPct], ["maxStatePct", candidate.maxStatePct]] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) throw new Error(`${label}: percentage from 0 to 100 or null required`);
  }

  const checks: BuyerPolicyCheck[] = [];
  const selected = (key: keyof BuyerCriteria) => criteria[key] as string[];
  checks.push(result("ASSET", "PORTFOLIO", selected("assets").includes(candidate.asset), selected("assets").join(", "), candidate.asset, "ASSET_NOT_ACCEPTED"));
  checks.push(result("SUBTYPE", "PORTFOLIO", selected("subtypes").includes(candidate.subtype), selected("subtypes").join(", "), candidate.subtype, "SUBTYPE_NOT_ACCEPTED"));
  checks.push(result("ORIGINATOR", "PORTFOLIO", selected("originators").includes(candidate.originatorAcceptance), selected("originators").join(", "), candidate.originatorAcceptance, "ORIGINATOR_ROUTE_NOT_ACCEPTED"));
  checks.push(result("BORROWERS", "PORTFOLIO", candidate.borrowerTypes.every((value) => selected("borrowers").includes(value)), selected("borrowers").join(", "), candidate.borrowerTypes.join(", "), "BORROWER_TYPE_NOT_ACCEPTED"));

  const pslPreference = String(criteria.psl);
  checks.push(pslPreference === "NO_PREFERENCE"
    ? result("PSL", "PORTFOLIO", true, pslPreference, candidate.pslStatus, "PSL_ACCEPTED")
    : candidate.pslStatus === "UNVERIFIED"
      ? review("PSL", "PORTFOLIO", pslPreference, candidate.pslStatus, "PSL_STATUS_UNVERIFIED")
      : result("PSL", "PORTFOLIO", pslPreference !== "REQUIRED" || candidate.pslStatus === "PSL", pslPreference, candidate.pslStatus, "PSL_REQUIREMENT"));

  checks.push(result("PROGRAMME_TICKET", "PORTFOLIO", croreRangeContains(corpus, criteria.ticketCr as number[]), `${(criteria.ticketCr as number[]).join("-")} Cr`, candidate.programmeCorpusMinor, "PROGRAMME_TICKET_OUTSIDE_RANGE"));
  const sellerTicketMatches = candidate.sellerTickets.every((item) => croreRangeContains(BigInt(item.corpusMinor), criteria.sellerTicketCr as number[]));
  checks.push(result("SELLER_TICKETS", "PORTFOLIO", sellerTicketMatches, `${(criteria.sellerTicketCr as number[]).join("-")} Cr each`, candidate.sellerTickets.map((item) => `${item.sellerRef}:${item.corpusMinor}`).join(", "), "SELLER_TICKET_OUTSIDE_RANGE"));
  checks.push(result("SELLER_COUNT", "PORTFOLIO", candidate.sellerCount <= Number(criteria.maxSellers), `<= ${criteria.maxSellers}`, String(candidate.sellerCount), "TOO_MANY_SELLERS"));
  const remaining = criteria.remainingMonths as number[];
  checks.push(result("REMAINING_TERM", "CREDIT", candidate.remainingMonths[0] >= remaining[0] && candidate.remainingMonths[1] <= remaining[1], `${remaining[0]}-${remaining[1]} months`, candidate.remainingMonths.join("-"), "REMAINING_TERM_OUTSIDE_RANGE"));
  checks.push(result("DPD", "CREDIT", candidate.maxDpd <= Number(criteria.maxDpd), `<= ${criteria.maxDpd}`, String(candidate.maxDpd), "DPD_LIMIT"));
  checks.push(result("SEASONING", "CREDIT", candidate.minSeasoningMonths >= Number(criteria.minSeasoningMonths), `>= ${criteria.minSeasoningMonths} months`, `${candidate.minSeasoningMonths} months`, "SEASONING_MINIMUM"));
  checks.push(ratioCheck("LTV", candidate.maxLtvPct, Number(criteria.maxLtvPct), "LTV"));
  checks.push(ratioCheck("OEM_CONCENTRATION", candidate.maxOemPct, Number(criteria.maxOemPct), "OEM"));
  checks.push(ratioCheck("STATE_CONCENTRATION", candidate.maxStatePct, Number(criteria.maxStatePct), "STATE"));

  const expectedStates = selected("states");
  const geographyPass = criteria.geography === "ALL_INDIA" || (candidate.geography === "SELECTED_STATES" && candidate.states.length > 0 && candidate.states.every((state) => expectedStates.includes(state)));
  checks.push(result("GEOGRAPHY", "PORTFOLIO", geographyPass, criteria.geography === "ALL_INDIA" ? "ALL_INDIA" : expectedStates.join(", "), candidate.geography === "ALL_INDIA" ? "ALL_INDIA" : candidate.states.join(", "), "GEOGRAPHY_NOT_ACCEPTED"));

  const prohibited = new Set(selected("exclusions"));
  const presentExcluded = candidate.exclusionsPresent.filter((value) => prohibited.has(value));
  checks.push(result("EXCLUSIONS", "CREDIT", presentExcluded.length === 0, `none of ${[...prohibited].join(", ") || "specified exclusions"}`, presentExcluded.join(", ") || "none", "EXCLUDED_LOANS_PRESENT"));
  const missingEvidence = selected("requiredEvidence").filter((value) => !candidate.evidenceAvailable.includes(value));
  checks.push(missingEvidence.length
    ? review("EVIDENCE", "EVIDENCE", selected("requiredEvidence").join(", "), `missing: ${missingEvidence.join(", ")}`, "REQUIRED_EVIDENCE_MISSING")
    : result("EVIDENCE", "EVIDENCE", true, selected("requiredEvidence").join(", "), candidate.evidenceAvailable.join(", "), "REQUIRED_EVIDENCE_PRESENT"));
  checks.push(candidate.historyMonths >= Number(criteria.historyMonths)
    ? result("HISTORY", "EVIDENCE", true, `>= ${criteria.historyMonths} months`, `${candidate.historyMonths} months`, "HISTORY_SUFFICIENT")
    : review("HISTORY", "EVIDENCE", `>= ${criteria.historyMonths} months`, `${candidate.historyMonths} months`, "HISTORY_INCOMPLETE"));

  checks.push(result("SERVICING", "OPERATIONS", selected("servicing").includes(candidate.servicing), selected("servicing").join(", "), candidate.servicing, "SERVICING_ROUTE_NOT_ACCEPTED"));
  checks.push(result("REMITTANCE", "OPERATIONS", String(criteria.remittance) === "DEAL_SPECIFIC" || criteria.remittance === candidate.remittance, String(criteria.remittance), candidate.remittance, "REMITTANCE_NOT_ACCEPTED"));
  checks.push(result("REPORTING", "OPERATIONS", criteria.reporting === candidate.reporting, String(criteria.reporting), candidate.reporting, "REPORTING_NOT_ACCEPTED"));
  checks.push(result("FORMAT", "OPERATIONS", candidate.formats.some((value) => selected("formats").includes(value)), selected("formats").join(", "), candidate.formats.join(", "), "NO_COMMON_EXPORT_FORMAT"));
  checks.push(result("PRICE_BASIS", "OPERATIONS", String(criteria.priceBasis) === "DEAL_SPECIFIC" || criteria.priceBasis === candidate.priceBasis, String(criteria.priceBasis), candidate.priceBasis, "PRICE_BASIS_NOT_ACCEPTED"));
  checks.push(result("CLOSING_MODE", "OPERATIONS", String(criteria.closingMode) === "DEAL_SPECIFIC" || criteria.closingMode === candidate.closingMode, String(criteria.closingMode), candidate.closingMode, "CLOSING_MODE_NOT_ACCEPTED"));
  if (criteria.requireBuyerPrecheck) checks.push(candidate.buyerPrecheckCompleted
    ? result("BUYER_PRECHECK", "OPERATIONS", true, "completed", "completed", "BUYER_PRECHECK_COMPLETE")
    : review("BUYER_PRECHECK", "OPERATIONS", "completed", "pending", "BUYER_PRECHECK_REQUIRED"));

  const failures = checks.filter((check) => check.result === "FAIL");
  const reviews = checks.filter((check) => check.result === "REVIEW");
  const decision: PolicyDecision = failures.length ? "BUYER_POLICY_MISMATCH" : reviews.length ? "BUYER_REVIEW_REQUIRED" : "BUYER_POLICY_MATCH";
  const canonical = JSON.stringify({ schema: "assurerail-buyer-policy-evaluation/1", criteria, candidate, checks, decision });
  return {
    schema: "assurerail-buyer-policy-evaluation/1" as const,
    decision,
    checks,
    summary: { pass: checks.length - failures.length - reviews.length, fail: failures.length, review: reviews.length },
    evaluationDigest: `sha256:${createHash("sha256").update(canonical).digest("hex")}`,
    qualification: "PREPARATION_SCREEN_ONLY_BUYER_DECIDES" as const,
  };
}
