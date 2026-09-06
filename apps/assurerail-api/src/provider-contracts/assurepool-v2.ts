import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { canonicalJson, hashObject } from "./v1";

export const ASSUREPOOL_PROVIDER_PROFILE_V2 =
  "assurepool.frozen-da-evidence/2.0" as const;
export const ASSUREPOOL_TAPE_V2_VERSION = "2.0" as const;
export const ASSUREPOOL_PERFORMANCE_SNAPSHOT_VERSION = "1.0" as const;
export const ASSUREPOOL_PROVIDER_ENVELOPE_V2 =
  "assurepool.provider-envelope/2.0" as const;

export type PoolVerdictV2 =
  | "ELIGIBLE"
  | "HARD_EXCLUDE"
  | "MISSING_EVIDENCE"
  | "POLICY_VARIANCE"
  | "WARNING";
export type PslEvidenceStateV2 =
  | "VERIFIED"
  | "UNVERIFIED"
  | "FAILED"
  | "NOT_CLAIMED";

export interface AssurePoolTapeLoanV2 {
  readonly loanRef: string;
  readonly verdict: PoolVerdictV2;
  readonly overridden: boolean;
  readonly overrideReason: string | null;
  readonly includedInTransferSet: boolean;
  readonly disbursedMinor: string | null;
  readonly originationDate: string | null;
  readonly classificationBucket: string | null;
  readonly obligorRef: string | null;
  readonly pslTag: string | null;
  readonly pslEvidenceState: PslEvidenceStateV2;
  readonly interestRateBps: number | null;
  readonly product: string;
  readonly stateCode: string;
  readonly resolution: {
    readonly restructured: boolean | null;
    readonly writtenOff: boolean | null;
    readonly settledOts: boolean | null;
  };
  readonly encumbrance: {
    readonly onBookStatus: "ON_BOOK" | "SOLD" | "PARTIAL" | "UNKNOWN";
    readonly regulatoryReportingStatus: "ON_BOOK" | "SECURITISED" | "UNKNOWN";
    readonly cersaiChargePresent: boolean;
    readonly chargeRank: "FIRST" | "SECOND" | "PARI_PASSU" | "UNKNOWN" | null;
    readonly crossPoolSeen: boolean;
    readonly sourceMode: "LIVE" | "DEMO";
    readonly asOfAt: string;
  } | null;
  readonly commitment: string;
}

export interface AssurePoolTapeV2 {
  readonly profileId: typeof ASSUREPOOL_PROVIDER_PROFILE_V2;
  readonly tapeVersion: typeof ASSUREPOOL_TAPE_V2_VERSION;
  readonly poolId: string;
  readonly sourceArrangementRef: string;
  readonly cutoffDate: string;
  readonly frozenAt: string;
  readonly sourceLegacyManifestHash: string;
  readonly manifestHash: string;
  readonly aggregates: {
    readonly loanCount: number;
    readonly includedCount: number;
    readonly totalMinor: string;
    readonly includedMinor: string;
    readonly includedShareBps: number;
    readonly pslVerifiedMinor: string;
    readonly pslVerifiedShareBps: number;
    readonly wacBps: number;
    readonly wacCoverageBps: number;
    readonly productMixMinor: Readonly<Record<string, string>>;
    readonly stateMixMinor: Readonly<Record<string, string>>;
    readonly restructuredMinor: string;
  };
  readonly loans: readonly AssurePoolTapeLoanV2[];
  readonly lock: {
    readonly state: string;
    readonly reference: string;
    readonly loanCount: number;
  } | null;
  readonly exclusions: readonly string[];
  readonly tapeHash: string;
}

export interface AssurePoolEvidencePackageV2 {
  readonly profileId: typeof ASSUREPOOL_PROVIDER_PROFILE_V2;
  readonly packageVersion: "2.0";
  readonly generatedAt: string;
  readonly tape: AssurePoolTapeV2;
  readonly performance: {
    readonly snapshotVersion: typeof ASSUREPOOL_PERFORMANCE_SNAPSHOT_VERSION;
    readonly generatedAt: string;
    readonly poolId: string;
    readonly sourceAsOfCycle: string | null;
    readonly result: Readonly<Record<string, unknown>>;
    readonly resultDigest: string;
  };
  readonly packageDigest: string;
}

