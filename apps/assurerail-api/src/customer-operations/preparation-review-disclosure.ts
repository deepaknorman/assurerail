type ReviewedJob = {
  stage: string;
  status: string;
  resultDigest?: string | null;
  reviewSnapshot?: unknown;
};

/** Disclose the qualification captured at sign-off, never today's mutable configuration. */
export function preparationReviewDisclosure(job: ReviewedJob) {
  if (job.stage !== "PREPARATION" || job.status !== "RELEASED") return null;
  const snapshot = job.reviewSnapshot as {
    resultDigest?: unknown;
    qualification?: { qualificationRef?: unknown; syntheticDemoOnly?: unknown };
  } | null | undefined;
  const qualificationRef = snapshot?.qualification?.qualificationRef;
  if (!job.resultDigest || snapshot?.resultDigest !== job.resultDigest
    || typeof qualificationRef !== "string" || !qualificationRef.trim()) {
    return { status: "UNAVAILABLE", label: "Reviewer qualification unavailable." } as const;
  }
  const syntheticDemoOnly = snapshot.qualification?.syntheticDemoOnly === true
    || /^demo:\/\//i.test(qualificationRef.trim());
  return {
    status: syntheticDemoOnly ? "SYNTHETIC_DEMONSTRATION_ONLY" : "PLATFORM_APPROVED",
    syntheticDemoOnly,
    label: syntheticDemoOnly
      ? "Reviewed using a synthetic qualification — demonstration only; not professional sign-off."
      : "Completed using a platform-approved reviewer qualification.",
    qualificationRef,
    resultDigest: job.resultDigest,
  } as const;
}
