export type DemoControlState = "MATCHED" | "REVIEW_REQUIRED" | "BLOCKED" | "NOT_ACTIVATED";

export type DemoPersonaId =
  | "ORIGINATOR"
  | "TRANSFEREE"
  | "TRUSTEE"
  | "RECORDKEEPER"
  | "RAIL_OPERATOR";

export type DemoPersona = {
  id: DemoPersonaId;
  label: string;
  organisation: string;
  responsibility: string;
  initials: string;
};

export type DemoStage = {
  id: string;
  number: string;
  phase: string;
  title: string;
  summary: string;
  route: "FOUNDATION" | "DA + PTC" | "DA" | "PTC" | "LIFECYCLE" | "PLATFORM";
  state: DemoControlState;
  owner: string;
  expectedOutcome: string;
  observedOutcome: string;
  consequence: string;
  perspectives: Record<DemoPersonaId, string>;
  facts: ReadonlyArray<{ label: string; value: string; tone?: "good" | "warn" | "blocked" }>;
  artefacts: ReadonlyArray<{ label: string; reference: string; state: DemoControlState }>;
  boundary: string;
};

export const FULL_SYSTEM_DEMO = {
  fixtureId: "AR-DEMO-01-MUM-001",
  title: "One governed transaction record, from admission to surveillance",
  subtitle:
    "A deterministic institutional walkthrough across conventional DA and PTC, with controlled commercial, lifecycle, integration and optional token-representation views.",
  asOf: "2026-09-07T09:30:00+05:30",
  manifestDigest: "sha256:bc1b5df08e7a7bd126d94429965c2dc8a7f70c3f4d16ec842764139c5f81cdb0",
  evidenceNotice:
    "All names, values, references, decisions and digests in this experience are synthetic. No external system is contacted and no transaction, payment, title, allotment, register or token action occurs.",
  metrics: [
    { label: "Institutional roles", value: "5", detail: "bounded views" },
    { label: "Transaction routes", value: "2", detail: "DA + PTC" },
    { label: "Governed stages", value: "10", detail: "end to end" },
    { label: "External effects", value: "0", detail: "synthetic only" },
  ],
} as const;

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  {
    id: "ORIGINATOR",
    label: "Originator",
    organisation: "Sahyadri Finance Ltd",
    responsibility: "Supplies the pool, evidence and authorised seller instructions.",
    initials: "SF",
  },
  {
    id: "TRANSFEREE",
    label: "Bank / investor",
    organisation: "Dakshin Institutional Bank",
    responsibility: "Owns credit judgement, diligence acceptance and purchase authority.",
    initials: "DB",
  },
  {
    id: "TRUSTEE",
    label: "Trustee",
    organisation: "Western Trusteeship Services",
    responsibility: "Controls the synthetic PTC workflow and appoints assurance.",
    initials: "WT",
  },
  {
    id: "RECORDKEEPER",
    label: "RTA / recordkeeper",
    organisation: "National Registry Services",
    responsibility: "Supplies the route-defined authoritative record acknowledgement.",
    initials: "NR",
  },
  {
    id: "RAIL_OPERATOR",
    label: "Rail operations",
    organisation: "AssureRail Operations",
    responsibility: "Operates the workflow and reconciliation controls without taking participant decisions.",
    initials: "AR",
  },
] as const;

const perspectives = (
  originator: string,
  transferee: string,
  trustee: string,
  recordkeeper: string,
  rail: string,
): Record<DemoPersonaId, string> => ({
  ORIGINATOR: originator,
  TRANSFEREE: transferee,
  TRUSTEE: trustee,
  RECORDKEEPER: recordkeeper,
  RAIL_OPERATOR: rail,
});

