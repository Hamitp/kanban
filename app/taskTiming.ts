import type { BoardColumn, TaskCard } from "./types";

type ColumnRole = BoardColumn["role"];

export function transitionTaskTiming(
  task: TaskCard,
  fromRole: ColumnRole,
  toRole: ColumnRole,
  transitionedAt: string,
): TaskCard {
  if (fromRole === toRole) return task;

  let sessions = [...(task.workSessions ?? [])];
  if (fromRole === "active" && toRole !== "active") {
    const last = sessions[sessions.length - 1];
    if (last && !last.endedAt) {
      sessions = [...sessions.slice(0, -1), { ...last, endedAt: transitionedAt }];
    }
  }
  if (toRole === "active" && fromRole !== "active") {
    const last = sessions[sessions.length - 1];
    if (!last || last.endedAt) sessions.push({ startedAt: transitionedAt });
  }

  return {
    ...task,
    workSessions: sessions,
    completedAt: toRole === "done" ? transitionedAt : undefined,
    updatedAt: transitionedAt,
  };
}

export function getTaskWorkMs(task: TaskCard, referenceTime = Date.now()): number {
  return (task.workSessions ?? []).reduce((sum, session) => {
    const start = new Date(session.startedAt).getTime();
    const end = session.endedAt ? new Date(session.endedAt).getTime() : referenceTime;
    return sum + Math.max(0, end - start);
  }, 0);
}

export function getTaskWorkDays(task: TaskCard, referenceTime = Date.now()): number {
  const milliseconds = getTaskWorkMs(task, referenceTime);
  return milliseconds > 0 ? Math.max(1, Math.ceil(milliseconds / 86_400_000)) : 0;
}

