import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppData, LocalWorkspace, WorkspaceStore } from "./types";
import type { DesktopSaveInfo } from "./desktop";

const DB_NAME = "akis-workspace";
const STORE_NAME = "workspace";
const STATE_KEY = "primary";
const FALLBACK_KEY = "akis-workspace-fallback";
const THEMES = new Set(["linen", "night", "sand", "forest"]);
const PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const PROJECT_STATUSES = new Set(["active", "completed", "delivered"]);
const COLUMN_ROLES = new Set(["backlog", "planned", "active", "done"]);
const ITEM_KINDS = new Set(["board", "mindmap"]);
const LANGUAGES = new Set(["tr", "en"]);
const CURRENCIES = new Set(["TRY", "USD", "EUR", "GBP"]);
const EFFORT_POINTS = new Set([1, 2, 3, 5, 8]);
const ISSUE_STATUSES = new Set(["open", "investigating", "implementing", "verifying", "closed"]);
const ISSUE_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const CALENDAR_EVENT_TYPES = new Set(["meeting", "planned", "note"]);
const SOURCE_LINK_KINDS = new Set(["mindnode", "issue", "corrective-action"]);
const EPOCH = "1970-01-01T00:00:00.000Z";

type UnknownRecord = Record<string, unknown>;

export interface WorkspaceRecoveryInfo {
  recovered: boolean;
  source: "previous" | "backup" | "none";
  sourceFile?: string;
  primaryCorrupt: boolean;
  detectedAt: string;
  error?: string;
}

interface TauriRecoveryMetadata {
  status: "none" | "recovered" | "required";
  source?: "previous" | "backup";
  sourceFile?: string;
  sourceSavedAt?: string;
  quarantinedFile?: string;
  recoveredAt?: string;
}

interface TauriLoadResult {
  data: unknown;
  recovery: TauriRecoveryMetadata;
}

let tauriRecoveryInfo: WorkspaceRecoveryInfo | null = null;

function fromTauriRecovery(recovery: TauriRecoveryMetadata): WorkspaceRecoveryInfo | null {
  if (recovery.status === "none") return null;
  return {
    recovered: recovery.status === "recovered",
    source: recovery.source ?? "none",
    sourceFile: recovery.sourceFile,
    primaryCorrupt: true,
    detectedAt: recovery.recoveredAt ?? new Date().toISOString(),
    error: recovery.status === "required" ? "Sağlam bir otomatik kopya bulunamadı." : undefined,
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback?: string): string | undefined {
  return typeof value === "string" ? value : fallback;
}

function identifier(value: unknown, fallback?: string): string | null {
  const candidate = stringValue(value, fallback);
  return candidate?.trim() ? candidate : null;
}

function timestampValue(value: unknown, fallback = EPOCH): string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalString(target: UnknownRecord, key: string, value: unknown): boolean {
  if (typeof value === "string") target[key] = value;
  else if (value !== undefined) return false;
  return true;
}

function normalizedStringArray(value: unknown, fallback: string[] = []): string[] | null {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return [...new Set(value as string[])];
}

function normalizedRecordArray(
  value: unknown,
  mapper: (item: unknown) => UnknownRecord | null,
): UnknownRecord[] | null {
  if (!Array.isArray(value)) return null;
  const result: UnknownRecord[] = [];
  for (const item of value) {
    const normalized = mapper(item);
    if (!normalized) return null;
    result.push(normalized);
  }
  return result;
}

function normalizePayment(value: unknown, fallbackTimestamp: string): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id);
  const receivedOn = stringValue(value.receivedOn);
  if (!id || !Number.isSafeInteger(value.amountKurus) || (value.amountKurus as number) < 0 || !receivedOn) return null;
  const createdAt = timestampValue(value.createdAt, fallbackTimestamp);
  const payment: UnknownRecord = {
    id,
    amountKurus: value.amountKurus,
    receivedOn,
    createdAt,
    updatedAt: timestampValue(value.updatedAt, createdAt),
  };
  return optionalString(payment, "note", value.note) ? payment : null;
}

