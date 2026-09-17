"use client";
import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { enterpriseIntegrationEnabled } from "@/lib/customer-workspace";
import { vget } from "@/lib/venue";
import { useScopedResource } from "@/lib/use-scoped-resource";

type Gate = {
  gateCode: string;
  gateKind: string;
  currentStatus?: string;
  status: string;
  accountableParty: string;
};
type Profile = {
  id: string;
  connectorClass: string;
  direction: string;
  status: string;
  connectorRegistration: {
    displayName: string;
    transport: string;
    status: string;
  };
  readiness: {
    softwareConformant: boolean;
    externalEvidenceVerified: boolean;
    shadowReady: boolean;
    safePaused: boolean;
    openGates: Gate[];
  };
  healthObservations: Array<{ observedStatus: string; sourceAsOfAt: string }>;
};
type Catalogue = {
  version: string;
  connectorClasses: Array<{ connectorClass: string; gates: Gate[] }>;
  boundary: {
    operatingMode: string;
    dispatchPermitted: false;
    credentialsStored: false;
    softwareConformanceIsCertification: false;
  };
};

export default function EnterpriseIntegrationsPage() {
  const router = useRouter();
  const { loading, firebaseUser, needsOnboarding, activeInstitutionId } =
    useAuth();
  const enabled = enterpriseIntegrationEnabled();
  const load = useCallback(async () => {
    if (!activeInstitutionId || !enabled) throw new Error("Institution context is required");
    const root = `/v1/rail/institutions/${encodeURIComponent(
      activeInstitutionId
    )}/integrations`;
    const [profiles, catalogue] = await Promise.all([
      vget<Profile[]>(`${root}/profiles`),
      vget<Catalogue>(`${root}/catalogue/v1`),
    ]);
    return { profiles, catalogue };
  }, [activeInstitutionId, enabled]);
  const resource = useScopedResource({
    scopeKey: activeInstitutionId,
    enabled: enabled && !!firebaseUser,
    loader: load,
    errorFallback: "We couldn’t load the integration workspace. Refresh the page or try again.",
  });
  const data = resource.data;
  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/login");
    else if (!loading && needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);
  if (!enabled)
    return (
      <>
        <VenueHeader />
        <main className="wrap institutional-page">
          <div className="boundary-note">
            Enterprise integration governance is not enabled in this
            environment.
          </div>
        </main>
      </>
    );
  return (
    <>
      <VenueHeader />
      <main className="wrap institutional-page customer-workspace">
        <Link className="back-link" href="/workspace">
          ← Institution workspace
        </Link>
        <div className="console-head">
          <p className="eyebrow">AR-29 · shadow only</p>
          <h1>Enterprise integration register</h1>
          <p>
            Lender registry, trustee, RTA/depository, payment, signing,
            stamping, rating, servicing, finance, CRM and notification
            boundaries—governed separately from software fixtures and case
            authority.
          </p>
        </div>
        {resource.status === "loading" && activeInstitutionId && (
          <div className="msg" role="status">
            Loading this institution’s integration register…
          </div>
        )}
        {resource.error && (
          <div className="msg err" role="alert">
            {resource.error}
          </div>
        )}
        {data && (
          <>
            <div className="boundary-note">
              No profile dispatches instructions or stores credentials. A
              software pass is not certification; every external gate and a
              current healthy observation remain mandatory.
            </div>
            <section className="workspace-grid">
              <article className="panel workspace-module workspace-wide">
                <h2>Integration profiles</h2>
                <div className="workspace-list">
                  {data.profiles.map((profile) => {
                    const health =
                      profile.healthObservations[0]?.observedStatus ??
                      "NO OBSERVATION";
                    return (
                      <div className="workspace-row" key={profile.id}>
                        <span>
                          <strong>
                            {profile.connectorRegistration.displayName} ·{" "}
                            {profile.connectorClass}
                          </strong>
                          <small>
                            {profile.direction} ·{" "}
                            {profile.connectorRegistration.transport} · software{" "}
                            {profile.readiness.softwareConformant
                              ? "passed"
                              : "open"}{" "}
                            · external{" "}
                            {profile.readiness.externalEvidenceVerified
                              ? "verified"
                              : `${profile.readiness.openGates.length} gate(s) open`}{" "}
                            · health {health}
                          </small>
                        </span>
                        <span
                          className={`pill ${
                            profile.readiness.shadowReady
                              ? "pill-ok"
                              : "pill-warn"
                          }`}
                        >
                          {profile.readiness.safePaused
                            ? "SAFE PAUSED"
                            : profile.status}
                        </span>
                      </div>
                    );
                  })}
                  {!data.profiles.length && (
                    <p className="meta">
                      No governed enterprise integration profile exists yet.
                    </p>
                  )}
                </div>
              </article>
              <article className="panel workspace-module workspace-wide">
                <h2>Boundary catalogue v{data.catalogue.version}</h2>
                <div className="workspace-list">
                  {data.catalogue.connectorClasses.map((item) => (
                    <div className="workspace-row" key={item.connectorClass}>
                      <span>
                        <strong>
                          {item.connectorClass.replaceAll("_", " ")}
                        </strong>
                        <small>
                          Software conformance +{" "}
                          {
                            item.gates.filter(
                              (gate) => gate.gateKind === "EXTERNAL_EVIDENCE"
                            ).length
                          }{" "}
                          external acceptance gates
                        </small>
                      </span>
                      <span className="pill">NO DISPATCH</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </>
  );
}
