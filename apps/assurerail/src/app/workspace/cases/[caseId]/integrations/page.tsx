"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { enterpriseIntegrationEnabled } from "@/lib/customer-workspace";
import { vget } from "@/lib/venue";
type Binding = {
  id: string;
  materialFunction: string;
  authorityClass: string;
  direction: string;
  status: string;
  effectiveStatus: string;
  performerInstitutionId: string;
  enterpriseIntegrationProfile: {
    connectorClass: string;
    connectorRegistration: { displayName: string };
    healthObservations: Array<{ observedStatus: string }>;
  };
};
export default function CaseIntegrationsPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = String(params.caseId);
  const router = useRouter();
  const { loading, firebaseUser, needsOnboarding } = useAuth();
  const enabled = enterpriseIntegrationEnabled();
  const [items, setItems] = useState<Binding[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      setItems(
        await vget<Binding[]>(
          `/v1/rail/cases/${encodeURIComponent(caseId)}/integrations`
        )
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [caseId, enabled]);
  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/login");
    else if (!loading && needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => {
    if (firebaseUser) void load();
  }, [firebaseUser, load]);
  if (!enabled)
    return (
      <>
        <VenueHeader />
        <main className="wrap institutional-page">
          <div className="boundary-note">
            Case integration governance is not enabled.
          </div>
        </main>
      </>
    );
  return (
    <>
      <VenueHeader />
      <main className="wrap institutional-page customer-workspace">
        <Link
          className="back-link"
          href={`/workspace/cases/${encodeURIComponent(caseId)}`}
        >
          ← Case workspace
        </Link>
        <div className="console-head">
          <p className="eyebrow">Case-specific authority · shadow</p>
          <h1>Case integration bindings</h1>
          <p>
            Only profiles matching an active case function assignment and
            performer can be independently approved here. A binding records
            authority; it never dispatches the act.
          </p>
        </div>
        {error && (
          <div className="msg err" role="alert">
            {error}
          </div>
        )}
        <section className="panel workspace-module">
          <div className="workspace-list">
            {items.map((item) => (
              <div className="workspace-row" key={item.id}>
                <span>
                  <strong>
                    {item.materialFunction} ·{" "}
                    {
                      item.enterpriseIntegrationProfile.connectorRegistration
                        .displayName
                    }
                  </strong>
                  <small>
                    {item.enterpriseIntegrationProfile.connectorClass} ·{" "}
                    {item.direction} · {item.authorityClass} · health{" "}
                    {item.enterpriseIntegrationProfile.healthObservations[0]
                      ?.observedStatus ?? "unknown"}
                  </small>
                </span>
                <span
                  className={`pill ${
                    item.effectiveStatus === "SAFE_PAUSED" ? "pill-warn" : ""
                  }`}
                >
                  {item.effectiveStatus}
                </span>
              </div>
            ))}
            {!items.length && (
              <p className="meta">
                No enterprise connector is bound to this case.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