function normalizeFinance(value: unknown, fallbackTimestamp: string): UnknownRecord | null | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  if (
    (value.currency !== undefined && !CURRENCIES.has(value.currency as string)) ||
    !Number.isSafeInteger(value.agreedAmountKurus) ||
    (value.agreedAmountKurus as number) < 0
  ) {
    return null;
  }
  const payments = normalizedRecordArray(value.payments, (payment) => normalizePayment(payment, fallbackTimestamp));
  return payments
    ? { currency: CURRENCIES.has(value.currency as string) ? value.currency : "TRY", agreedAmountKurus: value.agreedAmountKurus, payments }
    : null;
}

function normalizeProject(value: unknown, fallbackTimestamp: string): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id);
  const name = stringValue(value.name);
  if (!id || name === undefined) return null;
  const createdAt = timestampValue(value.createdAt, fallbackTimestamp);
  const finance = normalizeFinance(value.finance, createdAt);
  if (finance === null) return null;
  const project: UnknownRecord = {
    id,
    name,
    description: stringValue(value.description, ""),
    color: stringValue(value.color, "#6558c7"),
    archived: typeof value.archived === "boolean" ? value.archived : false,
    createdAt,
    updatedAt: timestampValue(value.updatedAt, createdAt),
  };
  if (!optionalString(project, "clientName", value.clientName)) return null;
  if (value.status !== undefined) {
    if (!PROJECT_STATUSES.has(value.status as string)) return null;
    project.status = value.status;
  }
  if (!optionalString(project, "completedAt", value.completedAt)) return null;
  if (!optionalString(project, "deliveredAt", value.deliveredAt)) return null;
  if (finance) project.finance = finance;
  return project;
}

function normalizeMember(value: unknown): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id);
  const name = stringValue(value.name);
  if (!id || name === undefined) return null;
  return {
    id,
    name,
    initials: stringValue(value.initials, name.slice(0, 2).toUpperCase()),
    color: stringValue(value.color, "#6558c7"),
    active: typeof value.active === "boolean" ? value.active : true,
  };
}

function normalizeLabel(value: unknown): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id);
  const name = stringValue(value.name);
  return !id || name === undefined
    ? null
    : { id, name, color: stringValue(value.color, "#6558c7") };
}

function normalizeTask(value: unknown, fallbackTimestamp: string, fallbackId: string): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id, fallbackId);
  const title = stringValue(value.title);
  const labelIds = normalizedStringArray(value.labelIds);
  const assigneeIds = normalizedStringArray(value.assigneeIds);
  if (!id || id !== fallbackId || title === undefined || !labelIds || !assigneeIds) return null;
  const createdAt = timestampValue(value.createdAt, fallbackTimestamp);
  const task: UnknownRecord = {
    id,
    title,
    description: stringValue(value.description, ""),
    priority: PRIORITIES.has(value.priority as string) ? value.priority : "medium",
    labelIds,
    assigneeIds,
    effortPoints: EFFORT_POINTS.has(value.effortPoints as number) ? value.effortPoints : 1,
    createdAt,
    updatedAt: timestampValue(value.updatedAt, createdAt),
  };
  for (const key of ["dueDate", "waitingReason", "completedAt"]) {
    if (!optionalString(task, key, value[key])) return null;
  }
  if (value.workSessions !== undefined) {
    const sessions = normalizedRecordArray(value.workSessions, (session) => {
      if (!isRecord(session)) return null;
      const startedAt = timestampValue(session.startedAt, "");
      if (!startedAt) return null;
      const result: UnknownRecord = { startedAt };
      return optionalString(result, "endedAt", session.endedAt) ? result : null;
    });
    if (!sessions) return null;
    task.workSessions = sessions;
  }
  const transitions = value.transitions === undefined ? [] : normalizedRecordArray(value.transitions, (transition) => {
    if (!isRecord(transition)) return null;
    const id = identifier(transition.id);
    const toColumnId = identifier(transition.toColumnId);
    if (!id || !toColumnId) return null;
    const normalized: UnknownRecord = {
      id,
      occurredAt: timestampValue(transition.occurredAt, createdAt),
      toColumnId,
      inferred: transition.inferred === true,
    };
    if (!optionalString(normalized, "fromColumnId", transition.fromColumnId)) return null;
    for (const key of ["fromRole", "toRole"]) {
      if (transition[key] !== undefined) {
        if (!COLUMN_ROLES.has(transition[key] as string)) return null;
        normalized[key] = transition[key];
      }
    }
    return normalized;
  });
  if (!transitions) return null;
  task.transitions = transitions;
  const sourceLinks = value.sourceLinks === undefined ? [] : normalizedRecordArray(value.sourceLinks, (link) => {
    if (!isRecord(link) || !SOURCE_LINK_KINDS.has(link.kind as string)) return null;
    const sourceId = identifier(link.sourceId);
    if (!sourceId) return null;
    const normalized: UnknownRecord = {
      kind: link.kind,
      sourceId,
      createdAt: timestampValue(link.createdAt, createdAt),
    };
    return optionalString(normalized, "containerId", link.containerId) ? normalized : null;
  });
  if (!sourceLinks) return null;
  task.sourceLinks = sourceLinks;
  return task;
}

