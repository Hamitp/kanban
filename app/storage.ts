import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppData } from "./types";
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
    (value.currency !== undefined && value.currency !== "TRY") ||
    !Number.isSafeInteger(value.agreedAmountKurus) ||
    (value.agreedAmountKurus as number) < 0
  ) {
    return null;
  }
  const payments = normalizedRecordArray(value.payments, (payment) => normalizePayment(payment, fallbackTimestamp));
  return payments
    ? { currency: "TRY", agreedAmountKurus: value.agreedAmountKurus, payments }
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

export function normalizeWorkspaceData(value: unknown): AppData | null {
  const wrapped = isRecord(value) && isRecord(value.data) && value.version !== 1 ? value.data : value;
  if (
    !isRecord(wrapped) ||
    wrapped.version !== 1 ||
    !Array.isArray(wrapped.projects) ||
    !Array.isArray(wrapped.boards) ||
    !Array.isArray(wrapped.mindMaps) ||
    !Array.isArray(wrapped.members) ||
    !Array.isArray(wrapped.labels)
  ) {
    return null;
  }
  const updatedAt = timestampValue(wrapped.updatedAt);
  const projects = normalizedRecordArray(wrapped.projects, (project) => normalizeProject(project, updatedAt));
  const boards = normalizedRecordArray(wrapped.boards, (board) => normalizeBoard(board, updatedAt));
  const mindMaps = normalizedRecordArray(wrapped.mindMaps, (map) => normalizeMindMap(map, updatedAt));
  const members = normalizedRecordArray(wrapped.members, normalizeMember);
  const labels = normalizedRecordArray(wrapped.labels, normalizeLabel);
  const groups = [projects, boards, mindMaps, members, labels];
  if (groups.some((group) => !group)) return null;
  for (const group of groups as UnknownRecord[][]) {
    if (new Set(group.map((item) => item.id)).size !== group.length) return null;
  }
  const normalizedProjects = projects as UnknownRecord[];
  const normalizedBoards = boards as UnknownRecord[];
  const normalizedMindMaps = mindMaps as UnknownRecord[];
  const projectIds = new Set(normalizedProjects.map((project) => project.id));
  if (normalizedBoards.some((board) => !projectIds.has(board.projectId))) return null;
  if (normalizedMindMaps.some((map) => !projectIds.has(map.projectId))) return null;
  const result: UnknownRecord = {
    version: 1,
    workspaceName: stringValue(wrapped.workspaceName, "Akis Calisma Alani"),
    theme: THEMES.has(wrapped.theme as string) ? wrapped.theme : "linen",
    projects: normalizedProjects,
    boards: normalizedBoards,
    mindMaps: normalizedMindMaps,
    members: members as UnknownRecord[],
    labels: labels as UnknownRecord[],
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

export async function loadWorkspace(): Promise<AppData | null> {
  if (isTauri()) {
    const result = await invoke<TauriLoadResult>("load");
    tauriRecoveryInfo = fromTauriRecovery(result.recovery);
    if (result.recovery.status === "required") throw new Error("WORKSPACE_RECOVERY_REQUIRED");
    const normalized = normalizeWorkspaceData(result.data);
    if (result.data !== null && !normalized) throw new Error("WORKSPACE_DEEP_VALIDATION_FAILED");
    return normalized;
  }
  try {
    const db = await openDatabase();
    const value = await new Promise<AppData | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve((request.result as AppData) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    const normalized = normalizeWorkspaceData(value);
    if (normalized) return normalized;
  } catch {
    // Fall through to the independent localStorage snapshot.
  }
  try {
    const fallback = localStorage.getItem(FALLBACK_KEY);
    return fallback ? normalizeWorkspaceData(JSON.parse(fallback)) : null;
  } catch {
    return null;
  }
}

export async function saveWorkspace(data: AppData): Promise<void> {
  const normalized = normalizeWorkspaceData(data);
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
  provider: () => AppData | null | Promise<AppData | null>,
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
            const normalized = normalizeWorkspaceData(snapshot);
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
