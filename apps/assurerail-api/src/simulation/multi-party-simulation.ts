import { sha256Digest } from "../contracts/v1";

export const SIMULATION_CORPUS_VERSION = "assurerail.multi-party-simulation.v1" as const;
export const SIMULATION_PARTY_COUNTS = [2, 3, 4, 5, 6] as const;
export const SIMULATION_FAULTS = [
  "NONE",
  "TAMPERED_PROVIDER_PAYLOAD",
  "UNTRUSTED_PROVIDER_KEY",
  "EXPIRED_PROVIDER_PACKAGE",
  "INCONSISTENT_COVERAGE",
  "RAW_IDENTIFIER_LEAKAGE",
  "INACTIVE_MEMBER",
  "WRONG_SESSION_CONTEXT",
  "NON_PARTICIPANT_ACCESS",
  "UNCERTIFIED_CONNECTOR",
] as const;
export const PTC_PREPARATION_SIMULATION_FAMILY_VERSION =
  "assurerail.multi-party-simulation.ptc-preparation.v1" as const;
export const PTC_PREPARATION_SIMULATION_VARIANTS = [
  "VALID_REVIEW_REQUIRED",
  "TAMPERED_SSA_UNDER_OLD_SIGNATURE",
  "READY_WITH_COUNSEL_PENDING",
  "FAIL_FINDING_WITH_NON_FAIL_OVERALL",
  "MRR_BAND_BPS_MISMATCH",
  "DA_PACKAGE_ON_PTC_CASE",
  "UNTRUSTED_PROVIDER_KEY",
  "INVALID_PROVIDER_SIGNATURE",
] as const;

export type SimulationRoute = "DA" | "PTC";
export type SimulationRepresentation = "CONVENTIONAL" | "TOKENISED";
export type SimulationFault = (typeof SIMULATION_FAULTS)[number];
export type SimulationGate =
  | "PARTICIPANT_TOPOLOGY"
  | "INSTITUTION_AUTHORITY"
  | "SESSION_STEP_UP"
  | "CASE_PARTICIPATION"
  | "PROVIDER_EVIDENCE"
  | "CONNECTOR_CERTIFICATION"
  | "RAIL_REVIEW";

export interface MultiPartySimulationScenario {
  readonly corpusVersion: typeof SIMULATION_CORPUS_VERSION;
  readonly sequence: number;
  readonly scenarioId: string;
  readonly transactionRoute: SimulationRoute;
  readonly representation: SimulationRepresentation;
  readonly partyCount: (typeof SIMULATION_PARTY_COUNTS)[number];
  readonly partyRoles: readonly string[];
  readonly fault: SimulationFault;
  readonly expectedGate: SimulationGate;
  readonly expectedDecision: "BLOCKED" | "REVIEW_REQUIRED";
}

export interface PtcPreparationSimulationScenario {
  readonly corpusVersion: typeof PTC_PREPARATION_SIMULATION_FAMILY_VERSION;
  readonly sequence: number;
  readonly scenarioId: string;
  readonly transactionRoute: "PTC";
  readonly representation: "CONVENTIONAL";
  readonly partyCount: 3;
  readonly partyRoles: readonly ["ISSUER", "TRUSTEE", "RTA"];
  readonly variant: (typeof PTC_PREPARATION_SIMULATION_VARIANTS)[number];
  readonly expectedGate: "PROVIDER_EVIDENCE" | "RAIL_REVIEW";
  readonly expectedDecision: "BLOCKED" | "REVIEW_REQUIRED";
}

const PARTY_ROLES: Record<SimulationRoute, readonly string[]> = {
  DA: ["TRANSFEROR", "TRANSFEREE", "SERVICER", "COUNSEL", "RATING_AGENCY", "ASSURANCE_PROVIDER"],
  PTC: ["ISSUER", "TRUSTEE", "RTA", "INVESTOR", "SERVICER", "ASSURANCE_PROVIDER"],
};

