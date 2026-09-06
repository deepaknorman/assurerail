import { createHash } from "node:crypto";

/**
 * Provider-boundary wire contracts used by Rail adapters and deterministic fixtures.
 *
 * These types do not make AssurePool or AssureTransfer part of AssureRail. Production adapters must
 * negotiate an independently versioned provider contract and validate the received wire payload.
 */

export type CanonicalJsonValue = null | boolean | number | string | CanonicalJsonValue[] | {
  readonly [key: string]: CanonicalJsonValue;
};

function canonicalValue(value: unknown): unknown {
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(source).sort()) {
      Object.defineProperty(output, key, {
        value: canonicalValue(source[key]),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return output;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashObject(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export const SUPPORTED_ASSUREPOOL_TAPE_VERSION = "1.0";

export type PoolVerdict =
  | "ELIGIBLE"
  | "HARD_EXCLUDE"
  | "MISSING_EVIDENCE"
  | "POLICY_VARIANCE"
  | "WARNING";

export interface TapeInputPoolV1 {
  readonly poolId: string;
  readonly claId: string;
  readonly cutoffDate: string;
  readonly manifestHash: string;
  readonly frozenAt: string;
}

export interface TapeInputLoanV1 {
  readonly loanRef: string;
  readonly verdict: PoolVerdict;
  readonly overridden: boolean;
  readonly overrideReason?: string | null;
  readonly disbursedMinor?: string;
  readonly originationDate?: string;
  readonly classificationBucket?: string;
  readonly obligorRef?: string;
  readonly fullRecordForCommitment?: unknown;
}

export interface TapeLockV1 {
  readonly state: string;
  readonly reference: string;
  readonly loanCount: number;
}

export interface TapeLoanV1 {
  readonly loanRef: string;
  readonly verdict: PoolVerdict;
  readonly overridden: boolean;
  readonly overrideReason?: string | null;
  readonly mintable: boolean;
  readonly disbursedMinor?: string;
  readonly originationDate?: string;
  readonly classificationBucket?: string;
  readonly obligorRef?: string;
  readonly commitment: string;
}

export interface AssurePoolTapeV1 {
  readonly tapeVersion: string;
  readonly poolId: string;
  readonly claId: string;
  readonly cutoffDate: string;
  readonly manifestHash: string;
  readonly frozenAt: string;
  readonly aggregates: {
    readonly loanCount: number;
    readonly mintableCount: number;
    readonly totalMinor: string;
    readonly mintableMinor: string;
    readonly mintableShareBps: number;
  };
  readonly loans: readonly TapeLoanV1[];
  readonly lock?: TapeLockV1;
  readonly excludes: string;
  readonly tapeHash: string;
}

interface ManifestLoanV1 {
  readonly loanRef: string;
  readonly verdict: PoolVerdict;
  readonly overridden: boolean;
  readonly overrideReason?: string | null;
  readonly disbursedMinor?: string | null;
  readonly originationDate?: string | null;
  readonly classificationBucket?: string | null;
}

export function computePoolManifestV1(loans: readonly ManifestLoanV1[]): string {
  const records = [...loans]
    .sort((left, right) => left.loanRef.localeCompare(right.loanRef))
    .map((loan) => ({
      loanRef: loan.loanRef,
      verdict: loan.verdict,
      overridden: loan.overridden,
      overrideReason: loan.overrideReason ?? null,
      disbursedMinor: loan.disbursedMinor ?? null,
      originationDate: loan.originationDate ?? null,
      classificationBucket: loan.classificationBucket ?? null,
    }));
  return `sha256:${hashObject(records)}`;
}

function isQualifiedForFixture(verdict: PoolVerdict, overridden: boolean): boolean {
  return verdict === "ELIGIBLE" || verdict === "WARNING" || overridden;
}

/** Build deterministic non-production fixtures conforming to the AssurePool v1 wire profile. */
export function buildAssurePoolTapeFixtureV1(
  pool: TapeInputPoolV1,
  loans: readonly TapeInputLoanV1[],
  lock?: TapeLockV1,
): AssurePoolTapeV1 {
  let totalMinor = 0n;
  let mintableMinor = 0n;
  let mintableCount = 0;
  const tapeLoans = loans.map((loan): TapeLoanV1 => {
    const amount = BigInt(loan.disbursedMinor ?? "0");
    const mintable = isQualifiedForFixture(loan.verdict, loan.overridden);
    totalMinor += amount;
    if (mintable) {
      mintableMinor += amount;
      mintableCount += 1;
    }
    const commitment = sha256Hex(canonicalJson(loan.fullRecordForCommitment ?? {
      loanRef: loan.loanRef,
      verdict: loan.verdict,
      disbursedMinor: loan.disbursedMinor,
      originationDate: loan.originationDate,
      classificationBucket: loan.classificationBucket,
    }));
    return {
      loanRef: loan.loanRef,
      verdict: loan.verdict,
      overridden: loan.overridden,
      overrideReason: loan.overrideReason ?? undefined,
      mintable,
      disbursedMinor: loan.disbursedMinor,
      originationDate: loan.originationDate,
      classificationBucket: loan.classificationBucket,
      obligorRef: loan.obligorRef,
      commitment,
    };
  });
  const body = {
    tapeVersion: SUPPORTED_ASSUREPOOL_TAPE_VERSION,
    poolId: pool.poolId,
    claId: pool.claId,
    cutoffDate: pool.cutoffDate,
    manifestHash: pool.manifestHash,
    frozenAt: pool.frozenAt,
    aggregates: {
      loanCount: loans.length,
      mintableCount,
      totalMinor: totalMinor.toString(),
      mintableMinor: mintableMinor.toString(),
      mintableShareBps: totalMinor > 0n ? Number((mintableMinor * 10_000n) / totalMinor) : 0,
    },
    loans: tapeLoans,
    lock,
    excludes: "T2 (loan-level PII, bank balances) stays off-chain, encrypted; regulator break-glass only",
  };
  return { ...body, tapeHash: `sha256:${hashObject(body)}` };
}

export type DirectionFamily =
  | "COMMERCIAL_BANK_TDCR_2025"
  | "NBFC_TDCR_2025"
  | "AIFI_TDCR_2025"
  | "SMALL_FINANCE_BANK_TDCR_2025"
  | "HISTORICAL_TLE_2021"
  | "ROUTE_REVIEW_REQUIRED";

export type EntityIdentifierType =
  | "GSTIN"
  | "PAN"
  | "LEGAL_ENTITY_IDENTIFIER"
  | "GOVERNMENT_ENTITY_CODE"
  | "VERIFIED_INTERNAL_ENTITY_ID";

export interface EntityIdentifierV1 {
  readonly type: EntityIdentifierType;
  readonly value: string;
}

export interface PriorTransferV1 {
  readonly sequenceNumber: number;
  readonly transferId: string;
  readonly transferorEntityId: string;
  readonly transfereeEntityId: string;
  readonly transferDate: string;
  readonly evidenceHash: string;
}

export interface TapeReceivableV1 {
  readonly tenantId: string;
  readonly exposureRef: string;
  readonly exposureType:
    | "LOAN_SECURED_BY_RECEIVABLES"
    | "FACTORING_RECEIVABLE_ASSIGNMENT"
    | "TREDS_FINANCED_RECEIVABLE"
    | "NEGOTIABLE_INSTRUMENT_RECEIVABLE_REVIEW_REQUIRED";
  readonly supplierIdentifier: EntityIdentifierV1;
  readonly draweeIdentifier: EntityIdentifierV1;
  readonly invoiceNumber: string;
  readonly invoiceDate: string;
  readonly faceAmountMinor: string;
  readonly irn?: string;
  readonly acceptanceState:
    | "UNACCEPTED"
    | "NO_DISPUTE_OBSERVED"
    | "CONTRACTUALLY_DEEMED_ACCEPTED"
    | "EXPLICITLY_ACCEPTED"
    | "DISPUTED"
    | "REVOKED";
  readonly originationDate: string;
  readonly dueDate: string;
  readonly submittedResidualMaturityDays?: number;
  readonly priorTransfers: readonly PriorTransferV1[];
}

export interface TransferPartyV1 {
  readonly partyId: string;
  readonly role: "TRANSFEROR" | "TRANSFEREE";
  readonly governingRuleSetId: DirectionFamily;
}

export interface TransferTransactionV1 {
  readonly tenantId: string;
  readonly transferId: string;
  readonly transactionDate: string;
  readonly transferor: TransferPartyV1;
  readonly transferee: TransferPartyV1;
  readonly exposures: readonly TapeReceivableV1[];
}

export interface FrozenReceivablesManifestV1 {
  readonly version: number;
  readonly tenantId: string;
  readonly transferId: string;
  readonly exposureRefs: readonly string[];
  readonly fingerprintDigests: readonly string[];
  readonly tapeDigests: readonly string[];
  readonly manifestHash: string;
}

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

function invoiceFingerprint(exposure: TapeReceivableV1): string {
  if (!/^[1-9][0-9]*$/.test(exposure.faceAmountMinor)) {
    throw new Error("faceAmountMinor must be a positive minor-unit string");
  }
  const preimage = canonicalJson({
    version: "INVOICE-FP-1",
    supplier: {
      type: exposure.supplierIdentifier.type,
      value: normalize(exposure.supplierIdentifier.value),
    },
    drawee: {
      type: exposure.draweeIdentifier.type,
      value: normalize(exposure.draweeIdentifier.value),
    },
    invoiceNumber: normalize(exposure.invoiceNumber),
    invoiceDate: exposure.invoiceDate,
    faceAmountMinor: exposure.faceAmountMinor,
    irn: exposure.irn ? normalize(exposure.irn) : null,
  });
  return `sha256:${sha256Hex(preimage)}`;
}

/** Build deterministic non-production fixtures conforming to the receivables manifest v1 profile. */
export function buildReceivablesManifestFixtureV1(
  tenantId: string,
  transferId: string,
  exposures: readonly TapeReceivableV1[],
  version = 1,
): FrozenReceivablesManifestV1 {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("manifest version must be a positive integer");
  }
  const rows = exposures.map((exposure) => ({
    exposureRef: exposure.exposureRef,
    fingerprintDigest: invoiceFingerprint(exposure),
    tapeDigest: `sha256:${hashObject(exposure)}`,
  })).sort((left, right) => left.exposureRef.localeCompare(right.exposureRef));
  if (new Set(rows.map((row) => row.exposureRef)).size !== rows.length) {
    throw new Error("duplicate exposure reference in manifest");
  }
  const body = {
    version,
    tenantId,
    transferId,
    exposureRefs: rows.map((row) => row.exposureRef),
    fingerprintDigests: rows.map((row) => row.fingerprintDigest),
    tapeDigests: rows.map((row) => row.tapeDigest),
  };
  return { ...body, manifestHash: `sha256:${hashObject(body)}` };
}
