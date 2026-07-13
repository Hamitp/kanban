import type { AppData, CalendarEventType } from "./types";

interface AgendaEntryBase {
  id: string;
  title: string;
  date: string;
  projectId?: string;
}

export interface CalendarEventAgendaEntry extends AgendaEntryBase {
  kind: "event";
  eventId: string;
  type: CalendarEventType;
  startTime?: string;
  endTime?: string;
  note: string;
}

export interface TaskDueAgendaEntry extends AgendaEntryBase {
  kind: "task";
  boardId: string;
  taskId: string;
}

export type CalendarAgendaEntry = CalendarEventAgendaEntry | TaskDueAgendaEntry;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addLocalDays(date: Date, amount: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  result.setDate(result.getDate() + amount);
  return result;
}

function agendaTime(entry: CalendarAgendaEntry): string {
  return entry.kind === "event" && entry.startTime ? entry.startTime : "99:99";
}

function compareAgendaEntries(left: CalendarAgendaEntry, right: CalendarAgendaEntry): number {
  return left.date.localeCompare(right.date)
    || agendaTime(left).localeCompare(agendaTime(right))
    || left.title.localeCompare(right.title, "tr");
}

export function getCalendarAgendaEntries(data: AppData): CalendarAgendaEntry[] {
  const visibleProjectIds = new Set(
    data.projects.filter((project) => !project.archived).map((project) => project.id),
  );
  const entries: CalendarAgendaEntry[] = data.calendarEvents
    .filter((event) => datePattern.test(event.date))
    .filter((event) => !event.projectId || visibleProjectIds.has(event.projectId))
    .map((event) => ({
      kind: "event",
      id: `event-${event.id}`,
      eventId: event.id,
      title: event.title,
      date: event.date,
      projectId: event.projectId,
      type: event.type,
      startTime: event.startTime,
      endTime: event.endTime,
      note: event.note,
    }));

  data.boards
    .filter((board) => !board.archived && visibleProjectIds.has(board.projectId))
    .forEach((board) => {
      const locatedTaskIds = new Set<string>();
      board.columns.forEach((column) => {
        column.taskIds.forEach((taskId) => {
          if (locatedTaskIds.has(taskId)) return;
          locatedTaskIds.add(taskId);
          const task = board.tasks[taskId];
          if (!task?.dueDate || !datePattern.test(task.dueDate)) return;
          if (column.role === "done" || task.completedAt) return;
          entries.push({
            kind: "task",
            id: `task-${board.id}-${task.id}`,
            taskId: task.id,
            boardId: board.id,
            projectId: board.projectId,
            title: task.title,
            date: task.dueDate,
          });
        });
      });
    });

  return entries.sort(compareAgendaEntries);
}

export function getUpcomingAgendaEntries(
  data: AppData,
  options: { today?: Date; days?: number; limit?: number } = {},
): CalendarAgendaEntry[] {
  const today = options.today ?? new Date();
  const start = localDateKey(today);
  const end = options.days && options.days > 0
    ? localDateKey(addLocalDays(today, Math.floor(options.days) - 1))
    : undefined;
  const entries = getCalendarAgendaEntries(data).filter(
    (entry) => entry.date >= start && (!end || entry.date <= end),
  );
  return options.limit === undefined ? entries : entries.slice(0, Math.max(0, options.limit));
}
