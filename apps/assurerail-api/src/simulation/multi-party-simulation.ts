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