function normalizeColumn(value: unknown): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id);
  const title = stringValue(value.title);
  const taskIds = normalizedStringArray(value.taskIds);
  if (!id || title === undefined || !taskIds) return null;
  const column: UnknownRecord = { id, title, color: stringValue(value.color, "#8b7cf6"), taskIds };
  if (value.role !== undefined) {
    if (!COLUMN_ROLES.has(value.role as string)) return null;
    column.role = value.role;
  }
  return column;
}

function normalizeBoard(value: unknown, fallbackTimestamp: string): UnknownRecord | null {
  if (!isRecord(value) || (value.kind !== undefined && value.kind !== "board")) return null;
  const id = identifier(value.id);
  const projectId = identifier(value.projectId);
  const title = stringValue(value.title);
  if (!id || !projectId || title === undefined || !isRecord(value.tasks)) return null;
  const tasks: UnknownRecord = {};
  for (const [taskId, taskValue] of Object.entries(value.tasks)) {
    const task = normalizeTask(taskValue, fallbackTimestamp, taskId);
    if (!task) return null;
    tasks[taskId] = task;
  }
  const columns = normalizedRecordArray(value.columns, normalizeColumn);
  if (!columns?.length || new Set(columns.map((column) => column.id)).size !== columns.length) return null;
  const placedTasks = new Set<string>();
  for (const column of columns) {
    column.taskIds = (column.taskIds as string[]).filter((taskId) => {
      if (!tasks[taskId] || placedTasks.has(taskId)) return false;
      placedTasks.add(taskId);
      return true;
    });
  }
  (columns[0].taskIds as string[]).push(...Object.keys(tasks).filter((taskId) => !placedTasks.has(taskId)));
  for (const column of columns) {
    for (const taskId of column.taskIds as string[]) {
      const task = tasks[taskId] as UnknownRecord;
      if ((task.transitions as UnknownRecord[]).length === 0) {
        task.transitions = [{
          id: `migration-${taskId}`,
          occurredAt: task.createdAt,
          toColumnId: column.id,
          ...(column.role ? { toRole: column.role } : {}),
          inferred: true,
        }];
      }
    }
  }
  const createdAt = timestampValue(value.createdAt, fallbackTimestamp);
  const board: UnknownRecord = {
    id,
    kind: "board",
    projectId,
    title,
    description: stringValue(value.description, ""),
    columns,
    tasks,
    archived: typeof value.archived === "boolean" ? value.archived : false,
    createdAt,
    updatedAt: timestampValue(value.updatedAt, createdAt),
  };
  if (typeof value.zoom === "number") board.zoom = finiteNumber(value.zoom, 1);
  return board;
}

