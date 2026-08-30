import {
  assertSha256Digest,
  exactMoney,
  sha256Digest,
  toCanonicalValue,
  type CanonicalValue,
} from "../contracts/v1";

export const CONVENTIONAL_DA_ROUTE_PACK = Object.freeze({
  ref: "assurerail://route-packs/domestic-conventional-da-replay",
  version: "1.0.0",
  transactionRoute: "DA",
  representation: "CONVENTIONAL",
  jurisdiction: "IN",
  marketContext: "DOMESTIC",
  placementOrListing: "BILATERAL",
  lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
  operatingModes: ["REPLAY", "SHADOW"] as const,
  requiredPartyRoles: ["TRANSFEROR", "TRANSFEREE"] as const,
  requiredEvidenceTypes: [
    "TRANSFEREE_CREDIT_DECISION",
    "EXECUTED_TRANSFER_DOCUMENT",
  ] as const,
  requiredLegTypes: [
    "TRANSFEREE_CREDIT_DECISION",
    "DOCUMENT_EXECUTION",
    "CASH_CONSIDERATION",
    "TRANSFEROR_SOURCE_UPDATE",
    "TRANSFEREE_SOURCE_UPDATE",
    "AUTHORITATIVE_REGISTER_UPDATE",
  ] as const,
  prohibitedAutomaticParties: ["TRUSTEE", "ASSURANCE_PROVIDER"] as const,
  executionMode: "OBSERVE_ONLY" as const,
});

export type DaLegType =
  | (typeof CONVENTIONAL_DA_ROUTE_PACK.requiredLegTypes)[number]
  | "REQUIRED_NOTICE";

export interface DaReplayNoticePlan {
  readonly noticeType: string;
  readonly recipientInstitutionId: string;
  readonly expectedAcknowledgementDigest: string;
}

export interface DaSagaPlanInput {
  readonly transferorInstitutionId: string;
  readonly transfereeInstitutionId: string;
  readonly recordkeeperInstitutionId: string;
  readonly legalMechanism: string;
  readonly consideration: {
    readonly currency: unknown;
    readonly units: unknown;
    readonly scale: unknown;
  };
  readonly transfereeCreditDecisionDigest: string;
  readonly executedTransferDocumentDigest: string;
  readonly expectedOutcome: {
    readonly transferredAssetDigest: string;
    readonly considerationReference: string;
    readonly transferorSourceAfterDigest: string;
    readonly transfereeSourceAfterDigest: string;
    readonly authoritativeRecordAfterDigest: string;
  };
  readonly authoritativeRecord: {
    readonly recordType: string;
    readonly recordReference: string;
    readonly beforeDigest: string;
  };
  readonly notices: readonly DaReplayNoticePlan[];
}