export interface AssurePoolProviderEnvelopeV2 {
  readonly envelopeVersion: typeof ASSUREPOOL_PROVIDER_ENVELOPE_V2;
  readonly providerId: string;
  readonly algorithm: "Ed25519";
  readonly keyId: string;
  readonly payloadDigest: string;
  readonly signature: string;
  readonly payload: AssurePoolEvidencePackageV2;
}

declare const verifiedProviderEnvelopeBrand: unique symbol;
/** Available only from this module's complete parser/verifier. */
export type VerifiedAssurePoolProviderEnvelopeV2 = AssurePoolProviderEnvelopeV2 & {
  readonly [verifiedProviderEnvelopeBrand]: true;
};

export interface AssurePoolProviderVerificationOptions {
  readonly expectedProviderId: string;
  /** Keyed by the SHA-256 SPKI fingerprint prefix used as keyId. */
  readonly publicKeysById: Readonly<Record<string, string>>;
  readonly operatingMode:
    | "DEMO"
    | "REPLAY"
    | "SHADOW"
    | "SANDBOX"
    | "CONTROLLED_LIVE"
    | "PRODUCTION";
}

export interface AssurePoolProviderVerificationV2 {
  readonly ok: boolean;
  readonly reasons: readonly string[];
  readonly envelope?: VerifiedAssurePoolProviderEnvelopeV2;
}

const MINOR = /^(0|[1-9]\d*)$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const KEY_ID = /^[0-9a-f]{32}$/;
const STATE_CODE = /^(?:UNSPECIFIED|[A-Z]{2})$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const VERDICTS = new Set<PoolVerdictV2>([
  "ELIGIBLE",
  "HARD_EXCLUDE",
  "MISSING_EVIDENCE",
  "POLICY_VARIANCE",
  "WARNING",
]);
const DPD_BUCKETS = ["CURRENT", "SMA_0", "SMA_1", "SMA_2", "NPA"] as const;

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string
): void {
  const expected = new Set(keys);
  const missing = keys.filter((key) => !Object.hasOwn(value, key));
  const extra = Object.keys(value).filter((key) => !expected.has(key));
  if (missing.length || extra.length) {
    throw new Error(
      `${path} fields are invalid (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`
    );
  }
}

function text(value: unknown, path: string, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${path} must be a non-empty string of at most ${max} characters`);
  }
  return value;
}

function nullableText(value: unknown, path: string, max = 500): string | null {
  return value === null ? null : text(value, path, max);
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be boolean`);
  return value;
}

function nullableBool(value: unknown, path: string): boolean | null {
  return value === null ? null : bool(value, path);
}

function integer(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${path} must be an integer between ${min} and ${max}`);
  }
  return value as number;
}

function nullableInteger(value: unknown, path: string, min: number, max: number): number | null {
  return value === null ? null : integer(value, path, min, max);
}

function minor(value: unknown, path: string): string {
  if (typeof value !== "string" || !MINOR.test(value)) {
    throw new Error(`${path} must be a canonical non-negative minor-unit string`);
  }
  return value;
}

function nullableMinor(value: unknown, path: string): string | null {
  return value === null ? null : minor(value, path);
}

function digest(value: unknown, path: string): string {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw new Error(`${path} must be a sha256 digest`);
  }
  return value;
}

function instant(value: unknown, path: string): string {
  if (typeof value !== "string" || !INSTANT.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${path} must be a UTC ISO-8601 instant`);
  }
  return value;
}

function date(value: unknown, path: string): string {
  if (typeof value !== "string" || !DATE.test(value)) throw new Error(`${path} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${path} must be a calendar-valid date`);
  }
  return value;
}