function normalizeMindNode(value: unknown): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id);
  const title = stringValue(value.title);
  if (!id || title === undefined) return null;
  const node: UnknownRecord = {
    id,
    title,
    note: stringValue(value.note, ""),
    x: finiteNumber(value.x, 0),
    y: finiteNumber(value.y, 0),
    color: stringValue(value.color, "violet"),
  };
  if (!optionalString(node, "parentId", value.parentId)) return null;
  if (!optionalString(node, "linkedTaskId", value.linkedTaskId)) return null;
  if (value.linkedTask !== undefined) {
    if (!isRecord(value.linkedTask)) return null;
    const boardId = identifier(value.linkedTask.boardId);
    const taskId = identifier(value.linkedTask.taskId);
    if (!boardId || !taskId) return null;
    node.linkedTask = {
      boardId,
      taskId,
      createdAt: timestampValue(value.linkedTask.createdAt),
    };
  }
  return node;
}

function breakInvalidMindMapLinks(nodes: UnknownRecord[]): void {
  const byId = new Map(nodes.map((node) => [node.id as string, node]));
  for (const node of nodes) {
    if (!node.parentId || !byId.has(node.parentId as string) || node.parentId === node.id) {
      delete node.parentId;
      continue;
    }
    const visited = new Set([node.id]);
    let cursor = node;
    while (cursor.parentId) {
      if (visited.has(cursor.parentId)) {
        delete node.parentId;
        break;
      }
      visited.add(cursor.parentId);
      const next = byId.get(cursor.parentId as string);
      if (!next) break;
      cursor = next;
    }
  }
}

function normalizeMindMap(value: unknown, fallbackTimestamp: string): UnknownRecord | null {
  if (!isRecord(value) || (value.kind !== undefined && value.kind !== "mindmap")) return null;
  const id = identifier(value.id);
  const projectId = identifier(value.projectId);
  const title = stringValue(value.title);
  if (!id || !projectId || title === undefined) return null;
  const nodes = normalizedRecordArray(value.nodes, normalizeMindNode);
  if (!nodes || new Set(nodes.map((node) => node.id)).size !== nodes.length) return null;
  breakInvalidMindMapLinks(nodes);
  const createdAt = timestampValue(value.createdAt, fallbackTimestamp);
  const map: UnknownRecord = {
    id,
    kind: "mindmap",
    projectId,
    title,
    description: stringValue(value.description, ""),
    nodes,
    archived: typeof value.archived === "boolean" ? value.archived : false,
    createdAt,
    updatedAt: timestampValue(value.updatedAt, createdAt),
  };
  if (typeof value.zoom === "number") map.zoom = finiteNumber(value.zoom, 1);
  return map;
}

function normalizeLinkedTask(value: unknown, fallbackTimestamp: string): UnknownRecord | null | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const boardId = identifier(value.boardId);
  const taskId = identifier(value.taskId);
  return boardId && taskId
    ? { boardId, taskId, createdAt: timestampValue(value.createdAt, fallbackTimestamp) }
    : null;
}

function normalizeCorrectiveAction(value: unknown, fallbackTimestamp: string): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id);
  const title = stringValue(value.title);
  const assigneeIds = normalizedStringArray(value.assigneeIds);
  if (!id || title === undefined || !assigneeIds) return null;
  const createdAt = timestampValue(value.createdAt, fallbackTimestamp);
  const linkedTask = normalizeLinkedTask(value.linkedTask, createdAt);
  if (linkedTask === null) return null;
  const action: UnknownRecord = {
    id,
    title,
    description: stringValue(value.description, ""),
    assigneeIds,
    effortPoints: EFFORT_POINTS.has(value.effortPoints as number) ? value.effortPoints : 1,
    createdAt,
    updatedAt: timestampValue(value.updatedAt, createdAt),
  };
  if (!optionalString(action, "dueDate", value.dueDate)) return null;
  if (linkedTask) action.linkedTask = linkedTask;
  return action;
}

