// AssurePool provider adapter. The venue fetches the tape over a versioned HTTP boundary; it does
// not import or execute provider source code. Transport negotiates HTTP/2 over TLS/ALPN where the
// provider supports it. DEMO makes no HTTP call.
import { Agent } from "undici";
import { config } from "../config";
import {
  parseAndVerifyAssurePoolProviderEnvelopeV2,
  type AssurePoolTapeV2,
  type VerifiedAssurePoolProviderEnvelopeV2,
} from "../provider-contracts/assurepool-v2";
import type { AssurePoolTape } from "./tape.types";
import { buildDemoTape } from "./demo-tape";
import { buildReceivablesDemoTape, isReceivablesPool } from "./receivables-demo-tape";

// HTTP/2-capable dispatcher. allowH2 upgrades the connection to h2 when the server negotiates it.
const h2Dispatcher = new Agent({ allowH2: true });

export async function readBoundedProviderJson(
  response: Response,
  url: string,
  maxResponseBytes = config.tapeProviderMaxResponseBytes
): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new Error(`provider evidence response from ${url} is not application/json`);
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxResponseBytes)) {
    throw new Error(`provider evidence response from ${url} exceeds the configured byte limit`);
  }
  if (!response.body) throw new Error(`provider evidence response from ${url} has no body`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    received += part.value.byteLength;
    if (received > maxResponseBytes) {
      await reader.cancel("provider response byte limit exceeded");
      throw new Error(`provider evidence response from ${url} exceeds the configured byte limit`);
    }
    chunks.push(part.value);
  }
  const joined = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)), received);
  try {
    return JSON.parse(joined.toString("utf8")) as unknown;
  } catch {
    throw new Error(`provider evidence response from ${url} is not valid JSON`);
  }
}

export type FetchedTape =
  | { readonly contractVersion: "legacy-v1"; readonly tape: AssurePoolTape }
  | {
      readonly contractVersion: "v2";
      readonly tape: AssurePoolTape;
      readonly providerEnvelope: VerifiedAssurePoolProviderEnvelopeV2;
    };

/** Legacy projection exists solely for the pre-neutral Note adapter. The verified v2 envelope is
 * retained alongside it and is the evidence object; this projection is never re-signed or treated
 * as a new provider assertion. */
export function adaptV2TapeToLegacyNoteProjection(tape: AssurePoolTapeV2): AssurePoolTape {
  return {
    tapeVersion: "1.0",
    poolId: tape.poolId,
    claId: tape.sourceArrangementRef,
    cutoffDate: tape.cutoffDate,
    manifestHash: tape.manifestHash,
    frozenAt: tape.frozenAt,
    aggregates: {
      loanCount: tape.aggregates.loanCount,
      mintableCount: tape.aggregates.includedCount,
      totalMinor: tape.aggregates.totalMinor,
      mintableMinor: tape.aggregates.includedMinor,
      mintableShareBps: tape.aggregates.includedShareBps,
    },
    loans: tape.loans.map((loan) => ({
      loanRef: loan.loanRef,
      verdict: loan.verdict,
      overridden: loan.overridden,
      overrideReason: loan.overrideReason,
      mintable: loan.includedInTransferSet,
      disbursedMinor: loan.disbursedMinor ?? undefined,
      originationDate: loan.originationDate ?? undefined,
      classificationBucket: loan.classificationBucket ?? undefined,
      obligorRef: loan.obligorRef ?? undefined,
      commitment: loan.commitment,
    })),
    lock: tape.lock ?? undefined,
    excludes: tape.exclusions.join(" "),
    tapeHash: tape.tapeHash,
  };
}

export async function fetchAssurePoolProviderEnvelopeV2(poolId: string): Promise<VerifiedAssurePoolProviderEnvelopeV2> {
  const url = `${config.tapeProviderApiUrl}/v1/co-lending/pools/${encodeURIComponent(poolId)}/provider/v2/evidence-package`;
  const res = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(config.tapeProviderTimeoutMs),
    headers: config.tapeProviderApiKey ? { Authorization: `Bearer ${config.tapeProviderApiKey}` } : {},
    dispatcher: h2Dispatcher,
  } as RequestInit & { dispatcher: Agent });
  if (!res.ok) throw new Error(`provider evidence fetch failed (${res.status}) from ${url}`);
  const verification = parseAndVerifyAssurePoolProviderEnvelopeV2(await readBoundedProviderJson(res, url), {
    expectedProviderId: config.tapeProviderExpectedId,
    publicKeysById: config.tapeProviderPublicKeys,
    operatingMode: (process.env.ASSURERAIL_OPERATING_MODE ?? "DEMO").toUpperCase() as
      | "DEMO" | "REPLAY" | "SHADOW" | "SANDBOX" | "CONTROLLED_LIVE" | "PRODUCTION",
  });
  if (!verification.ok || !verification.envelope) {
    throw new Error(`AssurePool provider-v2 evidence rejected: ${verification.reasons.join("; ")}`);
  }
  if (verification.envelope.payload.tape.poolId !== poolId) {
    throw new Error(`AssurePool provider-v2 evidence rejected: requested pool ${poolId} but received ${verification.envelope.payload.tape.poolId}`);
  }
  return verification.envelope;
}

export async function fetchTape(poolId: string): Promise<FetchedTape> {
  if (config.tapeSource === "demo") {
    return { contractVersion: "legacy-v1", tape: isReceivablesPool(poolId) ? buildReceivablesDemoTape(poolId) : buildDemoTape(poolId) };
  }
  if (config.tapeSource === "off") throw new Error("AssurePool-profile tape adapter is off for this deployment");
  const providerEnvelope = await fetchAssurePoolProviderEnvelopeV2(poolId);
  return {
    contractVersion: "v2",
    tape: adaptV2TapeToLegacyNoteProjection(providerEnvelope.payload.tape),
    providerEnvelope,
  };
}
