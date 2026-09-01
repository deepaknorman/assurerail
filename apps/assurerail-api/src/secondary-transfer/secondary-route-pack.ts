import {
  assertSha256Digest,
  exactMoney,
  exactUnitQuantity,
  sha256Digest,
  toCanonicalValue,
  type CanonicalValue,
  type FunctionPerformer,
} from "../contracts/v1";

export const CONVENTIONAL_SECONDARY_ROUTE_PACKS = Object.freeze({
  DA: Object.freeze({
    ref: "assurerail://route-packs/domestic-conventional-da-secondary-replay",
    version: "1.0.0",
    transactionRoute: "DA" as const,
    representation: "CONVENTIONAL" as const,
    lifecycleLeg: "SECONDARY_TRANSFER_OR_TRADE" as const,
    operatingModes: ["REPLAY", "SHADOW"] as const,
    executionMode: "OBSERVE_ONLY" as const,
  }),
  PTC: Object.freeze({
    ref: "assurerail://route-packs/domestic-conventional-ptc-secondary-replay",
    version: "1.0.0",
    transactionRoute: "PTC" as const,
    representation: "CONVENTIONAL" as const,
    lifecycleLeg: "SECONDARY_TRANSFER_OR_TRADE" as const,
    operatingModes: ["REPLAY", "SHADOW"] as const,
    executionMode: "OBSERVE_ONLY" as const,
  }),
});

export const SECONDARY_EVIDENCE_TYPES = [
  "CURRENT_HOLDER",
  "PRIOR_TRANSFER_CHAIN",
  "SELLER_AUTHORITY",
  "TRANSFER_RESTRICTIONS",
  "EXECUTED_TRANSFER_DOCUMENT",
  "NOTICE_AND_CONSENT",
  "CASH_SETTLEMENT",
  "AUTHORITATIVE_RECORD_BEFORE",
  "AUTHORITATIVE_RECORD_AFTER",
  "TRUSTEE_TRANSACTION_CONTROL",
] as const;

export type SecondaryEvidenceType = (typeof SECONDARY_EVIDENCE_TYPES)[number];
export type SecondaryRoute = keyof typeof CONVENTIONAL_SECONDARY_ROUTE_PACKS;

export interface SecondaryEvidenceFact {
  readonly id: string;
  readonly evidenceType: SecondaryEvidenceType;
  readonly evidenceResult: string;
  readonly assertionDigest: string;
  readonly providerInstitutionId: string;
}

export interface SecondaryPlanLeg {
  readonly legKey: string;
  readonly legType: string;
  readonly sequence: number;
  readonly performerInstitutionId: string;
  readonly performerClass: FunctionPerformer;
  readonly expectedEvidenceType: SecondaryEvidenceType;
  readonly expectedAssertionDigest: string;
  readonly evidenceRecordId: string;
  readonly comparisonDigest: string;
}

const REQUIRED: Readonly<Record<SecondaryRoute, readonly SecondaryEvidenceType[]>> = {
  DA: [
    "CURRENT_HOLDER", "PRIOR_TRANSFER_CHAIN", "SELLER_AUTHORITY", "TRANSFER_RESTRICTIONS",
    "EXECUTED_TRANSFER_DOCUMENT", "NOTICE_AND_CONSENT", "CASH_SETTLEMENT",
    "AUTHORITATIVE_RECORD_BEFORE", "AUTHORITATIVE_RECORD_AFTER",
  ],
  PTC: [
    "CURRENT_HOLDER", "PRIOR_TRANSFER_CHAIN", "SELLER_AUTHORITY", "TRANSFER_RESTRICTIONS",
    "EXECUTED_TRANSFER_DOCUMENT", "NOTICE_AND_CONSENT", "CASH_SETTLEMENT",
    "TRUSTEE_TRANSACTION_CONTROL", "AUTHORITATIVE_RECORD_BEFORE", "AUTHORITATIVE_RECORD_AFTER",
  ],
};

const LEG_META: Readonly<Record<SecondaryEvidenceType, { key: string; type: string; sequence: number; performer: FunctionPerformer }>> = {
  CURRENT_HOLDER: { key: "current-holder", type: "CURRENT_HOLDER_VERIFICATION", sequence: 10, performer: "EXTERNAL_AUTHORITY" },
  PRIOR_TRANSFER_CHAIN: { key: "prior-chain", type: "PRIOR_CHAIN_VERIFICATION", sequence: 20, performer: "EXTERNAL_AUTHORITY" },
  SELLER_AUTHORITY: { key: "seller-authority", type: "SELLER_AUTHORITY", sequence: 30, performer: "PARTICIPANT_OWNED" },
  TRANSFER_RESTRICTIONS: { key: "transfer-restrictions", type: "TRANSFER_RESTRICTIONS", sequence: 40, performer: "EXTERNAL_AUTHORITY" },
  EXECUTED_TRANSFER_DOCUMENT: { key: "executed-document", type: "DOCUMENT_EXECUTION", sequence: 50, performer: "PARTICIPANT_OWNED" },
  NOTICE_AND_CONSENT: { key: "notice-and-consent", type: "NOTICE_OR_CONSENT", sequence: 60, performer: "PARTICIPANT_OWNED" },
  CASH_SETTLEMENT: { key: "cash-settlement", type: "CASH_SETTLEMENT", sequence: 70, performer: "PARTICIPANT_OWNED" },
  TRUSTEE_TRANSACTION_CONTROL: { key: "trustee-control", type: "TRUSTEE_TRANSACTION_CONTROL", sequence: 80, performer: "EXTERNAL_AUTHORITY" },
  AUTHORITATIVE_RECORD_BEFORE: { key: "record-before", type: "AUTHORITATIVE_RECORD_BEFORE", sequence: 90, performer: "EXTERNAL_AUTHORITY" },
  AUTHORITATIVE_RECORD_AFTER: { key: "record-after", type: "AUTHORITATIVE_RECORD_AFTER", sequence: 100, performer: "EXTERNAL_AUTHORITY" },
};

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