function normalizeIssue(value: unknown, fallbackTimestamp: string): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id);
  const projectId = identifier(value.projectId);
  const title = stringValue(value.title);
  const assigneeIds = normalizedStringArray(value.assigneeIds);
  if (!id || !projectId || title === undefined || !assigneeIds) return null;
  const createdAt = timestampValue(value.createdAt, fallbackTimestamp);
  const evidence = value.evidence === undefined ? [] : normalizedRecordArray(value.evidence, (entry) => {
    if (!isRecord(entry)) return null;
    const evidenceId = identifier(entry.id);
    const text = stringValue(entry.text);
    return evidenceId && text !== undefined
      ? { id: evidenceId, text, createdAt: timestampValue(entry.createdAt, createdAt) }
      : null;
  });
  const whys = value.whys === undefined ? [] : normalizedRecordArray(value.whys, (entry) => {
    if (!isRecord(entry)) return null;
    const whyId = identifier(entry.id);
    return whyId
      ? {
          id: whyId,
          answer: stringValue(entry.answer, ""),
          evidence: stringValue(entry.evidence, ""),
          validated: entry.validated === true,
        }
      : null;
  });
  const fishbone = value.fishbone === undefined ? [] : normalizedRecordArray(value.fishbone, (category) => {
    if (!isRecord(category)) return null;
    const categoryId = identifier(category.id);
    const name = stringValue(category.name);
    const causes = category.causes === undefined ? [] : normalizedRecordArray(category.causes, (cause) => {
      if (!isRecord(cause)) return null;
      const causeId = identifier(cause.id);
      return causeId
        ? {
            id: causeId,
            text: stringValue(cause.text, ""),
            evidence: stringValue(cause.evidence, ""),
            rootCause: cause.rootCause === true,
          }
        : null;
    });
    return categoryId && name !== undefined && causes ? { id: categoryId, name, causes } : null;
  });
  const actions = value.actions === undefined
    ? []
    : normalizedRecordArray(value.actions, (action) => normalizeCorrectiveAction(action, createdAt));
  if (!evidence || !whys || !fishbone || !actions) return null;
  const a3Source = isRecord(value.a3) ? value.a3 : {};
  const issue: UnknownRecord = {
    id,
    projectId,
    title,
    description: stringValue(value.description, ""),
    impact: stringValue(value.impact, ""),
    severity: ISSUE_SEVERITIES.has(value.severity as string) ? value.severity : "medium",
    status: ISSUE_STATUSES.has(value.status as string) ? value.status : "open",
    assigneeIds,
    observedOn: stringValue(value.observedOn, createdAt.slice(0, 10)),
    evidence,
    whys,
    fishbone,
    rootCause: stringValue(value.rootCause, ""),
    actions,
    a3: {
      background: stringValue(a3Source.background, ""),
      currentState: stringValue(a3Source.currentState, ""),
      targetState: stringValue(a3Source.targetState, ""),
      rootCauseSummary: stringValue(a3Source.rootCauseSummary, ""),
      countermeasures: stringValue(a3Source.countermeasures, ""),
      implementationPlan: stringValue(a3Source.implementationPlan, ""),
      verificationResult: stringValue(a3Source.verificationResult, ""),
      standardization: stringValue(a3Source.standardization, ""),
      lessonsLearned: stringValue(a3Source.lessonsLearned, ""),
    },
    verificationNote: stringValue(value.verificationNote, ""),
    createdAt,
    updatedAt: timestampValue(value.updatedAt, createdAt),
  };
  for (const key of ["boardId", "taskId", "followUpDate", "closedAt"]) {
    if (!optionalString(issue, key, value[key])) return null;
  }
  if (typeof value.verificationEffective === "boolean") issue.verificationEffective = value.verificationEffective;
  return issue;
}

