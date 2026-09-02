"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { productionScaleEnabled } from "@/lib/customer-workspace";
import { vget, vpost } from "@/lib/venue";

type GateRow = {
  code: string;
  evidenceClass: string | null;
  currentAcceptedScopeCount: number;
  recordedScopeCount: number;
  current: boolean;
};
type Blockers = {
  criticalOpsFindings: number;
  opsKillSwitchEngaged: number;
  opsSweepMissingOrStale: number;
  openSettlementBreaks: number;
  openTokenBreaks: number;
  openLifecycleBreaks: number;
  openSecondaryBreaks: number;
  openRoomParityBreaks: number;
  deadLetterMessages: number;
  hardCapacityObservations: number;
  activeCapacityBudgetsMissing: number;
  capacityObservationMissingOrStale: number;
  overdueCriticalSupport: number;
  internalCoverageErrors: string[];
};
type Board = {
  asOf: string;
  environment: string;
  targetOperatingMode: "CONTROLLED_LIVE" | "PRODUCTION";
  buildCommit: string;
  boardState: string;
  gateRows: GateRow[];
  openGates: { external: string[]; internal: string[] };
  blockers: Blockers;
  blockerCount: number;
  activation: null | {
    id: string;
    manifestId: string;
    status: string;
    buildCommit: string;
    expiresAt: string;
    current: boolean;
  };
  controlDigest: string;
};
type Assessment = {
  id: string;
  environment: string;
  targetOperatingMode: string;
  buildCommit: string;
  boardState: string;
  controlDigest: string;
  assessmentDigest: string;
  status: string;
  generatedByUserId: string;
  assessedAt: string;
  reviewedByUserId: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
};

const stateLabel = (value: string) => value.replaceAll("_", " ");

async function internalStepUp(code: string, purpose: string): Promise<string> {
  const response = await vpost<{ stepUp: { id: string } | null }>(
    "/venue/auth/mfa/verify/totp",
    { code, purpose, institutionId: null },
    { institutionId: null }
  );
  if (!response.stepUp?.id)
    throw new Error(
      "The authenticator proof did not produce step-up evidence."
    );
  return response.stepUp.id;
}

