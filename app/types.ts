export type ThemeId = "linen" | "night" | "sand" | "forest";
export type Priority = "low" | "medium" | "high" | "critical";
export type ItemKind = "board" | "mindmap";

export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
  active: boolean;
}

export interface LabelDefinition {
  id: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCard {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  labelIds: string[];
  assigneeIds: string[];
  dueDate?: string;
  waitingReason?: string;
  workSessions?: Array<{
    startedAt: string;
    endedAt?: string;
  }>;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumn {
  id: string;
  title: string;
  color: string;
  taskIds: string[];
  role?: "backlog" | "planned" | "active" | "done";
}

export interface KanbanBoard {
  id: string;
  kind: "board";
  projectId: string;
  title: string;
  description: string;
  columns: BoardColumn[];
  tasks: Record<string, TaskCard>;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MindNode {
  id: string;
  title: string;
  note: string;
  x: number;
  y: number;
  color: string;
  parentId?: string;
  linkedTaskId?: string;
}

export interface MindMap {
  id: string;
  kind: "mindmap";
  projectId: string;
  title: string;
  description: string;
  nodes: MindNode[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  version: 1;
  workspaceName: string;
  theme: ThemeId;
  projects: Project[];
  boards: KanbanBoard[];
  mindMaps: MindMap[];
  members: Member[];
  labels: LabelDefinition[];
  lastOpened?: { kind: ItemKind; id: string };
  updatedAt: string;
}

export type Screen =
  | { kind: "home" }
  | { kind: "projects" }
  | { kind: "boards" }
  | { kind: "mindmaps" }
  | { kind: "project"; id: string }
  | { kind: "board"; id: string }
  | { kind: "mindmap"; id: string }
  | { kind: "archive" }
  | { kind: "settings" };
