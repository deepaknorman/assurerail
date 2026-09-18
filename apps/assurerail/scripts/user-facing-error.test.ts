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

// A caught value reaches the screen either at the sink (a state setter) or through an alias
// assigned earlier. The original guard read only single-line sinks, so `setError(String(e))`,
// a sink split across lines, and `const detail = (e as Error).message` all passed. Both shapes
// are checked here; the reviewed wrappers are the only sanctioned way for caught values to
// reach customer copy.
const CAUGHT = String.raw`(?:\([^)]*as Error\)|\b(?:e|err|error|cause|reason|failure)\b)`;
const SINK = /\bset(?:Error|Err|Message|Feedback|Status|Notice)\s*\(/g;
const SANCTIONED = /\b(?:userFacingError|authenticationError|UserFacingError)\s*\(/;

/** The sink's argument text, to its balanced closing parenthesis (newlines included). */
function argumentText(source: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === "(") depth += 1;
    else if (source[i] === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return source.slice(openIndex + 1, openIndex + 400);
}

function leaksCaughtValue(source: string): boolean {
  const unsafeExpression = new RegExp(
    [
      `${CAUGHT}\\s*\\.\\s*message`,          // e.message, (cause as Error).message
      `${CAUGHT}\\s*\\.\\s*toString\\s*\\(`,  // e.toString()
      `\\bString\\s*\\(\\s*${CAUGHT}\\s*\\)`, // String(e)
      `\\bJSON\\.stringify\\s*\\(\\s*${CAUGHT}`, // JSON.stringify(e)
      `\\$\\{\\s*${CAUGHT}\\s*\\}`,           // `${e}`
    ].join("|"),
  );

  SINK.lastIndex = 0;
  for (let match = SINK.exec(source); match; match = SINK.exec(source)) {
    const argument = argumentText(source, SINK.lastIndex - 1);
    if (unsafeExpression.test(argument) && !SANCTIONED.test(argument)) return true;
  }

  // Aliasing the raw message earlier and rendering the alias later defeats any sink check,
  // so the assignment itself must go through a reviewed wrapper.
  const alias = new RegExp(
    String.raw`\b(?:const|let|var)\s+\w+\s*(?::[^=\n]+)?=\s*[^;\n]*${CAUGHT}\s*\.\s*message`,
  );
  for (const line of source.split("\n")) {
    if (alias.test(line) && !SANCTIONED.test(line)) return true;
  }
  return false;
}

test("client screens do not render caught error values directly", () => {
  const unsafe: string[] = [];
  for (const path of sourceFiles(new URL("../src/app", import.meta.url).pathname)) {
    if (leaksCaughtValue(readFileSync(path, "utf8"))) unsafe.push(path);
  }
  assert.deepEqual(unsafe, [], `Route errors must pass through userFacingError():\n${unsafe.join("\n")}`);
});

test("the leak guard catches aliased, wrapped and multi-line shapes", () => {
  const leaks = [
    `setError((cause as Error).message);`,
    `setError(String(err));`,
    `setError(err.toString());`,
    "setError(`could not load: ${error}`);",
    `setError(\n  (cause as Error).message,\n);`,
    `const detail = (cause as Error).message;\nsetError(detail);`,
    `setMessage(JSON.stringify(error));`,
  ];
  for (const sample of leaks) assert.equal(leaksCaughtValue(sample), true, `should flag: ${sample}`);

  const safe = [
    `setError(userFacingError(cause, "The assessment could not be refreshed. Please try again."));`,
    `setError(authenticationError(cause, "SESSION"));`,
    `setError("");`,
    `setError(reviewedCopy);`,
    `const detail = userFacingError(cause);\nsetError(detail);`,
  ];
  for (const sample of safe) assert.equal(leaksCaughtValue(sample), false, `should allow: ${sample}`);
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