export default function ProductionScalePage() {
  const router = useRouter();
  const { loading, firebaseUser, activeInstitutionId, selectInstitution } =
    useAuth();
  const enabled = productionScaleEnabled();
  const [target, setTarget] = useState<"CONTROLLED_LIVE" | "PRODUCTION">(
    "CONTROLLED_LIVE"
  );
  const [board, setBoard] = useState<Board | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [totp, setTotp] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!enabled || activeInstitutionId) return;
    try {
      const [current, history] = await Promise.all([
        vget<Board>(
          `/v1/rail/internal/production-scale/board?targetOperatingMode=${target}`,
          { institutionId: null }
        ),
        vget<Assessment[]>("/v1/rail/internal/production-scale/assessments", {
          institutionId: null,
        }),
      ]);
      setBoard(current);
      setAssessments(history);
      setError("");
    } catch (cause) {
      setBoard(null);
      setError((cause as Error).message);
    }
  }, [activeInstitutionId, enabled, target]);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/login");
  }, [firebaseUser, loading, router]);
  useEffect(() => {
    if (firebaseUser) void load();
  }, [firebaseUser, load]);

  async function generateAssessment() {
    setBusy("generate");
    setError("");
    setNotice("");
    try {
      const stepUpEvidenceId = await internalStepUp(
        totp,
        "PRODUCTION_SCALE_ASSESS"
      );
      await vpost(
        "/v1/rail/internal/production-scale/assessments",
        {
          targetOperatingMode: target,
          idempotencyKey: crypto.randomUUID(),
          stepUpEvidenceId,
        },
        { institutionId: null }
      );
      setNotice(
        "Immutable assessment recorded. No gate, activation or live capability changed."
      );
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function reviewAssessment(
    item: Assessment,
    decision: "ACKNOWLEDGE" | "REJECT"
  ) {
    setBusy(`review-${item.id}`);
    setError("");
    setNotice("");
    try {
      const stepUpEvidenceId = await internalStepUp(
        totp,
        "PRODUCTION_SCALE_REVIEW"
      );
      await vpost(
        `/v1/rail/internal/production-scale/assessments/${encodeURIComponent(
          item.id
        )}/review`,
        { decision, reason: reviewReason, stepUpEvidenceId },
        { institutionId: null }
      );
      setNotice(
        `${
          decision === "ACKNOWLEDGE"
            ? "Assessment acknowledged"
            : "Assessment rejected"
        }. This is not release approval.`
      );
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  const blockerEntries = board
    ? (Object.entries(board.blockers).filter(
        ([key]) => key !== "internalCoverageErrors"
      ) as Array<[string, number]>)
    : [];

  return (
    <>
      <VenueHeader />
      <main className="wrap institutional-page customer-workspace">
        <Link className="back-link" href="/internal">
          ← Internal workspaces
        </Link>
        <div className="console-head">
          <p className="eyebrow">AR-30 · internal production-scale control</p>
          <h1>Production scale & release board</h1>
          <p>
            One current view of external and internal readiness gates,
            operational blockers, exact build activation and independently
            reviewed assessment evidence.
          </p>
        </div>
        <div className="boundary-note">
          An assessment or acknowledgment never closes a VAPT, counsel,
          participant, trustee, provider, DR or customer gate. It never signs a
          release or creates a live capability.
        </div>
        {!enabled && (
          <div className="msg err">
            Production-scale governance is disabled. Its API and web flags must
            both be explicitly set to shadow.
          </div>
        )}
        {activeInstitutionId && (
          <section className="panel">
            <h2>Leave participant context first</h2>
            <p>
              Internal release authority cannot be combined with an active
              customer-institution context.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => void selectInstitution(null)}
            >
              Switch to internal context
            </button>
          </section>
        )}
        {error && (
          <div className="msg err" role="alert">
            {error}
          </div>
        )}
        {notice && <div className="msg ok">{notice}</div>}
        {enabled && !activeInstitutionId && board && (
          <>
            <section className="workspace-hero">
              <div>
                <span className="workspace-label">Target</span>
                <strong>{stateLabel(board.targetOperatingMode)}</strong>
                <small>{board.environment}</small>
              </div>
              <div>
                <span className="workspace-label">Board state</span>
                <strong>{stateLabel(board.boardState)}</strong>
                <small>Derived, never self-certified</small>
              </div>
              <div>
                <span className="workspace-label">Open gates</span>
                <strong>
                  {board.openGates.external.length +
                    board.openGates.internal.length}
                </strong>
                <small>
                  {board.openGates.external.length} external ·{" "}
                  {board.openGates.internal.length} internal
                </small>
              </div>
              <div>
                <span className="workspace-label">Operational blockers</span>
                <strong>{board.blockerCount}</strong>
                <small>Fail-closed release inputs</small>
              </div>
            </section>
            <section className="panel">
              <div className="form-grid">
                <label className="lbl">
                  Release target
                  <select
                    className="field"
                    value={target}
                    onChange={(event) =>
                      setTarget(
                        event.target.value as "CONTROLLED_LIVE" | "PRODUCTION"
                      )
                    }
                  >
                    <option>CONTROLLED_LIVE</option>
                    <option>PRODUCTION</option>
                  </select>
                </label>
                <label className="lbl">
                  Authenticator code
                  <input
                    className="field"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totp}
                    onChange={(event) =>
                      setTotp(event.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                  />
                </label>
                <label className="lbl">
                  Independent review reason
                  <input
                    className="field"
                    value={reviewReason}
                    onChange={(event) => setReviewReason(event.target.value)}
                  />
                </label>
              </div>
              <button
                className="btn btn-primary"
                disabled={!!busy || totp.length < 6}
                onClick={() => void generateAssessment()}
              >
                {busy === "generate"
                  ? "Recording…"
                  : "Record immutable assessment"}
              </button>
              <p className="meta">
                Build {board.buildCommit} · control digest {board.controlDigest}{" "}
                · assessed {new Date(board.asOf).toLocaleString("en-IN")}
              </p>
            </section>
            <section className="workspace-grid">
              <article className="panel workspace-module workspace-wide">
                <h2>Readiness gates</h2>
                <div className="workspace-list">
                  {board.gateRows.map((gate) => (
                    <div className="workspace-row" key={gate.code}>
                      <span>
                        <strong>{stateLabel(gate.code)}</strong>
                        <small>
                          {gate.evidenceClass ?? "NOT RECORDED"} ·{" "}
                          {gate.currentAcceptedScopeCount}/
                          {gate.recordedScopeCount} current accepted scopes
                        </small>
                      </span>
                      <span
                        className={`pill ${
                          gate.current ? "pill-ok" : "pill-warn"
                        }`}
                      >
                        {gate.current ? "CURRENT" : "OPEN"}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel workspace-module">
                <h2>Operational blockers</h2>
                <div className="workspace-list">
                  {blockerEntries.map(([key, count]) => (
                    <div className="workspace-row" key={key}>
                      <span>{stateLabel(key)}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                  {board.blockers.internalCoverageErrors.map((item) => (
                    <div className="msg warn" key={item}>
                      {item}
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel workspace-module">
                <h2>Signed activation</h2>
                {board.activation ? (
                  <>
                    <p>
                      <strong>{board.activation.manifestId}</strong>
                    </p>
                    <p className="meta">
                      {board.activation.status} · build{" "}
                      {board.activation.buildCommit} · expires{" "}
                      {new Date(board.activation.expiresAt).toLocaleString(
                        "en-IN"
                      )}
                    </p>
                    <span
                      className={`pill ${
                        board.activation.current ? "pill-ok" : "pill-warn"
                      }`}
                    >
                      {board.activation.current ? "CURRENT" : "NOT CURRENT"}
                    </span>
                  </>
                ) : (
                  <p className="meta">
                    No approved activation exists for this environment and
                    target. An assessment cannot create one.
                  </p>
                )}
              </article>
              <article className="panel workspace-module workspace-wide">
                <h2>Assessment history</h2>
                <div className="record-list">
                  {assessments.map((item) => (
                    <div className="record-card" key={item.id}>
                      <div className="record-head">
                        <strong>
                          {item.targetOperatingMode} ·{" "}
                          {stateLabel(item.boardState)}
                        </strong>
                        <span className="pill">{item.status}</span>
                      </div>
                      <p className="meta">
                        {item.environment} ·{" "}
                        {new Date(item.assessedAt).toLocaleString("en-IN")} ·{" "}
                        {item.assessmentDigest}
                      </p>
                      {item.status === "GENERATED" && (
                        <div className="button-row">
                          <button
                            className="btn btn-primary"
                            disabled={
                              !!busy || totp.length < 6 || !reviewReason.trim()
                            }
                            onClick={() =>
                              void reviewAssessment(item, "ACKNOWLEDGE")
                            }
                          >
                            Acknowledge current snapshot
                          </button>
                          <button
                            className="btn"
                            disabled={
                              !!busy || totp.length < 6 || !reviewReason.trim()
                            }
                            onClick={() =>
                              void reviewAssessment(item, "REJECT")
                            }
                          >
                            Reject snapshot
                          </button>
                        </div>
                      )}
                      {item.reviewReason && (
                        <p className="meta">Review: {item.reviewReason}</p>
                      )}
                    </div>
                  ))}
                  {!assessments.length && (
                    <p className="meta">
                      No immutable production-scale assessment has been
                      recorded.
                    </p>
                  )}
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </>
  );
}
