import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalSerialize, sha256Digest, toCanonicalValue } from "../contracts/v1";

export const AI_RUN_RECEIPT_SCHEMA_VERSION = "assurerail.ai-run-receipt.v0" as const;

export type AiReceiptSource = {
  evidenceVersionId: string;
  digest: string;
  locator: string;
  characterCount: number;
};

export type AiReceiptCitation = {
  findingIndex: number;
  evidenceVersionId: string;
  locator: string;
  quoteDigest: string;
  quoteCharacterCount: number;
};

export type AiReceiptCheck = {
  code: string;
  status: "PASS" | "FAIL" | "NOT_RUN" | "NOT_MEASURED";
  evidenceDigest: string | null;
};

export type AiReceiptChange = {
  kind: "CORRECTION" | "OVERRIDE";
  code: string;
  evidenceVersionId: string | null;
  locator: string | null;
  actorType: "MODEL_VALIDATION_PASS" | "DETERMINISTIC_RULE" | "HUMAN";
  evidenceDigest: string;
};

type AiRunReceiptBody = {
  schemaVersion: typeof AI_RUN_RECEIPT_SCHEMA_VERSION;
  runId: string;
  stage: "INITIAL" | "PREPARATION";
  createdAt: string;
  execution: {
    provider: string;
    model: string | null;
    fallbackUsed: boolean;
    qualification: string;
    promptVersion: string;
    ruleVersion: string;
  };
  inputDigest: string;
  outputDigest: string;
  sources: AiReceiptSource[];
  citations: AiReceiptCitation[];
  coverage: {
    sourceCount: number;
    segmentCount: number;
    nonEmptySegmentCount: number;
    pageLocatorCount: number;
    readablePageLocatorCount: number;
    readablePageCoverageBps: number | null;
    extractedCharacterCount: number;
  };
  abstentions: {
    code: string;
    evidenceVersionId: string | null;
    locator: string | null;
  }[];
  deterministicChecks: AiReceiptCheck[];
  corrections: AiReceiptChange[];
  overrides: AiReceiptChange[];
  usage: {
    inputTokens: string | null;
    outputTokens: string | null;
    estimatedCostMinor: string | null;
    costCurrency: "INR";
    costStatus: "NOT_CONFIGURED" | "ESTIMATED";
  };
  exceptionCount: number;
};

export type AiRunReceipt = AiRunReceiptBody & {
  receiptId: string;
  integrity: {
    payloadDigest: string;
    algorithm: "SHA-256" | "HMAC-SHA256";
    keyRef: string | null;
    signature: string | null;
    outerBinding: "ASSESSMENT_RESULT_DIGEST";
  };
};

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function tokenCount(usage: unknown, names: string[]): string | null {
  if (!usage || typeof usage !== "object") return null;
  const row = usage as Record<string, unknown>;
  for (const name of names) {
    const value = row[name];
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  }
  return null;
}

function sourceDigest(sources: AiReceiptSource[]): string {
  return sha256Digest(sources.map(({ evidenceVersionId, digest, locator, characterCount }) => ({ evidenceVersionId, digest, locator, characterCount })));
}

