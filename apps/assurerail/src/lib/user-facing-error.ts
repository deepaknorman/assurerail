type ErrorWithCode = { code?: unknown; name?: unknown; message?: unknown };

const text = (value: unknown) => typeof value === "string" ? value : "";

/** A reviewed message that is intentionally safe to show to an authenticated customer. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/**
 * Converts an unknown client-side failure into copy that is safe to render. Raw provider,
 * API and stack messages are deliberately excluded unless the error was created as a
 * reviewed user-facing error by this application.
 */
export function userFacingError(cause: unknown, fallback = "We could not complete that action. Please try again."): string {
  const error = cause && typeof cause === "object" ? cause as ErrorWithCode : {};
  if (cause instanceof UserFacingError && text(cause.message)) return cause.message;

  const code = text(error.code).toLowerCase();
  const name = text(error.name).toLowerCase();
  if (code.includes("network") || name === "networkerror") return "We could not reach AssureRail. Check your connection and try again.";
  if (name === "aborterror") return "The request took too long. Please try again.";
  if (name === "notallowederror") return "The requested security check was cancelled or not allowed on this device.";
  if (name === "invalidstateerror") return "That security method is already registered or is not available in the current state.";
  return fallback;
}

export function authenticationError(cause: unknown, action: "SIGN_IN" | "REGISTER" | "SESSION" = "SIGN_IN"): string {
  const error = cause && typeof cause === "object" ? cause as ErrorWithCode : {};
  if (cause instanceof UserFacingError && text(cause.message)) return cause.message;
  const code = text(error.code).toLowerCase();
  const message = text(error.message).toLowerCase();

  if (["auth/invalid-credential", "auth/invalid-login-credentials", "auth/user-not-found", "auth/wrong-password"].includes(code)) {
    return "The email or password was not recognised. Check the details and try again.";
  }
  if (code === "auth/email-already-in-use") return "An account already exists for this email. Sign in instead.";
  if (code === "auth/invalid-email") return "Enter a valid work email address.";
  if (code === "auth/weak-password") return "Choose a stronger password with at least eight characters.";
  if (code === "auth/too-many-requests") return "Sign-in is temporarily limited after repeated attempts. Wait a moment and try again.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "The sign-in window was closed before authentication finished.";
  if (code === "auth/popup-blocked") return "Your browser blocked the sign-in window. Allow pop-ups for AssureRail and try again.";
  if (code === "auth/network-request-failed") return "We could not reach the identity service. Check your connection and try again.";
  if (code === "auth/operation-not-allowed" || message.includes("authentication is not configured")) return "This sign-in method is not available in the current environment.";
  if (code === "auth/user-disabled") return "This account is not active. Contact your organisation administrator.";
  if (code === "auth/requires-recent-login") return "Please sign in again before making this security change.";
  if (action === "REGISTER") return "We could not create the account. Review the details or use another sign-in method.";
  if (action === "SESSION") return "We could not open your AssureRail session. Sign in again or contact your organisation administrator.";
  return "We could not sign you in. Review the details and try again.";
}
