import assert from "node:assert/strict";
import test from "node:test";
import { dueState, orderHostedAlphaTasks, taskCounts, type HostedAlphaTask } from "./hosted-alpha-policy";

const now = new Date("2026-09-02T06:00:00.000Z");
const task = (overrides: Partial<HostedAlphaTask> & Pick<HostedAlphaTask, "id">): HostedAlphaTask => ({
  category: "CASE",
  priority: "NORMAL",
  dueState: "OPEN",
  title: "Task",
  summary: "Retained source record requires review.",
  href: "/workspace",
  sourceType: "FIXTURE",
  sourceId: overrides.id,
  transactionCaseId: null,
  requiredAction: "VIEW_CASE",
  dueAt: null,
  operatingBoundary: "SHADOW",
  ...overrides,
});

test("[AR21][TASKS] due state is explicit and bounded to a 72-hour due-soon window", () => {
  assert.equal(dueState(null, now), "OPEN");
  assert.equal(dueState(new Date("2026-09-02T05:59:59.000Z"), now), "OVERDUE");
  assert.equal(dueState(new Date("2026-09-05T06:00:00.000Z"), now), "DUE_SOON");
  assert.equal(dueState(new Date("2026-09-05T06:00:00.001Z"), now), "OPEN");
});

test("[AR21][TASKS] tasks sort by priority, due state, due time and stable id", () => {
  const ordered = orderHostedAlphaTasks([
    task({ id: "normal" }),
    task({ id: "critical-later", priority: "CRITICAL", dueState: "DUE_SOON", dueAt: "2026-09-04T00:00:00.000Z" }),
    task({ id: "critical-overdue", priority: "CRITICAL", dueState: "OVERDUE", dueAt: "2026-09-01T00:00:00.000Z" }),
    task({ id: "high", priority: "HIGH" }),
  ]);
  assert.deepEqual(ordered.map((item) => item.id), ["critical-overdue", "critical-later", "high", "normal"]);
});

test("[AR21][TASKS] summary counts preserve empty categories instead of implying unavailable data", () => {
  const counts = taskCounts([
    task({ id: "break", category: "RECONCILIATION", priority: "CRITICAL", dueState: "OVERDUE" }),
    task({ id: "evidence", category: "EVIDENCE", dueState: "DUE_SOON" }),
  ]);
  assert.equal(counts.total, 2);
  assert.equal(counts.actionRequired, 2);
  assert.equal(counts.watch, 0);
  assert.equal(counts.critical, 1);
  assert.equal(counts.overdue, 1);
  assert.equal(counts.byCategory.GOVERNANCE, 0);
  assert.equal(counts.byCategory.RECONCILIATION, 1);
});

test("[AR21][TASKS] watch items remain visible but are not counted as action required", () => {
  const counts = taskCounts([task({ id: "watch", category: "SERVICE", priority: "LOW", dueState: "WATCH" })]);
  assert.equal(counts.total, 1);
  assert.equal(counts.actionRequired, 0);
  assert.equal(counts.watch, 1);
});
