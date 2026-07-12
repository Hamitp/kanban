import type {
  AppData,
  CalendarEvent,
  CalendarEventType,
  CorrectiveAction,
  EffortPoints,
  FlowRole,
  IssueSeverity,
  IssueStatus,
  Language,
  ProblemIssue,
  TaskCard,
  TaskTransition,
} from "./types";

export const effortPointOptions: EffortPoints[] = [1, 2, 3, 5, 8];
export const committedRoles = new Set<FlowRole>(["planned", "active", "done"]);
export type BurnupRangeDays = 7 | 15 | 21 | 30 | 90;

export function taskEffort(task: TaskCard): EffortPoints {
  return effortPointOptions.includes(task.effortPoints as EffortPoints)
    ? task.effortPoints as EffortPoints
    : 1;
}

export function appendTaskTransition(
  task: TaskCard,
  transition: Omit<TaskTransition, "id">,
  id: string,
): TaskCard {
  return {
    ...task,
    transitions: [...(task.transitions ?? []), { ...transition, id }],
    updatedAt: transition.occurredAt,
  };
}

export function createProblemIssue(
  id: string,
  projectId: string,
  title: string,
  stamp = new Date().toISOString(),
): ProblemIssue {
  return {
    id,
    projectId,
    title,
    description: "",
    impact: "",
    severity: "medium",
    status: "open",
    assigneeIds: [],
    observedOn: stamp.slice(0, 10),
    evidence: [],
    whys: [],
    fishbone: [],
    rootCause: "",
    actions: [],
    a3: {
      background: "",
      currentState: "",
      targetState: "",
      rootCauseSummary: "",
      countermeasures: "",
      implementationPlan: "",
      verificationResult: "",
      standardization: "",
      lessonsLearned: "",
    },
    verificationNote: "",
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function transitionIssueStatus(
  issue: ProblemIssue,
  status: IssueStatus,
  stamp = new Date().toISOString(),
): ProblemIssue | null {
  if (status === "closed" && issue.verificationEffective !== true) return null;
  return {
    ...issue,
    status,
    closedAt: status === "closed" ? stamp : undefined,
    updatedAt: stamp,
  };
}

export function createCorrectiveAction(
  id: string,
  title: string,
  stamp = new Date().toISOString(),
): CorrectiveAction {
  return {
    id,
    title,
    description: "",
    assigneeIds: [],
    effortPoints: 1,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function createCalendarEvent(
  id: string,
  title: string,
  date: string,
  type: CalendarEventType = "planned",
  stamp = new Date().toISOString(),
): CalendarEvent {
  return { id, title, date, type, note: "", createdAt: stamp, updatedAt: stamp };
}

interface BurnupTask {
  task: TaskCard;
  currentRole?: FlowRole;
}

function taskScopeDate({ task, currentRole }: BurnupTask): { date?: string; approximate: boolean } {
  const transition = [...(task.transitions ?? [])]
    .filter((event) => event.toRole && committedRoles.has(event.toRole))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];
  if (transition) return { date: transition.occurredAt, approximate: transition.inferred === true };
  if (currentRole && committedRoles.has(currentRole)) return { date: task.createdAt, approximate: true };
  return { approximate: false };
}

function taskCompletionDate({ task }: BurnupTask): string | undefined {
  return task.completedAt
    ?? [...(task.transitions ?? [])]
      .filter((event) => event.toRole === "done")
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0]?.occurredAt;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getProjectBurnup(
  data: AppData,
  projectId: string,
  options: { days?: BurnupRangeDays; mode?: "tasks" | "points"; today?: Date; language?: Language } = {},
) {
  const today = options.today ?? new Date();
  const mode = options.mode ?? "tasks";
  const tasks: BurnupTask[] = data.boards
    .filter((board) => !board.archived && board.projectId === projectId)
    .flatMap((board) => board.columns.flatMap((column) => column.taskIds
      .map((taskId) => board.tasks[taskId])
      .filter(Boolean)
      .map((task) => ({ task, currentRole: column.role }))));
  const scoped = tasks.map((item) => ({
    ...item,
    scope: taskScopeDate(item),
    completedAt: taskCompletionDate(item),
    weight: mode === "points" ? taskEffort(item.task) : 1,
  })).filter((item) => item.scope.date);
  const earliest = scoped.map((item) => item.scope.date!).sort()[0] ?? dateKey(today);
  const start = options.days
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - options.days + 1)
    : new Date(`${earliest.slice(0, 10)}T00:00:00`);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const points = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = dateKey(cursor);
    const endOfDay = `${key}T23:59:59.999`;
    const scope = scoped.filter((item) => item.scope.date! <= endOfDay).reduce((sum, item) => sum + item.weight, 0);
    const completed = scoped.filter((item) => item.completedAt && item.completedAt <= endOfDay).reduce((sum, item) => sum + item.weight, 0);
    points.push({
      date: key,
      label: new Intl.DateTimeFormat(options.language === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "short" }).format(cursor),
      scope,
      completed,
    });
  }
  const last = points.at(-1) ?? { scope: 0, completed: 0 };
  return {
    points,
    total: last.scope,
    completed: last.completed,
    remaining: Math.max(0, last.scope - last.completed),
    progress: last.scope ? Math.round((last.completed / last.scope) * 100) : 0,
    approximate: scoped.some((item) => item.scope.approximate),
  };
}

export function getIssueInsights(issues: ProblemIssue[], today = new Date()) {
  const open = issues.filter((issue) => issue.status !== "closed");
  const closed = issues.filter((issue) => issue.status === "closed" && issue.closedAt);
  const averageResolutionDays = closed.length
    ? Math.round(closed.reduce((sum, issue) => sum + Math.max(0, new Date(issue.closedAt!).getTime() - new Date(issue.createdAt).getTime()), 0) / closed.length / 86_400_000)
    : 0;
  const rootCauses = Object.entries(issues.reduce<Record<string, number>>((counts, issue) => {
    const key = issue.rootCause.trim();
    if (key) counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]);
  return {
    open: open.length,
    verifying: open.filter((issue) => issue.status === "verifying").length,
    overdueFollowUps: open.filter((issue) => issue.followUpDate && issue.followUpDate < dateKey(today)).length,
    averageResolutionDays,
    rootCauses,
    severity: (["low", "medium", "high", "critical"] as IssueSeverity[]).reduce<Record<IssueSeverity, number>>((counts, severity) => {
      counts[severity] = issues.filter((issue) => issue.severity === severity).length;
      return counts;
    }, { low: 0, medium: 0, high: 0, critical: 0 }),
  };
}