function month(value: unknown, path: string): string {
  if (typeof value !== "string" || !MONTH.test(value)) throw new Error(`${path} must be YYYY-MM`);
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${path} must be one of ${values.join(", ")}`);
  }
  return value as T;
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value.map((item, index) => text(item, `${path}[${index}]`, 2_000));
}

function parseMinorMap(value: unknown, path: string): Record<string, string> {
  const input = record(value, path);
  const result = Object.create(null) as Record<string, string>;
  for (const [key, amount] of Object.entries(input)) {
    text(key, `${path} key`, 200);
    Object.defineProperty(result, key, {
      value: minor(amount, `${path}.${key}`),
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return result;
}

function parseLoan(value: unknown, index: number): AssurePoolTapeLoanV2 {
  const path = `payload.tape.loans[${index}]`;
  const loan = record(value, path);
  exactKeys(loan, [
    "loanRef", "verdict", "overridden", "overrideReason", "includedInTransferSet",
    "disbursedMinor", "originationDate", "classificationBucket", "obligorRef", "pslTag",
    "pslEvidenceState", "interestRateBps", "product", "stateCode", "resolution",
    "encumbrance", "commitment",
  ], path);
  const resolution = record(loan.resolution, `${path}.resolution`);
  exactKeys(resolution, ["restructured", "writtenOff", "settledOts"], `${path}.resolution`);
  const encumbrance = loan.encumbrance === null ? null : record(loan.encumbrance, `${path}.encumbrance`);
  if (encumbrance) exactKeys(encumbrance, [
    "onBookStatus", "regulatoryReportingStatus", "cersaiChargePresent", "chargeRank",
    "crossPoolSeen", "sourceMode", "asOfAt",
  ], `${path}.encumbrance`);
  const pslEvidenceState = enumValue(loan.pslEvidenceState, ["VERIFIED", "UNVERIFIED", "FAILED", "NOT_CLAIMED"] as const, `${path}.pslEvidenceState`);
  const pslTag = nullableText(loan.pslTag, `${path}.pslTag`, 200);
  if ((pslEvidenceState === "VERIFIED") !== (pslTag !== null)) {
    throw new Error(`${path}.pslTag must be present exactly when PSL evidence is VERIFIED`);
  }
  const parsedEncumbrance = encumbrance ? {
    onBookStatus: enumValue(encumbrance.onBookStatus, ["ON_BOOK", "SOLD", "PARTIAL", "UNKNOWN"] as const, `${path}.encumbrance.onBookStatus`),
    regulatoryReportingStatus: enumValue(encumbrance.regulatoryReportingStatus, ["ON_BOOK", "SECURITISED", "UNKNOWN"] as const, `${path}.encumbrance.regulatoryReportingStatus`),
    cersaiChargePresent: bool(encumbrance.cersaiChargePresent, `${path}.encumbrance.cersaiChargePresent`),
    chargeRank: encumbrance.chargeRank === null ? null : enumValue(encumbrance.chargeRank, ["FIRST", "SECOND", "PARI_PASSU", "UNKNOWN"] as const, `${path}.encumbrance.chargeRank`),
    crossPoolSeen: bool(encumbrance.crossPoolSeen, `${path}.encumbrance.crossPoolSeen`),
    sourceMode: enumValue(encumbrance.sourceMode, ["LIVE", "DEMO"] as const, `${path}.encumbrance.sourceMode`),
    asOfAt: instant(encumbrance.asOfAt, `${path}.encumbrance.asOfAt`),
  } : null;
  if (parsedEncumbrance && !parsedEncumbrance.cersaiChargePresent && parsedEncumbrance.chargeRank !== null) {
    throw new Error(`${path}.encumbrance.chargeRank requires cersaiChargePresent=true`);
  }
  const verdict = enumValue(loan.verdict, [...VERDICTS] as PoolVerdictV2[], `${path}.verdict`);
  const overridden = bool(loan.overridden, `${path}.overridden`);
  const overrideReason = nullableText(loan.overrideReason, `${path}.overrideReason`, 2_000);
  if (overridden !== (overrideReason !== null)) {
    throw new Error(`${path}.overrideReason must be present exactly when overridden=true`);
  }
  const includedInTransferSet = bool(loan.includedInTransferSet, `${path}.includedInTransferSet`);
  if (includedInTransferSet !== (verdict === "ELIGIBLE" || verdict === "WARNING" || overridden)) {
    throw new Error(`${path}.includedInTransferSet disagrees with verdict/override`);
  }
  const stateCode = text(loan.stateCode, `${path}.stateCode`, 20);
  if (!STATE_CODE.test(stateCode)) throw new Error(`${path}.stateCode is invalid`);
  return {
    loanRef: text(loan.loanRef, `${path}.loanRef`, 160),
    verdict,
    overridden,
    overrideReason,
    includedInTransferSet,
    disbursedMinor: nullableMinor(loan.disbursedMinor, `${path}.disbursedMinor`),
    originationDate: loan.originationDate === null ? null : date(loan.originationDate, `${path}.originationDate`),
    classificationBucket: nullableText(loan.classificationBucket, `${path}.classificationBucket`, 100),
    obligorRef: nullableText(loan.obligorRef, `${path}.obligorRef`, 200),
    pslTag,
    pslEvidenceState,
    interestRateBps: nullableInteger(loan.interestRateBps, `${path}.interestRateBps`, 0, 100_000),
    product: text(loan.product, `${path}.product`, 200),
    stateCode,
    resolution: {
      restructured: nullableBool(resolution.restructured, `${path}.resolution.restructured`),
      writtenOff: nullableBool(resolution.writtenOff, `${path}.resolution.writtenOff`),
      settledOts: nullableBool(resolution.settledOts, `${path}.resolution.settledOts`),
    },
    encumbrance: parsedEncumbrance,
    commitment: digest(loan.commitment, `${path}.commitment`),
  };
}

function parseTape(value: unknown): AssurePoolTapeV2 {
  const path = "payload.tape";
  const tape = record(value, path);
  exactKeys(tape, [
    "profileId", "tapeVersion", "poolId", "sourceArrangementRef", "cutoffDate", "frozenAt",
    "sourceLegacyManifestHash", "manifestHash", "aggregates", "loans", "lock", "exclusions",
    "tapeHash",
  ], path);
  const aggregates = record(tape.aggregates, `${path}.aggregates`);
  exactKeys(aggregates, [
    "loanCount", "includedCount", "totalMinor", "includedMinor", "includedShareBps",
    "pslVerifiedMinor", "pslVerifiedShareBps", "wacBps", "wacCoverageBps",
    "productMixMinor", "stateMixMinor", "restructuredMinor",
  ], `${path}.aggregates`);
  if (!Array.isArray(tape.loans)) throw new Error(`${path}.loans must be an array`);
  const loans = tape.loans.map(parseLoan);
  const lock = tape.lock === null ? null : record(tape.lock, `${path}.lock`);
  if (lock) exactKeys(lock, ["state", "reference", "loanCount"], `${path}.lock`);
  return {
    profileId: enumValue(tape.profileId, [ASSUREPOOL_PROVIDER_PROFILE_V2] as const, `${path}.profileId`),
    tapeVersion: enumValue(tape.tapeVersion, [ASSUREPOOL_TAPE_V2_VERSION] as const, `${path}.tapeVersion`),
    poolId: text(tape.poolId, `${path}.poolId`, 200),
    sourceArrangementRef: text(tape.sourceArrangementRef, `${path}.sourceArrangementRef`, 200),
    cutoffDate: date(tape.cutoffDate, `${path}.cutoffDate`),
    frozenAt: instant(tape.frozenAt, `${path}.frozenAt`),
    sourceLegacyManifestHash: digest(tape.sourceLegacyManifestHash, `${path}.sourceLegacyManifestHash`),
    manifestHash: digest(tape.manifestHash, `${path}.manifestHash`),
    aggregates: {
      loanCount: integer(aggregates.loanCount, `${path}.aggregates.loanCount`),
      includedCount: integer(aggregates.includedCount, `${path}.aggregates.includedCount`),
      totalMinor: minor(aggregates.totalMinor, `${path}.aggregates.totalMinor`),
      includedMinor: minor(aggregates.includedMinor, `${path}.aggregates.includedMinor`),
      includedShareBps: integer(aggregates.includedShareBps, `${path}.aggregates.includedShareBps`, 0, 10_000),
      pslVerifiedMinor: minor(aggregates.pslVerifiedMinor, `${path}.aggregates.pslVerifiedMinor`),
      pslVerifiedShareBps: integer(aggregates.pslVerifiedShareBps, `${path}.aggregates.pslVerifiedShareBps`, 0, 10_000),
      wacBps: integer(aggregates.wacBps, `${path}.aggregates.wacBps`, 0, 100_000),
      wacCoverageBps: integer(aggregates.wacCoverageBps, `${path}.aggregates.wacCoverageBps`, 0, 10_000),
      productMixMinor: parseMinorMap(aggregates.productMixMinor, `${path}.aggregates.productMixMinor`),
      stateMixMinor: parseMinorMap(aggregates.stateMixMinor, `${path}.aggregates.stateMixMinor`),
      restructuredMinor: minor(aggregates.restructuredMinor, `${path}.aggregates.restructuredMinor`),
    },
    loans,
    lock: lock ? {
      state: text(lock.state, `${path}.lock.state`, 80),
      reference: text(lock.reference, `${path}.lock.reference`, 500),
      loanCount: integer(lock.loanCount, `${path}.lock.loanCount`),
    } : null,
    exclusions: stringArray(tape.exclusions, `${path}.exclusions`),
    tapeHash: digest(tape.tapeHash, `${path}.tapeHash`),
  };
}

function validatePerformanceResult(value: unknown): Readonly<Record<string, unknown>> {
  const path = "payload.performance.result";
  const result = record(value, path);
  exactKeys(result, [
    "valueBasis", "note", "asOfCycle", "vintages", "unvintaged", "rolls", "cycleGaps", "par",
    "parObservedShareBps",
  ], path);
  enumValue(result.valueBasis, ["DISBURSED_VALUE"] as const, `${path}.valueBasis`);
  text(result.note, `${path}.note`, 4_000);
  if (result.asOfCycle !== null) month(result.asOfCycle, `${path}.asOfCycle`);
  integer(result.unvintaged, `${path}.unvintaged`);
  integer(result.parObservedShareBps, `${path}.parObservedShareBps`, 0, 10_000);
  stringArray(result.cycleGaps, `${path}.cycleGaps`);
  if (!Array.isArray(result.vintages)) throw new Error(`${path}.vintages must be an array`);
  result.vintages.forEach((item, index) => {
    const p = `${path}.vintages[${index}]`;
    const vintage = record(item, p);
    exactKeys(vintage, ["cohort", "loanCount", "valueMinor", "curve"], p);
    month(vintage.cohort, `${p}.cohort`);
    integer(vintage.loanCount, `${p}.loanCount`);
    minor(vintage.valueMinor, `${p}.valueMinor`);
    if (!Array.isArray(vintage.curve)) throw new Error(`${p}.curve must be an array`);
    vintage.curve.forEach((cellValue, cellIndex) => {
      const cp = `${p}.curve[${cellIndex}]`;
      const cell = record(cellValue, cp);
      exactKeys(cell, ["monthOnBook", "d30ShareBps", "d90ShareBps", "observedShareBps"], cp);
      integer(cell.monthOnBook, `${cp}.monthOnBook`);
      integer(cell.d30ShareBps, `${cp}.d30ShareBps`, 0, 10_000);
      integer(cell.d90ShareBps, `${cp}.d90ShareBps`, 0, 10_000);
      integer(cell.observedShareBps, `${cp}.observedShareBps`, 0, 10_000);
    });
  });
  if (!Array.isArray(result.rolls)) throw new Error(`${path}.rolls must be an array`);
  result.rolls.forEach((item, index) => {
    const p = `${path}.rolls[${index}]`;
    const roll = record(item, p);
    exactKeys(roll, ["fromCycle", "toCycle", "counts", "observedLoans", "headline"], p);
    month(roll.fromCycle, `${p}.fromCycle`);
    month(roll.toCycle, `${p}.toCycle`);
    integer(roll.observedLoans, `${p}.observedLoans`);
    const counts = record(roll.counts, `${p}.counts`);
    exactKeys(counts, DPD_BUCKETS, `${p}.counts`);
    for (const from of DPD_BUCKETS) {
      const row = record(counts[from], `${p}.counts.${from}`);
      exactKeys(row, DPD_BUCKETS, `${p}.counts.${from}`);
      for (const to of DPD_BUCKETS) integer(row[to], `${p}.counts.${from}.${to}`);
    }
    const headline = record(roll.headline, `${p}.headline`);
    exactKeys(headline, ["currentToDelinquentBps", "sma0WorseBps", "sma1WorseBps", "sma2ToNpaBps", "cureBps"], `${p}.headline`);
    for (const key of Object.keys(headline)) integer(headline[key], `${p}.headline.${key}`, 0, 10_000);
  });
  if (!Array.isArray(result.par)) throw new Error(`${path}.par must be an array`);
  result.par.forEach((item, index) => {
    const p = `${path}.par[${index}]`;
    const point = record(item, p);
    exactKeys(point, ["thresholdDays", "parBps", "valueMinor"], p);
    integer(point.thresholdDays, `${p}.thresholdDays`);
    integer(point.parBps, `${p}.parBps`, 0, 10_000);
    minor(point.valueMinor, `${p}.valueMinor`);
  });
  return result;
}

function parsePackage(value: unknown): AssurePoolEvidencePackageV2 {
  const path = "payload";
  const payload = record(value, path);
  exactKeys(payload, ["profileId", "packageVersion", "generatedAt", "tape", "performance", "packageDigest"], path);
  const performance = record(payload.performance, `${path}.performance`);
  exactKeys(performance, ["snapshotVersion", "generatedAt", "poolId", "sourceAsOfCycle", "result", "resultDigest"], `${path}.performance`);
  return {
    profileId: enumValue(payload.profileId, [ASSUREPOOL_PROVIDER_PROFILE_V2] as const, `${path}.profileId`),
    packageVersion: enumValue(payload.packageVersion, ["2.0"] as const, `${path}.packageVersion`),
    generatedAt: instant(payload.generatedAt, `${path}.generatedAt`),
    tape: parseTape(payload.tape),
    performance: {
      snapshotVersion: enumValue(performance.snapshotVersion, [ASSUREPOOL_PERFORMANCE_SNAPSHOT_VERSION] as const, `${path}.performance.snapshotVersion`),
      generatedAt: instant(performance.generatedAt, `${path}.performance.generatedAt`),
      poolId: text(performance.poolId, `${path}.performance.poolId`, 200),
      sourceAsOfCycle: performance.sourceAsOfCycle === null ? null : month(performance.sourceAsOfCycle, `${path}.performance.sourceAsOfCycle`),
      result: validatePerformanceResult(performance.result),
      resultDigest: digest(performance.resultDigest, `${path}.performance.resultDigest`),
    },
    packageDigest: digest(payload.packageDigest, `${path}.packageDigest`),
  };
}

export function computePoolManifestV2(loans: readonly AssurePoolTapeLoanV2[]): string {
  return `sha256:${hashObject([...loans].sort((a, b) => a.loanRef.localeCompare(b.loanRef)))}`;
}

export function providerEnvelopeSigningInput(
  providerId: string,
  keyId: string,
  payloadDigest: string
): string {
  return `${ASSUREPOOL_PROVIDER_ENVELOPE_V2}|${providerId}|Ed25519|${keyId}|${payloadDigest}`;
}

function expectedAggregates(loans: readonly AssurePoolTapeLoanV2[]): AssurePoolTapeV2["aggregates"] {
  let total = 0n;
  let included = 0n;
  let includedCount = 0;
  let psl = 0n;
  let rated = 0n;
  let weighted = 0n;
  let restructured = 0n;
  const product = new Map<string, bigint>();
  const state = new Map<string, bigint>();
  for (const loan of loans) {
    const amount = BigInt(loan.disbursedMinor ?? "0");
    total += amount;
    if (!loan.includedInTransferSet) continue;
    included += amount;
    includedCount += 1;
    if (loan.pslTag) psl += amount;
    if (loan.interestRateBps !== null) {
      rated += amount;
      weighted += BigInt(loan.interestRateBps) * amount;
    }
    if (loan.resolution.restructured === true) restructured += amount;
    product.set(loan.product, (product.get(loan.product) ?? 0n) + amount);
    state.set(loan.stateCode, (state.get(loan.stateCode) ?? 0n) + amount);
  }
  const sorted = (source: Map<string, bigint>): Record<string, string> =>
    Object.fromEntries([...source].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, value.toString()]));
  return {
    loanCount: loans.length,
    includedCount,
    totalMinor: total.toString(),
    includedMinor: included.toString(),
    includedShareBps: total > 0n ? Number((included * 10_000n) / total) : 0,
    pslVerifiedMinor: psl.toString(),
    pslVerifiedShareBps: included > 0n ? Number((psl * 10_000n) / included) : 0,
    wacBps: rated > 0n ? Number(weighted / rated) : 0,
    wacCoverageBps: included > 0n ? Number((rated * 10_000n) / included) : 0,
    productMixMinor: sorted(product),
    stateMixMinor: sorted(state),
    restructuredMinor: restructured.toString(),
  };
}

export function parseAndVerifyAssurePoolProviderEnvelopeV2(
  input: unknown,
  options: AssurePoolProviderVerificationOptions
): AssurePoolProviderVerificationV2 {
  const reasons: string[] = [];
  let envelope: AssurePoolProviderEnvelopeV2;
  try {
    const raw = record(input, "envelope");
    exactKeys(raw, ["envelopeVersion", "providerId", "algorithm", "keyId", "payloadDigest", "signature", "payload"], "envelope");
    const keyId = text(raw.keyId, "envelope.keyId", 32);
    if (!KEY_ID.test(keyId)) throw new Error("envelope.keyId must be a 32-character lowercase hex fingerprint");
    const signature = text(raw.signature, "envelope.signature", 256);
    if (!/^[A-Za-z0-9_-]+$/.test(signature)) throw new Error("envelope.signature must be unpadded base64url");
    envelope = {
      envelopeVersion: enumValue(raw.envelopeVersion, [ASSUREPOOL_PROVIDER_ENVELOPE_V2] as const, "envelope.envelopeVersion"),
      providerId: text(raw.providerId, "envelope.providerId", 200),
      algorithm: enumValue(raw.algorithm, ["Ed25519"] as const, "envelope.algorithm"),
      keyId,
      payloadDigest: digest(raw.payloadDigest, "envelope.payloadDigest"),
      signature,
      payload: parsePackage(raw.payload),
    };
  } catch (error) {
    return { ok: false, reasons: [(error as Error).message] };
  }

  if (envelope.providerId !== options.expectedProviderId) {
    reasons.push(`providerId ${envelope.providerId} is not the configured provider`);
  }
  const publicKeyPem = options.publicKeysById[envelope.keyId];
  if (!publicKeyPem) {
    reasons.push(`signing key ${envelope.keyId} is not trusted`);
  } else {
    try {
      const publicKey = createPublicKey(publicKeyPem.replace(/\\n/g, "\n"));
      if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("trusted key is not Ed25519");
      const derivedKeyId = createHash("sha256")
        .update(publicKey.export({ format: "der", type: "spki" }))
        .digest("hex")
        .slice(0, 32);
      if (derivedKeyId !== envelope.keyId) reasons.push("trusted public key fingerprint does not match keyId");
      const verified = verifySignature(
        null,
        Buffer.from(providerEnvelopeSigningInput(envelope.providerId, envelope.keyId, envelope.payloadDigest), "utf8"),
        publicKey,
        Buffer.from(envelope.signature, "base64url")
      );
      if (!verified) reasons.push("provider signature verification failed");
    } catch (error) {
      reasons.push(`trusted signing key is invalid: ${(error as Error).message}`);
    }
  }

  const payloadDigest = `sha256:${hashObject(envelope.payload)}`;
  if (payloadDigest !== envelope.payloadDigest) reasons.push("payloadDigest mismatch");
  const { packageDigest, ...packageBody } = envelope.payload;
  if (`sha256:${hashObject(packageBody)}` !== packageDigest) reasons.push("packageDigest mismatch");
  const { tapeHash, ...tapeBody } = envelope.payload.tape;
  if (`sha256:${hashObject(tapeBody)}` !== tapeHash) reasons.push("tapeHash mismatch");
  if (computePoolManifestV2(envelope.payload.tape.loans) !== envelope.payload.tape.manifestHash) {
    reasons.push("manifestHash mismatch — published loan data differs from the frozen v2 manifest");
  }
  if (canonicalJson(expectedAggregates(envelope.payload.tape.loans)) !== canonicalJson(envelope.payload.tape.aggregates)) {
    reasons.push("aggregate mismatch — published aggregates do not reconcile to loan rows");
  }
  if (new Set(envelope.payload.tape.loans.map((loan) => loan.loanRef)).size !== envelope.payload.tape.loans.length) {
    reasons.push("duplicate loanRef in tape");
  }
  if (envelope.payload.performance.poolId !== envelope.payload.tape.poolId) reasons.push("performance poolId does not match tape poolId");
  if (envelope.payload.performance.generatedAt !== envelope.payload.generatedAt) reasons.push("performance generatedAt does not match package generatedAt");
  if (Date.parse(envelope.payload.tape.frozenAt) > Date.parse(envelope.payload.generatedAt)) reasons.push("package generatedAt precedes tape frozenAt");
  if (envelope.payload.tape.cutoffDate > envelope.payload.tape.frozenAt.slice(0, 10)) reasons.push("tape cutoffDate follows frozenAt");
  if (envelope.payload.performance.sourceAsOfCycle !== envelope.payload.performance.result.asOfCycle) {
    reasons.push("performance sourceAsOfCycle does not match result asOfCycle");
  }
  if (`sha256:${hashObject(envelope.payload.performance.result)}` !== envelope.payload.performance.resultDigest) {
    reasons.push("performance resultDigest mismatch");
  }
  if (envelope.payload.tape.lock && envelope.payload.tape.lock.loanCount !== envelope.payload.tape.aggregates.includedCount) {
    reasons.push("lock loanCount does not match includedCount");
  }
  if (["CONTROLLED_LIVE", "PRODUCTION"].includes(options.operatingMode)) {
    if (envelope.payload.tape.lock?.state !== "CONFIRMED") {
      reasons.push(`a CONFIRMED source lock is required in ${options.operatingMode}`);
    }
    for (const loan of envelope.payload.tape.loans.filter((row) => row.includedInTransferSet)) {
      if (loan.verdict !== "ELIGIBLE" && loan.verdict !== "WARNING") {
        reasons.push(`${loan.loanRef}: an override alone cannot include ${loan.verdict} evidence in ${options.operatingMode}`);
      }
      if (loan.resolution.writtenOff !== false || loan.resolution.settledOts !== false) {
        reasons.push(`${loan.loanRef}: written-off and OTS status must be explicitly clear in ${options.operatingMode}`);
      }
      if (loan.resolution.restructured === null) reasons.push(`${loan.loanRef}: restructured status must be explicit in ${options.operatingMode}`);
      if (BigInt(loan.disbursedMinor ?? "0") <= 0n) reasons.push(`${loan.loanRef}: included principal must be positive in ${options.operatingMode}`);
      if (!loan.encumbrance) {
        reasons.push(`${loan.loanRef}: current encumbrance evidence is required in ${options.operatingMode}`);
        continue;
      }
      if (loan.encumbrance.sourceMode !== "LIVE") reasons.push(`${loan.loanRef}: DEMO encumbrance evidence is prohibited in ${options.operatingMode}`);
      if (Date.parse(loan.encumbrance.asOfAt) > Date.parse(envelope.payload.generatedAt)) reasons.push(`${loan.loanRef}: encumbrance asOfAt follows package generatedAt`);
      if (loan.encumbrance.onBookStatus !== "ON_BOOK") reasons.push(`${loan.loanRef}: on-book status must be ON_BOOK in ${options.operatingMode}`);
      if (loan.encumbrance.regulatoryReportingStatus !== "ON_BOOK") reasons.push(`${loan.loanRef}: regulatory reporting status must be ON_BOOK in ${options.operatingMode}`);
      if (loan.encumbrance.crossPoolSeen) reasons.push(`${loan.loanRef}: cross-pool presence blocks ${options.operatingMode}`);
    }
  }
  return {
    ok: reasons.length === 0,
    reasons,
    envelope: reasons.length === 0 ? envelope as VerifiedAssurePoolProviderEnvelopeV2 : undefined,
  };
}