export interface PlannedDaLeg {
  readonly legKey: string;
  readonly legType: DaLegType;
  readonly sequence: number;
  readonly required: true;
  readonly participantOwnerInstitutionId: string;
  readonly performerClass: "PARTICIPANT_OWNED" | "EXTERNAL_AUTHORITY";
  readonly expected: CanonicalValue;
  readonly expectedDigest: string;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${field} is required`);
  return value.trim();
}

function digest(value: unknown, field: string): string {
  return assertSha256Digest(value, field);
}

/**
 * Produces the immutable, ordered, non-mutating completion plan. The transferee owns its credit
 * decision. The route does not inject a trustee or assurance provider merely because other Rail
 * routes may use them.
 */
export function buildConventionalDaSagaPlan(
  input: DaSagaPlanInput
): readonly PlannedDaLeg[] {
  const transferor = requiredText(
    input.transferorInstitutionId,
    "transferorInstitutionId"
  );
  const transferee = requiredText(
    input.transfereeInstitutionId,
    "transfereeInstitutionId"
  );
  const recordkeeper = requiredText(
    input.recordkeeperInstitutionId,
    "recordkeeperInstitutionId"
  );
  if (transferor === transferee)
    throw new Error("transferor and transferee must be distinct institutions");
  const consideration = exactMoney(input.consideration);
  if (BigInt(consideration.units) <= 0n)
    throw new Error("consideration units must be positive");
  const legalMechanism = requiredText(input.legalMechanism, "legalMechanism");
  const recordType = requiredText(
    input.authoritativeRecord.recordType,
    "authoritativeRecord.recordType"
  );
  const recordReference = requiredText(
    input.authoritativeRecord.recordReference,
    "authoritativeRecord.recordReference"
  );
  const expected = {
    transferredAssetDigest: digest(
      input.expectedOutcome.transferredAssetDigest,
      "expectedOutcome.transferredAssetDigest"
    ),
    considerationReference: requiredText(
      input.expectedOutcome.considerationReference,
      "expectedOutcome.considerationReference"
    ),
    transferorSourceAfterDigest: digest(
      input.expectedOutcome.transferorSourceAfterDigest,
      "expectedOutcome.transferorSourceAfterDigest"
    ),
    transfereeSourceAfterDigest: digest(
      input.expectedOutcome.transfereeSourceAfterDigest,
      "expectedOutcome.transfereeSourceAfterDigest"
    ),
    authoritativeRecordAfterDigest: digest(
      input.expectedOutcome.authoritativeRecordAfterDigest,
      "expectedOutcome.authoritativeRecordAfterDigest"
    ),
  };
  const legs: Array<Omit<PlannedDaLeg, "expectedDigest">> = [
    {
      legKey: "transferee-credit-decision",
      legType: "TRANSFEREE_CREDIT_DECISION",
      sequence: 10,
      required: true,
      participantOwnerInstitutionId: transferee,
      performerClass: "PARTICIPANT_OWNED",
      expected: toCanonicalValue({
        decisionEvidenceDigest: digest(
          input.transfereeCreditDecisionDigest,
          "transfereeCreditDecisionDigest"
        ),
        decisionOwnerInstitutionId: transferee,
      }),
    },
    {
      legKey: "executed-transfer-document",
      legType: "DOCUMENT_EXECUTION",
      sequence: 20,
      required: true,
      participantOwnerInstitutionId: transferor,
      performerClass: "PARTICIPANT_OWNED",
      expected: toCanonicalValue({
        documentDigest: digest(
          input.executedTransferDocumentDigest,
          "executedTransferDocumentDigest"
        ),
        legalMechanism,
        transferredAssetDigest: expected.transferredAssetDigest,
      }),
    },
    {
      legKey: "cash-consideration",
      legType: "CASH_CONSIDERATION",
      sequence: 30,
      required: true,
      participantOwnerInstitutionId: transferee,
      performerClass: "PARTICIPANT_OWNED",
      expected: toCanonicalValue({
        consideration,
        considerationReference: expected.considerationReference,
        payerInstitutionId: transferee,
        payeeInstitutionId: transferor,
      }),
    },
    {
      legKey: "transferor-source-update",
      legType: "TRANSFEROR_SOURCE_UPDATE",
      sequence: 40,
      required: true,
      participantOwnerInstitutionId: transferor,
      performerClass: "PARTICIPANT_OWNED",
      expected: toCanonicalValue({
        afterDigest: expected.transferorSourceAfterDigest,
        institutionId: transferor,
        transferredAssetDigest: expected.transferredAssetDigest,
      }),
    },
    {
      legKey: "transferee-source-update",
      legType: "TRANSFEREE_SOURCE_UPDATE",
      sequence: 50,
      required: true,
      participantOwnerInstitutionId: transferee,
      performerClass: "PARTICIPANT_OWNED",
      expected: toCanonicalValue({
        afterDigest: expected.transfereeSourceAfterDigest,
        institutionId: transferee,
        transferredAssetDigest: expected.transferredAssetDigest,
      }),
    },
    {
      legKey: "authoritative-register-update",
      legType: "AUTHORITATIVE_REGISTER_UPDATE",
      sequence: 60,
      required: true,
      participantOwnerInstitutionId: recordkeeper,
      performerClass: "EXTERNAL_AUTHORITY",
      expected: toCanonicalValue({
        afterDigest: expected.authoritativeRecordAfterDigest,
        beforeDigest: digest(
          input.authoritativeRecord.beforeDigest,
          "authoritativeRecord.beforeDigest"
        ),
        recordReference,
        recordType,
        transferredAssetDigest: expected.transferredAssetDigest,
      }),
    },
  ];
  const noticeKeys = new Set<string>();
  for (const [index, notice] of input.notices.entries()) {
    const noticeType = requiredText(
      notice.noticeType,
      `notices[${index}].noticeType`
    ).toUpperCase();
    const recipientInstitutionId = requiredText(
      notice.recipientInstitutionId,
      `notices[${index}].recipientInstitutionId`
    );
    const legKey = `notice:${noticeType.toLowerCase()}:${recipientInstitutionId}`;
    if (noticeKeys.has(legKey))
      throw new Error(`duplicate notice plan: ${legKey}`);
    noticeKeys.add(legKey);
    legs.push({
      legKey,
      legType: "REQUIRED_NOTICE",
      sequence: 70 + index,
      required: true,
      participantOwnerInstitutionId: transferor,
      performerClass: "PARTICIPANT_OWNED",
      expected: toCanonicalValue({
        acknowledgementDigest: digest(
          notice.expectedAcknowledgementDigest,
          `notices[${index}].expectedAcknowledgementDigest`
        ),
        noticeType,
        recipientInstitutionId,
      }),
    });
  }
  return Object.freeze(
    legs.map((leg) =>
      Object.freeze({ ...leg, expectedDigest: sha256Digest(leg.expected) })
    )
  );
}

export interface ObservationDifference {
  readonly path: string;
  readonly expected: CanonicalValue | undefined;
  readonly observed: CanonicalValue | undefined;
}

function walkDifferences(
  expected: CanonicalValue | undefined,
  observed: CanonicalValue | undefined,
  path: string,
  differences: ObservationDifference[]
): void {
  if (expected === undefined || observed === undefined) {
    differences.push({ path, expected, observed });
    return;
  }
  if (Array.isArray(expected) || Array.isArray(observed)) {
    if (
      !Array.isArray(expected) ||
      !Array.isArray(observed) ||
      sha256Digest(expected) !== sha256Digest(observed)
    ) {
      differences.push({ path, expected, observed });
    }
    return;
  }
  if (
    expected !== null &&
    observed !== null &&
    typeof expected === "object" &&
    typeof observed === "object"
  ) {
    const left = expected as Readonly<Record<string, CanonicalValue>>;
    const right = observed as Readonly<Record<string, CanonicalValue>>;
    for (const key of [
      ...new Set([...Object.keys(left), ...Object.keys(right)]),
    ].sort()) {
      walkDifferences(left[key], right[key], `${path}.${key}`, differences);
    }
    return;
  }
  if (expected !== observed) differences.push({ path, expected, observed });
}

export function compareDaLegObservation(
  expectedInput: unknown,
  observedInput: unknown
): {
  readonly result: "MATCHED" | "BREAK_OPEN";
  readonly expected: CanonicalValue;
  readonly observed: CanonicalValue;
  readonly expectedDigest: string;
  readonly observedDigest: string;
  readonly differences: readonly ObservationDifference[];
} {
  const expected = toCanonicalValue(expectedInput);
  const observed = toCanonicalValue(observedInput);
  const differences: ObservationDifference[] = [];
  walkDifferences(expected, observed, "$", differences);
  return {
    result: differences.length === 0 ? "MATCHED" : "BREAK_OPEN",
    expected,
    observed,
    expectedDigest: sha256Digest(expected),
    observedDigest: sha256Digest(observed),
    differences,
  };
}

export function deriveDaSagaState(
  legs: readonly { required: boolean; state: string }[],
  openBreakCount: number
): "READY" | "EXECUTING" | "OBSERVED" | "RECONCILED" | "BREAK_OPEN" {
  if (openBreakCount > 0 || legs.some((leg) => leg.state === "BREAK_OPEN"))
    return "BREAK_OPEN";
  const required = legs.filter((leg) => leg.required);
  if (required.length === 0 || required.every((leg) => leg.state === "PLANNED"))
    return "READY";
  if (required.every((leg) => leg.state === "RECONCILED")) return "RECONCILED";
  if (required.every((leg) => ["OBSERVED", "RECONCILED"].includes(leg.state)))
    return "OBSERVED";
  return "EXECUTING";
}
