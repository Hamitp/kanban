"use client";

import {
  Archive,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Blocks,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Copy,
  Download,
  FolderOpen,
  FolderKanban,
  HardDrive,
  Home,
  LayoutDashboard,
  Leaf,
  ListTodo,
  Map as MapIcon,
  Moon,
  MoreHorizontal,
  Palette,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  Upload,
  UserPlus,
  ChevronsUpDown,
  X,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BoardView } from "./components/BoardView";
import { InsightsScreen } from "./components/InsightsScreen";
import { MindMapView } from "./components/MindMapView";
import {
  formatTryKurus,
  getPortfolioFinance,
  getProjectFinanceTotals,
  getProjectStatus,
  parseTryToKurus,
  transitionProjectStatus,
} from "./projectFinance";
import { createBoard, createMindMap, createSeedData, newId } from "./seed";
import { countMemberAssignments, removeMemberFromWorkspace } from "./memberManagement";
import {
  archiveWorkspace,
  createBlankWorkspace,
  createWorkspaceStoreFromLegacy,
  deleteArchivedWorkspace,
  getActiveWorkspace,
  renameWorkspace,
  restoreWorkspace,
  switchWorkspace,
  updateActiveWorkspaceData,
} from "./workspaceManagement";
import {
  getDesktopSaveInfo,
  getDesktopRecoveryInfo,
  isDesktopRuntime,
  isWorkspaceData,
  loadWorkspace,
  openDesktopSaveFolder,
  registerDesktopFlushProvider,
  saveWorkspace,
} from "./storage";
import { formatTaskWorkDuration, getTaskWorkMs, transitionTaskTiming } from "./taskTiming";
import { getBoardFlowStats, getProjectFlowStats } from "./workspaceAnalytics";
import type { DesktopSaveInfo } from "./desktop";
import type {
  AppData,
  ItemKind,
  KanbanBoard,
  MindMap,
  MindNode,
  Project,
  ProjectPayment,
  ProjectStatus,
  Screen,
  TaskCard,
  ThemeId,
  LocalWorkspace,
  WorkspaceStore,
} from "./types";

type ModalState =
  | { type: "project"; projectId?: string }
  | { type: "payment"; projectId: string; paymentId?: string }
  | { type: "item"; kind: ItemKind; projectId?: string }
  | { type: "duplicate"; kind: ItemKind; id: string }
  | { type: "member" }
  | { type: "workspace"; workspaceId?: string }
  | null;

interface ProjectDraft {
  name: string;
  description: string;
  color: string;
  clientName?: string;
  agreedAmountKurus?: number;
}

interface PaymentDraft {
  amountKurus: number;
  receivedOn: string;
  note?: string;
}

const themes: Array<{ id: ThemeId; name: string; description: string; icon: typeof Sun }> = [
  { id: "linen", name: "Keten", description: "Aydınlık ve sakin", icon: Sun },
  { id: "night", name: "Gece", description: "Derin odak", icon: Moon },
  { id: "sand", name: "Kum", description: "Sıcak ve doğal", icon: Palette },
  { id: "forest", name: "Orman", description: "Dingin ve koyu", icon: Leaf },
];

const projectColors = ["#6f63d9", "#d27a55", "#4f8da8", "#4f9672", "#c0657e"];

function now() {
  return new Date().toISOString();
}

