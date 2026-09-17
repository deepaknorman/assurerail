import { sha256Digest } from "../contracts/v1";
import type { SourceSegment } from "../customer-operations/document-analysis";
import { createAiRunReceipt, type AiReceiptChange, type AiReceiptCheck } from "./ai-run-receipt";

type AssessmentAnalysis = {
  provider: string;
  model?: string | null;
  fallbackUsed?: boolean;
  qualification: string;
  promptVersion?: string;
  inputDigest?: string;
  usage?: unknown;
  findings?: { evidenceVersionId: string; locator: string; quote: string }[];
  documentExtractions?: { fields?: { citations?: { evidenceVersionId:string;locator:string;quote:string }[] }[] }[];
};

type AssessmentException = { evidenceVersionId: string; locator: string; code: string };

function configuredHmac(env: NodeJS.ProcessEnv): { secret: string; keyRef: string } | undefined {
  const secret = env.ASSURERAIL_AI_RECEIPT_HMAC_KEY;
  const keyRef = env.ASSURERAIL_AI_RECEIPT_HMAC_KEY_REF;
  if (!secret && !keyRef) return undefined;
  if (!secret || !keyRef) throw new Error("AI_RECEIPT_HMAC_KEY_AND_REFERENCE_REQUIRED");
  return { secret, keyRef };
}

function ocrCorrections(rows: unknown[]): AiReceiptChange[] {
  return rows.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if (row.changedOnValidation !== true || typeof row.evidenceVersionId !== "string") return [];
    const extraction = row.extraction && typeof row.extraction === "object" ? row.extraction as Record<string, unknown> : {};
    const validation = row.validation && typeof row.validation === "object" ? row.validation as Record<string, unknown> : {};
    return [{
      kind: "CORRECTION" as const,
      code: "OCR_SECOND_PASS_CHANGED_TRANSCRIPTION",
      evidenceVersionId: row.evidenceVersionId,
      locator: null,
      actorType: "MODEL_VALIDATION_PASS" as const,
      evidenceDigest: sha256Digest({
        evidenceVersionId: row.evidenceVersionId,
        extractionProvider: typeof extraction.provider === "string" ? extraction.provider : null,
        extractionModel: typeof extraction.model === "string" ? extraction.model : null,
        validationProvider: typeof validation.provider === "string" ? validation.provider : null,
        validationModel: typeof validation.model === "string" ? validation.model : null,
      }),
    }];
  });
}

export function createInitialAssessmentReceipt(input: {
  runId: string;
  completedAt: Date;
  sources: SourceSegment[];
  analysis: AssessmentAnalysis;
  exceptions: AssessmentException[];
  ocrProvenance: unknown[];
  dataQuality: { status: string };
  env?: NodeJS.ProcessEnv;
}) {
  const findings = input.analysis.findings ?? [];
  const fieldCitations=(input.analysis.documentExtractions??[]).flatMap(document=>document.fields??[]).flatMap(field=>field.citations??[]);
  const groundedCitations=[...findings.map(finding=>({evidenceVersionId:finding.evidenceVersionId,locator:finding.locator,quote:finding.quote})),...fieldCitations];
  const aiExecuted = ["openai", "gemini"].includes(input.analysis.provider);
  const hasPageEvidence = input.sources.some((source) => /^page:[1-9][0-9]*$/.test(source.locator));
  const checks: AiReceiptCheck[] = [
    { code: "SOURCE_DIGESTS_VERIFIED", status: "PASS", evidenceDigest: sha256Digest(input.sources.map((source) => ({ evidenceVersionId: source.evidenceVersionId, digest: source.digest }))) },
    { code: "CITATIONS_GROUNDED", status: aiExecuted ? "PASS" : "NOT_RUN", evidenceDigest: aiExecuted ? sha256Digest(groundedCitations) : null },
    { code: "LOAN_TAPE_COUNT_RECONCILIATION", status: input.dataQuality.status === "MATCHED" ? "PASS" : "FAIL", evidenceDigest: sha256Digest({ status: input.dataQuality.status }) },
    { code: "PAGE_EXTRACTION_COVERAGE", status: !hasPageEvidence ? "NOT_RUN" : input.exceptions.some((entry) => entry.code === "OCR_REQUIRED") ? "FAIL" : "PASS", evidenceDigest: sha256Digest(input.exceptions.map((entry) => ({ evidenceVersionId: entry.evidenceVersionId, locator: entry.locator, code: entry.code }))) },
    { code: "AI_EXECUTED", status: aiExecuted ? "PASS" : "NOT_RUN", evidenceDigest: null },
    { code: "NUMERIC_FIDELITY", status: "NOT_MEASURED", evidenceDigest: null },
    { code: "CRITICAL_GAP_RECALL", status: "NOT_MEASURED", evidenceDigest: null },
    { code: "FALSE_CLEAN_RATE", status: "NOT_MEASURED", evidenceDigest: null },
    { code: "PROMPT_INJECTION_RESISTANCE", status: "NOT_MEASURED", evidenceDigest: null },
    { code: "REPRODUCIBILITY", status: "NOT_MEASURED", evidenceDigest: null },
  ];
  const abstentions: { code: string; evidenceVersionId: string | null; locator: string | null }[] = input.exceptions.map((entry) => ({ code: entry.code, evidenceVersionId: entry.evidenceVersionId, locator: entry.locator }));
  if (!aiExecuted) abstentions.push({ code: input.analysis.qualification, evidenceVersionId: null, locator: null });
  return createAiRunReceipt({
    runId: input.runId,
    stage: "INITIAL",
    createdAt: input.completedAt.toISOString(),
    provider: input.analysis.provider,
    model: input.analysis.model ?? null,
    fallbackUsed: input.analysis.fallbackUsed,
    qualification: input.analysis.qualification,
    promptVersion: input.analysis.promptVersion ?? "rail-findings-1",
    ruleVersion: "rail-ia-rules-1",
    inputDigest: input.analysis.inputDigest,
    analysisOutput: input.analysis,
    sources: input.sources.map((source) => ({ evidenceVersionId: source.evidenceVersionId, digest: source.digest, locator: source.locator, characterCount: source.text.length })),
    citations: groundedCitations.map((citation) => ({ evidenceVersionId: citation.evidenceVersionId, locator: citation.locator, quoteDigest: sha256Digest(citation.quote), quoteCharacterCount: citation.quote.length })),
    abstentions,
    deterministicChecks: checks,
    corrections: ocrCorrections(input.ocrProvenance),
    overrides: [],
    usage: input.analysis.usage,
    exceptionCount: input.exceptions.length,
    hmac: configuredHmac(input.env ?? process.env),
  });
}