function normalizeCalendarEvent(value: unknown, fallbackTimestamp: string): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id);
  const title = stringValue(value.title);
  const date = stringValue(value.date);
  if (!id || title === undefined || !date) return null;
  const createdAt = timestampValue(value.createdAt, fallbackTimestamp);
  const event: UnknownRecord = {
    id,
    title,
    date,
    type: CALENDAR_EVENT_TYPES.has(value.type as string) ? value.type : "planned",
    note: stringValue(value.note, ""),
    createdAt,
    updatedAt: timestampValue(value.updatedAt, createdAt),
  };
  for (const key of ["startTime", "endTime", "projectId"]) {
    if (!optionalString(event, key, value[key])) return null;
  }
  return event;
}

export function normalizeWorkspaceData(value: unknown): AppData | null {
  const wrapped = isRecord(value) && isRecord(value.data) && value.version !== 1 && value.version !== 2 ? value.data : value;
  if (
    !isRecord(wrapped) ||
    (wrapped.version !== 1 && wrapped.version !== 2) ||
    !Array.isArray(wrapped.projects) ||
    !Array.isArray(wrapped.boards) ||
    !Array.isArray(wrapped.mindMaps) ||
    !Array.isArray(wrapped.members) ||
    !Array.isArray(wrapped.labels) ||
    (wrapped.issues !== undefined && !Array.isArray(wrapped.issues)) ||
    (wrapped.calendarEvents !== undefined && !Array.isArray(wrapped.calendarEvents))
  ) {
    return null;
  }
  const updatedAt = timestampValue(wrapped.updatedAt);
  const projects = normalizedRecordArray(wrapped.projects, (project) => normalizeProject(project, updatedAt));
  const boards = normalizedRecordArray(wrapped.boards, (board) => normalizeBoard(board, updatedAt));
  const mindMaps = normalizedRecordArray(wrapped.mindMaps, (map) => normalizeMindMap(map, updatedAt));
  const members = normalizedRecordArray(wrapped.members, normalizeMember);
  const labels = normalizedRecordArray(wrapped.labels, normalizeLabel);
  const issues = normalizedRecordArray(wrapped.issues ?? [], (issue) => normalizeIssue(issue, updatedAt));
  const calendarEvents = normalizedRecordArray(wrapped.calendarEvents ?? [], (event) => normalizeCalendarEvent(event, updatedAt));
  const groups = [projects, boards, mindMaps, members, labels, issues, calendarEvents];
  if (groups.some((group) => !group)) return null;
  for (const group of groups as UnknownRecord[][]) {
    if (new Set(group.map((item) => item.id)).size !== group.length) return null;
  }
  const normalizedProjects = projects as UnknownRecord[];
  const normalizedBoards = boards as UnknownRecord[];
  const normalizedMindMaps = mindMaps as UnknownRecord[];
  const normalizedIssues = issues as UnknownRecord[];
  const normalizedCalendarEvents = calendarEvents as UnknownRecord[];
  const projectIds = new Set(normalizedProjects.map((project) => project.id));
  if (normalizedBoards.some((board) => !projectIds.has(board.projectId))) return null;
  if (normalizedMindMaps.some((map) => !projectIds.has(map.projectId))) return null;
  if (normalizedIssues.some((issue) => !projectIds.has(issue.projectId))) return null;
  const boardById = new Map(normalizedBoards.map((board) => [board.id as string, board]));
  const linkedTaskExists = (link: unknown) => {
    if (!isRecord(link)) return false;
    const board = boardById.get(link.boardId as string);
    return Boolean(board && isRecord(board.tasks) && typeof link.taskId === "string" && isRecord(board.tasks[link.taskId]));
  };
  for (const map of normalizedMindMaps) {
    if (!Array.isArray(map.nodes)) continue;
    for (const node of map.nodes) {
      if (isRecord(node) && node.linkedTask && !linkedTaskExists(node.linkedTask)) {
        delete node.linkedTask;
        delete node.linkedTaskId;
      }
    }
  }
  for (const issue of normalizedIssues) {
    const linkedBoard = typeof issue.boardId === "string" ? boardById.get(issue.boardId) : undefined;
    if (issue.boardId && (!linkedBoard || linkedBoard.projectId !== issue.projectId)) {
      delete issue.boardId;
      delete issue.taskId;
    } else if (issue.taskId && (!linkedBoard || !isRecord(linkedBoard.tasks) || !isRecord(linkedBoard.tasks[issue.taskId as string]))) {
      delete issue.taskId;
    }
    if (Array.isArray(issue.actions)) {
      for (const action of issue.actions) {
        if (isRecord(action) && action.linkedTask && !linkedTaskExists(action.linkedTask)) delete action.linkedTask;
      }
    }
  }
  for (const event of normalizedCalendarEvents) {
    if (event.projectId && !projectIds.has(event.projectId)) delete event.projectId;
  }
  const result: UnknownRecord = {
    version: 2,
    workspaceName: stringValue(wrapped.workspaceName, "Akis Calisma Alani"),
    theme: THEMES.has(wrapped.theme as string) ? wrapped.theme : "linen",
    projects: normalizedProjects,
    boards: normalizedBoards,
    mindMaps: normalizedMindMaps,
    members: members as UnknownRecord[],
    labels: labels as UnknownRecord[],
    issues: normalizedIssues,
    calendarEvents: normalizedCalendarEvents,
    updatedAt,
  };
  if (!optionalString(result, "profileName", wrapped.profileName)) return null;
  const lastOpened = wrapped.lastOpened;
  if (isRecord(lastOpened) && ITEM_KINDS.has(lastOpened.kind as string) && typeof lastOpened.id === "string") {
    const collection = lastOpened.kind === "board" ? normalizedBoards : normalizedMindMaps;
    if (collection.some((item) => item.id === lastOpened.id)) {
      result.lastOpened = { kind: lastOpened.kind, id: lastOpened.id };
    }
  }
  return result as unknown as AppData;
}

