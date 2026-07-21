import { Injectable, Logger } from "@nestjs/common";
import { RecaptchaEnterpriseServiceClient } from "@google-cloud/recaptcha-enterprise";
import { loadGoogleCreds } from "./google-credentials";

export interface AssessResult {
  ok: boolean;
  score?: number;
  reason?: string;
}

// reCAPTCHA Enterprise assessment (the Assessment API, not classic verify) authenticated by the venue's
// Firebase Admin service account — which needs the "reCAPTCHA Enterprise Agent" IAM role granted. Env:
//   RECAPTCHA_SITE_KEY   public site key (6Lc8…)                 — required to assess
//   RECAPTCHA_ENFORCE    "true" ⇒ a failed/low assessment blocks; otherwise fail-soft (log-only)
//   RECAPTCHA_MIN_SCORE  default 0.5
// Fail-soft by default so login isn't bricked before the IAM role is confirmed; flip RECAPTCHA_ENFORCE
// on once the assessment is proven working on the box.
@Injectable()
export class RecaptchaService {
  private readonly log = new Logger("Recaptcha");
  private client?: RecaptchaEnterpriseServiceClient;
  private readonly projectId: string;
  private readonly siteKey = (process.env.RECAPTCHA_SITE_KEY || "").trim();
  private readonly enforce = process.env.RECAPTCHA_ENFORCE === "true";
  private readonly minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");

  constructor() {
    const creds = loadGoogleCreds();
    this.projectId = (process.env.RECAPTCHA_PROJECT_ID || creds?.projectId || "assurerail").trim();
    if (creds && this.siteKey) {
      this.client = new RecaptchaEnterpriseServiceClient({
        credentials: { client_email: creds.clientEmail, private_key: creds.privateKey },
        projectId: this.projectId,
      });
      this.log.log(`reCAPTCHA Enterprise ready (project ${this.projectId}, enforce=${this.enforce})`);
    } else {
      this.log.warn(`reCAPTCHA not configured (siteKey=${!!this.siteKey}, creds=${!!creds}) — assessments skipped (enforce=${this.enforce})`);
    }
  }

  /** Assess a token for an expected action. ok=false only blocks the caller when RECAPTCHA_ENFORCE=true. */
  async assess(token: string | undefined, expectedAction: string, ip?: string): Promise<AssessResult> {
    if (!this.client || !this.siteKey) return { ok: !this.enforce, reason: "recaptcha-not-configured" };
    if (!token) return { ok: !this.enforce, reason: "missing-token" };
    try {
      const [a] = await this.client.createAssessment({
        parent: `projects/${this.projectId}`,
        assessment: { event: { token, siteKey: this.siteKey, expectedAction, userIpAddress: ip } },
      });
      const props = a.tokenProperties;
      if (!props?.valid) return { ok: !this.enforce, score: 0, reason: `invalid-token:${props?.invalidReason ?? "unknown"}` };
      if (props.action !== expectedAction) return { ok: !this.enforce, reason: `action-mismatch:${props.action}` };
      const score = a.riskAnalysis?.score ?? 0;
      const ok = score >= this.minScore;
      if (!ok) this.log.warn(`low reCAPTCHA score ${score} for action ${expectedAction}`);
      return { ok: ok || !this.enforce, score, reason: ok ? undefined : `low-score:${score}` };
    } catch (e) {
      this.log.warn(`assess failed (${(e as Error).message}) — ${this.enforce ? "BLOCKING" : "allowing (fail-soft)"}`);
      return { ok: !this.enforce, reason: "assess-error" };
    }
  }
}
