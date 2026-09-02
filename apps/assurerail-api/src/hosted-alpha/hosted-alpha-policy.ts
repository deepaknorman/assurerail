export const HOSTED_ALPHA_TASK_CATEGORIES = [
  "GOVERNANCE",
  "CASE",
  "EVIDENCE",
  "RECONCILIATION",
  "COMMERCIAL",
  "SERVICE",
] as const;
export type HostedAlphaTaskCategory = (typeof HOSTED_ALPHA_TASK_CATEGORIES)[number];

export const HOSTED_ALPHA_TASK_PRIORITIES = ["CRITICAL", "HIGH", "NORMAL", "LOW"] as const;
export type HostedAlphaTaskPriority = (typeof HOSTED_ALPHA_TASK_PRIORITIES)[number];
export type HostedAlphaDueState = "OVERDUE" | "DUE_SOON" | "OPEN" | "WATCH";

export interface HostedAlphaTask {
  id: string;
  category: HostedAlphaTaskCategory;
  priority: HostedAlphaTaskPriority;
  dueState: HostedAlphaDueState;
  title: string;
  summary: string;
  href: string;
  sourceType: string;
  sourceId: string;
  transactionCaseId: string | null;
  requiredAction: string;
  dueAt: string | null;
  operatingBoundary: "SHADOW";
}

const PRIORITY_RANK: Record<HostedAlphaTaskPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};
const DUE_RANK: Record<HostedAlphaDueState, number> = {
  OVERDUE: 0,
  DUE_SOON: 1,
  OPEN: 2,
  WATCH: 3,
};

export function dueState(dueAt: Date | null, now: Date): HostedAlphaDueState {
  if (!dueAt) return "OPEN";
  if (dueAt.getTime() <= now.getTime()) return "OVERDUE";
  return dueAt.getTime() <= now.getTime() + 72 * 60 * 60 * 1_000 ? "DUE_SOON" : "OPEN";
}

/** Stable priority/due-time ordering makes the same retained records produce the same inbox. */
export function orderHostedAlphaTasks(tasks: readonly HostedAlphaTask[]): HostedAlphaTask[] {
  return [...tasks].sort((left, right) => {
    const priority = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    if (priority) return priority;
    const due = DUE_RANK[left.dueState] - DUE_RANK[right.dueState];
    if (due) return due;
    const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id.localeCompare(right.id);
  });
}

export function taskCounts(tasks: readonly HostedAlphaTask[]) {
  return {
    total: tasks.length,
    actionRequired: tasks.filter((task) => task.dueState !== "WATCH").length,
    watch: tasks.filter((task) => task.dueState === "WATCH").length,
    critical: tasks.filter((task) => task.priority === "CRITICAL").length,
    overdue: tasks.filter((task) => task.dueState === "OVERDUE").length,
    dueSoon: tasks.filter((task) => task.dueState === "DUE_SOON").length,
    byCategory: Object.fromEntries(HOSTED_ALPHA_TASK_CATEGORIES.map((category) => [
      category,
      tasks.filter((task) => task.category === category).length,
    ])) as Record<HostedAlphaTaskCategory, number>,
  };
}