function normalizeLocalWorkspace(value: unknown): LocalWorkspace | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id);
  const name = identifier(value.name);
  const data = normalizeWorkspaceData(value.data);
  if (!id || !name || !data) return null;
  const createdAt = timestampValue(value.createdAt, data.updatedAt);
  const updatedAt = timestampValue(value.updatedAt, data.updatedAt);
  return {
    id,
    name,
    color: stringValue(value.color, "#6558c7")!,
    archived: typeof value.archived === "boolean" ? value.archived : false,
    createdAt,
    updatedAt,
    data: { ...data, workspaceName: name },
  };
}

export function normalizeWorkspaceStore(value: unknown): WorkspaceStore | null {
  if (isRecord(value) && (value.version === 2 || value.version === 3 || value.version === 4) && Array.isArray(value.workspaces)) {
    const workspaces = value.workspaces.map(normalizeLocalWorkspace);
    if (workspaces.some((workspace) => !workspace)) return null;
    const normalized = workspaces as LocalWorkspace[];
    if (normalized.length === 0 || new Set(normalized.map((workspace) => workspace.id)).size !== normalized.length) return null;
    const activeWorkspaceId = identifier(value.activeWorkspaceId);
    const active = normalized.find((workspace) => workspace.id === activeWorkspaceId && !workspace.archived);
    const fallback = normalized.find((workspace) => !workspace.archived);
    if (!fallback) return null;
    const rawPreferences = isRecord(value.preferences) ? value.preferences : {};
    const language = LANGUAGES.has(rawPreferences.language as string) ? rawPreferences.language as "tr" | "en" : undefined;
    const defaultCurrency = CURRENCIES.has(rawPreferences.defaultCurrency as string)
      ? rawPreferences.defaultCurrency as "TRY" | "USD" | "EUR" | "GBP"
      : "TRY";
    return {
      version: 4,
      activeWorkspaceId: active?.id ?? fallback.id,
      workspaces: normalized,
      preferences: {
        language,
        defaultCurrency,
        freshInstallation: (value.version === 3 || value.version === 4) && rawPreferences.freshInstallation === true,
      },
      updatedAt: timestampValue(value.updatedAt, fallback.updatedAt),
    };
  }
  const legacy = normalizeWorkspaceData(value);
  if (!legacy) return null;
  const name = "Kişisel Alanım";
  return {
    version: 4,
    activeWorkspaceId: "workspace-personal",
    workspaces: [{
      id: "workspace-personal",
      name,
      color: "#6558c7",
      archived: false,
      createdAt: legacy.updatedAt,
      updatedAt: legacy.updatedAt,
      data: { ...legacy, workspaceName: name },
    }],
    preferences: { defaultCurrency: "TRY", freshInstallation: false },
    updatedAt: legacy.updatedAt,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadWorkspace(): Promise<WorkspaceStore | null> {
  if (isTauri()) {
    const result = await invoke<TauriLoadResult>("load");
    tauriRecoveryInfo = fromTauriRecovery(result.recovery);
    if (result.recovery.status === "required") throw new Error("WORKSPACE_RECOVERY_REQUIRED");
    const normalized = normalizeWorkspaceStore(result.data);
    if (result.data !== null && !normalized) throw new Error("WORKSPACE_DEEP_VALIDATION_FAILED");
    return normalized;
  }
  try {
    const db = await openDatabase();
    const value = await new Promise<unknown>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    const normalized = normalizeWorkspaceStore(value);
    if (normalized) return normalized;
  } catch {
    // Fall through to the independent localStorage snapshot.
  }
  try {
    const fallback = localStorage.getItem(FALLBACK_KEY);
    return fallback ? normalizeWorkspaceStore(JSON.parse(fallback)) : null;
  } catch {
    return null;
  }
}

export async function saveWorkspace(data: WorkspaceStore): Promise<void> {
  const normalized = normalizeWorkspaceStore(data);
  if (!normalized) throw new Error("INVALID_WORKSPACE");
  if (isTauri()) {
    await invoke("save", { data: normalized });
    return;
  }
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(normalized));
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(normalized, STATE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch {
    // localStorage already contains the latest atomic snapshot.
  }
}

export function isDesktopRuntime(): boolean {
  return isTauri();
}

export async function getDesktopSaveInfo(): Promise<DesktopSaveInfo | null> {
  if (isTauri()) return invoke<DesktopSaveInfo>("info");
  return null;
}

export async function getDesktopRecoveryInfo(): Promise<WorkspaceRecoveryInfo | null> {
  if (isTauri()) return tauriRecoveryInfo;
  return null;
}

export function registerDesktopFlushProvider(
  provider: () => WorkspaceStore | null | Promise<WorkspaceStore | null>,
  onError?: () => void,
): () => void {
  if (isTauri()) {
    let disposed = false;
    let closing = false;
    let removeListener: (() => void) | undefined;

    void import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        const currentWindow = getCurrentWindow();
        return currentWindow.onCloseRequested(async (event) => {
          if (disposed || closing) return;
          event.preventDefault();
          closing = true;
          try {
            const snapshot = await provider();
            if (!snapshot) {
              if (!disposed) await currentWindow.destroy();
              return;
            }
            const normalized = normalizeWorkspaceStore(snapshot);
            if (!normalized) throw new Error("INVALID_WORKSPACE_FLUSH_SNAPSHOT");
            await invoke("save", { data: normalized });
            if (!disposed) await currentWindow.destroy();
          } catch {
            closing = false;
            onError?.();
          }
        });
      })
      .then((unlisten) => {
        if (disposed) unlisten();
        else removeListener = unlisten;
      })
      .catch(() => onError?.());

    return () => {
      disposed = true;
      removeListener?.();
    };
  }

  return () => undefined;
}

export async function openDesktopSaveFolder(): Promise<void> {
  if (isTauri()) {
    await invoke("open_save_folder");
    return;
  }
}

export function isWorkspaceData(value: unknown): value is AppData {
  return normalizeWorkspaceData(value) !== null;
}

export function isWorkspaceStore(value: unknown): value is WorkspaceStore {
  return normalizeWorkspaceStore(value) !== null;
}