export const FULL_SYSTEM_STAGES: readonly DemoStage[] = [
  {
    id: "admission",
    number: "01",
    phase: "Institutional foundation",
    title: "Admit the institution, not merely the user",
    summary: "Identity binding, institutional admission, membership and authority are separate governed records.",
    route: "FOUNDATION",
    state: "MATCHED",
    owner: "Institution administrators + Rail admission operations",
    expectedOutcome: "Each human action resolves to an active institution, membership and effective mandate.",
    observedOutcome: "Four institutions admitted; maker-checker authority is current; one read-only observer has no transaction action.",
    consequence: "The synthetic cases may be opened for their named participants. No global role grants transaction access.",
    perspectives: perspectives(
      "Your treasury maker can prepare evidence but cannot approve their own mandate or completion instruction.",
      "Your diligence team sees only cases in which the bank is an accepted party.",
      "Your appointment is transaction-scoped and does not expose unrelated DA cases.",
      "Your service account can acknowledge only the register scope assigned to it.",
      "Support access is time-bound; privilege, suspension and escalation remain independently auditable.",
    ),
    facts: [
      { label: "Admissions", value: "4 active", tone: "good" },
      { label: "Mandates", value: "7 effective", tone: "good" },
      { label: "Self-approval", value: "Denied", tone: "good" },
      { label: "Recertification", value: "1 due in 28 days", tone: "warn" },
    ],
    artefacts: [
      { label: "Admission decision", reference: "ADM-SYN-240901", state: "MATCHED" },
      { label: "Treasury mandate", reference: "MAND-SYN-0042", state: "MATCHED" },
      { label: "Route entitlement", reference: "ENT-SYN-DA-PTC-07", state: "MATCHED" },
    ],
    boundary: "Identity verification is evidence about a person; it is never, by itself, admission or transaction authority.",
  },
  {
    id: "intake",
    number: "02",
    phase: "Evidence intake",
    title: "Freeze the source package and expose its limits",
    summary: "A provider-neutral intake receipt binds source, version, schema, digest, as-of time and qualifications.",
    route: "DA + PTC",
    state: "REVIEW_REQUIRED",
    owner: "Originator data owner",
    expectedOutcome: "The pool and performance package is immutable, signed, complete for the declared period and reproducible.",
    observedOutcome: "Signature and manifest match. Monthly-cycle coverage is 98.7%; two records use scheduled rather than reported outstanding.",
    consequence: "The package remains visible but its coverage and value-basis qualification follows every downstream decision.",
    perspectives: perspectives(
      "Your signed submission has one immutable receipt; a correction becomes a new version rather than an overwrite.",
      "You can see exactly which figures are reported, scheduled or fallback before relying on a curve.",
      "The assurance appointment can scope review to this exact package version and qualification.",
      "No register action is requested at evidence-intake stage.",
      "The system refuses to promote expected provider capability into achieved verification.",
    ),
    facts: [
      { label: "Loans", value: "12,480", tone: "good" },
      { label: "Cycle coverage", value: "98.7%", tone: "warn" },
      { label: "Manifest", value: "Signature verified", tone: "good" },
      { label: "Value basis", value: "96.2% reported", tone: "warn" },
    ],
    artefacts: [
      { label: "Signed provider package", reference: "PKG-SYN-8F3C", state: "MATCHED" },
      { label: "Coverage report", reference: "COV-SYN-2026-08", state: "REVIEW_REQUIRED" },
      { label: "Source qualification", reference: "QUAL-SYN-002", state: "REVIEW_REQUIRED" },
    ],
    boundary: "AssurePool is one optional DA source adapter. The canonical Rail intake does not require AssurePool or any other named provider.",
  },
  {
    id: "room",
    number: "03",
    phase: "Diligence room",
    title: "Give named parties the minimum evidence they need",
    summary: "Invitation, declaration, purpose, object-level access, Q&A and exports remain attributable and tamper-evident.",
    route: "DA + PTC",
    state: "MATCHED",
    owner: "Transferor / issuer and invited reviewers",
    expectedOutcome: "Only accepted, scoped grants can view or export the frozen evidence version.",
    observedOutcome: "Bank reviewer accepted the declaration; trustee reviewer sees only the PTC room; two access grants expire tonight.",
    consequence: "Diligence proceeds with a retained access chain. Expired grants cannot be used to fetch evidence.",
    perspectives: perspectives(
      "You control the named invitation and see a receipt for every view, question and export.",
      "Your reviewer gets the agreed evidence, not the originator's unrelated book or commercial data.",
      "Your PTC room remains segregated from the bilateral DA room.",
      "You receive no diligence-room access unless appointed for a specific evidence object.",
      "A support operator cannot silently impersonate a participant or rewrite imported access history.",
    ),
    facts: [
      { label: "Named grants", value: "6", tone: "good" },
      { label: "Open questions", value: "3", tone: "warn" },
      { label: "Export receipts", value: "4", tone: "good" },
      { label: "Chain verification", value: "Matched", tone: "good" },
    ],
    artefacts: [
      { label: "Room declaration", reference: "DECL-SYN-V3", state: "MATCHED" },
      { label: "Access-chain tail", reference: "sha256:4a53…d18c", state: "MATCHED" },
      { label: "Open Q&A", reference: "Q-SYN-017", state: "REVIEW_REQUIRED" },
    ],
    boundary: "Passive diligence is separate from price discovery, negotiation, matching and transaction execution.",
  },
  {
    id: "commercial",
    number: "04",
    phase: "Primary opportunity",
    title: "Share terms with a named audience—under explicit conduct controls",
    summary: "A private opportunity, interest and RFQ record can be orchestrated without a public order book or automatic match.",
    route: "DA + PTC",
    state: "REVIEW_REQUIRED",
    owner: "Assigned arranger / participant-owned commercial team",
    expectedOutcome: "Audience, function performer, conflicts and communication policy are accepted before term interaction.",
    observedOutcome: "Three institutions are eligible; the arranger function is participant-owned; one conflict disclosure awaits acknowledgement.",
    consequence: "Named recipients may review terms. Allocation and case handoff remain blocked until the disclosure is acknowledged.",
    perspectives: perspectives(
      "You can expose a controlled term sheet without making it public or granting a buyer access to the underlying tape.",
      "Your interest is attributable and scoped; it is not an automatic commitment or credit decision.",
      "You observe only if your accepted appointment and the route pack assign that function.",
      "No commercial terms are written to the legal register.",
      "The Rail records the communication and conduct state but does not invent performer authority.",
    ),
    facts: [
      { label: "Named audience", value: "3 institutions", tone: "good" },
      { label: "Interests", value: "2 received", tone: "good" },
      { label: "Conflict disclosure", value: "1 open", tone: "warn" },
      { label: "Automatic matching", value: "Off", tone: "good" },
    ],
    artefacts: [
      { label: "Opportunity terms v2", reference: "OPP-SYN-DA-004", state: "MATCHED" },
      { label: "Conflict disclosure", reference: "CONFLICT-SYN-12", state: "REVIEW_REQUIRED" },
    ],
    boundary: "The demonstration does not claim regulatory permission for solicitation, arrangement, matching, distribution or execution.",
  },
  {
    id: "da",
    number: "05",
    phase: "Conventional completion",
    title: "Reconstruct a DA completion as a multi-leg evidence saga",
    summary: "Documents, consideration, notices and source acknowledgements remain separate legs with independent observations.",
    route: "DA",
    state: "BLOCKED",
    owner: "Transferor and transferee; each external performer owns its fact",
    expectedOutcome: "All required legs reconcile to the frozen case before a completion statement is produced.",
    observedOutcome: "Documents and payment reference match. Transferee source-system acknowledgement is absent; payment finality remains UNKNOWN.",
    consequence: "Rail refuses the legal-completion claim and opens a named reconciliation break rather than correcting an external book.",
    perspectives: perspectives(
      "You see the missing counterparty acknowledgement without surrendering ownership of your source system.",
      "You retain the credit decision and must supply the acknowledgement from your own authoritative process.",
      "The bilateral DA route does not insert a trustee where the approved route does not require one.",
      "No RTA/depository leg is assumed for this bilateral DA fixture.",
      "Operations sees the exact blocked leg, owner, age, SLA and permitted repair path.",
    ),
    facts: [
      { label: "Illustrative consideration", value: "₹50.00 crore", tone: "good" },
      { label: "Saga legs", value: "3 / 5 matched", tone: "warn" },
      { label: "Payment finality", value: "UNKNOWN", tone: "blocked" },
      { label: "Completion claim", value: "Refused", tone: "good" },
    ],
    artefacts: [
      { label: "Executed assignment schedule", reference: "DA-SYN-SCHED-V4", state: "MATCHED" },
      { label: "Payment acknowledgement", reference: "PAY-SYN-7712", state: "REVIEW_REQUIRED" },
      { label: "Transferee book acknowledgement", reference: "EXPECTED-ACK-05", state: "BLOCKED" },
    ],
    boundary: "The Rail observes and reconciles. It does not move funds, decide credit, or overwrite the transferor's or transferee's system of record.",
  },
  {
    id: "ptc",
    number: "06",
    phase: "Conventional issuance",
    title: "Keep trustee control distinct from the legally operative register",
    summary: "The trustee's transaction-control decision records the route-defined RTA/depository acknowledgement it relies upon.",
    route: "PTC",
    state: "REVIEW_REQUIRED",
    owner: "Trustee and route-defined external performers",
    expectedOutcome: "Trust, pool transfer, documents, rating, assurance, subscription, allotment and register facts reconcile.",
    observedOutcome: "Trustee decision is signed; assurance is qualified; the RTA quantity matches while depository finality is still pending.",
    consequence: "The trustee may review the qualification, but Rail does not call the issuance complete until the route-required acknowledgement arrives.",
    perspectives: perspectives(
      "As issuer, you supply evidence and instructions but cannot mark the trustee-controlled case complete.",
      "Your subscription evidence is visible within the accepted case scope.",
      "Your signed decision remains final for Rail workflow control and explicitly references the external register evidence.",
      "Your acknowledgement remains the legally operative route record; Rail stores a digest-bound snapshot, not a competing register.",
      "The platform exposes any disagreement between trustee schedule and recordkeeper rather than choosing one silently.",
    ),
    facts: [
      { label: "Illustrative issue", value: "₹120.00 crore", tone: "good" },
      { label: "Trustee decision", value: "Signed", tone: "good" },
      { label: "Assurance", value: "Qualified", tone: "warn" },
      { label: "Depository finality", value: "Pending", tone: "warn" },
    ],
    artefacts: [
      { label: "Trustee control decision", reference: "TRU-SYN-PTC-019", state: "MATCHED" },
      { label: "Provider-neutral assurance result", reference: "ASR-SYN-006", state: "REVIEW_REQUIRED" },
      { label: "RTA snapshot", reference: "RTA-SYN-ALLOT-331", state: "MATCHED" },
    ],
    boundary: "The trustee controls the Rail workflow; the approved route pack defines which RTA, depository or register is legally operative.",
  },
  {
    id: "lifecycle",
    number: "07",
    phase: "Lifecycle & monitoring",
    title: "Carry the evidence boundary beyond closing",
    summary: "Collections, pool factors, triggers, notices and signed monitoring results are versioned and reconciled over time.",
    route: "LIFECYCLE",
    state: "REVIEW_REQUIRED",
    owner: "Servicer / lender data owner and appointed reviewers",
    expectedOutcome: "Each period states its data universe, achieved checks, exceptions and source acknowledgement.",
    observedOutcome: "August cycle reconciles. Optional AssureLens monitoring reports two alerts, but the declared source universe is partial.",
    consequence: "Alerts enter review; they neither claim total borrower indebtedness nor silently restrict a transaction.",
    perspectives: perspectives(
      "You submit the period once and can see coverage, basis mix and outstanding exceptions.",
      "Your monitoring view distinguishes observed exposure from any claim about total indebtedness.",
      "You can see whether a qualified result affects a trustee condition without surrendering the decision to a provider.",
      "Register holdings remain independently reconciled from monitoring observations.",
      "AssureLens is accepted through the same neutral evidence contract as any certified provider and receives no privileged status.",
    ),
    facts: [
      { label: "Pool factor", value: "0.9472", tone: "good" },
      { label: "Cycle status", value: "Reconciled", tone: "good" },
      { label: "Monitoring alerts", value: "2 review items", tone: "warn" },
      { label: "Source universe", value: "Partial / declared", tone: "warn" },
    ],
    artefacts: [
      { label: "Monthly cycle receipt", reference: "MC-SYN-2026-08", state: "MATCHED" },
      { label: "Signed monitoring package", reference: "LENS-SYN-PKG-013", state: "REVIEW_REQUIRED" },
      { label: "Trigger review case", reference: "LIFE-SYN-RVW-22", state: "REVIEW_REQUIRED" },
    ],
    boundary: "A monitoring provider reports scoped evidence. The bank, trustee or other accountable participant retains its decision and action authority.",
  },
  {
    id: "secondary",
    number: "08",
    phase: "Secondary transfer",
    title: "Prove the current holder and prior chain before transfer",
    summary: "A later transfer reuses the case kernel while adding holder, notice, consent and authoritative-record controls.",
    route: "DA + PTC",
    state: "BLOCKED",
    owner: "Current holder, buyer and route-defined recordkeeper",
    expectedOutcome: "Current holder, prior chain, restrictions, consideration and resulting record all reconcile.",
    observedOutcome: "Prior chain verifies; a consent condition is expired and no valid waiver authority is attached.",
    consequence: "The transfer is blocked. Historical ownership evidence and the rejected attempt remain intact.",
    perspectives: perspectives(
      "You see only your retained servicing or notice obligations after the original transfer.",
      "As current holder, you must prove authority and close the expired consent rather than bypass it.",
      "For PTC, any trustee consent is recorded only when the route and appointment require it.",
      "No holding change is accepted until your authoritative acknowledgement matches the approved instruction.",
      "Repair is append-only: a new consent or authorised waiver closes the break; the original failure is not rewritten.",
    ),
    facts: [
      { label: "Prior chain", value: "Verified", tone: "good" },
      { label: "Current holder", value: "Matched", tone: "good" },
      { label: "Consent", value: "Expired", tone: "blocked" },
      { label: "Transfer state", value: "Blocked", tone: "good" },
    ],
    artefacts: [
      { label: "Prior-chain dossier", reference: "CHAIN-SYN-004", state: "MATCHED" },
      { label: "Consent condition", reference: "COND-SYN-SEC-11", state: "BLOCKED" },
    ],
    boundary: "Secondary trading remains a separately permissioned function. A complete workflow model is not evidence that the function is authorised live.",
  },
  {
    id: "token",
    number: "09",
    phase: "Optional representation",
    title: "Mirror an approved legal record—never outrank it by default",
    summary: "A token representation can bind to a conventional case while supply and holdings remain reconciled to the declared authority.",
    route: "DA + PTC",
    state: "NOT_ACTIVATED",
    owner: "Approved token connector operator and authoritative recordkeeper",
    expectedOutcome: "Connector, keys, finality, authority mode, recovery and reconciliation are accepted before any dispatch.",
    observedOutcome: "Synthetic mint instruction and holding projection are shown; dispatch is disabled and five external activation gates remain open.",
    consequence: "The representation is an inert demonstration projection. It cannot establish title, ownership, issuance or transfer.",
    perspectives: perspectives(
      "You can inspect how the frozen pool version would bind to a token without committing your source assets.",
      "You can compare projected economic interest against the conventional record before accepting any future route.",
      "You retain the same transaction-control role; the token does not replace the trustee decision.",
      "Your register remains authoritative unless a future approved route explicitly determines otherwise.",
      "Plaza/HTS is an optional external connector with separate credentials, health and exit controls—not an internal Rail ledger shortcut.",
    ),
    facts: [
      { label: "Authority mode", value: "Mirror", tone: "good" },
      { label: "Projected supply", value: "120,000,000 units", tone: "good" },
      { label: "Dispatch", value: "Disabled", tone: "good" },
      { label: "External gates", value: "5 open", tone: "warn" },
    ],
    artefacts: [
      { label: "Synthetic representation manifest", reference: "TOK-SYN-MAN-09", state: "MATCHED" },
      { label: "HTS connector certification", reference: "EXTERNAL-GATE-HTS", state: "NOT_ACTIVATED" },
      { label: "Legal authority decision", reference: "EXTERNAL-GATE-LEGAL", state: "NOT_ACTIVATED" },
    ],
    boundary: "Tokenisation is an optional representation adapter. It is not the product entry ticket and is not available for live use in this demonstration.",
  },
  {
    id: "operations",
    number: "10",
    phase: "Operations & readiness",
    title: "End with receipts, open gates and a safe next action",
    summary: "Integration health, audit, break ageing, customer export and production readiness remain visible without making a production claim.",
    route: "PLATFORM",
    state: "REVIEW_REQUIRED",
    owner: "Rail operations, security, risk and service owners",
    expectedOutcome: "Every capability has an owner, operating mode, evidence state, escalation and reversible safe-pause path.",
    observedOutcome: "All synthetic events are digest-bound; two breaks remain open; counsel, historic replay, Azure rehearsal and VAPT gates are not accepted.",
    consequence: "The demonstration ends in SHADOW readiness, not production. The next honest step is a completed-deal replay under NDA.",
    perspectives: perspectives(
      "You can export your institution's evidence inventory without another participant's records or platform secrets.",
      "You receive a comparison pack and can independently verify the retained hashes.",
      "You can export the trustee view, open qualifications and referenced register receipts.",
      "You see connector acknowledgement and reconciliation health for only your assigned routes.",
      "The operator board separates software checks from external approvals and forbids the same person from generating and reviewing readiness.",
    ),
    facts: [
      { label: "Audit digest", value: "Verified", tone: "good" },
      { label: "Open breaks", value: "2", tone: "warn" },
      { label: "External readiness gates", value: "Open", tone: "warn" },
      { label: "Production activation", value: "Not available", tone: "good" },
    ],
    artefacts: [
      { label: "Synthetic evidence inventory", reference: "EXIT-SYN-001", state: "MATCHED" },
      { label: "Readiness assessment", reference: "READY-SYN-20260907", state: "REVIEW_REQUIRED" },
      { label: "Independent VAPT", reference: "EXTERNAL-GATE-VAPT", state: "NOT_ACTIVATED" },
      { label: "Historic transaction replay", reference: "EXTERNAL-GATE-REPLAY", state: "NOT_ACTIVATED" },
    ],
    boundary: "Repository tests and synthetic demonstrations prove software behaviour only; they cannot close customer, trustee, counsel, VAPT, DR or production gates.",
  },
] as const;

export function demoStage(id: string): DemoStage {
  const stage = FULL_SYSTEM_STAGES.find((candidate) => candidate.id === id);
  if (!stage) throw new Error(`Unknown full-system demo stage: ${id}`);
  return stage;
}

export function demoExport(persona: DemoPersonaId) {
  return {
    schema: "assurerail.synthetic-full-system-demo.v1",
    fixture: FULL_SYSTEM_DEMO,
    selectedPersona: DEMO_PERSONAS.find((candidate) => candidate.id === persona),
    stages: FULL_SYSTEM_STAGES,
    evidenceClassification: "SYNTHETIC_NON_EVIDENCE",
    externalEffects: false,
    canSatisfyExternalGate: false,
  };
}
