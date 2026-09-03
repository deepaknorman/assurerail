"use client";

import { FormEvent, useState } from "react";
import {
  CURRENT_STAGES,
  INQUIRY_ROUTES,
  INSTITUTION_TYPES,
  OWNER_STATES,
  TIMINGS,
  type ReplayInquiry,
} from "@/lib/inbound-contract";
import styles from "@/app/public-site.module.css";

const LABELS: Record<string, string> = {
  NBFC_ORIGINATOR: "NBFC / originator",
  BANK_OR_TRANSFEREE: "Bank / transferee",
  INVESTOR: "Institutional investor",
  TRUSTEE: "Trustee",
  RTA_OR_DEPOSITORY: "RTA / depository",
  ADVISOR_OR_PROVIDER: "Advisor / service provider",
  DA: "Direct assignment",
  PTC: "PTC",
  BOTH: "Both DA and PTC",
  EXPLORING: "Exploring the control problem",
  COMPLETED_DEAL_AVAILABLE: "Completed transaction available for replay",
  LIVE_PIPELINE: "Live pipeline; no replay nominated yet",
  EXISTING_PLATFORM_REVIEW: "Reviewing an existing platform/process",
  NAMED: "Named and authorised to discuss the file",
  IDENTIFYING: "Being identified",
  NOT_YET: "Not yet",
  WITHIN_30_DAYS: "Within 30 days",
  ONE_TO_THREE_MONTHS: "1–3 months",
  THREE_TO_SIX_MONTHS: "3–6 months",
  LATER: "Later / exploratory",
};

const initial: ReplayInquiry = {
  organization: "",
  workEmail: "",
  jobRole: "",
  institutionType: "NBFC_ORIGINATOR",
  route: "BOTH",
  currentStage: "EXPLORING",
  transactionOwner: "IDENTIFYING",
  timing: "ONE_TO_THREE_MONTHS",
  consent: false,
  website: "",
};

export function ReplayInquiryForm() {
  const [form, setForm] = useState<ReplayInquiry>(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const set = <K extends keyof ReplayInquiry>(key: K, value: ReplayInquiry[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const payload = await response.json() as { message?: string };
      setResult({ ok: response.ok, message: payload.message ?? (response.ok ? "Enquiry recorded." : "The enquiry could not be recorded.") });
      if (response.ok) setForm(initial);
    } catch {
      setResult({ ok: false, message: "The enquiry could not be recorded. Please try again later." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formGrid}>
        <div className={styles.field}><label htmlFor="organization">Organisation</label><input id="organization" autoComplete="organization" required minLength={2} maxLength={120} value={form.organization} onChange={(event) => set("organization", event.target.value)} /></div>
        <div className={styles.field}><label htmlFor="workEmail">Work email</label><input id="workEmail" type="email" autoComplete="email" required maxLength={180} value={form.workEmail} onChange={(event) => set("workEmail", event.target.value)} /></div>
        <div className={styles.field}><label htmlFor="jobRole">Your role</label><input id="jobRole" autoComplete="organization-title" required minLength={2} maxLength={100} value={form.jobRole} onChange={(event) => set("jobRole", event.target.value)} /></div>
        <div className={styles.field}><label htmlFor="institutionType">Institution type</label><select id="institutionType" value={form.institutionType} onChange={(event) => set("institutionType", event.target.value as ReplayInquiry["institutionType"])}>{INSTITUTION_TYPES.map((value) => <option value={value} key={value}>{LABELS[value]}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="route">Route of interest</label><select id="route" value={form.route} onChange={(event) => set("route", event.target.value as ReplayInquiry["route"])}>{INQUIRY_ROUTES.map((value) => <option value={value} key={value}>{LABELS[value]}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="currentStage">Current stage</label><select id="currentStage" value={form.currentStage} onChange={(event) => set("currentStage", event.target.value as ReplayInquiry["currentStage"])}>{CURRENT_STAGES.map((value) => <option value={value} key={value}>{LABELS[value]}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="transactionOwner">Completed-deal data owner</label><select id="transactionOwner" value={form.transactionOwner} onChange={(event) => set("transactionOwner", event.target.value as ReplayInquiry["transactionOwner"])}>{OWNER_STATES.map((value) => <option value={value} key={value}>{LABELS[value]}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="timing">Preferred timing</label><select id="timing" value={form.timing} onChange={(event) => set("timing", event.target.value as ReplayInquiry["timing"])}>{TIMINGS.map((value) => <option value={value} key={value}>{LABELS[value]}</option>)}</select></div>
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}><label htmlFor="website">Website</label><input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => set("website", event.target.value)} /></div>
        <label className={styles.consent}><input type="checkbox" required checked={form.consent} onChange={(event) => set("consent", event.target.checked)} /><span>I agree to be contacted about an AssureRail institutional replay or pilot. I will not submit borrower data, transaction files or confidential deal information through this form.</span></label>
        <button className={styles.submit} disabled={busy}>{busy ? "Recording…" : "Request replay discovery"}</button>
        {result ? <p className={styles.formMessage} role="status">{result.message}</p> : null}
      </div>
    </form>
  );
}