function deriveLegacyProfileName(workspaceName: string): string {
  const match = workspaceName
    .trim()
    .match(/^(.+?)(?:['’](?:ın|in|un|ün))?\s+Çalışma Alanı$/iu);
  return match?.[1]?.trim() ?? "";
}

function resolveProfileName(data: Pick<AppData, "profileName" | "workspaceName" | "members">): string {
  if (data.profileName !== undefined) return data.profileName.trim();
  const legacyName = deriveLegacyProfileName(data.workspaceName);
  const legacyFirstName = legacyName.split(/\s+/)[0]?.toLocaleLowerCase("tr-TR");
  const matchingMember = legacyFirstName
    ? data.members.find((member) => member.name.split(/\s+/)[0]?.toLocaleLowerCase("tr-TR") === legacyFirstName)
    : undefined;
  return matchingMember?.name ?? legacyName;
}

function getProfileInitials(profileName: string): string {
  const parts = profileName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  return [parts[0], parts.at(-1)]
    .filter((part, index) => index === 0 || parts.length > 1)
    .map((part) => part?.[0] ?? "")
    .join("")
    .toLocaleUpperCase("tr-TR");
}

export default function AkisApp() {
  const [workspaceStore, setWorkspaceStore] = useState<WorkspaceStore | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [fatalLoadError, setFatalLoadError] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: boolean } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const latestDataRef = useRef<WorkspaceStore | null>(workspaceStore);
  const pastRef = useRef<AppData[]>([]);
  const futureRef = useRef<AppData[]>([]);
  const hydrated = useRef(false);
  const activeWorkspace = workspaceStore ? getActiveWorkspace(workspaceStore) : null;
  const data = activeWorkspace?.data ?? null;

  useLayoutEffect(() => {
    latestDataRef.current = workspaceStore;
  }, [workspaceStore]);

  useEffect(() => {
    loadWorkspace()
      .then(async (stored) => {
        // Mark hydration before publishing the loaded store so legacy-to-v2
        // normalization is persisted immediately, even without a user action.
        hydrated.current = true;
        setWorkspaceStore(stored ?? createWorkspaceStoreFromLegacy(createSeedData()));
        const recovery = await getDesktopRecoveryInfo();
        if (recovery?.recovered) {
          setToast({ message: "Son sağlam otomatik kopya güvenle geri yüklendi" });
        }
      })
      .catch(() => {
        hydrated.current = true;
        setFatalLoadError(true);
      });
    if (!isDesktopRuntime()) navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  useEffect(
    () => registerDesktopFlushProvider(
      () => latestDataRef.current,
      () => setSaveState("error"),
    ),
    [],
  );

  useEffect(() => {
    if (!workspaceStore || !data || !hydrated.current) return;
    document.documentElement.dataset.theme = data.theme;
    let cancelled = false;
    let retryTimer: number | undefined;
    const persist = () => {
      if (cancelled) return;
      setSaveState("saving");
      saveWorkspace(workspaceStore)
        .then(() => {
          if (cancelled) return;
        setSaveState("saved");
        setSavedAt(new Date());
        })
        .catch(() => {
          if (cancelled) return;
          setSaveState("error");
          retryTimer = window.setTimeout(persist, 2000);
        });
    };
    const desktop = isDesktopRuntime();
    const timer = window.setTimeout(persist, desktop ? 120 : 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [workspaceStore, data]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditingText = Boolean(
        target?.matches("input, textarea, select") || target?.isContentEditable,
      );
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (!isEditingText && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if (
        !isEditingText &&
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))
      ) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const commit = useCallback((updater: (current: AppData) => AppData, track = true) => {
    setWorkspaceStore((currentStore) => {
      if (!currentStore) return currentStore;
      const current = getActiveWorkspace(currentStore)?.data;
      if (!current) return currentStore;
      if (track) {
        pastRef.current = [...pastRef.current.slice(-39), current];
        futureRef.current = [];
      }
      return updateActiveWorkspaceData(currentStore, updater, now());
    });
    if (track) setHistoryVersion((value) => value + 1);
  }, []);

  function undo() {
    if (!data || pastRef.current.length === 0) return;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [data, ...futureRef.current.slice(0, 39)];
    setWorkspaceStore((current) => current ? updateActiveWorkspaceData(current, () => previous, now()) : current);
    setToast({ message: "Son işlem geri alındı" });
    setHistoryVersion((value) => value + 1);
  }

  function redo() {
    if (!data || futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-39), data];
    setWorkspaceStore((current) => current ? updateActiveWorkspaceData(current, () => next, now()) : current);
    setToast({ message: "İşlem yeniden uygulandı" });
    setHistoryVersion((value) => value + 1);
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (fatalLoadError) {
    return (
      <div className="recovery-screen">
        <div className="recovery-card">
          <span className="recovery-icon"><ShieldCheck size={26} /></span>
          <span className="eyebrow">VERİLERİNİZ KORUNDU</span>
          <h1>Çalışma alanı açılamadı</h1>
          <p>Akış, sorunlu dosyanın üzerine yeni veri yazmadı. Save klasörünüzdeki son sağlam kopyayı inceleyebilmeniz için veriler olduğu gibi korundu.</p>
          <button className="primary-button large" onClick={() => openDesktopSaveFolder()}><FolderOpen size={17} /> Save klasörünü aç</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app-loading">
        <div className="brand-mark"><Blocks size={22} /></div>
        <div><strong>Akış hazırlanıyor</strong><span>Çalışma alanınız yerelden açılıyor...</span></div>
      </div>
    );
  }

  const profileName = resolveProfileName(data);
  const availableProjects = data.projects.filter((project) => !project.archived);
  const currentBoard = screen.kind === "board" ? data.boards.find((board) => board.id === screen.id) : undefined;
  const currentMap = screen.kind === "mindmap" ? data.mindMaps.find((map) => map.id === screen.id) : undefined;

  function navigate(next: Screen) {
    setScreen(next);
    setSearchOpen(false);
    if (next.kind === "board" || next.kind === "mindmap") {
      commit((current) => ({ ...current, lastOpened: { kind: next.kind, id: next.id } }), false);
    }
  }

  function showToast(message: string, canUndo = false) {
    setToast({ message, undo: canUndo });
  }

  function clearWorkspaceContext() {
    pastRef.current = [];
    futureRef.current = [];
    setHistoryVersion((value) => value + 1);
    setScreen({ kind: "home" });
    setModal(null);
    setSearchQuery("");
    setSearchOpen(false);
  }

  function activateWorkspace(workspaceId: string) {
    if (!workspaceStore || workspaceId === workspaceStore.activeWorkspaceId) return;
    const target = workspaceStore.workspaces.find((workspace) => workspace.id === workspaceId && !workspace.archived);
    if (!target) return;
    setWorkspaceStore((current) => current ? switchWorkspace(current, workspaceId, now()) : current);
    clearWorkspaceContext();
    showToast(`${target.name} çalışma alanına geçildi`);
  }

  function saveWorkspaceItem(name: string, color: string, workspaceId?: string) {
    if (!workspaceStore || !data) return;
    const cleanName = name.trim();
    const normalizedName = cleanName.toLocaleLowerCase("tr-TR");
    const duplicate = workspaceStore.workspaces.some((workspace) =>
      workspace.id !== workspaceId && workspace.name.toLocaleLowerCase("tr-TR") === normalizedName,
    );
    if (!cleanName || duplicate) {
      if (duplicate) window.alert("Bu adla bir çalışma alanı zaten var.");
      return;
    }
    const stamp = now();
    if (workspaceId) {
      setWorkspaceStore((current) => current ? renameWorkspace(current, workspaceId, cleanName, stamp, color) : current);
      setModal(null);
      showToast("Çalışma alanı adı güncellendi");
      return;
    }
    const workspace = createBlankWorkspace(newId(), cleanName, color, data, stamp);
    setWorkspaceStore((current) => current ? {
      ...current,
      activeWorkspaceId: workspace.id,
      workspaces: [...current.workspaces, workspace],
      updatedAt: stamp,
    } : current);
    clearWorkspaceContext();
    showToast(`${cleanName} çalışma alanı oluşturuldu`);
  }

  function archiveWorkspaceItem(workspaceId: string) {
    if (!workspaceStore) return;
    const workspace = workspaceStore.workspaces.find((item) => item.id === workspaceId && !item.archived);
    const activeCount = workspaceStore.workspaces.filter((item) => !item.archived).length;
    if (!workspace || activeCount <= 1) return;
    if (!window.confirm(`${workspace.name} çalışma alanı arşivlensin mi? İçerikleri korunacak ve daha sonra geri getirilebilecek.`)) return;
    const switching = workspaceStore.activeWorkspaceId === workspaceId;
    setWorkspaceStore((current) => current ? archiveWorkspace(current, workspaceId, now()) : current);
    if (switching) clearWorkspaceContext();
    showToast(`${workspace.name} arşivlendi`);
  }

  function restoreWorkspaceItem(workspaceId: string) {
    if (!workspaceStore) return;
    const workspace = workspaceStore.workspaces.find((item) => item.id === workspaceId && item.archived);
    if (!workspace) return;
    setWorkspaceStore((current) => current ? restoreWorkspace(current, workspaceId, now()) : current);
    showToast(`${workspace.name} geri getirildi`);
  }

  function deleteWorkspaceItem(workspaceId: string) {
    if (!workspaceStore) return;
    const workspace = workspaceStore.workspaces.find((item) => item.id === workspaceId && item.archived);
    if (!workspace) return;
    const summary = `${workspace.data.projects.length} proje, ${workspace.data.boards.length} Kanban panosu ve ${workspace.data.mindMaps.length} zihin haritası`;
    if (!window.confirm(`${workspace.name} kalıcı olarak silinsin mi?\n\n${summary} silinecek. Bu işlem geri alınamaz.`)) return;
    setWorkspaceStore((current) => current ? deleteArchivedWorkspace(current, workspaceId, now()) : current);
    showToast(`${workspace.name} kalıcı olarak silindi`);
  }

  function saveProjectItem(draft: ProjectDraft, projectId?: string) {
    if (projectId) {
      commit((current) => ({
        ...current,
        projects: current.projects.map((project) => {
          if (project.id !== projectId) return project;
          const payments = project.finance?.payments ?? [];
          return {
            ...project,
            name: draft.name,
            description: draft.description,
            color: draft.color,
            clientName: draft.clientName,
            finance: draft.agreedAmountKurus
              ? { currency: "TRY", agreedAmountKurus: draft.agreedAmountKurus, payments }
              : payments.length
                ? project.finance
                : undefined,
            updatedAt: now(),
          };
        }),
      }));
      setModal(null);
      showToast("Proje bilgileri güncellendi", true);
      return;
    }
    const project: Project = {
      id: newId(),
      name: draft.name,
      description: draft.description,
      color: draft.color,
      clientName: draft.clientName,
      status: "active",
      finance: draft.agreedAmountKurus
        ? { currency: "TRY", agreedAmountKurus: draft.agreedAmountKurus, payments: [] }
        : undefined,
      archived: false,
      createdAt: now(),
      updatedAt: now(),
    };
    commit((current) => ({ ...current, projects: [...current.projects, project] }));
    setModal(null);
    navigate({ kind: "project", id: project.id });
    showToast("Yeni proje hazır");
  }

  function saveProjectPayment(projectId: string, draft: PaymentDraft, paymentId?: string) {
    const stamp = now();
    commit((current) => ({
      ...current,
      projects: current.projects.map((project) => {
        if (project.id !== projectId || !project.finance) return project;
        const payment: ProjectPayment = {
          id: paymentId ?? newId(),
          amountKurus: draft.amountKurus,
          receivedOn: draft.receivedOn,
          note: draft.note,
          createdAt:
            project.finance.payments.find((item) => item.id === paymentId)?.createdAt ?? stamp,
          updatedAt: stamp,
        };
        const payments = paymentId
          ? project.finance.payments.map((item) => item.id === paymentId ? payment : item)
          : [...project.finance.payments, payment];
        return {
          ...project,
          finance: { ...project.finance, payments },
          updatedAt: stamp,
        };
      }),
    }));
    setModal(null);
    showToast(paymentId ? "Tahsilat güncellendi" : "Tahsilat kaydedildi", true);
  }

  function createItem(kind: ItemKind, projectId: string, title: string) {
    if (kind === "board") {
      const board = createBoard(projectId, title);
      commit((current) => ({ ...current, boards: [...current.boards, board] }));
      setModal(null);
      navigate({ kind: "board", id: board.id });
    } else {
      const map = createMindMap(projectId, title);
      commit((current) => ({ ...current, mindMaps: [...current.mindMaps, map] }));
      setModal(null);
      navigate({ kind: "mindmap", id: map.id });
    }
    showToast(kind === "board" ? "Yeni Kanban panosu hazır" : "Yeni zihin haritası hazır");
  }

  function archiveItem(kind: ItemKind, id: string) {
    commit((current) =>
      kind === "board"
        ? { ...current, boards: current.boards.map((item) => (item.id === id ? { ...item, archived: true } : item)) }
        : { ...current, mindMaps: current.mindMaps.map((item) => (item.id === id ? { ...item, archived: true } : item)) },
    );
    navigate({ kind: "home" });
    showToast("Çalışma arşivlendi", true);
  }

  function duplicateItem(kind: ItemKind, id: string, targetProjectId: string, structureOnly: boolean) {
    if (!data) return;
    const stamp = now();
    if (kind === "board") {
      const source = data.boards.find((board) => board.id === id);
      if (!source) return;
      const taskIdMap = new Map(Object.keys(source.tasks).map((taskId) => [taskId, newId()]));
      const tasks = structureOnly
        ? {}
        : Object.fromEntries(
            Object.values(source.tasks).map((task) => {
              const clonedId = taskIdMap.get(task.id)!;
              const taskWithoutTiming = { ...task };
              delete taskWithoutTiming.workSessions;
              delete taskWithoutTiming.completedAt;
              return [clonedId, { ...taskWithoutTiming, id: clonedId, createdAt: stamp, updatedAt: stamp }];
            }),
          );
      const copy: KanbanBoard = {
        ...source,
        id: newId(),
        projectId: targetProjectId,
        title: `${source.title} — Kopya`,
        tasks,
        columns: source.columns.map((column) => ({
          ...column,
          id: newId(),
          taskIds: structureOnly ? [] : column.taskIds.map((taskId) => taskIdMap.get(taskId)!).filter(Boolean),
        })),
        archived: false,
        createdAt: stamp,
        updatedAt: stamp,
      };
      commit((current) => ({ ...current, boards: [...current.boards, copy] }));
      setModal(null);
      navigate({ kind: "board", id: copy.id });
    } else {
      const source = data.mindMaps.find((map) => map.id === id);
      if (!source) return;
      const nodeIdMap = new Map(source.nodes.map((node) => [node.id, newId()]));
      const sourceRoot = source.nodes.find((node) => !node.parentId);
      const nodes = structureOnly
        ? [{ ...(sourceRoot ?? source.nodes[0]), id: newId(), title: sourceRoot?.title ?? "Ana fikir", parentId: undefined }]
        : source.nodes.map((node) => ({
            ...node,
            id: nodeIdMap.get(node.id)!,
            parentId: node.parentId ? nodeIdMap.get(node.parentId) : undefined,
          }));
      const copy: MindMap = {
        ...source,
        id: newId(),
        projectId: targetProjectId,
        title: `${source.title} — Kopya`,
        nodes,
        archived: false,
        createdAt: stamp,
        updatedAt: stamp,
      };
      commit((current) => ({ ...current, mindMaps: [...current.mindMaps, copy] }));
      setModal(null);
      navigate({ kind: "mindmap", id: copy.id });
    }
    showToast("Bağımsız bir kopya oluşturuldu");
  }

  function addGlobalLabel(name: string, color: string) {
    const id = newId();
    commit((current) => ({ ...current, labels: [...current.labels, { id, name, color }] }));
    return id;
  }

  const shellScreen = !(currentBoard || currentMap);

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      <Sidebar
        open={sidebarOpen}
        screen={screen}
        projects={availableProjects}
        workspaces={workspaceStore!.workspaces}
        activeWorkspaceId={workspaceStore!.activeWorkspaceId}
        onToggle={() => setSidebarOpen((value) => !value)}
        onNavigate={navigate}
        onNewProject={() => setModal({ type: "project" })}
        onSwitchWorkspace={activateWorkspace}
        onNewWorkspace={() => setModal({ type: "workspace" })}
      />
      <div className="app-main">
        <Topbar
          workspaceName={data.workspaceName}
          profileName={profileName}
          screen={screen}
          projects={data.projects}
          boards={data.boards}
          mindMaps={data.mindMaps}
          query={searchQuery}
          searchOpen={searchOpen}
          saveState={saveState}
          savedAt={savedAt}
          canUndo={pastRef.current.length > 0}
          canRedo={futureRef.current.length > 0}
          historyVersion={historyVersion}
          onQuery={setSearchQuery}
          onSearchOpen={setSearchOpen}
          onNavigate={navigate}
          onUndo={undo}
          onRedo={redo}
        />

        {currentBoard && (
          <BoardView
            key={currentBoard.id}
            board={currentBoard}
            projectName={data.projects.find((project) => project.id === currentBoard.projectId)?.name ?? "Proje"}
            members={data.members}
            labels={data.labels}
            onBack={() => navigate({ kind: "project", id: currentBoard.projectId })}
            onRename={(title, description) =>
              commit((current) => ({
                ...current,
                boards: current.boards.map((board) =>
                  board.id === currentBoard.id ? { ...board, title, description, updatedAt: now() } : board,
                ),
              }))
            }
            onArchive={() => archiveItem("board", currentBoard.id)}
            onDuplicate={() => setModal({ type: "duplicate", kind: "board", id: currentBoard.id })}
            onAddColumn={(title, color, role) =>
              commit((current) => ({
                ...current,
                boards: current.boards.map((board) =>
                  board.id === currentBoard.id
                    ? { ...board, columns: [...board.columns, { id: newId(), title, color, role, taskIds: [] }], updatedAt: now() }
                    : board,
                ),
              }))
            }
            onEditColumn={(columnId, title, color, role) => {
              const existingColumn = currentBoard.columns.find((column) => column.id === columnId);
              if (!existingColumn) return;
              if (existingColumn.role !== role && existingColumn.taskIds.length > 0) {
                const accepted = window.confirm(
                  `Bu sütunun akış anlamı değişirse içindeki ${existingColumn.taskIds.length} görevin süre ve tamamlanma kayıtları yeni anlama göre güncellenecek. Devam edilsin mi?`,
                );
                if (!accepted) return;
              }
              commit((current) => ({
                ...current,
                boards: current.boards.map((board) => {
                  if (board.id !== currentBoard.id) return board;
                  const changedAt = now();
                  const tasks = existingColumn.role !== role
                    ? Object.fromEntries(Object.entries(board.tasks).map(([taskId, task]) => [
                        taskId,
                        existingColumn.taskIds.includes(taskId)
                          ? transitionTaskTiming(task, existingColumn.role, role, changedAt)
                          : task,
                      ]))
                    : board.tasks;
                  return { ...board, tasks, columns: board.columns.map((column) => (column.id === columnId ? { ...column, title, color, role } : column)), updatedAt: changedAt };
                }),
              }));
            }}
            onDeleteColumn={(columnId) => {
              const column = currentBoard.columns.find((item) => item.id === columnId);
              if (!column) return;
              if (column.taskIds.length) {
                showToast("Önce sütundaki görevleri başka bir sütuna taşıyın");
                return;
              }
              if (currentBoard.columns.length === 1) {
                showToast("Panoda en az bir sütun kalmalı");
                return;
              }
              commit((current) => ({
                ...current,
                boards: current.boards.map((board) =>
                  board.id === currentBoard.id ? { ...board, columns: board.columns.filter((item) => item.id !== columnId) } : board,
                ),
              }));
              showToast("Sütun silindi", true);
            }}
            onReorderColumn={(columnId, direction) =>
              commit((current) => ({
                ...current,
                boards: current.boards.map((board) => {
                  if (board.id !== currentBoard.id) return board;
                  const index = board.columns.findIndex((column) => column.id === columnId);
                  const target = index + direction;
                  if (index < 0 || target < 0 || target >= board.columns.length) return board;
                  const columns = [...board.columns];
                  [columns[index], columns[target]] = [columns[target], columns[index]];
                  return { ...board, columns, updatedAt: now() };
                }),
              }))
            }
            onSaveTask={(columnId, task, isNew) =>
              commit((current) => ({
                ...current,
                boards: current.boards.map((board) => {
                  if (board.id !== currentBoard.id) return board;
                  return {
                    ...board,
                    tasks: { ...board.tasks, [task.id]: task },
                    columns: isNew
                      ? board.columns.map((column) =>
                          column.id === columnId ? { ...column, taskIds: [...column.taskIds, task.id] } : column,
                        )
                      : board.columns,
                    updatedAt: now(),
                  };
                }),
              }))
            }
            onDeleteTask={(columnId, taskId) =>
              commit((current) => ({
                ...current,
                boards: current.boards.map((board) => {
                  if (board.id !== currentBoard.id) return board;
                  const tasks = { ...board.tasks };
                  delete tasks[taskId];
                  return {
                    ...board,
                    tasks,
                    columns: board.columns.map((column) =>
                      column.id === columnId ? { ...column, taskIds: column.taskIds.filter((id) => id !== taskId) } : column,
                    ),
                  };
                }),
              }))
            }
            onMoveTask={(taskId, fromColumnId, toColumnId, beforeTaskId) =>
              commit((current) => ({
                ...current,
                boards: current.boards.map((board) => {
                  if (board.id !== currentBoard.id) return board;
                  const sourceColumn = board.columns.find((column) => column.id === fromColumnId);
                  const targetColumn = board.columns.find((column) => column.id === toColumnId);
                  const columns = board.columns.map((column) => ({
                    ...column,
                    taskIds: column.taskIds.filter((id) => id !== taskId),
                  }));
                  const target = columns.find((column) => column.id === toColumnId);
                  if (!target) return board;
                  const index = beforeTaskId ? target.taskIds.indexOf(beforeTaskId) : -1;
                  target.taskIds = [...target.taskIds];
                  if (index >= 0) target.taskIds.splice(index, 0, taskId);
                  else target.taskIds.push(taskId);
                  let tasks = board.tasks;
                  if (fromColumnId !== toColumnId && sourceColumn && targetColumn && board.tasks[taskId]) {
                    const movedAt = now();
                    tasks = {
                      ...tasks,
                      [taskId]: transitionTaskTiming(
                        board.tasks[taskId],
                        sourceColumn.role,
                        targetColumn.role,
                        movedAt,
                      ),
                    };
                  }
                  return { ...board, columns, tasks, updatedAt: now() };
                }),
              }))
            }
            onAddLabel={addGlobalLabel}
            onZoomChange={(zoom) =>
              commit(
                (current) => ({
                  ...current,
                  boards: current.boards.map((board) =>
                    board.id === currentBoard.id ? { ...board, zoom } : board,
                  ),
                }),
                false,
              )
            }
          />
        )}

        {currentMap && (
          <MindMapView
            key={currentMap.id}
            map={currentMap}
            projectName={data.projects.find((project) => project.id === currentMap.projectId)?.name ?? "Proje"}
            onBack={() => navigate({ kind: "project", id: currentMap.projectId })}
            onRename={(title, description) =>
              commit((current) => ({
                ...current,
                mindMaps: current.mindMaps.map((map) => (map.id === currentMap.id ? { ...map, title, description, updatedAt: now() } : map)),
              }))
            }
            onArchive={() => archiveItem("mindmap", currentMap.id)}
            onDuplicate={() => setModal({ type: "duplicate", kind: "mindmap", id: currentMap.id })}
            onAddNode={(parentId) => {
              const id = newId();
              const parent = currentMap.nodes.find((node) => node.id === parentId) ?? currentMap.nodes[0];
              const siblings = currentMap.nodes.filter((node) => node.parentId === parent?.id).length;
              const node: MindNode = {
                id,
                title: "Yeni fikir",
                note: "",
                parentId: parent?.id,
                x: Math.min(1260, (parent?.x ?? 600) + (siblings % 2 === 0 ? 300 : -300)),
                y: Math.max(50, (parent?.y ?? 340) + (siblings + 1) * 90 - 130),
                color: ["coral", "sage", "blue", "amber"][siblings % 4],
              };
              commit((current) => ({
                ...current,
                mindMaps: current.mindMaps.map((map) =>
                  map.id === currentMap.id ? { ...map, nodes: [...map.nodes, node], updatedAt: now() } : map,
                ),
              }));
              return id;
            }}
            onUpdateNode={(nodeId, patch) =>
              commit((current) => ({
                ...current,
                mindMaps: current.mindMaps.map((map) =>
                  map.id === currentMap.id
                    ? { ...map, nodes: map.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)), updatedAt: now() }
                    : map,
                ),
              }))
            }
            onMoveNode={(nodeId, x, y) =>
              commit((current) => ({
                ...current,
                mindMaps: current.mindMaps.map((map) =>
                  map.id === currentMap.id
                    ? { ...map, nodes: map.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)), updatedAt: now() }
                    : map,
                ),
              }))
            }
            onDeleteNode={(nodeId) =>
              commit((current) => ({
                ...current,
                mindMaps: current.mindMaps.map((map) => {
                  if (map.id !== currentMap.id) return map;
                  const descendants = new Set<string>([nodeId]);
                  let changed = true;
                  while (changed) {
                    changed = false;
                    map.nodes.forEach((node) => {
                      if (node.parentId && descendants.has(node.parentId) && !descendants.has(node.id)) {
                        descendants.add(node.id);
                        changed = true;
                      }
                    });
                  }
                  return { ...map, nodes: map.nodes.filter((node) => !descendants.has(node.id)), updatedAt: now() };
                }),
              }))
            }
            onAutoLayout={() => {
              const root = currentMap.nodes.find((node) => !node.parentId);
              if (!root) return;
              const levels = new Map<number, MindNode[]>();
              const queue: Array<{ node: MindNode; depth: number }> = [{ node: root, depth: 0 }];
              while (queue.length) {
                const current = queue.shift()!;
                levels.set(current.depth, [...(levels.get(current.depth) ?? []), current.node]);
                currentMap.nodes
                  .filter((node) => node.parentId === current.node.id)
                  .forEach((node) => queue.push({ node, depth: current.depth + 1 }));
              }
              const positions = new Map<string, { x: number; y: number }>();
              levels.forEach((nodes, depth) => {
                nodes.forEach((node, index) => {
                  positions.set(node.id, {
                    x: 150 + depth * 310,
                    y: 110 + index * Math.max(115, 650 / Math.max(1, nodes.length)),
                  });
                });
              });
              commit((current) => ({
                ...current,
                mindMaps: current.mindMaps.map((map) =>
                  map.id === currentMap.id
                    ? { ...map, nodes: map.nodes.map((node) => ({ ...node, ...(positions.get(node.id) ?? {}) })), updatedAt: now() }
                    : map,
                ),
              }));
              showToast("Harita otomatik düzenlendi", true);
            }}
            onZoomChange={(zoom) =>
              commit(
                (current) => ({
                  ...current,
                  mindMaps: current.mindMaps.map((map) =>
                    map.id === currentMap.id ? { ...map, zoom } : map,
                  ),
                }),
                false,
              )
            }
          />
        )}

        {shellScreen && (
          <ShellContent
            screen={screen}
            data={data}
            workspaces={workspaceStore!.workspaces}
            activeWorkspaceId={workspaceStore!.activeWorkspaceId}
            onNavigate={navigate}
            onModal={setModal}
            onArchiveItem={archiveItem}
            onArchiveProject={(projectId) => {
              commit((current) => ({
                ...current,
                projects: current.projects.map((project) =>
                  project.id === projectId ? { ...project, archived: true, updatedAt: now() } : project,
                ),
              }));
              navigate({ kind: "home" });
              showToast("Proje arşivlendi", true);
            }}
            onEditProject={(projectId) => setModal({ type: "project", projectId })}
            onProjectStatus={(projectId, status) => {
              commit((current) => ({
                ...current,
                projects: current.projects.map((project) =>
                  project.id === projectId
                    ? { ...transitionProjectStatus(project, status, now()), updatedAt: now() }
                    : project,
                ),
              }));
              showToast(
                status === "active"
                  ? "Proje yeniden aktif"
                  : status === "completed"
                    ? "Proje tamamlandı olarak işaretlendi"
                    : "Müşteriye teslim kaydedildi",
                true,
              );
            }}
            onAddPayment={(projectId) => setModal({ type: "payment", projectId })}
            onEditPayment={(projectId, paymentId) => setModal({ type: "payment", projectId, paymentId })}
            onDeletePayment={(projectId, paymentId) => {
              const project = data.projects.find((item) => item.id === projectId);
              const payment = project?.finance?.payments.find((item) => item.id === paymentId);
              if (!payment || !window.confirm(`${formatTryKurus(payment.amountKurus, true)} tutarındaki tahsilat kaydı silinsin mi?`)) return;
              commit((current) => ({
                ...current,
                projects: current.projects.map((item) =>
                  item.id === projectId && item.finance
                    ? { ...item, finance: { ...item.finance, payments: item.finance.payments.filter((entry) => entry.id !== paymentId) }, updatedAt: now() }
                    : item,
                ),
              }));
              showToast("Tahsilat kaydı silindi", true);
            }}
            onRestore={(kind, id) => {
              commit((current) => {
                if (kind === "project") return { ...current, projects: current.projects.map((item) => (item.id === id ? { ...item, archived: false } : item)) };
                if (kind === "board") return { ...current, boards: current.boards.map((item) => (item.id === id ? { ...item, archived: false } : item)) };
                return { ...current, mindMaps: current.mindMaps.map((item) => (item.id === id ? { ...item, archived: false } : item)) };
              });
              showToast("Çalışma geri getirildi", true);
            }}
            onDelete={(kind, id) => {
              const message = kind === "project"
                ? (() => {
                    const project = data.projects.find((item) => item.id === id);
                    const boards = data.boards.filter((item) => item.projectId === id);
                    const maps = data.mindMaps.filter((item) => item.projectId === id);
                    const tasks = boards.reduce((sum, board) => sum + Object.keys(board.tasks).length, 0);
                    const payments = project?.finance?.payments.length ?? 0;
                    return `“${project?.name ?? "Proje"}” ile birlikte ${boards.length} Kanban panosu, ${maps.length} zihin haritası, ${tasks} görev ve ${payments} tahsilat kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`;
                  })()
                : "Bu çalışma kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?";
              if (!window.confirm(message)) return;
              commit((current) => {
                if (kind === "project") {
                  return {
                    ...current,
                    projects: current.projects.filter((item) => item.id !== id),
                    boards: current.boards.filter((item) => item.projectId !== id),
                    mindMaps: current.mindMaps.filter((item) => item.projectId !== id),
                  };
                }
                if (kind === "board") return { ...current, boards: current.boards.filter((item) => item.id !== id) };
                return { ...current, mindMaps: current.mindMaps.filter((item) => item.id !== id) };
              }, false);
              showToast("Kalıcı olarak silindi");
            }}
            onQuickTask={(boardId, title) => {
              const board = data.boards.find((item) => item.id === boardId);
              const column = board?.columns.find((item) => item.role === "backlog") ?? board?.columns[0];
              if (!board || !column) return;
              const task: TaskCard = {
                id: newId(),
                title,
                description: "",
                priority: "medium",
                labelIds: [],
                assigneeIds: [],
                createdAt: now(),
                updatedAt: now(),
              };
              commit((current) => ({
                ...current,
                boards: current.boards.map((item) =>
                  item.id === boardId
                    ? {
                        ...item,
                        tasks: { ...item.tasks, [task.id]: task },
                        columns: item.columns.map((entry) =>
                          entry.id === column.id ? { ...entry, taskIds: [task.id, ...entry.taskIds] } : entry,
                        ),
                      }
                    : item,
                ),
              }));
              showToast("Görev, toplam görev listesine eklendi");
            }}
            onTheme={(theme) => commit((current) => ({ ...current, theme }), false)}
            onWorkspaceName={(workspaceName) => saveWorkspaceItem(workspaceName, activeWorkspace!.color, activeWorkspace!.id)}
            onProfileName={(profileName) => commit((current) => ({ ...current, profileName }))}
            onNewMember={() => setModal({ type: "member" })}
            onToggleMember={(memberId) =>
              commit((current) => ({
                ...current,
                members: current.members.map((member) =>
                  member.id === memberId ? { ...member, active: !member.active } : member,
                ),
              }))
            }
            onDeleteMember={(memberId) => {
              const member = data.members.find((item) => item.id === memberId);
              if (!member) return;
              const assignmentCount = countMemberAssignments(data, memberId);
              const assignmentNotice = assignmentCount > 0
                ? `\n\n${assignmentCount} görevdeki kişi ataması kaldırılacak. Görevler silinmeyecek.`
                : "";
              if (!window.confirm(`${member.name} kişi dizininden silinsin mi?${assignmentNotice}`)) return;
              commit((current) => removeMemberFromWorkspace(current, memberId, now()));
              showToast(
                assignmentCount > 0
                  ? `${member.name} silindi; ${assignmentCount} görevdeki ataması kaldırıldı`
                  : `${member.name} kişi dizininden silindi`,
                true,
              );
            }}
            onExport={() => exportWorkspace(data)}
            onImport={(imported) => {
              pastRef.current = [...pastRef.current.slice(-39), data];
              futureRef.current = [];
              setWorkspaceStore((current) => current
                ? updateActiveWorkspaceData(current, () => ({ ...imported, workspaceName: activeWorkspace!.name }), now())
                : current);
              setHistoryVersion((value) => value + 1);
              showToast("Yedek başarıyla geri yüklendi", true);
            }}
            onNewWorkspace={() => setModal({ type: "workspace" })}
            onEditWorkspace={(workspaceId) => setModal({ type: "workspace", workspaceId })}
            onSwitchWorkspace={activateWorkspace}
            onArchiveWorkspace={archiveWorkspaceItem}
            onRestoreWorkspace={restoreWorkspaceItem}
            onDeleteWorkspace={deleteWorkspaceItem}
          />
        )}
      </div>

      {modal?.type === "project" && (
        <ProjectModal
          project={modal.projectId ? data.projects.find((project) => project.id === modal.projectId) : undefined}
          onClose={() => setModal(null)}
          onSave={(draft) => saveProjectItem(draft, modal.projectId)}
        />
      )}
      {modal?.type === "payment" && (() => {
        const project = data.projects.find((item) => item.id === modal.projectId);
        const payment = project?.finance?.payments.find((item) => item.id === modal.paymentId);
        if (!project?.finance) return null;
        return (
          <PaymentModal
            project={project}
            payment={payment}
            onClose={() => setModal(null)}
            onSave={(draft) => saveProjectPayment(project.id, draft, payment?.id)}
          />
        );
      })()}
      {modal?.type === "item" && (
        <ItemModal
          kind={modal.kind}
          projects={availableProjects}
          initialProjectId={modal.projectId}
          onClose={() => setModal(null)}
          onNewProject={() => setModal({ type: "project" })}
          onSave={createItem}
        />
      )}
      {modal?.type === "duplicate" && (
        <DuplicateModal
          kind={modal.kind}
          projects={availableProjects}
          currentProjectId={
            modal.kind === "board"
              ? data.boards.find((item) => item.id === modal.id)?.projectId
              : data.mindMaps.find((item) => item.id === modal.id)?.projectId
          }
          onClose={() => setModal(null)}
          onNewProject={() => setModal({ type: "project" })}
          onSave={(projectId, structureOnly) => duplicateItem(modal.kind, modal.id, projectId, structureOnly)}
        />
      )}
      {modal?.type === "member" && (
        <MemberModal
          onClose={() => setModal(null)}
          onSave={(name, color) => {
            const initials = name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toLocaleUpperCase("tr");
            commit((current) => ({
              ...current,
              members: [...current.members, { id: newId(), name, initials, color, active: true }],
            }));
            setModal(null);
            showToast("Kişi çalışma alanına eklendi");
          }}
        />
      )}
      {modal?.type === "workspace" && (
        <WorkspaceModal
          workspace={modal.workspaceId ? workspaceStore!.workspaces.find((item) => item.id === modal.workspaceId) : undefined}
          existingNames={workspaceStore!.workspaces.map((item) => item.name)}
          onClose={() => setModal(null)}
          onSave={(name, color) => saveWorkspaceItem(name, color, modal.workspaceId)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          <span>{toast.message}</span>
          {toast.undo && <button onClick={undo}>Geri al</button>}
          <button className="toast-close" onClick={() => setToast(null)} aria-label="Bildirimi kapat"><X size={15} /></button>
        </div>
      )}
    </div>
  );
}

function Sidebar({
  open,
  screen,
  projects,
  workspaces,
  activeWorkspaceId,
  onToggle,
  onNavigate,
  onNewProject,
  onSwitchWorkspace,
  onNewWorkspace,
}: {
  open: boolean;
  screen: Screen;
  projects: Project[];
  workspaces: LocalWorkspace[];
  activeWorkspaceId: string;
  onToggle: () => void;
  onNavigate: (screen: Screen) => void;
  onNewProject: () => void;
  onSwitchWorkspace: (id: string) => void;
  onNewWorkspace: () => void;
}) {
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const visibleWorkspaces = workspaces.filter((workspace) => !workspace.archived);
  const nav = [
    { kind: "home" as const, label: "Genel Bakış", icon: Home },
    { kind: "projects" as const, label: "Projeler", icon: FolderKanban },
    { kind: "boards" as const, label: "Kanban Panoları", icon: LayoutDashboard },
    { kind: "mindmaps" as const, label: "Zihin Haritaları", icon: MapIcon },
    { kind: "insights" as const, label: "İçgörüler", icon: BarChart3 },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <button className="brand-button" onClick={() => onNavigate({ kind: "home" })} aria-label="Genel Bakışa git">
          <span className="brand-mark"><Blocks size={20} /></span>
          {open && <span><strong>Akış</strong><small>Yerel çalışma alanı</small></span>}
        </button>
        <button className="icon-button sidebar-toggle" onClick={onToggle} aria-label={open ? "Menüyü daralt" : "Menüyü genişlet"}>
          {open ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        </button>
      </div>
      <div className={`workspace-switcher ${workspaceMenu ? "open" : ""}`}>
        <button
          className="workspace-switcher-button"
          onClick={() => { if (!open) { onToggle(); setWorkspaceMenu(true); } else setWorkspaceMenu((value) => !value); }}
          aria-label="Çalışma alanını değiştir"
          aria-expanded={workspaceMenu}
          title={!open ? activeWorkspace?.name : undefined}
        >
          <i style={{ background: activeWorkspace?.color }} />
          {open && <span><small>ÇALIŞMA ALANI</small><strong>{activeWorkspace?.name}</strong></span>}
          {open && <ChevronsUpDown size={15} />}
        </button>
        {workspaceMenu && (
          <div className="workspace-switcher-menu" role="menu">
            <header>Çalışma alanları</header>
            {visibleWorkspaces.map((workspace) => (
              <button key={workspace.id} role="menuitem" className={workspace.id === activeWorkspaceId ? "active" : ""} onClick={() => { setWorkspaceMenu(false); onSwitchWorkspace(workspace.id); }}>
                <i style={{ background: workspace.color }} />
                <span>{workspace.name}</span>
                {workspace.id === activeWorkspaceId && <Check size={15} />}
              </button>
            ))}
            <button role="menuitem" className="new-workspace" onClick={() => { setWorkspaceMenu(false); onNewWorkspace(); }}><Plus size={15} /> Yeni çalışma alanı</button>
          </div>
        )}
      </div>
      <nav className="main-nav" aria-label="Ana menü">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = screen.kind === item.kind
            || (item.kind === "projects" && screen.kind === "project")
            || (item.kind === "boards" && screen.kind === "board")
            || (item.kind === "mindmaps" && screen.kind === "mindmap");
          return (
            <button key={item.kind} className={active ? "active" : ""} aria-label={item.label} aria-current={active ? "page" : undefined} onClick={() => onNavigate({ kind: item.kind })} title={!open ? item.label : undefined}>
              <Icon size={18} /> {open && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
      {open && (
        <div className="sidebar-projects">
          <header><span>PROJELER</span><button onClick={onNewProject} aria-label="Yeni proje"><Plus size={15} /></button></header>
          {projects.slice(0, 6).map((project) => (
            <button
              key={project.id}
              className={screen.kind === "project" && screen.id === project.id ? "active" : ""}
              aria-label={`${project.name} projesini aç`}
              aria-current={screen.kind === "project" && screen.id === project.id ? "page" : undefined}
              onClick={() => onNavigate({ kind: "project", id: project.id })}
            >
              <i style={{ background: project.color }} />
              <span>{project.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="sidebar-bottom">
        <button className={screen.kind === "archive" ? "active" : ""} aria-label="Arşiv" aria-current={screen.kind === "archive" ? "page" : undefined} onClick={() => onNavigate({ kind: "archive" })} title={!open ? "Arşiv" : undefined}>
          <Archive size={18} /> {open && <span>Arşiv</span>}
        </button>
        <button className={screen.kind === "settings" ? "active" : ""} aria-label="Ayarlar" aria-current={screen.kind === "settings" ? "page" : undefined} onClick={() => onNavigate({ kind: "settings" })} title={!open ? "Ayarlar" : undefined}>
          <Settings2 size={18} /> {open && <span>Ayarlar</span>}
        </button>
      </div>
    </aside>
  );
}

function Topbar({
  workspaceName,
  profileName,
  screen,
  projects,
  boards,
  mindMaps,
  query,
  searchOpen,
  saveState,
  savedAt,
  canUndo,
  canRedo,
  onQuery,
  onSearchOpen,
  onNavigate,
  onUndo,
  onRedo,
}: {
  workspaceName: string;
  profileName: string;
  screen: Screen;
  projects: Project[];
  boards: KanbanBoard[];
  mindMaps: MindMap[];
  query: string;
  searchOpen: boolean;
  saveState: "saved" | "saving" | "error";
  savedAt: Date | null;
  canUndo: boolean;
  canRedo: boolean;
  historyVersion: number;
  onQuery: (query: string) => void;
  onSearchOpen: (open: boolean) => void;
  onNavigate: (screen: Screen) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const normalized = query.trim().toLocaleLowerCase("tr");
  const visibleProjects = projects.filter((project) => !project.archived);
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));
  const visibleBoards = boards.filter((board) => !board.archived && visibleProjectIds.has(board.projectId));
  const visibleMindMaps = mindMaps.filter((map) => !map.archived && visibleProjectIds.has(map.projectId));
  const results = normalized
    ? [
        ...visibleProjects.filter((item) => `${item.name} ${item.clientName ?? ""}`.toLocaleLowerCase("tr").includes(normalized)).map((item) => ({ key: `p-${item.id}`, title: item.name, meta: "Proje", screen: { kind: "project", id: item.id } as Screen, icon: FolderKanban })),
        ...visibleBoards.filter((item) => `${item.title} ${item.description}`.toLocaleLowerCase("tr").includes(normalized)).map((item) => ({ key: `b-${item.id}`, title: item.title, meta: "Kanban panosu", screen: { kind: "board", id: item.id } as Screen, icon: LayoutDashboard })),
        ...visibleMindMaps.filter((item) => `${item.title} ${item.description}`.toLocaleLowerCase("tr").includes(normalized)).map((item) => ({ key: `m-${item.id}`, title: item.title, meta: "Zihin haritası", screen: { kind: "mindmap", id: item.id } as Screen, icon: MapIcon })),
        ...visibleMindMaps.flatMap((map) =>
          map.nodes
            .filter((node) => `${node.title} ${node.note}`.toLocaleLowerCase("tr").includes(normalized))
            .map((node) => ({ key: `n-${node.id}`, title: node.title, meta: `${map.title} · Fikir`, screen: { kind: "mindmap", id: map.id } as Screen, icon: MapIcon })),
        ),
        ...visibleBoards.flatMap((board) =>
          Object.values(board.tasks)
            .filter((task) => `${task.title} ${task.description}`.toLocaleLowerCase("tr").includes(normalized))
            .map((task) => ({ key: `t-${task.id}`, title: task.title, meta: `${board.title} · Görev`, screen: { kind: "board", id: board.id } as Screen, icon: ListTodo })),
        ),
      ].slice(0, 8)
    : [];

  const crumb = (() => {
    if (screen.kind === "project") return projects.find((item) => item.id === screen.id)?.name;
    if (screen.kind === "board") return boards.find((item) => item.id === screen.id)?.title;
    if (screen.kind === "mindmap") return mindMaps.find((item) => item.id === screen.id)?.title;
    const names: Record<string, string> = { home: "Genel Bakış", projects: "Projeler", boards: "Kanban Panoları", mindmaps: "Zihin Haritaları", insights: "İçgörüler", archive: "Arşiv", settings: "Ayarlar" };
    return names[screen.kind];
  })();

  return (
    <header className="topbar">
      <div className="breadcrumb"><span>{workspaceName}</span><ChevronRight size={14} /><strong>{crumb}</strong></div>
      <div className="topbar-center">
        <label className="global-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onFocus={() => onSearchOpen(true)}
            placeholder="Her yerde ara..."
            role="combobox"
            aria-autocomplete="list"
            aria-label="Çalışma alanında ara"
            aria-expanded={searchOpen}
            aria-controls="global-search-results"
          />
          <kbd>Ctrl K</kbd>
        </label>
        {searchOpen && (
          <div id="global-search-results" className="search-popover" role="dialog" aria-label="Arama sonuçları">
            <header><span>{normalized ? `“${query}” için sonuçlar` : "Proje, görev veya fikir arayın"}</span><button onClick={() => onSearchOpen(false)} aria-label="Aramayı kapat"><X size={15} /></button></header>
            {results.map((result) => {
              const Icon = result.icon;
              return <button key={result.key} onClick={() => { onNavigate(result.screen); onSearchOpen(false); }}><Icon size={17} /><span><strong>{result.title}</strong><small>{result.meta}</small></span><ArrowRight size={15} /></button>;
            })}
            {normalized && results.length === 0 && <div className="empty-search">Eşleşen sonuç bulunamadı.</div>}
          </div>
        )}
      </div>
      <div className="topbar-actions">
        <div className={`save-indicator ${saveState}`} role={saveState === "error" ? "alert" : "status"} aria-live="polite">
          <i /> {saveState === "saving" ? "Kaydediliyor" : saveState === "error" ? "Kaydedilemedi · yeniden deneniyor" : `${isDesktopRuntime() ? "Save klasörüne kaydedildi" : "Yerelde kayıtlı"}${savedAt ? ` · ${savedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
          {saveState === "error" && isDesktopRuntime() && <button className="save-error-action" onClick={() => openDesktopSaveFolder()}>Save klasörü</button>}
        </div>
        <button className="icon-button" onClick={onUndo} disabled={!canUndo} aria-label="Geri al"><Undo2 size={17} /></button>
        <button className="icon-button" onClick={onRedo} disabled={!canRedo} aria-label="Yinele"><Redo2 size={17} /></button>
        <span className="user-avatar" role="img" aria-label={profileName ? `${profileName} profili` : "Akış profili"} title={profileName || "Akış"}>{getProfileInitials(profileName)}</span>
      </div>
    </header>
  );
}

function ShellContent({
  screen,
  data,
  workspaces,
  activeWorkspaceId,
  onNavigate,
  onModal,
  onArchiveItem,
  onArchiveProject,
  onEditProject,
  onProjectStatus,
  onAddPayment,
  onEditPayment,
  onDeletePayment,
  onRestore,
  onDelete,
  onQuickTask,
  onTheme,
  onWorkspaceName,
  onProfileName,
  onNewMember,
  onToggleMember,
  onDeleteMember,
  onExport,
  onImport,
  onNewWorkspace,
  onEditWorkspace,
  onSwitchWorkspace,
  onArchiveWorkspace,
  onRestoreWorkspace,
  onDeleteWorkspace,
}: {
  screen: Screen;
  data: AppData;
  workspaces: LocalWorkspace[];
  activeWorkspaceId: string;
  onNavigate: (screen: Screen) => void;
  onModal: (modal: ModalState) => void;
  onArchiveItem: (kind: ItemKind, id: string) => void;
  onArchiveProject: (id: string) => void;
  onEditProject: (id: string) => void;
  onProjectStatus: (id: string, status: ProjectStatus) => void;
  onAddPayment: (id: string) => void;
  onEditPayment: (projectId: string, paymentId: string) => void;
  onDeletePayment: (projectId: string, paymentId: string) => void;
  onRestore: (kind: "project" | ItemKind, id: string) => void;
  onDelete: (kind: "project" | ItemKind, id: string) => void;
  onQuickTask: (boardId: string, title: string) => void;
  onTheme: (theme: ThemeId) => void;
  onWorkspaceName: (name: string) => void;
  onProfileName: (name: string) => void;
  onNewMember: () => void;
  onToggleMember: (id: string) => void;
  onDeleteMember: (id: string) => void;
  onExport: () => void;
  onImport: (data: AppData) => void;
  onNewWorkspace: () => void;
  onEditWorkspace: (id: string) => void;
  onSwitchWorkspace: (id: string) => void;
  onArchiveWorkspace: (id: string) => void;
  onRestoreWorkspace: (id: string) => void;
  onDeleteWorkspace: (id: string) => void;
}) {
  if (screen.kind === "home") {
    return (
      <HomeScreen
        data={data}
        onNavigate={onNavigate}
        onNewProject={() => onModal({ type: "project" })}
        onQuickTask={onQuickTask}
      />
    );
  }
  if (screen.kind === "project") {
    const project = data.projects.find((item) => item.id === screen.id);
    if (!project) return <main className="shell-page missing-item-page"><EmptyState title="Proje bulunamadı" description="Bu proje kaldırılmış veya arşivlenmiş olabilir." actionLabel="Projelere dön" onAction={() => onNavigate({ kind: "projects" })} /></main>;
    return (
      <ProjectScreen
        project={project}
        boards={data.boards.filter((board) => board.projectId === project.id && !board.archived)}
        mindMaps={data.mindMaps.filter((map) => map.projectId === project.id && !map.archived)}
        onNavigate={onNavigate}
        onNew={(kind) => onModal({ type: "item", kind, projectId: project.id })}
        onArchiveProject={() => onArchiveProject(project.id)}
        onEditProject={() => onEditProject(project.id)}
        onProjectStatus={(status) => onProjectStatus(project.id, status)}
        onAddPayment={() => onAddPayment(project.id)}
        onEditPayment={(paymentId) => onEditPayment(project.id, paymentId)}
        onDeletePayment={(paymentId) => onDeletePayment(project.id, paymentId)}
        onDuplicate={(kind, id) => onModal({ type: "duplicate", kind, id })}
        onArchiveItem={onArchiveItem}
      />
    );
  }
  if (screen.kind === "projects") {
    const projects = data.projects.filter((project) => !project.archived);
    return (
      <LibraryScreen
        title="Projeler"
        description="Bütün çalışma alanlarınız tek bakışta."
        actionLabel="Yeni proje"
        onAction={() => onModal({ type: "project" })}
      >
        <div className="project-grid">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} data={data} onOpen={() => onNavigate({ kind: "project", id: project.id })} />
          ))}
          {projects.length === 0 && <EmptyState title="Henüz proje yok" description="İlk projenizi oluşturduğunuzda Kanban panolarınızı ve zihin haritalarınızı burada düzenleyebilirsiniz." />}
        </div>
      </LibraryScreen>
    );
  }
  if (screen.kind === "insights") {
    return <InsightsScreen data={data} onNavigate={onNavigate} />;
  }
  if (screen.kind === "board" || screen.kind === "mindmap") {
    const isBoard = screen.kind === "board";
    return (
      <main className="shell-page missing-item-page">
        <EmptyState
          title={isBoard ? "Kanban panosu bulunamadı" : "Zihin haritası bulunamadı"}
          description="Bu çalışma silinmiş, arşivlenmiş veya artık erişilemeyen bir bağlantıdan açılmış olabilir."
          actionLabel={isBoard ? "Kanban panolarına dön" : "Zihin haritalarına dön"}
          onAction={() => onNavigate({ kind: isBoard ? "boards" : "mindmaps" })}
        />
      </main>
    );
  }
  if (screen.kind === "boards" || screen.kind === "mindmaps") {
    const isBoard = screen.kind === "boards";
    const visibleProjectIds = new Set(
      data.projects.filter((project) => !project.archived).map((project) => project.id),
    );
    const items = isBoard
      ? data.boards.filter((item) => !item.archived && visibleProjectIds.has(item.projectId))
      : data.mindMaps.filter((item) => !item.archived && visibleProjectIds.has(item.projectId));
    return (
      <LibraryScreen
        title={isBoard ? "Kanban Panoları" : "Zihin Haritaları"}
        description={isBoard ? "Önceliklerinizi akışa dönüştüren çalışma yüzeyleri." : "Düşünceleriniz arasındaki bağları görünür kılın."}
        actionLabel={isBoard ? "Yeni Kanban panosu" : "Yeni zihin haritası"}
        onAction={() => onModal({ type: "item", kind: isBoard ? "board" : "mindmap" })}
      >
        <div className="asset-grid">
          {items.map((item) => (
            <AssetCard
              key={item.id}
              item={item}
              project={data.projects.find((project) => project.id === item.projectId)}
              onOpen={() => onNavigate({ kind: item.kind, id: item.id })}
              onDuplicate={() => onModal({ type: "duplicate", kind: item.kind, id: item.id })}
              onArchive={() => onArchiveItem(item.kind, item.id)}
            />
          ))}
          {items.length === 0 && <EmptyState title={isBoard ? "Henüz Kanban panosu yok" : "Henüz zihin haritası yok"} description={isBoard ? "Bir proje oluşturup ilk görev akışınızı kurabilirsiniz." : "Bir proje oluşturup düşüncelerinizi dallandırmaya başlayabilirsiniz."} />}
        </div>
      </LibraryScreen>
    );
  }
  if (screen.kind === "archive") {
    return <ArchiveScreen data={data} onRestore={onRestore} onDelete={onDelete} />;
  }
  if (screen.kind === "settings") {
    return (
      <SettingsScreen
        key={`${activeWorkspaceId}:${data.workspaceName}`}
        data={data}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onTheme={onTheme}
        onWorkspaceName={onWorkspaceName}
        onProfileName={onProfileName}
        onNewMember={onNewMember}
        onToggleMember={onToggleMember}
        onDeleteMember={onDeleteMember}
        onExport={onExport}
        onImport={onImport}
        onNewWorkspace={onNewWorkspace}
        onEditWorkspace={onEditWorkspace}
        onSwitchWorkspace={onSwitchWorkspace}
        onArchiveWorkspace={onArchiveWorkspace}
        onRestoreWorkspace={onRestoreWorkspace}
        onDeleteWorkspace={onDeleteWorkspace}
      />
    );
  }
  return null;
}

function HomeScreen({
  data,
  onNavigate,
  onNewProject,
  onQuickTask,
}: {
  data: AppData;
  onNavigate: (screen: Screen) => void;
  onNewProject: () => void;
  onQuickTask: (boardId: string, title: string) => void;
}) {
  const [quickTitle, setQuickTitle] = useState("");
  const [quickBoardId, setQuickBoardId] = useState("");
  const availableProjects = data.projects.filter((project) => !project.archived);
  const workInProgressProjects = availableProjects.filter((project) => getProjectStatus(project) === "active");
  const projectStats = workInProgressProjects.map((project) => ({ project, stats: getProjectFlowStats(project, data) }));
  const activeProjectIds = new Set(workInProgressProjects.map((project) => project.id));
  const activeBoards = data.boards.filter((board) => !board.archived && activeProjectIds.has(board.projectId));
  const activeTasks = activeBoards.flatMap((board) => {
    return board.columns
      .filter((column) => column.role === "active")
      .flatMap((column) => column.taskIds)
      .map((id) => ({ task: board.tasks[id], board }))
      .filter((item) => item.task);
  });
  const waitingTasks = activeBoards.flatMap((board) =>
    board.columns
      .filter((column) => column.role !== "done")
      .flatMap((column) => column.taskIds)
      .map((taskId) => board.tasks[taskId])
      .filter((task) => task?.waitingReason)
      .map((task) => ({ task, board })),
  );
  const totalDone = projectStats.reduce((sum, item) => sum + item.stats.done, 0);
  const totalCommitted = projectStats.reduce((sum, item) => sum + item.stats.committed, 0);
  const averageProgress = totalCommitted ? Math.round((totalDone / totalCommitted) * 100) : 0;
  const cycleSamples = activeBoards.flatMap((board) => Object.values(board.tasks).filter((task) => task.completedAt && task.workSessions?.length));
  const averageCycle = cycleSamples.length
    ? Math.max(1, Math.round(cycleSamples.reduce((sum, task) => sum + getTaskWorkMs(task), 0) / cycleSamples.length / 86_400_000))
    : 0;
  const quickBoards = activeBoards;
  const quickBoard = quickBoards.find((board) => board.id === quickBoardId) ?? quickBoards[0];
  const finance = getPortfolioFinance(data.projects);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
  const profileName = resolveProfileName(data);
  const greetingName = profileName.split(/\s+/).filter(Boolean)[0];

  return (
    <main className="shell-page home-page">
      <section className="home-hero">
        <div>
          <span className="eyebrow">{new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span>
          <h1>{greetingName ? `${greeting}, ${greetingName}.` : `${greeting}.`}</h1>
          <p>Zihniniz açık, görevleriniz görünür. Bugün en anlamlı adıma odaklanın.</p>
        </div>
        <button className="primary-button large" onClick={onNewProject}><Plus size={18} /> Yeni proje</button>
      </section>

      <section className="metric-grid" aria-label="Çalışma alanı özeti">
        <MetricCard icon={FolderKanban} tone="violet" label="Aktif proje" value={workInProgressProjects.length} note={`${activeBoards.length} Kanban panosu`} />
        <MetricCard icon={ListTodo} tone="blue" label="Üzerinde çalışılan" value={activeTasks.length} note={`${waitingTasks.length} görev beklemede`} />
        <MetricCard icon={CheckCircle2} tone="green" label="Tamamlanan" value={totalDone} note={`Genel ilerleme %${averageProgress}`} />
        <MetricCard icon={RotateCcw} tone="amber" label="Ortalama çevrim" value={averageCycle ? `${averageCycle} gün` : "—"} note={`${cycleSamples.length} tamamlanan görevden`} />
      </section>

      <section className="finance-overview" aria-label="Finansal görünüm">
        <header className="section-header compact">
          <div><span className="eyebrow">PARA AKIŞI</span><h2>Cebinize giren ve girecek tutarlar</h2></div>
          <button className="text-button" onClick={() => onNavigate({ kind: "insights" })}>Analizi gör <ArrowRight size={15} /></button>
        </header>
        <div className="finance-metric-grid">
          <FinanceMetricCard tone="violet" label="Aktif proje değeri" value={formatTryKurus(finance.activeWorkKurus)} note="Üzerinde çalışılan projelerin anlaşma toplamı" />
          <FinanceMetricCard tone="amber" label="Bekleyen alacak" value={formatTryKurus(finance.receivableKurus)} note="Tam tahsil edilen projeler hariç · arşiv dahil" />
          <FinanceMetricCard tone="green" label="Tahsil edilen" value={formatTryKurus(finance.collectedKurus)} note="Kayıtlı tüm ödemelerin toplamı" />
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-card project-health-card">
          <header className="section-header compact">
            <div><span className="eyebrow">PORTFÖY SAĞLIĞI</span><h2>Projelerinizin ilerlemesi</h2></div>
            <button className="text-button" onClick={() => onNavigate({ kind: "projects" })}>Tümünü gör <ArrowRight size={15} /></button>
          </header>
          <div className="project-health-list">
            {projectStats.map(({ project, stats }) => (
              <button key={project.id} className="project-health-row" onClick={() => onNavigate({ kind: "project", id: project.id })}>
                <div className="progress-ring small" style={{ "--progress": `${stats.progress * 3.6}deg`, "--project-color": project.color } as React.CSSProperties}>
                  <span>{stats.progress}%</span>
                </div>
                <div className="health-main">
                  <div className="health-title"><i style={{ background: project.color }} /><strong>{project.name}</strong><span>{stats.boards} pano</span></div>
                  <div className="segmented-progress" role="progressbar" aria-label={`${project.name} ilerlemesi`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.progress}>
                    <i className="planned" style={{ flex: stats.planned || 0.001 }} />
                    <i className="active" style={{ flex: stats.active || 0.001 }} />
                    <i className="done" style={{ flex: stats.done || 0.001 }} />
                  </div>
                  <div className="health-legend">
                    <span><i className="planned" /> Öncelikli <strong>{stats.planned}</strong></span>
                    <span><i className="active" /> Aktif <strong>{stats.active}</strong></span>
                    <span><i className="done" /> Tamamlanan <strong>{stats.done}</strong></span>
                    {stats.waiting > 0 && <span className="warning"><CircleAlert size={12} /> {stats.waiting} bekliyor</span>}
                  </div>
                </div>
                <div className="cycle-mini"><span>Ort. süre</span><strong>{stats.averageDays ? `${stats.averageDays} gün` : "—"}</strong></div>
                <ChevronRight size={17} />
              </button>
            ))}
            {projectStats.length === 0 && <EmptyState title="Henüz aktif proje yok" description="Yeni bir proje oluşturarak çalışma alanınızı başlatın." />}
          </div>
        </div>

        <aside className="dashboard-card quick-capture-card">
          <div className="capture-icon"><Sparkles size={19} /></div>
          <span className="eyebrow">HIZLI YAKALA</span>
          <h2>Aklınızdakini bırakın</h2>
          <p>Düşünceyi kaybetmeden seçtiğiniz panonun toplam görev listesine ekleyin.</p>
          <textarea value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="Yeni bir görev veya fikir..." rows={4} aria-label="Hızlı eklenecek görev" />
          {quickBoards.length > 1 && (
            <label className="quick-board-select">
              Hedef pano
              <select value={quickBoard?.id ?? ""} onChange={(event) => setQuickBoardId(event.target.value)}>
                {quickBoards.map((board) => <option key={board.id} value={board.id}>{board.title}</option>)}
              </select>
            </label>
          )}
          <button
            className="primary-button wide"
            disabled={!quickTitle.trim() || !quickBoard}
            onClick={() => {
              if (!quickBoard) return;
              onQuickTask(quickBoard.id, quickTitle.trim());
              setQuickTitle("");
            }}
          >
            <Plus size={17} /> Toplam görev listesine ekle
          </button>
          <small>{quickBoard ? `${quickBoard.title} · atanmamış görev` : "Önce aktif bir projede Kanban panosu oluşturun"}</small>
        </aside>
      </section>

      <section className="dashboard-grid lower">
        <div className="dashboard-card focus-card">
          <header className="section-header compact"><div><span className="eyebrow">ŞİMDİ</span><h2>Üzerinde çalıştığınız görevler</h2></div><span className="count-badge">{activeTasks.length}</span></header>
          <div className="focus-list">
            {activeTasks.slice(0, 5).map(({ task, board }) => {
              const elapsed = getTaskWorkMs(task);
              const days = Math.floor(elapsed / 86_400_000);
              return (
                <button key={task.id} onClick={() => onNavigate({ kind: "board", id: board.id })}>
                  <span className="pulse-dot" />
                  <span className="focus-copy"><strong>{task.title}</strong><small>{board.title}</small></span>
                  <span className={`age-badge ${days >= 5 ? "old" : days >= 2 ? "aging" : ""}`}>
                    {elapsed < 86_400_000 ? "Bugün başladı" : `Aktif süre: ${formatTaskWorkDuration(elapsed)}`}
                  </span>
                  <ChevronRight size={15} />
                </button>
              );
            })}
            {activeTasks.length === 0 && <EmptyState title="Aktif görev yok" description="Bir kartı ‘Üzerinde Çalışılanlar’ sütununa taşıdığınızda burada görünür." />}
          </div>
        </div>
        <div className="dashboard-card waiting-card">
          <header className="section-header compact"><div><span className="eyebrow">DIŞ BAĞIMLILIKLAR</span><h2>Bekleyen ve engellenenler</h2></div><CircleAlert size={19} /></header>
          <div className="waiting-list">
            {waitingTasks.slice(0, 5).map(({ task, board }) => (
              <button key={task.id} onClick={() => onNavigate({ kind: "board", id: board.id })}>
                <span className="warning-icon"><CircleAlert size={15} /></span>
                <span><strong>{task.title}</strong><small>{task.waitingReason}</small></span>
                <ChevronRight size={15} />
              </button>
            ))}
            {waitingTasks.length === 0 && <EmptyState title="Bekleyen görev yok" description="Akışınızı durduran dış bağımlılık görünmüyor." />}
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ icon: Icon, tone, label, value, note }: { icon: typeof Home; tone: string; label: string; value: number | string; note: string }) {
  return <article className={`metric-card ${tone}`}><div className="metric-icon"><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function FinanceMetricCard({ tone, label, value, note }: { tone: string; label: string; value: string; note: string }) {
  return (
    <article className={`finance-metric ${tone}`}>
      <span className="finance-metric-icon"><BadgeDollarSign size={20} /></span>
      <div><small>{label}</small><strong>{value}</strong><p>{note}</p></div>
    </article>
  );
}

function ProjectScreen({
  project,
  boards,
  mindMaps,
  onNavigate,
  onNew,
  onArchiveProject,
  onEditProject,
  onProjectStatus,
  onAddPayment,
  onEditPayment,
  onDeletePayment,
  onDuplicate,
  onArchiveItem,
}: {
  project: Project;
  boards: KanbanBoard[];
  mindMaps: MindMap[];
  onNavigate: (screen: Screen) => void;
  onNew: (kind: ItemKind) => void;
  onArchiveProject: () => void;
  onEditProject: () => void;
  onProjectStatus: (status: ProjectStatus) => void;
  onAddPayment: () => void;
  onEditPayment: (paymentId: string) => void;
  onDeletePayment: (paymentId: string) => void;
  onDuplicate: (kind: ItemKind, id: string) => void;
  onArchiveItem: (kind: ItemKind, id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = getProjectStatus(project);
  const finance = getProjectFinanceTotals(project);
  const statusLabels: Record<ProjectStatus, string> = {
    active: "Aktif",
    completed: "Proje tamamlandı",
    delivered: "Müşteriye teslim edildi",
  };
  const paymentLabel = finance.paymentState === "paid"
    ? "Ödeme alındı"
    : finance.paymentState === "overpaid"
      ? "Fazla tahsilat"
      : finance.paymentState === "partial"
        ? "Kısmi tahsilat"
        : finance.paymentState === "unpaid"
          ? "Tahsilat bekliyor"
          : "Tutar girilmedi";
  const sortedPayments = [...(project.finance?.payments ?? [])].sort((a, b) =>
    b.receivedOn.localeCompare(a.receivedOn),
  );
  return (
    <main className="shell-page project-page">
      <section className="project-hero" style={{ "--project-color": project.color } as React.CSSProperties}>
        <div className="project-symbol"><FolderKanban size={25} /></div>
        <div className="project-hero-copy">
          <div className="project-badges"><span className={`project-status-badge ${status}`}>{statusLabels[status]}</span><span className={`payment-badge ${finance.paymentState}`}>{paymentLabel}</span></div>
          <h1>{project.name}</h1>
          <p>{project.clientName ? `${project.clientName} · ${project.description}` : project.description}</p>
        </div>
        <div className="spacer" />
        <button className="secondary-button" onClick={onEditProject}><Pencil size={16} /> Düzenle</button>
        <button className="secondary-button" onClick={() => onNew("mindmap")}><MapIcon size={16} /> Zihin haritası</button>
        <button className="primary-button" onClick={() => onNew("board")}><Plus size={17} /> Kanban panosu</button>
        <div className="relative-menu"><button className="icon-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Proje menüsü" aria-haspopup="menu" aria-expanded={menuOpen}><MoreHorizontal size={18} /></button>{menuOpen && <div className="context-menu" role="menu"><button role="menuitem" onClick={onArchiveProject}><Archive size={15} /> Projeyi arşivle</button></div>}</div>
      </section>
      <section className="project-summary-strip">
        <span><LayoutDashboard size={16} /><strong>{boards.length}</strong> Kanban panosu</span>
        <span><MapIcon size={16} /><strong>{mindMaps.length}</strong> zihin haritası</span>
        <span><ListTodo size={16} /><strong>{boards.reduce((sum, board) => sum + Object.keys(board.tasks).length, 0)}</strong> toplam görev</span>
      </section>

      <section className="project-overview-grid">
        <article className="project-command-card lifecycle-card">
          <header><div><span className="eyebrow">PROJE AŞAMASI</span><h2>Proje hangi aşamada?</h2></div><CheckCircle2 size={20} /></header>
          <div className="lifecycle-steps" role="group" aria-label="Proje aşaması">
            {(["active", "completed", "delivered"] as ProjectStatus[]).map((value, index) => (
              <button
                key={value}
                className={`${status === value ? "current" : ""} ${(["active", "completed", "delivered"] as ProjectStatus[]).indexOf(status) >= index ? "reached" : ""}`}
                aria-pressed={status === value}
                onClick={() => onProjectStatus(value)}
              >
                <i>{index + 1}</i><span>{statusLabels[value]}</span>
              </button>
            ))}
          </div>
          <p className="command-note">
            {status === "active" && "Çalışma devam ediyor; aktif proje değeri hesabına dahildir."}
            {status === "completed" && "Üretim tamamlandı; müşteri teslimi bekleniyor."}
            {status === "delivered" && "Teslim kaydedildi; kalan alacak tahsil edilene kadar görünür kalır."}
          </p>
        </article>

        <article className={`project-command-card finance-card ${finance.paymentState}`}>
          <header>
            <div><span className="eyebrow">FİNANS</span><h2>{project.clientName || "Proje bütçesi"}</h2></div>
            <BadgeDollarSign size={20} />
          </header>
          {project.finance ? (
            <>
              <div className="project-money-grid">
                <div><span>Anlaşılan</span><strong>{formatTryKurus(finance.agreedKurus, true)}</strong></div>
                <div><span>Tahsil edilen</span><strong>{formatTryKurus(finance.collectedKurus, true)}</strong></div>
                <div className="receivable"><span>Kalan alacak</span><strong>{formatTryKurus(finance.receivableKurus, true)}</strong></div>
              </div>
              <div className="collection-progress" role="progressbar" aria-label="Tahsilat oranı" aria-valuemin={0} aria-valuemax={100} aria-valuenow={finance.collectionRate}>
                <i style={{ width: `${finance.collectionRate}%` }} />
              </div>
              <div className="finance-actions-row"><span className={`payment-badge ${finance.paymentState}`}>{paymentLabel} · %{finance.collectionRate}</span><button className="primary-button" onClick={onAddPayment} disabled={finance.receivableKurus === 0}><Plus size={16} /> Tahsilat ekle</button></div>
              {sortedPayments.length > 0 && (
                <div className="payment-history">
                  <strong>Tahsilat geçmişi</strong>
                  {sortedPayments.slice(0, 5).map((payment) => (
                    <div key={payment.id}>
                      <span><strong>{formatTryKurus(payment.amountKurus, true)}</strong><small>{new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${payment.receivedOn}T12:00:00`))}{payment.note ? ` · ${payment.note}` : ""}</small></span>
                      <button className="micro-button" onClick={() => onEditPayment(payment.id)} aria-label="Tahsilatı düzenle"><Pencil size={14} /></button>
                      <button className="micro-button danger" onClick={() => onDeletePayment(payment.id)} aria-label="Tahsilatı sil"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="finance-empty"><BadgeDollarSign size={24} /><div><strong>Henüz tutar girilmedi</strong><span>Müşteriyle anlaşılan tutarı ekleyerek alacak ve tahsilatı takip edin.</span></div><button className="secondary-button" onClick={onEditProject}>Finans bilgisi ekle</button></div>
          )}
        </article>
      </section>
      <section className="section-block">
        <header className="section-header"><div><span className="eyebrow">ÇALIŞMA ALANLARI</span><h2>Kanban Panoları</h2></div><button className="text-button" onClick={() => onNew("board")}><Plus size={15} /> Yeni Kanban panosu</button></header>
        <div className="asset-grid">
          {boards.map((board) => <AssetCard key={board.id} item={board} project={project} onOpen={() => onNavigate({ kind: "board", id: board.id })} onDuplicate={() => onDuplicate("board", board.id)} onArchive={() => onArchiveItem("board", board.id)} />)}
          {boards.length === 0 && <CreateCard icon={LayoutDashboard} label="İlk Kanban panosunu oluştur" onClick={() => onNew("board")} />}
        </div>
      </section>
      <section className="section-block">
        <header className="section-header"><div><span className="eyebrow">DÜŞÜNCE ALANI</span><h2>Zihin Haritaları</h2></div><button className="text-button" onClick={() => onNew("mindmap")}><Plus size={15} /> Yeni zihin haritası</button></header>
        <div className="asset-grid">
          {mindMaps.map((map) => <AssetCard key={map.id} item={map} project={project} onOpen={() => onNavigate({ kind: "mindmap", id: map.id })} onDuplicate={() => onDuplicate("mindmap", map.id)} onArchive={() => onArchiveItem("mindmap", map.id)} />)}
          {mindMaps.length === 0 && <CreateCard icon={MapIcon} label="İlk zihin haritasını oluştur" onClick={() => onNew("mindmap")} />}
        </div>
      </section>
    </main>
  );
}

function ProjectCard({ project, data, onOpen }: { project: Project; data: AppData; onOpen: () => void }) {
  const stats = getProjectFlowStats(project, data);
  const status = getProjectStatus(project);
  const finance = getProjectFinanceTotals(project);
  const statusLabel = status === "active" ? "Aktif" : status === "completed" ? "Tamamlandı" : "Teslim edildi";
  return (
    <button className="project-card" onClick={onOpen} style={{ "--project-color": project.color } as React.CSSProperties}>
      <div className="project-card-top"><span className="project-symbol small"><FolderKanban size={20} /></span><span className={`project-status-badge ${status}`}>{statusLabel}</span><ArrowRight size={17} /></div>
      <h3>{project.name}</h3><p>{project.description}</p>
      <div className="project-card-progress"><span><strong>{stats.progress}%</strong> ilerleme</span><div role="progressbar" aria-label={`${project.name} ilerlemesi`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.progress}><i style={{ width: `${stats.progress}%` }} /></div></div>
      {project.finance && <div className="project-card-money"><span>Kalan alacak</span><strong>{formatTryKurus(finance.receivableKurus)}</strong><small>{finance.paymentState === "paid" ? "Ödeme alındı" : `%${finance.collectionRate} tahsil edildi`}</small></div>}
      <footer><span>{stats.planned} öncelikli</span><span>{stats.active} aktif</span><span>{stats.done} tamamlanan</span></footer>
    </button>
  );
}

function AssetCard({
  item,
  project,
  onOpen,
  onDuplicate,
  onArchive,
}: {
  item: KanbanBoard | MindMap;
  project?: Project;
  onOpen: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [referenceTime] = useState(() => Date.now());
  const isBoard = item.kind === "board";
  const stats = isBoard ? getBoardFlowStats(item) : null;
  return (
    <article className="asset-card">
      <button className="asset-main" onClick={onOpen}>
        <div className={`asset-preview ${isBoard ? "board" : "map"}`}>
          {isBoard ? (
            <>{item.columns.slice(0, 4).map((column) => <i key={column.id} style={{ borderColor: column.color }}><span /><span /><span /></i>)}</>
          ) : (
            <><i className="map-line one" /><i className="map-line two" /><span className="map-node-preview root" /><span className="map-node-preview a" /><span className="map-node-preview b" /></>
          )}
          <span className="asset-kind"><>{isBoard ? <LayoutDashboard size={13} /> : <MapIcon size={13} />}</>{isBoard ? "KANBAN PANOSU" : "ZİHİN HARİTASI"}</span>
        </div>
        <div className="asset-copy"><span className="asset-project"><i style={{ background: project?.color }} />{project?.name ?? "Proje"}</span><h3>{item.title}</h3><p>{item.description}</p></div>
        <footer>{isBoard ? <><span>{stats?.committed} planlanan görev</span><span>%{stats?.progress} tamamlandı</span></> : <><span>{item.nodes.length} fikir</span><span>Zihin haritası</span></>}<span className="updated">{new Intl.RelativeTimeFormat("tr", { numeric: "auto" }).format(Math.max(-30, Math.min(0, Math.round((new Date(item.updatedAt).getTime() - referenceTime) / 86_400_000))), "day")}</span></footer>
      </button>
      <div className="asset-menu"><button className="icon-button" onClick={() => setMenu((value) => !value)} aria-label="Çalışma menüsü" aria-haspopup="menu" aria-expanded={menu}><MoreHorizontal size={17} /></button>{menu && <div className="context-menu" role="menu"><button role="menuitem" onClick={onDuplicate}><Copy size={15} /> Çoğalt</button><button role="menuitem" onClick={onArchive}><Archive size={15} /> Arşivle</button></div>}</div>
    </article>
  );
}

function CreateCard({ icon: Icon, label, onClick }: { icon: typeof Home; label: string; onClick: () => void }) {
  return <button className="create-card" onClick={onClick}><span><Icon size={21} /></span><strong>{label}</strong><small>Boş bir çalışma yüzeyiyle başlayın</small></button>;
}

function LibraryScreen({ title, description, actionLabel, onAction, children }: { title: string; description: string; actionLabel: string; onAction: () => void; children: React.ReactNode }) {
  return <main className="shell-page library-page"><header className="page-header"><div><span className="eyebrow">ÇALIŞMA ALANI</span><h1>{title}</h1><p>{description}</p></div><button className="primary-button large" onClick={onAction}><Plus size={18} /> {actionLabel}</button></header>{children}</main>;
}

function ArchiveScreen({ data, onRestore, onDelete }: { data: AppData; onRestore: (kind: "project" | ItemKind, id: string) => void; onDelete: (kind: "project" | ItemKind, id: string) => void }) {
  const projects = data.projects.filter((item) => item.archived).map((item) => ({ kind: "project" as const, id: item.id, title: item.name, description: item.description, icon: FolderKanban }));
  const boards = data.boards.filter((item) => item.archived).map((item) => ({ kind: "board" as const, id: item.id, title: item.title, description: item.description, icon: LayoutDashboard }));
  const maps = data.mindMaps.filter((item) => item.archived).map((item) => ({ kind: "mindmap" as const, id: item.id, title: item.title, description: item.description, icon: MapIcon }));
  const items = [...projects, ...boards, ...maps];
  return (
    <main className="shell-page archive-page">
      <header className="page-header"><div><span className="eyebrow">GÜVENLİ SAKLAMA</span><h1>Arşiv</h1><p>Tamamlanan veya şimdilik görünmemesi gereken çalışmalar burada korunur.</p></div></header>
      <div className="archive-notice"><Archive size={19} /><div><strong>Arşiv, silmek değildir.</strong><span>Her şeyi içeriği ve düzeniyle geri getirebilirsiniz.</span></div></div>
      <div className="archive-list">
        {items.map((item) => { const Icon = item.icon; return <article key={`${item.kind}-${item.id}`}><span className="archive-icon"><Icon size={19} /></span><div><strong>{item.title}</strong><p>{item.description}</p><small>{item.kind === "project" ? "Proje" : item.kind === "board" ? "Kanban panosu" : "Zihin haritası"}</small></div><button className="secondary-button" onClick={() => onRestore(item.kind, item.id)}><RotateCcw size={15} /> Geri getir</button><button className="danger-ghost" onClick={() => onDelete(item.kind, item.id)}><Trash2 size={16} /> Kalıcı sil</button></article>; })}
        {items.length === 0 && <EmptyState title="Arşiv boş" description="Arşivlediğiniz proje ve çalışmalar burada görünecek." />}
      </div>
    </main>
  );
}

function SettingsScreen({
  data,
  workspaces,
  activeWorkspaceId,
  onTheme,
  onWorkspaceName,
  onProfileName,
  onNewMember,
  onToggleMember,
  onDeleteMember,
  onExport,
  onImport,
  onNewWorkspace,
  onEditWorkspace,
  onSwitchWorkspace,
  onArchiveWorkspace,
  onRestoreWorkspace,
  onDeleteWorkspace,
}: {
  data: AppData;
  workspaces: LocalWorkspace[];
  activeWorkspaceId: string;
  onTheme: (theme: ThemeId) => void;
  onWorkspaceName: (name: string) => void;
  onProfileName: (name: string) => void;
  onNewMember: () => void;
  onToggleMember: (id: string) => void;
  onDeleteMember: (id: string) => void;
  onExport: () => void;
  onImport: (data: AppData) => void;
  onNewWorkspace: () => void;
  onEditWorkspace: (id: string) => void;
  onSwitchWorkspace: (id: string) => void;
  onArchiveWorkspace: (id: string) => void;
  onRestoreWorkspace: (id: string) => void;
  onDeleteWorkspace: (id: string) => void;
}) {
  const [name, setName] = useState(data.workspaceName);
  const currentProfileName = resolveProfileName(data);
  const [profileNameDraft, setProfileNameDraft] = useState(currentProfileName);
  const fileRef = useRef<HTMLInputElement>(null);
  const [desktopInfo, setDesktopInfo] = useState<DesktopSaveInfo | null>(null);
  const activeWorkspaceCount = workspaces.filter((workspace) => !workspace.archived).length;
  useEffect(() => {
    getDesktopSaveInfo().then(setDesktopInfo).catch(() => undefined);
  }, []);
  async function importFile(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; data?: unknown } | unknown;
      const candidate = typeof parsed === "object" && parsed && "data" in parsed ? (parsed as { data: unknown }).data : parsed;
      if (!isWorkspaceData(candidate)) throw new Error("invalid");
      if (!window.confirm("Mevcut çalışma alanı bu yedekle değiştirilecek. Devam edilsin mi?")) return;
      onImport(candidate);
    } catch {
      window.alert("Bu dosya geçerli bir Akış çalışma alanı yedeği değil.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <main className="shell-page settings-page">
      <header className="page-header"><div><span className="eyebrow">TERCİHLER</span><h1>Ayarlar</h1><p>Çalışma alanınızı size ait hissettiren ayrıntılar.</p></div></header>
      <section className="settings-section workspace-settings-section">
        <div className="settings-heading"><h2>Çalışma alanları</h2><p>Kişisel ve iş içeriklerinizi birbirinden tamamen ayrı tutun.</p></div>
        <div className="settings-panel">
          <div className="members-header"><span>{activeWorkspaceCount} aktif · {workspaces.filter((workspace) => workspace.archived).length} arşivde</span><button className="secondary-button" onClick={onNewWorkspace}><Plus size={16} /> Yeni çalışma alanı</button></div>
          <div className="workspace-management-list">
            {workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspaceId;
              const taskCount = workspace.data.boards.reduce((sum, board) => sum + Object.keys(board.tasks).length, 0);
              return (
                <div key={workspace.id} className={`${workspace.archived ? "archived" : ""} ${isActive ? "current" : ""}`}>
                  <i style={{ background: workspace.color }} />
                  <span><strong>{workspace.name}</strong><small>{workspace.archived ? "Arşivlendi" : isActive ? "Şu anda açık" : `${workspace.data.projects.length} proje · ${taskCount} görev`}</small></span>
                  <div className="workspace-row-actions">
                    {workspace.archived ? (
                      <><button className="text-button" onClick={() => onRestoreWorkspace(workspace.id)}><RotateCcw size={14} /> Geri getir</button><button className="danger-ghost" onClick={() => onDeleteWorkspace(workspace.id)}><Trash2 size={14} /> Kalıcı sil</button></>
                    ) : (
                      <>{!isActive && <button className="text-button" onClick={() => onSwitchWorkspace(workspace.id)}>Aç</button>}<button className="text-button" onClick={() => onEditWorkspace(workspace.id)}><Pencil size={14} /> Adlandır</button><button className="danger-ghost" disabled={activeWorkspaceCount <= 1} onClick={() => onArchiveWorkspace(workspace.id)}><Archive size={14} /> Arşivle</button></>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="settings-section"><div className="settings-heading"><h2>Çalışma alanı</h2><p>Profiliniz selamlamada ve avatarınızda; çalışma alanı adı ise tüm projelerinizin üzerinde görünür.</p></div><div className="settings-panel identity-settings"><label className="field-label">Profil adı<div className="inline-save"><input value={profileNameDraft} onChange={(event) => setProfileNameDraft(event.target.value)} placeholder="Örn. Hamit Parlak" /><button className="secondary-button" disabled={!profileNameDraft.trim() || profileNameDraft.trim() === currentProfileName} onClick={() => onProfileName(profileNameDraft.trim())}><Check size={15} /> Kaydet</button></div><small className="field-help">Yalnız bu cihazdaki kişisel selamlama için kullanılır.</small></label><label className="field-label">Çalışma alanı adı<div className="inline-save"><input value={name} onChange={(event) => setName(event.target.value)} /><button className="secondary-button" disabled={!name.trim() || name === data.workspaceName} onClick={() => onWorkspaceName(name.trim())}><Check size={15} /> Kaydet</button></div></label></div></section>
      <section className="settings-section"><div className="settings-heading"><h2>Tema</h2><p>Odak biçiminize uygun görünümü seçin.</p></div><div className="theme-grid">{themes.map((theme) => { const Icon = theme.icon; return <button key={theme.id} className={`theme-card ${theme.id} ${data.theme === theme.id ? "selected" : ""}`} aria-pressed={data.theme === theme.id} onClick={() => onTheme(theme.id)}><div className="theme-preview"><i /><i /><i /></div><span><Icon size={17} /><span><strong>{theme.name}</strong><small>{theme.description}</small></span>{data.theme === theme.id && <Check size={17} />}</span></button>; })}</div></section>
      <section className="settings-section"><div className="settings-heading"><h2>Kişiler</h2><p>Görev atamak için yerel kişi dizininiz.</p></div><div className="settings-panel"><div className="members-header"><span>{data.members.filter((member) => member.active).length} aktif kişi</span><button className="secondary-button" onClick={onNewMember}><UserPlus size={16} /> Kişi ekle</button></div><div className="settings-members">{data.members.map((member) => <div key={member.id} className={!member.active ? "inactive" : ""}><span className="member-avatar" style={{ background: member.color }}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.active ? "Aktif" : "Pasif · geçmiş atamalar korunur"}</small></span><div className="member-actions"><button className="text-button" onClick={() => onToggleMember(member.id)}>{member.active ? "Pasifleştir" : "Etkinleştir"}</button><button className="danger-ghost" onClick={() => onDeleteMember(member.id)} aria-label={`${member.name} kişisini sil`}><Trash2 size={15} /> Sil</button></div></div>)}</div></div></section>
      {desktopInfo ? (
        <section className="settings-section">
          <div className="settings-heading"><h2>Otomatik kayıt</h2><p>Hiçbir işlem yapmanız gerekmez. Akış bütün değişiklikleri dosyaya ve yedeklere kendisi yazar.</p></div>
          <div className="backup-panel automatic">
            <div><HardDrive size={20} /><span><strong>Save klasörüne otomatik kaydediliyor</strong><small className="save-path">{desktopInfo.dataFile}</small></span><span className="status-chip success"><Check size={14} /> Aktif</span></div>
            <div><ShieldCheck size={20} /><span><strong>Otomatik güvenlik kopyaları</strong><small>Her saat değişiklik varsa yeni bir kopya oluşturulur; son 60 sağlam yedek korunur.</small></span><button className="secondary-button" onClick={() => openDesktopSaveFolder()}><FolderOpen size={16} /> Save klasörünü aç</button></div>
          </div>
        </section>
      ) : (
        <section className="settings-section"><div className="settings-heading"><h2>Yedekleme</h2><p>Tarayıcı sürümünde taşınabilir bir dosya alabilirsiniz.</p></div><div className="backup-panel"><div><Download size={20} /><span><strong>Çalışma alanını dışa aktar</strong><small>Tüm proje, görev, kişi ve zihin haritası verilerini taşınabilir JSON dosyasına kaydeder.</small></span><button className="secondary-button" onClick={onExport}><Download size={16} /> Yedek indir</button></div><div><Upload size={20} /><span><strong>Yedekten geri yükle</strong><small>Daha önce alınan bir Akış yedeğini bu cihazda açar.</small></span><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => importFile(event.target.files?.[0])} /><button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={16} /> Dosya seç</button></div></div></section>
      )}
    </main>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="empty-state" role="status" aria-label={title}>
      <span aria-hidden="true"><Sparkles size={18} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && onAction && <button className="secondary-button" onClick={onAction}>{actionLabel}</button>}
    </section>
  );
}

function exportWorkspace(data: AppData) {
  const payload = { format: "akis-workspace-backup", formatVersion: 1, exportedAt: now(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `akis-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function ProjectModal({ project, onClose, onSave }: { project?: Project; onClose: () => void; onSave: (draft: ProjectDraft) => void }) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [clientName, setClientName] = useState(project?.clientName ?? "");
  const [amount, setAmount] = useState(
    project?.finance
      ? (project.finance.agreedAmountKurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "",
  );
  const [color, setColor] = useState(project?.color ?? projectColors[0]);
  const parsedAmount = amount.trim() ? parseTryToKurus(amount) : undefined;
  const collected = project ? getProjectFinanceTotals(project).collectedKurus : 0;
  const amountError = amount.trim() && parsedAmount === null
    ? "Geçerli bir tutar yazın. Örnek: 12.500,50"
    : parsedAmount !== undefined && parsedAmount !== null && parsedAmount < collected
      ? `Anlaşılan tutar, tahsil edilmiş ${formatTryKurus(collected, true)} tutarından düşük olamaz.`
      : !amount.trim() && collected > 0
        ? "Tahsilat geçmişi olan projede anlaşılan tutar boş bırakılamaz."
        : "";
  const valid = Boolean(name.trim()) && !amountError;

  return (
    <BaseModal
      title={project ? "Proje bilgilerini düzenle" : "Yeni proje"}
      subtitle="Hedefi, müşteriyi ve finansal çerçeveyi tek yerde tanımlayın. Finans alanları isteğe bağlıdır."
      onClose={onClose}
    >
      <div className="field-grid">
        <label className="field-label">Proje adı<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Örn. Yeni ürün lansmanı" /></label>
        <label className="field-label">Müşteri / kurum<input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="İsteğe bağlı" /></label>
      </div>
      <label className="field-label">Kısa açıklama<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Bu projede neyi başarmak istiyorsunuz?" /></label>
      <label className="field-label">Müşteriyle anlaşılan tutar (₺)<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Örn. 125.000,00" />{amountError ? <span className="field-error">{amountError}</span> : <span className="field-help">Kişisel veya ücretsiz projelerde boş bırakabilirsiniz.</span>}</label>
      <div className="field-label">Proje rengi<div className="color-picker-row">{projectColors.map((value) => <button key={value} className={color === value ? "selected" : ""} style={{ background: value }} onClick={() => setColor(value)} aria-label={`${value} proje rengini seç`} aria-pressed={color === value} />)}</div></div>
      <div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!valid} onClick={() => onSave({ name: name.trim(), description: description.trim() || "Yeni çalışma alanı", color, clientName: clientName.trim() || undefined, agreedAmountKurus: parsedAmount || undefined })}>{project ? "Değişiklikleri kaydet" : "Projeyi oluştur"}</button></div>
    </BaseModal>
  );
}

function PaymentModal({ project, payment, onClose, onSave }: { project: Project; payment?: ProjectPayment; onClose: () => void; onSave: (draft: PaymentDraft) => void }) {
  const totals = getProjectFinanceTotals(project);
  const editableMaximum = totals.receivableKurus + (payment?.amountKurus ?? 0);
  const suggested = payment?.amountKurus ?? editableMaximum;
  const [amount, setAmount] = useState(
    (suggested / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
  const localToday = (() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  })();
  const [receivedOn, setReceivedOn] = useState(payment?.receivedOn ?? localToday);
  const [note, setNote] = useState(payment?.note ?? "");
  const parsedAmount = parseTryToKurus(amount);
  const amountError = parsedAmount === null
    ? "Geçerli ve sıfırdan büyük bir tutar yazın."
    : parsedAmount > editableMaximum
      ? `Bu kayıt en fazla kalan ${formatTryKurus(editableMaximum, true)} olabilir.`
      : "";

  return (
    <BaseModal title={payment ? "Tahsilatı düzenle" : "Tahsilat ekle"} subtitle={`${project.name} · Kalan alacak ${formatTryKurus(totals.receivableKurus, true)}`} onClose={onClose}>
      <label className="field-label">Tahsil edilen tutar (₺)<input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />{amountError && <span className="field-error">{amountError}</span>}</label>
      <label className="field-label">Tahsilat tarihi<input type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} /></label>
      <label className="field-label">Not<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Örn. İlk taksit, havale" /></label>
      <div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={Boolean(amountError) || !receivedOn || parsedAmount === null} onClick={() => parsedAmount && onSave({ amountKurus: parsedAmount, receivedOn, note: note.trim() || undefined })}>{payment ? "Tahsilatı güncelle" : "Tahsilatı kaydet"}</button></div>
    </BaseModal>
  );
}

function ItemModal({ kind, projects, initialProjectId, onClose, onNewProject, onSave }: { kind: ItemKind; projects: Project[]; initialProjectId?: string; onClose: () => void; onNewProject: () => void; onSave: (kind: ItemKind, projectId: string, title: string) => void }) {
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const Icon = kind === "board" ? LayoutDashboard : MapIcon;
  const titleText = kind === "board" ? "Yeni Kanban panosu" : "Yeni zihin haritası";
  if (projects.length === 0) {
    return (
      <BaseModal title={titleText} subtitle="Her çalışma bir projeye bağlıdır." onClose={onClose}>
        <EmptyState title="Önce bir proje oluşturun" description={kind === "board" ? "Kanban panonuzu düzenli tutmak için önce bağlı olacağı projeyi oluşturun." : "Zihin haritanızı düzenli tutmak için önce bağlı olacağı projeyi oluşturun."} actionLabel="Yeni proje oluştur" onAction={onNewProject} />
      </BaseModal>
    );
  }
  return <BaseModal title={titleText} subtitle={kind === "board" ? "Varsayılan dört sütunla başlayın, sonra dilediğiniz gibi değiştirin." : "Ana fikri merkeze koyun ve dalları büyütün."} onClose={onClose}><div className="modal-illustration"><Icon size={24} /></div><label className="field-label">Ad<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "board" ? "Örn. Ürün Yol Haritası" : "Örn. Strateji Haritası"} /></label><label className="field-label">Proje<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!title.trim() || !projectId} onClick={() => onSave(kind, projectId, title.trim())}>Oluştur</button></div></BaseModal>;
}

function DuplicateModal({ kind, projects, currentProjectId, onClose, onNewProject, onSave }: { kind: ItemKind; projects: Project[]; currentProjectId?: string; onClose: () => void; onNewProject: () => void; onSave: (projectId: string, structureOnly: boolean) => void }) {
  const [projectId, setProjectId] = useState(currentProjectId ?? projects[0]?.id ?? "");
  const [structureOnly, setStructureOnly] = useState(false);
  if (projects.length === 0) {
    return <BaseModal title="Bağımsız bir kopya oluştur" subtitle="Kopyanın yerleştirileceği aktif bir proje bulunamadı." onClose={onClose}><EmptyState title="Önce bir proje oluşturun" description="Kopyayı kullanacağınız projeyi oluşturduktan sonra bu işlemi yeniden deneyebilirsiniz." actionLabel="Yeni proje oluştur" onAction={onNewProject} /></BaseModal>;
  }
  return <BaseModal title="Bağımsız bir kopya oluştur" subtitle="Kaynak çalışma değişmeden yeni bir altlık hazırlayın." onClose={onClose}><label className="field-label">Hedef proje<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><div className="copy-options"><button className={!structureOnly ? "selected" : ""} aria-pressed={!structureOnly} onClick={() => setStructureOnly(false)}><Copy size={18} /><span><strong>Tüm içerikle</strong><small>{kind === "board" ? "Sütunlar, kartlar ve atamalar" : "Tüm fikirler ve bağlantılar"}</small></span>{!structureOnly && <Check size={17} />}</button><button className={structureOnly ? "selected" : ""} aria-pressed={structureOnly} onClick={() => setStructureOnly(true)}><Blocks size={18} /><span><strong>Yalnız yapı</strong><small>{kind === "board" ? "Sütunları boş bir şablon gibi kopyala" : "Yalnız ana fikri kopyala"}</small></span>{structureOnly && <Check size={17} />}</button></div><div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!projectId} onClick={() => onSave(projectId, structureOnly)}>Kopyayı oluştur</button></div></BaseModal>;
}

function MemberModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, color: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(projectColors[2]);
  return <BaseModal title="Çalışma alanına kişi ekle" subtitle="Bu kişi yerel görev atamalarında kullanılacak." onClose={onClose}><label className="field-label">Ad soyad<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Örn. Deniz Yılmaz" /></label><div className="field-label">Avatar rengi<div className="color-picker-row">{projectColors.map((value) => <button key={value} className={color === value ? "selected" : ""} style={{ background: value }} onClick={() => setColor(value)} aria-label={`${value} avatar rengini seç`} aria-pressed={color === value} />)}</div></div><div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!name.trim()} onClick={() => onSave(name.trim(), color)}>Kişiyi ekle</button></div></BaseModal>;
}

function WorkspaceModal({
  workspace,
  existingNames,
  onClose,
  onSave,
}: {
  workspace?: LocalWorkspace;
  existingNames: string[];
  onClose: () => void;
  onSave: (name: string, color: string) => void;
}) {
  const [name, setName] = useState(workspace?.name ?? "");
  const [color, setColor] = useState(workspace?.color ?? projectColors[0]);
  const normalized = name.trim().toLocaleLowerCase("tr-TR");
  const duplicate = existingNames.some((existing) => existing !== workspace?.name && existing.toLocaleLowerCase("tr-TR") === normalized);
  const valid = Boolean(normalized) && !duplicate;
  return (
    <BaseModal
      title={workspace ? "Çalışma alanını yeniden adlandır" : "Yeni çalışma alanı"}
      subtitle={workspace ? "Yeni ad yalnızca bu çalışma alanını etkiler." : "Projeleri, finansı, kişileri ve aramaları tamamen ayrı yeni bir alan oluşturun."}
      onClose={onClose}
    >
      <label className="field-label">Çalışma alanı adı<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Örn. Şirket Projeleri" />{duplicate && <span className="field-error">Bu adla bir çalışma alanı zaten var.</span>}</label>
      <div className="field-label">Alan rengi<div className="color-picker-row">{projectColors.map((value) => <button key={value} className={color === value ? "selected" : ""} style={{ background: value }} onClick={() => setColor(value)} aria-label={`${value} çalışma alanı rengini seç`} aria-pressed={color === value} />)}</div></div>
      <div className="workspace-privacy-note"><ShieldCheck size={18} /><span><strong>Tamamen yerel ve ayrı</strong><small>Bu alanda yalnızca burada oluşturduğunuz proje, finans, kişi ve çalışmalar görünür.</small></span></div>
      <div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!valid} onClick={() => onSave(name.trim(), color)}>{workspace ? "Adı kaydet" : "Çalışma alanını oluştur"}</button></div>
    </BaseModal>
  );
}

function BaseModal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  const modalRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href]',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);
  return <div className="modal-scrim" onMouseDown={onClose}><section ref={modalRef} className="modal-card" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><X size={18} /></button></header><div className="modal-content">{children}</div></section></div>;
}
