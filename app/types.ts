export type ThemeId = "linen" | "night" | "sand" | "forest";
export type Language = "tr" | "en";
export type CurrencyCode = "TRY" | "USD" | "EUR" | "GBP";
export type Priority = "low" | "medium" | "high" | "critical";
export type ItemKind = "board" | "mindmap";
export type ProjectStatus = "active" | "completed" | "delivered";
export type EffortPoints = 1 | 2 | 3 | 5 | 8;
export type FlowRole = "backlog" | "planned" | "active" | "done";
export type IssueStatus = "open" | "investigating" | "implementing" | "verifying" | "closed";
export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type CalendarEventType = "meeting" | "planned" | "note";

export interface ProjectPayment {
  id: string;
  amountKurus: number;
  receivedOn: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFinance {
  currency: CurrencyCode;
  /** Stored in the currency's minor unit (kuruş, cent or penny). */
  agreedAmountKurus: number;
  payments: ProjectPayment[];
}

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
  clientName?: string;
  status?: ProjectStatus;
  completedAt?: string;
  deliveredAt?: string;
  finance?: ProjectFinance;
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
  effortPoints?: EffortPoints;
  transitions?: TaskTransition[];
  sourceLinks?: TaskSourceLink[];
  workSessions?: Array<{
    startedAt: string;
    endedAt?: string;
  }>;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTransition {
  id: string;
  occurredAt: string;
  fromColumnId?: string;
  toColumnId: string;
  fromRole?: FlowRole;
  toRole?: FlowRole;
  inferred?: boolean;
}

export interface TaskSourceLink {
  kind: "mindnode" | "issue" | "corrective-action";
  sourceId: string;
  containerId?: string;
  createdAt: string;
}

export interface BoardColumn {
  id: string;
  title: string;
  color: string;
  taskIds: string[];
  role?: FlowRole;
}

export interface KanbanBoard {
  id: string;
  kind: "board";
  projectId: string;
  title: string;
  description: string;
  columns: BoardColumn[];
  tasks: Record<string, TaskCard>;
  zoom?: number;
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
  linkedTask?: LinkedTaskReference;
}

export interface LinkedTaskReference {
  boardId: string;
  taskId: string;
  createdAt: string;
}

export interface MindMap {
  id: string;
  kind: "mindmap";
  projectId: string;
  title: string;
  description: string;
  nodes: MindNode[];
  zoom?: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IssueEvidence {
  id: string;
  text: string;
  createdAt: string;
}

export interface WhyAnalysisItem {
  id: string;
  answer: string;
  evidence: string;
  validated: boolean;
}

export interface FishboneCause {
  id: string;
  text: string;
  evidence: string;
  rootCause: boolean;
}

export interface FishboneCategory {
  id: string;
  name: string;
  causes: FishboneCause[];
}

export interface CorrectiveAction {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  assigneeIds: string[];
  effortPoints: EffortPoints;
  linkedTask?: LinkedTaskReference;
  createdAt: string;
  updatedAt: string;
}

export interface A3Report {
  background: string;
  currentState: string;
  targetState: string;
  rootCauseSummary: string;
  countermeasures: string;
  implementationPlan: string;
  verificationResult: string;
  standardization: string;
  lessonsLearned: string;
}

export interface ProblemIssue {
  id: string;
  projectId: string;
  title: string;
  description: string;
  impact: string;
  severity: IssueSeverity;
  status: IssueStatus;
  boardId?: string;
  taskId?: string;
  assigneeIds: string[];
  observedOn: string;
  evidence: IssueEvidence[];
  whys: WhyAnalysisItem[];
  fishbone: FishboneCategory[];
  rootCause: string;
  actions: CorrectiveAction[];
  a3: A3Report;
  verificationEffective?: boolean;
  verificationNote: string;
  followUpDate?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  type: CalendarEventType;
  projectId?: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  version: 2;
  workspaceName: string;
  /** Optional for backward compatibility with workspaces created before profiles existed. */
  profileName?: string;
  theme: ThemeId;
  projects: Project[];
  boards: KanbanBoard[];
  mindMaps: MindMap[];
  members: Member[];
  labels: LabelDefinition[];
  issues: ProblemIssue[];
  calendarEvents: CalendarEvent[];
  lastOpened?: { kind: ItemKind; id: string };
  updatedAt: string;
}

export interface LocalWorkspace {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  data: AppData;
}

export interface WorkspaceStore {
  version: 4;
  activeWorkspaceId: string;
  workspaces: LocalWorkspace[];
  preferences: {
    language?: Language;
    defaultCurrency: CurrencyCode;
    freshInstallation: boolean;
  };
  updatedAt: string;
}

export type Screen =
  | { kind: "home" }
  | { kind: "projects" }
  | { kind: "boards" }
  | { kind: "mindmaps" }
  | { kind: "insights" }
  | { kind: "issues" }
  | { kind: "issue"; id: string }
  | { kind: "calendar" }
  | { kind: "project"; id: string }
  | { kind: "board"; id: string }
  | { kind: "mindmap"; id: string }
  | { kind: "archive" }
  | { kind: "settings" };