export function createAiRunReceipt(input: {
  runId: string;
  stage: "INITIAL" | "PREPARATION";
  createdAt: string;
  provider: string;
  model: string | null;
  fallbackUsed?: boolean;
  qualification: string;
  promptVersion: string;
  ruleVersion: string;
  inputDigest?: string;
  analysisOutput: unknown;
  sources: AiReceiptSource[];
  citations: Omit<AiReceiptCitation, "findingIndex">[];
  abstentions: AiRunReceiptBody["abstentions"];
  deterministicChecks: AiReceiptCheck[];
  corrections?: AiReceiptChange[];
  overrides?: AiReceiptChange[];
  usage?: unknown;
  estimatedCostMinor?: string | null;
  exceptionCount: number;
  hmac?: { secret: string; keyRef: string };
}): AiRunReceipt {
  if (!input.runId || !ISO_INSTANT.test(input.createdAt)) throw new Error("AI_RECEIPT_ID_AND_CANONICAL_TIME_REQUIRED");
  for (const value of [input.provider, input.qualification, input.promptVersion, input.ruleVersion]) if (!value.trim() || value.length > 200) throw new Error("INVALID_AI_RECEIPT_EXECUTION_IDENTITY");
  if (!Number.isSafeInteger(input.exceptionCount) || input.exceptionCount < 0) throw new Error("INVALID_AI_RECEIPT_EXCEPTION_COUNT");
  if (input.estimatedCostMinor != null && !/^(0|[1-9][0-9]*)$/.test(input.estimatedCostMinor)) throw new Error("INVALID_AI_RECEIPT_COST");
  if (input.hmac && (input.hmac.secret.length < 32 || !input.hmac.keyRef.trim())) throw new Error("INVALID_AI_RECEIPT_HMAC_CONFIGURATION");
  if (input.inputDigest !== undefined && !DIGEST.test(input.inputDigest)) throw new Error("INVALID_AI_RECEIPT_INPUT_DIGEST");

  const sources = [...input.sources]
    .map((source) => {
      if (!source.evidenceVersionId || !source.locator || !DIGEST.test(source.digest) || !Number.isSafeInteger(source.characterCount) || source.characterCount < 0) throw new Error("INVALID_AI_RECEIPT_SOURCE");
      return source;
    })
    .sort((a, b) => a.evidenceVersionId.localeCompare(b.evidenceVersionId) || a.locator.localeCompare(b.locator));
  if (new Set(sources.map((source) => `${source.evidenceVersionId}\u0000${source.locator}`)).size !== sources.length) throw new Error("DUPLICATE_AI_RECEIPT_SOURCE_LOCATION");
  const citations = input.citations.map((citation, findingIndex) => ({ ...citation, findingIndex }));
  const sourceLocations = new Set(sources.map((source) => `${source.evidenceVersionId}\u0000${source.locator}`));
  if (citations.some((citation) => !sourceLocations.has(`${citation.evidenceVersionId}\u0000${citation.locator}`) || !DIGEST.test(citation.quoteDigest) || !Number.isSafeInteger(citation.quoteCharacterCount) || citation.quoteCharacterCount < 1)) throw new Error("INVALID_AI_RECEIPT_CITATION");
  if (input.deterministicChecks.some((check) => !check.code.trim() || check.evidenceDigest !== null && !DIGEST.test(check.evidenceDigest))) throw new Error("INVALID_AI_RECEIPT_CHECK");
  if ([...(input.corrections ?? []), ...(input.overrides ?? [])].some((change) => !change.code.trim() || !DIGEST.test(change.evidenceDigest))) throw new Error("INVALID_AI_RECEIPT_CHANGE");
  const pages = new Set(sources.filter((source) => /^page:[1-9][0-9]*$/.test(source.locator)).map((source) => `${source.evidenceVersionId}:${source.locator}`));
  const readablePages = new Set(sources.filter((source) => source.characterCount > 0 && /^page:[1-9][0-9]*$/.test(source.locator)).map((source) => `${source.evidenceVersionId}:${source.locator}`));
  const body: AiRunReceiptBody = {
    schemaVersion: AI_RUN_RECEIPT_SCHEMA_VERSION,
    runId: input.runId,
    stage: input.stage,
    createdAt: input.createdAt,
    execution: {
      provider: input.provider,
      model: input.model,
      fallbackUsed: input.fallbackUsed === true,
      qualification: input.qualification,
      promptVersion: input.promptVersion,
      ruleVersion: input.ruleVersion,
    },
    inputDigest: input.inputDigest ?? sourceDigest(sources),
    outputDigest: sha256Digest(toCanonicalValue(input.analysisOutput)),
    sources,
    citations,
    coverage: {
      sourceCount: new Set(sources.map((source) => source.evidenceVersionId)).size,
      segmentCount: sources.length,
      nonEmptySegmentCount: sources.filter((source) => source.characterCount > 0).length,
      pageLocatorCount: pages.size,
      readablePageLocatorCount: readablePages.size,
      readablePageCoverageBps: pages.size ? Math.floor((readablePages.size * 10_000) / pages.size) : null,
      extractedCharacterCount: sources.reduce((total, source) => total + source.characterCount, 0),
    },
    abstentions: [...input.abstentions],
    deterministicChecks: [...input.deterministicChecks],
    corrections: [...(input.corrections ?? [])],
    overrides: [...(input.overrides ?? [])],
    usage: {
      inputTokens: tokenCount(input.usage, ["input_tokens", "promptTokenCount"]),
      outputTokens: tokenCount(input.usage, ["output_tokens", "candidatesTokenCount"]),
      estimatedCostMinor: input.estimatedCostMinor ?? null,
      costCurrency: "INR",
      costStatus: input.estimatedCostMinor == null ? "NOT_CONFIGURED" : "ESTIMATED",
    },
    exceptionCount: input.exceptionCount,
  };
  const payloadDigest = sha256Digest(body);
  const receiptId = `air_${payloadDigest.slice("sha256:".length, "sha256:".length + 24)}`;
  const signature = input.hmac
    ? createHmac("sha256", input.hmac.secret).update(`ASSURERAIL-AI-RECEIPT-V0\n${payloadDigest}`).digest("hex")
    : null;
  return {
    ...body,
    receiptId,
    integrity: {
      payloadDigest,
      algorithm: input.hmac ? "HMAC-SHA256" : "SHA-256",
      keyRef: input.hmac?.keyRef ?? null,
      signature,
      outerBinding: "ASSESSMENT_RESULT_DIGEST",
    },
  };
}

export function verifyAiRunReceipt(receipt: AiRunReceipt, hmacSecret?: string): boolean {
  const { receiptId, integrity, ...body } = receipt;
  const payloadDigest = sha256Digest(body);
  if (payloadDigest !== integrity.payloadDigest || receiptId !== `air_${payloadDigest.slice(7, 31)}`) return false;
  if (integrity.algorithm === "SHA-256") return integrity.signature === null && integrity.keyRef === null;
  if (!hmacSecret || hmacSecret.length < 32 || !integrity.signature || !integrity.keyRef || !/^[a-f0-9]{64}$/.test(integrity.signature)) return false;
  const expected = createHmac("sha256", hmacSecret).update(`ASSURERAIL-AI-RECEIPT-V0\n${payloadDigest}`).digest();
  return timingSafeEqual(expected, Buffer.from(integrity.signature, "hex"));
}

export function canonicalAiRunReceipt(receipt: AiRunReceipt, hmacSecret?: string): string {
  if (!verifyAiRunReceipt(receipt, hmacSecret)) throw new Error("INVALID_AI_RUN_RECEIPT");
  return canonicalSerialize(receipt);
}