function expected(route: SimulationRoute, partyCount: number, fault: SimulationFault): Pick<MultiPartySimulationScenario, "expectedGate" | "expectedDecision"> {
  // Identity, authority and object non-disclosure are evaluated before route details. This order
  // prevents an unauthorised caller from learning that a case has a topology defect.
  if (fault === "INACTIVE_MEMBER") return { expectedGate: "INSTITUTION_AUTHORITY", expectedDecision: "BLOCKED" };
  if (fault === "WRONG_SESSION_CONTEXT") return { expectedGate: "SESSION_STEP_UP", expectedDecision: "BLOCKED" };
  if (fault === "NON_PARTICIPANT_ACCESS") return { expectedGate: "CASE_PARTICIPATION", expectedDecision: "BLOCKED" };
  // A conventional or token projection does not make a two-party PTC complete. The trustee and
  // route-defined recordkeeper must both be represented before later evidence is considered.
  if (route === "PTC" && partyCount < 3) return { expectedGate: "PARTICIPANT_TOPOLOGY", expectedDecision: "BLOCKED" };
  if (fault === "UNCERTIFIED_CONNECTOR") return { expectedGate: "CONNECTOR_CERTIFICATION", expectedDecision: "BLOCKED" };
  if (fault !== "NONE") return { expectedGate: "PROVIDER_EVIDENCE", expectedDecision: "BLOCKED" };
  return { expectedGate: "RAIL_REVIEW", expectedDecision: "REVIEW_REQUIRED" };
}

export function buildMultiPartySimulationCorpus(): readonly MultiPartySimulationScenario[] {
  const result: MultiPartySimulationScenario[] = [];
  for (const transactionRoute of ["DA", "PTC"] as const) {
    for (const representation of ["CONVENTIONAL", "TOKENISED"] as const) {
      for (const partyCount of SIMULATION_PARTY_COUNTS) {
        for (const fault of SIMULATION_FAULTS) {
          const sequence = result.length + 1;
          result.push({
            corpusVersion: SIMULATION_CORPUS_VERSION,
            sequence,
            scenarioId: ["sim-v1", transactionRoute, representation, `p${partyCount}`, fault].join("-").toLowerCase().replaceAll("_", "-"),
            transactionRoute,
            representation,
            partyCount,
            partyRoles: PARTY_ROLES[transactionRoute].slice(0, partyCount),
            fault,
            ...expected(transactionRoute, partyCount, fault),
          });
        }
      }
    }
  }
  return Object.freeze(result.map((scenario) => Object.freeze(scenario)));
}

/** Route-specific conformance family registered alongside the 200-case base matrix. It exercises
 * the signed provider seam itself rather than multiplying unrelated DA/token combinations. */
export function buildPtcPreparationSimulationFamily(): readonly PtcPreparationSimulationScenario[] {
  return Object.freeze(PTC_PREPARATION_SIMULATION_VARIANTS.map((variant, index) => Object.freeze({
    corpusVersion: PTC_PREPARATION_SIMULATION_FAMILY_VERSION,
    sequence: index + 1,
    scenarioId: `sim-v1-ptc-conventional-p3-ptc-prep-${variant.toLowerCase().replaceAll("_", "-")}`,
    transactionRoute: "PTC" as const,
    representation: "CONVENTIONAL" as const,
    partyCount: 3 as const,
    partyRoles: ["ISSUER", "TRUSTEE", "RTA"] as const,
    variant,
    expectedGate: variant === "VALID_REVIEW_REQUIRED" ? "RAIL_REVIEW" as const : "PROVIDER_EVIDENCE" as const,
    expectedDecision: variant === "VALID_REVIEW_REQUIRED" ? "REVIEW_REQUIRED" as const : "BLOCKED" as const,
  })));
}

export function validateParticipantTopology(scenario: MultiPartySimulationScenario): { allowed: boolean; code: string } {
  const roles = new Set(scenario.partyRoles);
  if (scenario.transactionRoute === "DA" && (!roles.has("TRANSFEROR") || !roles.has("TRANSFEREE"))) {
    return { allowed: false, code: "DA_TRANSFER_PARTIES_INCOMPLETE" };
  }
  if (scenario.transactionRoute === "PTC" && (!roles.has("ISSUER") || !roles.has("TRUSTEE") || !roles.has("RTA"))) {
    return { allowed: false, code: "PTC_TRUSTEE_OR_RECORDKEEPER_ABSENT" };
  }
  return { allowed: true, code: "PARTICIPANT_TOPOLOGY_ACCEPTABLE" };
}

export function simulationCorpusDigest(corpus = buildMultiPartySimulationCorpus()): string {
  return sha256Digest(corpus);
}

export function ptcPreparationSimulationFamilyDigest(
  corpus = buildPtcPreparationSimulationFamily(),
): string {
  return sha256Digest(corpus);
}

export function completeSimulationGateDigest(): string {
  return sha256Digest({
    base: buildMultiPartySimulationCorpus(),
    ptcPreparation: buildPtcPreparationSimulationFamily(),
  });
}
