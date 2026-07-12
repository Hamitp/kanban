import { currencyCodes, getPortfolioFinance } from "./projectFinance.ts";
import { getTaskWorkMs } from "./taskTiming.ts";
import type { AppData, CurrencyCode, KanbanBoard, Language, Project, TaskCard } from "./types";

export interface FlowStats {
  backlog: number;
  planned: number;
  active: number;
  done: number;
  waiting: number;
  committed: number;
  progress: number;
  averageDays: number;
}

export interface LocatedTask {
  task: TaskCard;
  board: KanbanBoard;
  columnId: string;
  role?: "backlog" | "planned" | "active" | "done";
}

export function getBoardFlowStats(board: KanbanBoard): FlowStats {
  const totals = { backlog: 0, planned: 0, active: 0, done: 0 };
  const doneTaskIds = new Set<string>();
  board.columns.forEach((column) => {
    const role = column.role ?? "backlog";
    totals[role] += column.taskIds.length;
    if (role === "done") column.taskIds.forEach((taskId) => doneTaskIds.add(taskId));
  });
  const waiting = Object.values(board.tasks).filter(
    (task) => task.waitingReason && !doneTaskIds.has(task.id),
  ).length;
  const completionTimes = Object.values(board.tasks)
    .filter((task) => task.completedAt && task.workSessions?.length)
    .map((task) => getTaskWorkMs(task));
  const committed = totals.planned + totals.active + totals.done;
  const progress = committed ? Math.round((totals.done / committed) * 100) : 0;
  const averageDays = completionTimes.length
    ? Math.max(
        1,
        Math.round(
          completionTimes.reduce((sum, value) => sum + value, 0) /
            completionTimes.length /
            86_400_000,
        ),
      )
    : 0;
  return { ...totals, waiting, committed, progress, averageDays };
}

export function getProjectFlowStats(project: Project, data: AppData) {
  const boards = data.boards.filter(
    (board) => board.projectId === project.id && !board.archived,
  );
  const stats = boards.map(getBoardFlowStats);
  const totals = stats.reduce(
    (sum, current) => ({
      backlog: sum.backlog + current.backlog,
      planned: sum.planned + current.planned,
      active: sum.active + current.active,
      done: sum.done + current.done,
      waiting: sum.waiting + current.waiting,
      committed: sum.committed + current.committed,
    }),
    { backlog: 0, planned: 0, active: 0, done: 0, waiting: 0, committed: 0 },
  );
  const completionTimes = boards.flatMap((board) =>
    Object.values(board.tasks)
      .filter((task) => task.completedAt && task.workSessions?.length)
      .map((task) => getTaskWorkMs(task)),
  );
  return {
    boards: boards.length,
    ...totals,
    progress: totals.committed ? Math.round((totals.done / totals.committed) * 100) : 0,
    averageDays: completionTimes.length
      ? Math.max(
          1,
          Math.round(
            completionTimes.reduce((sum, value) => sum + value, 0) /
              completionTimes.length /
              86_400_000,
          ),
        )
      : 0,
  };
}

export function getLocatedTasks(data: AppData) {
  const activeProjectIds = new Set(
    data.projects.filter((project) => !project.archived).map((project) => project.id),
  );
  return data.boards
    .filter((board) => !board.archived && activeProjectIds.has(board.projectId))
    .flatMap((board) =>
      board.columns.flatMap((column) =>
        column.taskIds
          .map((taskId) => board.tasks[taskId])
          .filter(Boolean)
          .map((task) => ({ task, board, columnId: column.id, role: column.role })),
      ),
    );
}

export function getCycleTimeStats(tasks: LocatedTask[]) {
  const days = tasks
    .filter(({ task }) => task.completedAt && task.workSessions?.length)
    .map(({ task }) => Math.max(1, Math.ceil(getTaskWorkMs(task) / 86_400_000)))
    .sort((a, b) => a - b);
  const percentile = (value: number) =>
    days.length ? days[Math.min(days.length - 1, Math.ceil(days.length * value) - 1)] : 0;
  return {
    samples: days.length,
    medianDays: percentile(0.5),
    p85Days: percentile(0.85),
    averageDays: days.length
      ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length)
      : 0,
  };
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy;
}

export function getWeeklyThroughput(tasks: LocatedTask[], today = new Date(), weeks = 8, language: Language = "tr") {
  const currentWeek = startOfWeek(today);
  const buckets = Array.from({ length: weeks }, (_, index) => {
    const start = new Date(currentWeek);
    start.setDate(start.getDate() - (weeks - index - 1) * 7);
    return {
      key: start.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "short" }).format(start),
      count: 0,
    };
  });
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  tasks.forEach(({ task }) => {
    if (!task.completedAt) return;
    const key = startOfWeek(new Date(task.completedAt)).toISOString().slice(0, 10);
    const bucket = bucketByKey.get(key);
    if (bucket) bucket.count += 1;
  });
  return buckets;
}

export function getMonthlyCashflow(data: AppData, today = new Date(), months = 6, language: Language = "tr") {
  const current = new Date(today.getFullYear(), today.getMonth(), 1);
  const buckets = Array.from({ length: months }, (_, index) => {
    const start = new Date(current.getFullYear(), current.getMonth() - (months - index - 1), 1);
    return {
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", { month: "short" }).format(start),
      amounts: Object.fromEntries(currencyCodes.map((currency) => [currency, 0])) as Record<CurrencyCode, number>,
    };
  });
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  data.projects.forEach((project) => {
    project.finance?.payments.forEach((payment) => {
      const bucket = bucketByKey.get(payment.receivedOn.slice(0, 7));
      if (bucket) bucket.amounts[project.finance!.currency] += Math.max(0, payment.amountKurus);
    });
  });
  return buckets;
}

export function getMemberWorkload(data: AppData, tasks: LocatedTask[]) {
  return data.members
    .filter((member) => member.active)
    .map((member) => ({
      member,
      count: tasks.filter(
        ({ task, role }) =>
          role !== "done" && role !== "backlog" && task.assigneeIds.includes(member.id),
      ).length,
    }))
    .sort((a, b) => b.count - a.count || a.member.name.localeCompare(b.member.name, "tr"));
}

export function getWorkspaceInsights(data: AppData, today = new Date(), language: Language = "tr") {
  const tasks = getLocatedTasks(data);
  const flow = tasks.reduce(
    (totals, { role }) => {
      if (role) totals[role] += 1;
      return totals;
    },
    { backlog: 0, planned: 0, active: 0, done: 0 },
  );
  const cycle = getCycleTimeStats(tasks);
  const nowMs = today.getTime();
  const risks = tasks
    .filter(({ task, role }) => {
      if (role === "done") return false;
      const activeAge = role === "active" ? getTaskWorkMs(task, nowMs) : 0;
      const overdue = task.dueDate
        ? new Date(`${task.dueDate}T23:59:59`).getTime() < nowMs
        : false;
      return Boolean(task.waitingReason) || activeAge >= 5 * 86_400_000 || overdue;
    })
    .sort((a, b) => Number(Boolean(b.task.waitingReason)) - Number(Boolean(a.task.waitingReason)));

  return {
    tasks,
    flow,
    cycle,
    risks,
    weeklyThroughput: getWeeklyThroughput(tasks, today, 8, language),
    monthlyCashflow: getMonthlyCashflow(data, today, 6, language),
    memberWorkload: getMemberWorkload(data, tasks),
    finance: getPortfolioFinance(data.projects),
  };
}
