import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { UserFacingError, authenticationError, userFacingError } from "../src/lib/user-facing-error.ts";

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

test("authentication failures use reviewed customer copy", () => {
  assert.equal(
    authenticationError({ code: "auth/invalid-credential", message: "Firebase: Error (auth/invalid-credential)." }),
    "The email or password was not recognised. Check the details and try again.",
  );
  assert.equal(
    authenticationError({ code: "auth/email-already-in-use" }, "REGISTER"),
    "An account already exists for this email. Sign in instead.",
  );
  assert.equal(
    authenticationError(new Error("credential vault stack: secret-ref-123"), "SESSION"),
    "We could not open your AssureRail session. Sign in again or contact your organisation administrator.",
  );
});

test("unknown failures never expose raw technical messages", () => {
  const raw = "Prisma P2025 at internal-host:5432 with provider response";
  assert.equal(userFacingError(new Error(raw)), "We could not complete that action. Please try again.");
  assert.equal(userFacingError(new Error(raw), "The assessment could not be refreshed. Please try again."), "The assessment could not be refreshed. Please try again.");
});

test("reviewed application errors and recognised browser failures remain actionable", () => {
  assert.equal(userFacingError(new UserFacingError("Your session has expired. Sign in again to continue.")), "Your session has expired. Sign in again to continue.");
  assert.equal(userFacingError({ name: "AbortError", message: "operation aborted at internal line 5" }), "The request took too long. Please try again.");
  assert.equal(userFacingError({ name: "NetworkError", message: "fetch tcp details" }), "We could not reach AssureRail. Check your connection and try again.");
});

test("client screens do not render caught Error.message values directly", () => {
  const unsafe: string[] = [];
  for (const path of sourceFiles(new URL("../src/app", import.meta.url).pathname)) {
    const source = readFileSync(path, "utf8");
    if (/set(?:Error|Err)\([^;\n]*(?:as Error\)|\b(?:e|err|error|cause)\b)\.message/.test(source)) unsafe.push(path);
  }
  assert.deepEqual(unsafe, [], `Route errors must pass through userFacingError():\n${unsafe.join("\n")}`);
});

test("switching between sign-in and registration clears the previous authentication error", () => {
  const login = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
  assert.match(login, /function changeMode\(\)[\s\S]*?clearError\(\)[\s\S]*?setRegister/);
  assert.match(login, /onClick=\{changeMode\}/);
});

test("authentication supports keyboard submission and action-specific progress", () => {
  const login = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
  assert.match(login, /<form[^>]*onSubmit=\{submitEmail\}/);
  assert.match(login, /type="submit"/);
  assert.match(login, /Connecting to Google…/);
  assert.match(login, /Creating account…/);
  assert.match(login, /Signing in…/);
});

test("shared feedback distinguishes errors from successful status updates", () => {
  const feedback = readFileSync(new URL("../src/components/FeedbackBanner.tsx", import.meta.url), "utf8");
  assert.match(feedback, /role="alert"/);
  assert.match(feedback, /role="status"/);
  assert.match(feedback, /aria-atomic="true"/);
});