export function normaliseSecondaryValues(input: {
  quantity?: { unitCode?: unknown; units?: unknown; scale?: unknown };
  consideration?: { currency?: unknown; units?: unknown; scale?: unknown };
}) {
  const quantity = exactUnitQuantity({
    unitCode: input.quantity?.unitCode,
    units: input.quantity?.units,
    scale: input.quantity?.scale,
  });
  const consideration = exactMoney({
    currency: input.consideration?.currency,
    units: input.consideration?.units,
    scale: input.consideration?.scale,
  });
  if (BigInt(quantity.units) <= 0n) throw new Error("quantity units must be positive");
  if (BigInt(consideration.units) <= 0n) throw new Error("consideration units must be positive");
  return { quantity, consideration };
}

export function buildSecondaryReplayPlan(input: {
  route: SecondaryRoute;
  sellerInstitutionId: string;
  buyerInstitutionId: string;
  trusteeInstitutionId?: string | null;
  recordkeeperInstitutionId: string;
  instrumentDigest: string;
  evidence: readonly SecondaryEvidenceFact[];
}): readonly SecondaryPlanLeg[] {
  const seller = requiredText(input.sellerInstitutionId, "sellerInstitutionId");
  const buyer = requiredText(input.buyerInstitutionId, "buyerInstitutionId");
  const recordkeeper = requiredText(input.recordkeeperInstitutionId, "recordkeeperInstitutionId");
  if (seller === buyer) throw new Error("seller and buyer must be distinct institutions");
  assertSha256Digest(input.instrumentDigest, "instrumentDigest");
  const latest = new Map(input.evidence.map((fact) => [fact.evidenceType, fact]));
  const requiredTypes = REQUIRED[input.route];
  for (const evidenceType of requiredTypes) {
    const fact = latest.get(evidenceType);
    if (!fact) throw new Error(`required ${evidenceType} evidence remains open`);
    if (fact.evidenceResult !== "VERIFIED") throw new Error(`${evidenceType} evidence is not VERIFIED`);
    assertSha256Digest(fact.assertionDigest, `${evidenceType}.assertionDigest`);
  }
  if (input.route === "PTC" && !requiredText(input.trusteeInstitutionId, "trusteeInstitutionId")) {
    throw new Error("PTC secondary replay requires a trustee institution");
  }

  return Object.freeze(requiredTypes.map((evidenceType) => {
    const fact = latest.get(evidenceType)!;
    const meta = LEG_META[evidenceType];
    const performerInstitutionId = evidenceType === "SELLER_AUTHORITY" || evidenceType === "EXECUTED_TRANSFER_DOCUMENT"
      || evidenceType === "NOTICE_AND_CONSENT" || evidenceType === "CASH_SETTLEMENT"
      ? seller
      : evidenceType === "TRUSTEE_TRANSACTION_CONTROL"
        ? requiredText(input.trusteeInstitutionId, "trusteeInstitutionId")
        : recordkeeper;
    return Object.freeze({
      legKey: meta.key,
      legType: meta.type,
      sequence: meta.sequence,
      performerInstitutionId,
      performerClass: meta.performer,
      expectedEvidenceType: evidenceType,
      expectedAssertionDigest: fact.assertionDigest,
      evidenceRecordId: fact.id,
      comparisonDigest: sha256Digest(toCanonicalValue({
        evidenceResult: fact.evidenceResult,
        evidenceType,
        providerInstitutionId: fact.providerInstitutionId,
        assertionDigest: fact.assertionDigest,
      }) as CanonicalValue),
    });
  }));
}

export function compareSecondaryAuthority(input: {
  route: SecondaryRoute;
  evidence: readonly SecondaryEvidenceFact[];
}): { matched: boolean; breakCode: string | null; expectedDigest: string; observedDigest: string } {
  const latest = new Map(input.evidence.map((fact) => [fact.evidenceType, fact]));
  const before = latest.get("AUTHORITATIVE_RECORD_BEFORE")?.assertionDigest ?? "";
  const after = latest.get("AUTHORITATIVE_RECORD_AFTER")?.assertionDigest ?? "";
  if (!before || !after) return { matched: false, breakCode: "AUTHORITATIVE_RECORD_EVIDENCE_MISSING", expectedDigest: before, observedDigest: after };
  if (before === after) return { matched: false, breakCode: "AUTHORITATIVE_RECORD_UNCHANGED", expectedDigest: before, observedDigest: after };
  if (input.route === "PTC") {
    const trustee = latest.get("TRUSTEE_TRANSACTION_CONTROL")?.assertionDigest ?? "";
    if (!trustee || trustee !== after) {
      return { matched: false, breakCode: "PTC_TRUSTEE_RECORDKEEPER_DISAGREEMENT", expectedDigest: trustee, observedDigest: after };
    }
  }
  return { matched: true, breakCode: null, expectedDigest: after, observedDigest: after };
}
