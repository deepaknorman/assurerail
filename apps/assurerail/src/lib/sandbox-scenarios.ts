export type SandboxRoute = "DA" | "PTC";
export type SandboxResult = "MATCHED" | "REVIEW_REQUIRED" | "BLOCKED";

export type SandboxStage = {
  id: string;
  owner: string;
  label: string;
  expected: string;
  observed: string;
  result: SandboxResult;
  consequence: string;
};

export type SandboxScenario = {
  id: string;
  route: SandboxRoute;
  reference: string;
  title: string;
  premise: string;
  fixtureNotice: string;
  expectedOutcome: SandboxResult;
  dossierDigest: string;
  stages: SandboxStage[];
};

export const SANDBOX_SCENARIOS: readonly SandboxScenario[] = [
  {
    id: "sim-da-001",
    route: "DA",
    reference: "SYNTHETIC-DA-2026-001",
    title: "Conventional DA completion replay",
    premise: "A frozen receivables tape, executed assignment documents and source-system extracts are compared without moving money or title.",
    fixtureNotice: "Synthetic training fixture. It is not customer evidence and cannot satisfy a route or production gate.",
    expectedOutcome: "REVIEW_REQUIRED",
    dossierDigest: "sha256:6fe7d8b3d990…1ca4",
    stages: [
      { id: "da-intake", owner: "Transferor", label: "Tape and source receipt", expected: "Frozen version and source digest agree", observed: "Version 4 and digest agree", result: "MATCHED", consequence: "Diligence may continue" },
      { id: "da-docs", owner: "Transferor + transferee", label: "Assignment documents", expected: "Executed schedules reconcile to the frozen tape", observed: "Two loan references require manual schedule mapping", result: "REVIEW_REQUIRED", consequence: "Named reviewer evidence required" },
      { id: "da-cash", owner: "Payment bank", label: "Consideration acknowledgement", expected: "Authenticated final payment reference", observed: "Reference supplied; finality classification is UNKNOWN", result: "REVIEW_REQUIRED", consequence: "Completion remains blocked" },
      { id: "da-register", owner: "Lender source systems", label: "Ownership/source update", expected: "Both books acknowledge the same effective transfer", observed: "Transferee acknowledgement not yet present", result: "BLOCKED", consequence: "No legal-completion claim" },
    ],
  },
  {
    id: "sim-ptc-001",
    route: "PTC",
    reference: "SYNTHETIC-PTC-2026-001",
    title: "Conventional PTC issuance replay",
    premise: "Trustee decisions, executed documents, allotment and route-defined register evidence are reconstructed beside the original process.",
    fixtureNotice: "Synthetic training fixture. Trustee, RTA and depository records shown here are invented and have no legal effect.",
    expectedOutcome: "BLOCKED",
    dossierDigest: "sha256:9d8e0c3910a1…742f",
    stages: [
      { id: "ptc-appointment", owner: "Trustee", label: "Appointment and authority", expected: "Accepted, effective and transaction-scoped", observed: "Appointment evidence verifies", result: "MATCHED", consequence: "Trustee controls may continue" },
      { id: "ptc-assurance", owner: "Trustee-appointed assurer", label: "Assurance result", expected: "Signed result with scope and qualifications", observed: "Partially verified; one source qualification open", result: "REVIEW_REQUIRED", consequence: "Trustee decision must address qualification" },
      { id: "ptc-allotment", owner: "Issuer + trustee", label: "Allotment instruction", expected: "Approved instruction matches final terms", observed: "Terms and instruction agree", result: "MATCHED", consequence: "Await authoritative register" },
      { id: "ptc-register", owner: "Trustee-referenced RTA/depository", label: "Authoritative record", expected: "Trustee decision and recordkeeper acknowledgement reconcile", observed: "One holder quantity differs from the trustee schedule", result: "BLOCKED", consequence: "Issuance completion and downstream transfer remain blocked" },
    ],
  },
] as const;

export function scenarioFor(route: SandboxRoute): SandboxScenario {
  const scenario = SANDBOX_SCENARIOS.find((item) => item.route === route);
  if (!scenario) throw new Error(`No sandbox scenario for ${route}`);
  return scenario;
}
