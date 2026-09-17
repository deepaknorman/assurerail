import type { ReactNode } from "react";

type FeedbackBannerProps = {
  error?: ReactNode;
  success?: ReactNode;
  id?: string;
};

/**
 * Presents async feedback consistently to visual and assistive-technology users.
 * Errors are assertive alerts; successful outcomes are polite status updates.
 */
export function FeedbackBanner({ error, success, id }: FeedbackBannerProps) {
  if (!error && !success) return null;

  return error ? (
    <div className="msg err" id={id} role="alert" aria-atomic="true">
      {error}
    </div>
  ) : (
    <div className="msg ok" id={id} role="status" aria-atomic="true">
      {success}
    </div>
  );
}
