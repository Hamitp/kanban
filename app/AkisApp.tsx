"use client";

import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Blocks,
  Check,
  CheckCircle2,
  CalendarDays,
  ChevronDown,
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
  ListChecks,
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
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BoardView } from "./components/BoardView";
import { InsightsScreen } from "./components/InsightsScreen";
import { MindMapView } from "./components/MindMapView";
import { BurnupChart } from "./components/BurnupChart";
import { CalendarScreen } from "./components/CalendarScreen";
import { IssueDetailScreen, ProblemsScreen } from "./components/ProblemSolvingScreen";
import {
  currencyCodes,
  formatMoney,
  getPortfolioFinance,
  getPortfolioCurrencies,
  getProjectFinanceTotals,
  getProjectStatus,
  parseMoneyToMinor,
  transitionProjectStatus,
} from "./projectFinance";
import { currencyName, I18nProvider, languageName, useI18n } from "./i18n";
import { createBoard, createMindMap, createSeedData, newId } from "./seed";
import { countMemberAssignments, removeMemberFromWorkspace } from "./memberManagement";
import {
  archiveWorkspace,
  createBlankWorkspace,
  createFreshWorkspaceStore,
  deleteArchivedWorkspace,
  getActiveWorkspace,
  renameWorkspace,
  restoreWorkspace,
  switchWorkspace,
  updateActiveWorkspaceData,
  setWorkspacePreferences,
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
import {
  appendTaskTransition,
  createProblemIssue,
} from "./v4Workflows";
import type { DesktopSaveInfo } from "./desktop";
import type {
  AppData,
  CalendarEvent,
  CurrencyCode,
  ItemKind,
  LinkedTaskReference,
  KanbanBoard,
  MindMap,
  MindNode,
  Project,
  ProjectPayment,
  ProjectStatus,
  ProblemIssue,
  Screen,
  TaskCard,
  ThemeId,
  LocalWorkspace,
  Language,
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
  currency: CurrencyCode;
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
  const language: Language = workspaceStore?.preferences.language ?? "tr";

  useLayoutEffect(() => {
    latestDataRef.current = workspaceStore;
  }, [workspaceStore]);

  useEffect(() => {
    loadWorkspace()
      .then(async (stored) => {
        // Mark hydration before publishing the loaded store so legacy-to-v2
        // normalization is persisted immediately, even without a user action.
        hydrated.current = true;
        setWorkspaceStore(stored ?? createFreshWorkspaceStore());
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
    document.documentElement.lang = language;
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
  }, [workspaceStore, data, language]);

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
    setToast({ message: language === "tr" ? "Son işlem geri alındı" : "Last action undone" });
    setHistoryVersion((value) => value + 1);
  }

  function redo() {
    if (!data || futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-39), data];
    setWorkspaceStore((current) => current ? updateActiveWorkspaceData(current, () => next, now()) : current);
    setToast({ message: language === "tr" ? "İşlem yeniden uygulandı" : "Action redone" });
    setHistoryVersion((value) => value + 1);
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function chooseLanguage(nextLanguage: Language) {
    const stamp = now();
    setWorkspaceStore((current) => {
      if (!current) return current;
      let next = setWorkspacePreferences(current, { language: nextLanguage, freshInstallation: false }, stamp);
      if (current.preferences.freshInstallation) {
        const seeded = createSeedData(nextLanguage);
        next = {
          ...next,
          workspaces: next.workspaces.map((workspace) => workspace.id === next.activeWorkspaceId
            ? {
                ...workspace,
                name: seeded.workspaceName,
                updatedAt: stamp,
                data: { ...seeded, workspaceName: seeded.workspaceName, updatedAt: stamp },
              }
            : workspace),
        };
      }
      return next;
    });
  }

  if (fatalLoadError) {
    return (
      <div className="recovery-screen">
        <div className="recovery-card">
          <span className="recovery-icon"><ShieldCheck size={26} /></span>
          <span className="eyebrow">VERİLERİNİZ KORUNDU · YOUR DATA IS SAFE</span>
          <h1>Çalışma alanı açılamadı · Workspace could not be opened</h1>
          <p>Akış sorunlu dosyanın üzerine yazmadı. Flow did not overwrite the problematic file; your Save folder remains unchanged.</p>
          <button className="primary-button large" onClick={() => openDesktopSaveFolder()}><FolderOpen size={17} /> Save klasörünü aç · Open Save folder</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app-loading">
        <div className="brand-mark"><Blocks size={22} /></div>
        <div><strong>Akış hazırlanıyor · Getting Flow ready</strong><span>Çalışma alanınız yerelden açılıyor · Opening your local workspace...</span></div>
      </div>
    );
  }

  if (!workspaceStore?.preferences.language) {
    return <LanguageOnboarding onChoose={chooseLanguage} />;
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
    showToast(language === "tr" ? `${target.name} çalışma alanına geçildi` : `Switched to ${target.name} workspace`);
  }

  function saveWorkspaceItem(name: string, color: string, workspaceId?: string) {
    if (!workspaceStore || !data) return;
    const cleanName = name.trim();
    const normalizedName = cleanName.toLocaleLowerCase("tr-TR");
    const duplicate = workspaceStore.workspaces.some((workspace) =>
      workspace.id !== workspaceId && workspace.name.toLocaleLowerCase("tr-TR") === normalizedName,
    );
    if (!cleanName || duplicate) {
      if (duplicate) window.alert(language === "tr" ? "Bu adla bir çalışma alanı zaten var." : "A workspace with this name already exists.");
      return;
    }
    const stamp = now();
    if (workspaceId) {
      setWorkspaceStore((current) => current ? renameWorkspace(current, workspaceId, cleanName, stamp, color) : current);
      setModal(null);
      showToast(language === "tr" ? "Çalışma alanı adı güncellendi" : "Workspace name updated");
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
    showToast(language === "tr" ? `${cleanName} çalışma alanı oluşturuldu` : `${cleanName} workspace created`);
  }

  function archiveWorkspaceItem(workspaceId: string) {
    if (!workspaceStore) return;
    const workspace = workspaceStore.workspaces.find((item) => item.id === workspaceId && !item.archived);
    const activeCount = workspaceStore.workspaces.filter((item) => !item.archived).length;
    if (!workspace || activeCount <= 1) return;
    if (!window.confirm(language === "tr" ? `${workspace.name} çalışma alanı arşivlensin mi? İçerikleri korunacak ve daha sonra geri getirilebilecek.` : `Archive the ${workspace.name} workspace? Its contents will be preserved and can be restored later.`)) return;
    const switching = workspaceStore.activeWorkspaceId === workspaceId;
    setWorkspaceStore((current) => current ? archiveWorkspace(current, workspaceId, now()) : current);
    if (switching) clearWorkspaceContext();
    showToast(language === "tr" ? `${workspace.name} arşivlendi` : `${workspace.name} archived`);
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
    const summary = language === "tr" ? `${workspace.data.projects.length} proje, ${workspace.data.boards.length} Kanban panosu ve ${workspace.data.mindMaps.length} zihin haritası` : `${workspace.data.projects.length} projects, ${workspace.data.boards.length} Kanban boards and ${workspace.data.mindMaps.length} mind maps`;
    if (!window.confirm(language === "tr" ? `${workspace.name} kalıcı olarak silinsin mi?\n\n${summary} silinecek. Bu işlem geri alınamaz.` : `Permanently delete ${workspace.name}?\n\n${summary} will be deleted. This cannot be undone.`)) return;
    setWorkspaceStore((current) => current ? deleteArchivedWorkspace(current, workspaceId, now()) : current);
    showToast(language === "tr" ? `${workspace.name} kalıcı olarak silindi` : `${workspace.name} permanently deleted`);
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
              ? { currency: payments.length ? project.finance?.currency ?? draft.currency : draft.currency, agreedAmountKurus: draft.agreedAmountKurus, payments }
              : payments.length
                ? project.finance
                : undefined,
            updatedAt: now(),
          };
        }),
      }));
      setModal(null);
      showToast(language === "tr" ? "Proje bilgileri güncellendi" : "Project details updated", true);
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
        ? { currency: draft.currency, agreedAmountKurus: draft.agreedAmountKurus, payments: [] }
        : undefined,
      archived: false,
      createdAt: now(),
      updatedAt: now(),
    };
    commit((current) => ({ ...current, projects: [...current.projects, project] }));
    setModal(null);
    navigate({ kind: "project", id: project.id });
    showToast(language === "tr" ? "Yeni proje hazır" : "New project ready");
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
    showToast(paymentId ? language === "tr" ? "Tahsilat güncellendi" : "Payment updated" : language === "tr" ? "Tahsilat kaydedildi" : "Payment recorded", true);
  }

  function createItem(kind: ItemKind, projectId: string, title: string) {
    if (kind === "board") {
      const board = createBoard(projectId, title, language);
      commit((current) => ({ ...current, boards: [...current.boards, board] }));
      setModal(null);
      navigate({ kind: "board", id: board.id });
    } else {
      const map = createMindMap(projectId, title, language);
      commit((current) => ({ ...current, mindMaps: [...current.mindMaps, map] }));
      setModal(null);
      navigate({ kind: "mindmap", id: map.id });
    }
    showToast(kind === "board" ? language === "tr" ? "Yeni Kanban panosu hazır" : "New Kanban board ready" : language === "tr" ? "Yeni zihin haritası hazır" : "New mind map ready");
  }

  function archiveItem(kind: ItemKind, id: string) {
    commit((current) =>
      kind === "board"
        ? { ...current, boards: current.boards.map((item) => (item.id === id ? { ...item, archived: true } : item)) }
        : { ...current, mindMaps: current.mindMaps.map((item) => (item.id === id ? { ...item, archived: true } : item)) },
    );
    navigate({ kind: "home" });
    showToast(language === "tr" ? "Çalışma arşivlendi" : "Work archived", true);
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
    showToast(language === "tr" ? "Bağımsız bir kopya oluşturuldu" : "Independent copy created");
  }

  function addGlobalLabel(name: string, color: string) {
    const id = newId();
    commit((current) => ({ ...current, labels: [...current.labels, { id, name, color }] }));
    return id;
  }

  const shellScreen = !(currentBoard || currentMap);

  return (
    <I18nProvider language={language}>
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
          issues={data.issues}
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
                          ? appendTaskTransition(
                              transitionTaskTiming(task, existingColumn.role, role, changedAt),
                              { fromColumnId: existingColumn.id, toColumnId: existingColumn.id, fromRole: existingColumn.role, toRole: role, occurredAt: changedAt },
                              newId(),
                            )
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
            onSaveTask={(columnId, task, isNew) => {
              const savedAt = now();
              commit((current) => ({
                ...current,
                boards: current.boards.map((board) => {
                  if (board.id !== currentBoard.id) return board;
                  const column = board.columns.find((item) => item.id === columnId);
                  const savedTask = isNew && column
                    ? appendTaskTransition(
                        { ...task, effortPoints: task.effortPoints ?? 1 },
                        { toColumnId: column.id, toRole: column.role, occurredAt: savedAt },
                        newId(),
                      )
                    : { ...task, effortPoints: task.effortPoints ?? 1 };
                  return {
                    ...board,
                    tasks: { ...board.tasks, [task.id]: savedTask },
                    columns: isNew
                      ? board.columns.map((item) =>
                          item.id === columnId ? { ...item, taskIds: [...item.taskIds, task.id] } : item,
                        )
                      : board.columns,
                    updatedAt: savedAt,
                  };
                }),
              }));
            }}
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
                mindMaps: current.mindMaps.map((map) => ({ ...map, nodes: map.nodes.map((node) => node.linkedTask?.boardId === currentBoard.id && node.linkedTask.taskId === taskId ? { ...node, linkedTask: undefined, linkedTaskId: undefined } : node) })),
                issues: current.issues.map((issue) => ({
                  ...issue,
                  boardId: issue.boardId === currentBoard.id && issue.taskId === taskId ? undefined : issue.boardId,
                  taskId: issue.boardId === currentBoard.id && issue.taskId === taskId ? undefined : issue.taskId,
                  actions: issue.actions.map((action) => action.linkedTask?.boardId === currentBoard.id && action.linkedTask.taskId === taskId ? { ...action, linkedTask: undefined } : action),
                })),
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
                    const timedTask = transitionTaskTiming(
                      board.tasks[taskId],
                      sourceColumn.role,
                      targetColumn.role,
                      movedAt,
                    );
                    tasks = {
                      ...tasks,
                      [taskId]: appendTaskTransition(
                        timedTask,
                        {
                          fromColumnId: sourceColumn.id,
                          toColumnId: targetColumn.id,
                          fromRole: sourceColumn.role,
                          toRole: targetColumn.role,
                          occurredAt: movedAt,
                        },
                        newId(),
                      ),
                    };
                  }
                  return { ...board, columns, tasks, updatedAt: now() };
                }),
              }))
            }
            onAddLabel={addGlobalLabel}
            onOpenTaskSource={(task) => {
              const source = task.sourceLinks?.[0];
              if (!source) return;
              if (source.kind === "mindnode" && source.containerId) navigate({ kind: "mindmap", id: source.containerId });
              else if ((source.kind === "issue" || source.kind === "corrective-action") && source.containerId) navigate({ kind: "issue", id: source.containerId });
            }}
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
            boards={data.boards.filter((board) => board.projectId === currentMap.projectId && !board.archived)}
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
              showToast(language === "tr" ? "Harita otomatik düzenlendi" : "Map arranged automatically", true);
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
            onCreateTaskFromNode={(nodeId, boardId, columnId) => {
              const node = currentMap.nodes.find((item) => item.id === nodeId);
              const board = data.boards.find((item) => item.id === boardId && item.projectId === currentMap.projectId);
              const column = board?.columns.find((item) => item.id === columnId);
              if (!node || node.linkedTask || !board || !column) return;
              const createdAt = now();
              const taskId = newId();
              const link: LinkedTaskReference = { boardId, taskId, createdAt };
              const task = appendTaskTransition({
                id: taskId,
                title: node.title,
                description: node.note,
                priority: "medium",
                effortPoints: 1,
                labelIds: [],
                assigneeIds: [],
                sourceLinks: [{ kind: "mindnode", sourceId: node.id, containerId: currentMap.id, createdAt }],
                createdAt,
                updatedAt: createdAt,
              }, { toColumnId: column.id, toRole: column.role, occurredAt: createdAt }, newId());
              commit((current) => ({
                ...current,
                boards: current.boards.map((item) => item.id === boardId ? {
                  ...item,
                  tasks: { ...item.tasks, [taskId]: task },
                  columns: item.columns.map((entry) => entry.id === columnId ? { ...entry, taskIds: [...entry.taskIds, taskId] } : entry),
                  updatedAt: createdAt,
                } : item),
                mindMaps: current.mindMaps.map((map) => map.id === currentMap.id ? {
                  ...map,
                  nodes: map.nodes.map((entry) => entry.id === nodeId ? { ...entry, linkedTask: link, linkedTaskId: taskId } : entry),
                  updatedAt: createdAt,
                } : map),
              }));
              showToast(language === "tr" ? "Fikir Kanban görevine dönüştürüldü" : "Idea converted to a Kanban task", true);
            }}
            onOpenLinkedTask={(boardId) => navigate({ kind: "board", id: boardId })}
          />
        )}

        {shellScreen && (
          <ShellContent
            screen={screen}
            data={data}
            workspaces={workspaceStore!.workspaces}
            activeWorkspaceId={workspaceStore!.activeWorkspaceId}
            language={language}
            defaultCurrency={workspaceStore!.preferences.defaultCurrency}
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
              showToast(language === "tr" ? "Proje arşivlendi" : "Project archived", true);
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
                    ? language === "tr" ? "Proje tamamlandı olarak işaretlendi" : "Project marked complete"
                    : language === "tr" ? "Müşteriye teslim kaydedildi" : "Client delivery recorded",
                true,
              );
            }}
            onAddPayment={(projectId) => setModal({ type: "payment", projectId })}
            onEditPayment={(projectId, paymentId) => setModal({ type: "payment", projectId, paymentId })}
            onDeletePayment={(projectId, paymentId) => {
              const project = data.projects.find((item) => item.id === projectId);
              const payment = project?.finance?.payments.find((item) => item.id === paymentId);
              if (!payment || !project?.finance) return;
              const paymentAmount = formatMoney(payment.amountKurus, project.finance.currency, language, true);
              if (!window.confirm(language === "tr" ? `${paymentAmount} tutarındaki tahsilat kaydı silinsin mi?` : `Delete the ${paymentAmount} payment record?`)) return;
              commit((current) => ({
                ...current,
                projects: current.projects.map((item) =>
                  item.id === projectId && item.finance
                    ? { ...item, finance: { ...item.finance, payments: item.finance.payments.filter((entry) => entry.id !== paymentId) }, updatedAt: now() }
                    : item,
                ),
              }));
              showToast(language === "tr" ? "Tahsilat kaydı silindi" : "Payment record deleted", true);
            }}
            onRestore={(kind, id) => {
              commit((current) => {
                if (kind === "project") return { ...current, projects: current.projects.map((item) => (item.id === id ? { ...item, archived: false } : item)) };
                if (kind === "board") return { ...current, boards: current.boards.map((item) => (item.id === id ? { ...item, archived: false } : item)) };
                return { ...current, mindMaps: current.mindMaps.map((item) => (item.id === id ? { ...item, archived: false } : item)) };
              });
              showToast(language === "tr" ? "Çalışma geri getirildi" : "Work restored", true);
            }}
            onDelete={(kind, id) => {
              const message = kind === "project"
                ? (() => {
                    const project = data.projects.find((item) => item.id === id);
                    const boards = data.boards.filter((item) => item.projectId === id);
                    const maps = data.mindMaps.filter((item) => item.projectId === id);
                    const tasks = boards.reduce((sum, board) => sum + Object.keys(board.tasks).length, 0);
                    const payments = project?.finance?.payments.length ?? 0;
                    const issues = data.issues.filter((item) => item.projectId === id).length;
                    const calendarLinks = data.calendarEvents.filter((item) => item.projectId === id).length;
                    return `“${project?.name ?? "Proje"}” ile birlikte ${boards.length} Kanban panosu, ${maps.length} zihin haritası, ${tasks} görev, ${issues} sorun analizi ve ${payments} tahsilat kaydı kalıcı olarak silinecek. ${calendarLinks} takvim kaydının proje bağlantısı kaldırılacak. Bu işlem geri alınamaz. Devam edilsin mi?`;
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
                    issues: current.issues.filter((item) => item.projectId !== id),
                    calendarEvents: current.calendarEvents.map((item) => item.projectId === id ? { ...item, projectId: undefined } : item),
                  };
                }
                if (kind === "board") return {
                  ...current,
                  boards: current.boards.filter((item) => item.id !== id),
                  mindMaps: current.mindMaps.map((map) => ({ ...map, nodes: map.nodes.map((node) => node.linkedTask?.boardId === id ? { ...node, linkedTask: undefined, linkedTaskId: undefined } : node) })),
                  issues: current.issues.map((issue) => ({ ...issue, boardId: issue.boardId === id ? undefined : issue.boardId, taskId: issue.boardId === id ? undefined : issue.taskId, actions: issue.actions.map((action) => action.linkedTask?.boardId === id ? { ...action, linkedTask: undefined } : action) })),
                };
                return { ...current, mindMaps: current.mindMaps.filter((item) => item.id !== id) };
              }, false);
              showToast(language === "tr" ? "Kalıcı olarak silindi" : "Permanently deleted");
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
                effortPoints: 1,
                labelIds: [],
                assigneeIds: [],
                createdAt: now(),
                updatedAt: now(),
              };
              const capturedTask = appendTaskTransition(task, { toColumnId: column.id, toRole: column.role, occurredAt: task.createdAt }, newId());
              commit((current) => ({
                ...current,
                boards: current.boards.map((item) =>
                  item.id === boardId
                    ? {
                        ...item,
                        tasks: { ...item.tasks, [task.id]: capturedTask },
                        columns: item.columns.map((entry) =>
                          entry.id === column.id ? { ...entry, taskIds: [task.id, ...entry.taskIds] } : entry,
                        ),
                      }
                    : item,
                ),
              }));
              showToast(language === "tr" ? "Görev, toplam görev listesine eklendi" : "Task added to the total task list");
            }}
            onSaveCalendarEvent={(event) => commit((current) => ({
              ...current,
              calendarEvents: current.calendarEvents.some((item) => item.id === event.id)
                ? current.calendarEvents.map((item) => item.id === event.id ? { ...event, updatedAt: now() } : item)
                : [...current.calendarEvents, { ...event, createdAt: event.createdAt || now(), updatedAt: now() }],
            }))}
            onDeleteCalendarEvent={(eventId) => {
              if (!window.confirm(language === "tr" ? "Bu takvim kaydı silinsin mi?" : "Delete this calendar entry?")) return;
              commit((current) => ({ ...current, calendarEvents: current.calendarEvents.filter((item) => item.id !== eventId) }));
            }}
            onCreateIssue={(projectId, title) => {
              const issue = createProblemIssue(newId(), projectId, title, now());
              commit((current) => ({ ...current, issues: [...current.issues, issue] }));
              navigate({ kind: "issue", id: issue.id });
            }}
            onSaveIssue={(issue) => {
              if (issue.status === "closed" && issue.verificationEffective !== true) {
                showToast(language === "tr" ? "Sorun kapanmadan önce çözümün etkisi doğrulanmalı" : "Verify the solution before closing the problem");
                return;
              }
              commit((current) => ({
                ...current,
                issues: current.issues.map((item) => item.id === issue.id ? { ...issue, updatedAt: now() } : item),
              }));
              showToast(language === "tr" ? "Sorun analizi kaydedildi" : "Problem analysis saved", true);
            }}
            onDeleteIssue={(issueId) => {
              commit((current) => ({ ...current, issues: current.issues.filter((item) => item.id !== issueId) }));
              navigate({ kind: "issues" });
              showToast(language === "tr" ? "Sorun kaydı silindi" : "Problem record deleted", true);
            }}
            onCreateCorrectiveTask={(issueDraft, actionId, boardId, columnId) => {
              const action = issueDraft.actions.find((item) => item.id === actionId);
              const board = data.boards.find((item) => item.id === boardId && item.projectId === issueDraft.projectId);
              const column = board?.columns.find((item) => item.id === columnId);
              if (!action || action.linkedTask || !board || !column) return undefined;
              const createdAt = now();
              const taskId = newId();
              const link: LinkedTaskReference = { boardId, taskId, createdAt };
              const task = appendTaskTransition({
                id: taskId,
                title: action.title,
                description: action.description,
                priority: issueDraft.severity === "critical" ? "critical" : issueDraft.severity === "high" ? "high" : "medium",
                effortPoints: action.effortPoints,
                labelIds: [],
                assigneeIds: action.assigneeIds,
                dueDate: action.dueDate,
                sourceLinks: [{ kind: "corrective-action", sourceId: action.id, containerId: issueDraft.id, createdAt }],
                createdAt,
                updatedAt: createdAt,
              }, { toColumnId: column.id, toRole: column.role, occurredAt: createdAt }, newId());
              commit((current) => ({
                ...current,
                boards: current.boards.map((item) => item.id === boardId ? {
                  ...item,
                  tasks: { ...item.tasks, [taskId]: task },
                  columns: item.columns.map((entry) => entry.id === columnId ? { ...entry, taskIds: [...entry.taskIds, taskId] } : entry),
                  updatedAt: createdAt,
                } : item),
                issues: current.issues.map((item) => item.id === issueDraft.id ? {
                  ...issueDraft,
                  actions: issueDraft.actions.map((entry) => entry.id === actionId ? { ...entry, linkedTask: link, updatedAt: createdAt } : entry),
                  updatedAt: createdAt,
                } : item),
              }));
              showToast(language === "tr" ? "Düzeltici aksiyon Kanban görevine bağlandı" : "Corrective action linked to a Kanban task", true);
              return link;
            }}
            onTheme={(theme) => commit((current) => ({ ...current, theme }), false)}
            onLanguage={(nextLanguage) => setWorkspaceStore((current) => current ? setWorkspacePreferences(current, { language: nextLanguage }, now()) : current)}
            onDefaultCurrency={(currency) => setWorkspaceStore((current) => current ? setWorkspacePreferences(current, { defaultCurrency: currency }, now()) : current)}
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
              showToast(language === "tr" ? "Yedek başarıyla geri yüklendi" : "Backup restored successfully", true);
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
          defaultCurrency={workspaceStore!.preferences.defaultCurrency}
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
            showToast(language === "tr" ? "Kişi çalışma alanına eklendi" : "Person added to workspace");
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
          {toast.undo && <button onClick={undo}>{language === "tr" ? "Geri al" : "Undo"}</button>}
          <button className="toast-close" onClick={() => setToast(null)} aria-label={language === "tr" ? "Bildirimi kapat" : "Dismiss notification"}><X size={15} /></button>
        </div>
      )}
    </div>
    </I18nProvider>
  );
}

function LanguageOnboarding({ onChoose }: { onChoose: (language: Language) => void }) {
  return (
    <main className="language-onboarding">
      <section className="language-card" aria-labelledby="language-title">
        <div className="brand-mark"><Blocks size={24} /></div>
        <span className="eyebrow">AKIŞ · FLOW</span>
        <h1 id="language-title">Dilinizi seçin · Choose your language</h1>
        <p>Bu seçimi daha sonra Ayarlar’dan değiştirebilirsiniz.<br />You can change this later in Settings.</p>
        <div className="language-options">
          <button onClick={() => onChoose("tr")}><span>TR</span><strong>Türkçe</strong><small>Uygulamayı Türkçe kullan</small><ChevronRight size={18} /></button>
          <button onClick={() => onChoose("en")}><span>EN</span><strong>English</strong><small>Use the application in English</small><ChevronRight size={18} /></button>
        </div>
        <div className="language-local-note"><ShieldCheck size={17} /><span>Verileriniz bu cihazda kalır · Your data stays on this device</span></div>
      </section>
    </main>
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
  const { t, language } = useI18n();
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const visibleWorkspaces = workspaces.filter((workspace) => !workspace.archived);
  const nav = [
    { kind: "home" as const, label: t("Genel Bakış"), icon: Home },
    { kind: "projects" as const, label: t("Projeler"), icon: FolderKanban },
    { kind: "boards" as const, label: t("Kanban Panoları"), icon: LayoutDashboard },
    { kind: "mindmaps" as const, label: t("Zihin Haritaları"), icon: MapIcon },
    { kind: "calendar" as const, label: language === "tr" ? "Takvim" : "Calendar", icon: CalendarDays },
    { kind: "issues" as const, label: language === "tr" ? "Sorun Çözme" : "Problem Solving", icon: Wrench },
    { kind: "insights" as const, label: t("İçgörüler"), icon: BarChart3 },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <button className="brand-button" onClick={() => onNavigate({ kind: "home" })} aria-label={t("Genel Bakışa git")}>
          <span className="brand-mark"><Blocks size={20} /></span>
          {open && <span><strong>Akış</strong><small>{t("Yerel çalışma alanı")}</small></span>}
        </button>
        <button className="icon-button sidebar-toggle" onClick={onToggle} aria-label={t(open ? "Menüyü daralt" : "Menüyü genişlet")}>
          {open ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        </button>
      </div>
      <div className={`workspace-switcher ${workspaceMenu ? "open" : ""}`}>
        <button
          className="workspace-switcher-button"
          onClick={() => { if (!open) { onToggle(); setWorkspaceMenu(true); } else setWorkspaceMenu((value) => !value); }}
          aria-label={t("Çalışma alanını değiştir")}
          aria-expanded={workspaceMenu}
          title={!open ? activeWorkspace?.name : undefined}
        >
          <i style={{ background: activeWorkspace?.color }} />
          {open && <span><small>{t("ÇALIŞMA ALANI")}</small><strong>{activeWorkspace?.name}</strong></span>}
          {open && <ChevronsUpDown size={15} />}
        </button>
        {workspaceMenu && (
          <div className="workspace-switcher-menu" role="menu">
            <header>{t("Çalışma alanları")}</header>
            {visibleWorkspaces.map((workspace) => (
              <button key={workspace.id} role="menuitem" className={workspace.id === activeWorkspaceId ? "active" : ""} onClick={() => { setWorkspaceMenu(false); onSwitchWorkspace(workspace.id); }}>
                <i style={{ background: workspace.color }} />
                <span>{workspace.name}</span>
                {workspace.id === activeWorkspaceId && <Check size={15} />}
              </button>
            ))}
            <button role="menuitem" className="new-workspace" onClick={() => { setWorkspaceMenu(false); onNewWorkspace(); }}><Plus size={15} /> {t("Yeni çalışma alanı")}</button>
          </div>
        )}
      </div>
      <nav className="main-nav" aria-label={t("Ana menü")}>
        {nav.map((item) => {
          const Icon = item.icon;
          const active = screen.kind === item.kind
            || (item.kind === "projects" && screen.kind === "project")
            || (item.kind === "boards" && screen.kind === "board")
            || (item.kind === "mindmaps" && screen.kind === "mindmap")
            || (item.kind === "issues" && screen.kind === "issue");
          return (
            <button key={item.kind} className={active ? "active" : ""} aria-label={item.label} aria-current={active ? "page" : undefined} onClick={() => onNavigate({ kind: item.kind })} title={!open ? item.label : undefined}>
              <Icon size={18} /> {open && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
      {open && (
        <div className="sidebar-projects">
          <header><span>{language === "tr" ? "PROJELER" : "PROJECTS"}</span><button onClick={onNewProject} aria-label={t("Yeni proje")}><Plus size={15} /></button></header>
          {projects.slice(0, 6).map((project) => (
            <button
              key={project.id}
              className={screen.kind === "project" && screen.id === project.id ? "active" : ""}
              aria-label={language === "tr" ? `${project.name} projesini aç` : `Open ${project.name} project`}
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
        <button className={screen.kind === "archive" ? "active" : ""} aria-label={t("Arşiv")} aria-current={screen.kind === "archive" ? "page" : undefined} onClick={() => onNavigate({ kind: "archive" })} title={!open ? t("Arşiv") : undefined}>
          <Archive size={18} /> {open && <span>{t("Arşiv")}</span>}
        </button>
        <button className={screen.kind === "settings" ? "active" : ""} aria-label={t("Ayarlar")} aria-current={screen.kind === "settings" ? "page" : undefined} onClick={() => onNavigate({ kind: "settings" })} title={!open ? t("Ayarlar") : undefined}>
          <Settings2 size={18} /> {open && <span>{t("Ayarlar")}</span>}
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
  issues,
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
  issues: ProblemIssue[];
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
  const { t, language, locale } = useI18n();
  const normalized = query.trim().toLocaleLowerCase(locale);
  const visibleProjects = projects.filter((project) => !project.archived);
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));
  const visibleBoards = boards.filter((board) => !board.archived && visibleProjectIds.has(board.projectId));
  const visibleMindMaps = mindMaps.filter((map) => !map.archived && visibleProjectIds.has(map.projectId));
  const visibleIssues = issues.filter((issue) => visibleProjectIds.has(issue.projectId));
  const results = normalized
    ? [
        ...visibleProjects.filter((item) => `${item.name} ${item.clientName ?? ""}`.toLocaleLowerCase(locale).includes(normalized)).map((item) => ({ key: `p-${item.id}`, title: item.name, meta: t("Proje"), screen: { kind: "project", id: item.id } as Screen, icon: FolderKanban })),
        ...visibleBoards.filter((item) => `${item.title} ${item.description}`.toLocaleLowerCase("tr").includes(normalized)).map((item) => ({ key: `b-${item.id}`, title: item.title, meta: "Kanban panosu", screen: { kind: "board", id: item.id } as Screen, icon: LayoutDashboard })),
        ...visibleMindMaps.filter((item) => `${item.title} ${item.description}`.toLocaleLowerCase(locale).includes(normalized)).map((item) => ({ key: `m-${item.id}`, title: item.title, meta: t("Zihin haritası"), screen: { kind: "mindmap", id: item.id } as Screen, icon: MapIcon })),
        ...visibleIssues.filter((item) => `${item.title} ${item.description} ${item.rootCause}`.toLocaleLowerCase(locale).includes(normalized)).map((item) => ({ key: `i-${item.id}`, title: item.title, meta: language === "tr" ? "Sorun analizi" : "Problem analysis", screen: { kind: "issue", id: item.id } as Screen, icon: Wrench })),
        ...visibleMindMaps.flatMap((map) =>
          map.nodes
            .filter((node) => `${node.title} ${node.note}`.toLocaleLowerCase("tr").includes(normalized))
            .map((node) => ({ key: `n-${node.id}`, title: node.title, meta: `${map.title} · Fikir`, screen: { kind: "mindmap", id: map.id } as Screen, icon: MapIcon })),
        ),
        ...visibleBoards.flatMap((board) =>
          Object.values(board.tasks)
            .filter((task) => `${task.title} ${task.description}`.toLocaleLowerCase("tr").includes(normalized))
            .map((task) => ({ key: `t-${task.id}`, title: task.title, meta: `${board.title} · ${t("Görev")}`, screen: { kind: "board", id: board.id } as Screen, icon: ListTodo })),
        ),
      ].slice(0, 8)
    : [];

  const crumb = (() => {
    if (screen.kind === "project") return projects.find((item) => item.id === screen.id)?.name;
    if (screen.kind === "board") return boards.find((item) => item.id === screen.id)?.title;
    if (screen.kind === "mindmap") return mindMaps.find((item) => item.id === screen.id)?.title;
    if (screen.kind === "issue") return issues.find((item) => item.id === screen.id)?.title;
    const names: Record<string, string> = { home: t("Genel Bakış"), projects: t("Projeler"), boards: t("Kanban Panoları"), mindmaps: t("Zihin Haritaları"), calendar: language === "tr" ? "Takvim" : "Calendar", issues: language === "tr" ? "Sorun Çözme" : "Problem Solving", issue: language === "tr" ? "Sorun Analizi" : "Problem Analysis", insights: t("İçgörüler"), archive: t("Arşiv"), settings: t("Ayarlar") };
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
            placeholder={language === "tr" ? "Her yerde ara..." : "Search everywhere..."}
            role="combobox"
            aria-autocomplete="list"
            aria-label={t("Çalışma alanında ara")}
            aria-expanded={searchOpen}
            aria-controls="global-search-results"
          />
          <kbd>Ctrl K</kbd>
        </label>
        {searchOpen && (
          <div id="global-search-results" className="search-popover" role="dialog" aria-label={t("Arama sonuçları")}>
            <header><span>{normalized ? language === "tr" ? `“${query}” için sonuçlar` : `Results for “${query}”` : t("Proje, görev veya fikir arayın")}</span><button onClick={() => onSearchOpen(false)} aria-label={t("Aramayı kapat")}><X size={15} /></button></header>
            {results.map((result) => {
              const Icon = result.icon;
              return <button key={result.key} onClick={() => { onNavigate(result.screen); onSearchOpen(false); }}><Icon size={17} /><span><strong>{result.title}</strong><small>{result.meta}</small></span><ArrowRight size={15} /></button>;
            })}
            {normalized && results.length === 0 && <div className="empty-search">{t("Eşleşen sonuç bulunamadı.")}</div>}
          </div>
        )}
      </div>
      <div className="topbar-actions">
        <div className={`save-indicator ${saveState}`} role={saveState === "error" ? "alert" : "status"} aria-live="polite">
          <i /> {saveState === "saving" ? t("Kaydediliyor") : saveState === "error" ? t("Kaydedilemedi · yeniden deneniyor") : `${t(isDesktopRuntime() ? "Save klasörüne kaydedildi" : "Yerelde kayıtlı")}${savedAt ? ` · ${savedAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}` : ""}`}
          {saveState === "error" && isDesktopRuntime() && <button className="save-error-action" onClick={() => openDesktopSaveFolder()}>{t("Save klasörü")}</button>}
        </div>
        <button className="icon-button" onClick={onUndo} disabled={!canUndo} aria-label={t("Geri al")}><Undo2 size={17} /></button>
        <button className="icon-button" onClick={onRedo} disabled={!canRedo} aria-label={t("Yinele")}><Redo2 size={17} /></button>
        <span className="user-avatar" role="img" aria-label={profileName ? language === "tr" ? `${profileName} profili` : `${profileName} profile` : t("Akış profili")} title={profileName || "Akış"}>{getProfileInitials(profileName)}</span>
      </div>
    </header>
  );
}

function ShellContent({
  screen,
  data,
  workspaces,
  activeWorkspaceId,
  language,
  defaultCurrency,
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
  onSaveCalendarEvent,
  onDeleteCalendarEvent,
  onCreateIssue,
  onSaveIssue,
  onDeleteIssue,
  onCreateCorrectiveTask,
  onTheme,
  onLanguage,
  onDefaultCurrency,
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
  language: Language;
  defaultCurrency: CurrencyCode;
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
  onSaveCalendarEvent: (event: CalendarEvent) => void;
  onDeleteCalendarEvent: (id: string) => void;
  onCreateIssue: (projectId: string, title: string) => void;
  onSaveIssue: (issue: ProblemIssue) => void;
  onDeleteIssue: (id: string) => void;
  onCreateCorrectiveTask: (issue: ProblemIssue, actionId: string, boardId: string, columnId: string) => LinkedTaskReference | undefined;
  onTheme: (theme: ThemeId) => void;
  onLanguage: (language: Language) => void;
  onDefaultCurrency: (currency: CurrencyCode) => void;
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
  const { t } = useI18n();
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
  if (screen.kind === "calendar") {
    return <CalendarScreen data={data} onSave={onSaveCalendarEvent} onDelete={onDeleteCalendarEvent} onNewId={newId} />;
  }
  if (screen.kind === "issues") {
    return <ProblemsScreen data={data} onNavigate={onNavigate} onCreate={onCreateIssue} />;
  }
  if (screen.kind === "issue") {
    const issue = data.issues.find((item) => item.id === screen.id);
    if (!issue) return <main className="shell-page missing-item-page"><EmptyState title={language === "tr" ? "Sorun kaydı bulunamadı" : "Problem record not found"} description={language === "tr" ? "Kayıt silinmiş veya artık erişilemiyor olabilir." : "The record may have been deleted or is no longer available."} actionLabel={language === "tr" ? "Sorunlara dön" : "Back to problems"} onAction={() => onNavigate({ kind: "issues" })} /></main>;
    return <IssueDetailScreen issue={issue} data={data} onBack={() => onNavigate({ kind: "issues" })} onSave={onSaveIssue} onDelete={() => onDeleteIssue(issue.id)} onCreateTask={onCreateCorrectiveTask} onOpenTask={(boardId) => onNavigate({ kind: "board", id: boardId })} onNewId={newId} />;
  }
  if (screen.kind === "project") {
    const project = data.projects.find((item) => item.id === screen.id);
    if (!project) return <main className="shell-page missing-item-page"><EmptyState title={t("Proje bulunamadı")} description={t("Bu proje kaldırılmış veya arşivlenmiş olabilir.")} actionLabel={t("Projelere dön")} onAction={() => onNavigate({ kind: "projects" })} /></main>;
    return (
      <ProjectScreen
        data={data}
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
        onBack={() => onNavigate({ kind: "projects" })}
      />
    );
  }
  if (screen.kind === "projects") {
    const projects = data.projects.filter((project) => !project.archived);
    return (
      <LibraryScreen
        title={t("Projeler")}
        description={t("Bütün çalışma alanlarınız tek bakışta.")}
        actionLabel={t("Yeni proje")}
        onAction={() => onModal({ type: "project" })}
      >
        <div className="project-grid">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} data={data} onOpen={() => onNavigate({ kind: "project", id: project.id })} />
          ))}
          {projects.length === 0 && <EmptyState title={t("Henüz proje yok")} description={t("İlk projenizi oluşturduğunuzda Kanban panolarınızı ve zihin haritalarınızı burada düzenleyebilirsiniz.")} />}
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
          title={t(isBoard ? "Kanban panosu bulunamadı" : "Zihin haritası bulunamadı")}
          description={t("Bu çalışma silinmiş, arşivlenmiş veya artık erişilemeyen bir bağlantıdan açılmış olabilir.")}
          actionLabel={t(isBoard ? "Kanban panolarına dön" : "Zihin haritalarına dön")}
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
        title={t(isBoard ? "Kanban Panoları" : "Zihin Haritaları")}
        description={t(isBoard ? "Önceliklerinizi akışa dönüştüren çalışma yüzeyleri." : "Düşünceleriniz arasındaki bağları görünür kılın.")}
        actionLabel={t(isBoard ? "Yeni Kanban panosu" : "Yeni zihin haritası")}
        onAction={() => onModal({ type: "item", kind: isBoard ? "board" : "mindmap" })}
      >
        <GroupedAssetLibrary
          items={items}
          projects={data.projects.filter((project) => !project.archived)}
          onNavigate={onNavigate}
          onDuplicate={(item) => onModal({ type: "duplicate", kind: item.kind, id: item.id })}
          onArchive={(item) => onArchiveItem(item.kind, item.id)}
          emptyTitle={t(isBoard ? "Henüz Kanban panosu yok" : "Henüz zihin haritası yok")}
          emptyDescription={t(isBoard ? "Bir proje oluşturup ilk görev akışınızı kurabilirsiniz." : "Bir proje oluşturup düşüncelerinizi dallandırmaya başlayabilirsiniz.")}
        />
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
        language={language}
        defaultCurrency={defaultCurrency}
        onTheme={onTheme}
        onLanguage={onLanguage}
        onDefaultCurrency={onDefaultCurrency}
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
  const { t, language, locale } = useI18n();
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
  const totalPrioritized = projectStats.reduce((sum, item) => sum + item.stats.planned, 0);
  const totalRemaining = totalPrioritized + activeTasks.length;
  const totalCommitted = projectStats.reduce((sum, item) => sum + item.stats.committed, 0);
  const averageProgress = totalCommitted ? Math.round((totalDone / totalCommitted) * 100) : 0;
  const cycleSamples = activeBoards.flatMap((board) => Object.values(board.tasks).filter((task) => task.completedAt && task.workSessions?.length));
  const averageCycle = cycleSamples.length
    ? Math.max(1, Math.round(cycleSamples.reduce((sum, task) => sum + getTaskWorkMs(task), 0) / cycleSamples.length / 86_400_000))
    : 0;
  const quickBoards = activeBoards;
  const quickBoard = quickBoards.find((board) => board.id === quickBoardId) ?? quickBoards[0];
  const finance = getPortfolioFinance(data.projects);
  const financeValues = (metric: "activeWorkKurus" | "receivableKurus" | "collectedKurus") =>
    getPortfolioCurrencies(finance, metric).map((currency) => ({ currency, value: formatMoney(finance[currency][metric], currency, language) }));
  const hour = new Date().getHours();
  const greeting = language === "tr"
    ? hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar"
    : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const profileName = resolveProfileName(data);
  const greetingName = profileName.split(/\s+/).filter(Boolean)[0];

  return (
    <main className="shell-page home-page">
      <section className="home-hero">
        <div>
          <span className="eyebrow">{new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span>
          <h1>{greetingName ? `${greeting}, ${greetingName}.` : `${greeting}.`}</h1>
          <p>{language === "tr" ? "Zihniniz açık, görevleriniz görünür. Bugün en anlamlı adıma odaklanın." : "Your mind is clear and your tasks are visible. Focus on today's most meaningful step."}</p>
        </div>
        <button className="primary-button large" onClick={onNewProject}><Plus size={18} /> {t("Yeni proje")}</button>
      </section>

      <section className="metric-grid" aria-label={language === "tr" ? "Çalışma alanı özeti" : "Workspace summary"}>
        <MetricCard icon={FolderKanban} tone="violet" label={language === "tr" ? "Aktif proje" : "Active projects"} value={workInProgressProjects.length} note={`${activeBoards.length} ${language === "tr" ? "Kanban panosu" : activeBoards.length === 1 ? "Kanban board" : "Kanban boards"}`} />
        <MetricCard icon={ListChecks} tone="blue" label={language === "tr" ? "Önceliklendirilmiş" : "Prioritized"} value={totalPrioritized} note={language === "tr" ? `Aktiflerle birlikte ${totalRemaining} iş kaldı` : `${totalRemaining} tasks remaining with active work`} />
        <MetricCard icon={ListTodo} tone="blue" label={language === "tr" ? "Üzerinde çalışılan" : "In progress"} value={activeTasks.length} note={`${waitingTasks.length} ${language === "tr" ? "görev beklemede" : waitingTasks.length === 1 ? "task waiting" : "tasks waiting"}`} />
        <MetricCard icon={CheckCircle2} tone="green" label={language === "tr" ? "Tamamlanan" : "Completed"} value={totalDone} note={language === "tr" ? `Genel ilerleme %${averageProgress}` : `Overall progress ${averageProgress}%`} />
        <MetricCard icon={RotateCcw} tone="amber" label={language === "tr" ? "Ortalama çevrim" : "Average cycle"} value={averageCycle ? `${averageCycle} ${language === "tr" ? "gün" : "days"}` : "—"} note={language === "tr" ? `${cycleSamples.length} tamamlanan görevden` : `From ${cycleSamples.length} completed tasks`} />
      </section>

      <section className="finance-overview" aria-label={language === "tr" ? "Finansal görünüm" : "Financial overview"}>
        <header className="section-header compact">
          <div><span className="eyebrow">{language === "tr" ? "PARA AKIŞI" : "CASH FLOW"}</span><h2>{language === "tr" ? "Cebinize giren ve girecek tutarlar" : "Money collected and expected"}</h2></div>
          <button className="text-button" onClick={() => onNavigate({ kind: "insights" })}>{language === "tr" ? "Analizi gör" : "View analysis"} <ArrowRight size={15} /></button>
        </header>
        <div className="finance-metric-grid">
          <FinanceMetricCard tone="violet" label={language === "tr" ? "Aktif proje değeri" : "Active project value"} values={financeValues("activeWorkKurus")} note={language === "tr" ? "Üzerinde çalışılan projelerin anlaşma toplamı" : "Total agreed value of projects in progress"} />
          <FinanceMetricCard tone="amber" label={language === "tr" ? "Bekleyen alacak" : "Outstanding receivable"} values={financeValues("receivableKurus")} note={language === "tr" ? "Tam tahsil edilen projeler hariç · arşiv dahil" : "Excludes fully paid projects · includes archive"} />
          <FinanceMetricCard tone="green" label={language === "tr" ? "Tahsil edilen" : "Collected"} values={financeValues("collectedKurus")} note={language === "tr" ? "Kayıtlı tüm ödemelerin toplamı" : "Total of all recorded payments"} />
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-card project-health-card">
          <header className="section-header compact">
            <div><span className="eyebrow">{language === "tr" ? "PORTFÖY SAĞLIĞI" : "PORTFOLIO HEALTH"}</span><h2>{language === "tr" ? "Projelerinizin ilerlemesi" : "Your project progress"}</h2></div>
            <button className="text-button" onClick={() => onNavigate({ kind: "projects" })}>{language === "tr" ? "Tümünü gör" : "View all"} <ArrowRight size={15} /></button>
          </header>
          <div className="project-health-list">
            {projectStats.map(({ project, stats }) => (
              <button key={project.id} className="project-health-row" onClick={() => onNavigate({ kind: "project", id: project.id })}>
                <div className="progress-ring small" style={{ "--progress": `${stats.progress * 3.6}deg`, "--project-color": project.color } as React.CSSProperties}>
                  <span>{stats.progress}%</span>
                </div>
                <div className="health-main">
                    <div className="health-title"><i style={{ background: project.color }} /><strong>{project.name}</strong><span>{stats.boards} {language === "tr" ? "pano" : stats.boards === 1 ? "board" : "boards"}</span></div>
                    <div className="segmented-progress" role="progressbar" aria-label={language === "tr" ? `${project.name} ilerlemesi` : `${project.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.progress}>
                    <i className="planned" style={{ flex: stats.planned || 0.001 }} />
                    <i className="active" style={{ flex: stats.active || 0.001 }} />
                    <i className="done" style={{ flex: stats.done || 0.001 }} />
                  </div>
                  <div className="health-legend">
                      <span><i className="planned" /> {language === "tr" ? "Öncelikli" : "Prioritized"} <strong>{stats.planned}</strong></span>
                      <span><i className="active" /> {language === "tr" ? "Aktif" : "Active"} <strong>{stats.active}</strong></span>
                      <span><i className="done" /> {language === "tr" ? "Tamamlanan" : "Completed"} <strong>{stats.done}</strong></span>
                      {stats.waiting > 0 && <span className="warning"><CircleAlert size={12} /> {stats.waiting} {language === "tr" ? "bekliyor" : "waiting"}</span>}
                  </div>
                </div>
                  <div className="cycle-mini"><span>{language === "tr" ? "Ort. süre" : "Avg. time"}</span><strong>{stats.averageDays ? `${stats.averageDays} ${language === "tr" ? "gün" : "days"}` : "—"}</strong></div>
                <ChevronRight size={17} />
              </button>
            ))}
            {projectStats.length === 0 && <EmptyState title={language === "tr" ? "Henüz aktif proje yok" : "No active projects yet"} description={language === "tr" ? "Yeni bir proje oluşturarak çalışma alanınızı başlatın." : "Create a new project to get started."} />}
          </div>
        </div>

        <aside className="dashboard-card quick-capture-card">
          <div className="capture-icon"><Sparkles size={19} /></div>
          <span className="eyebrow">{language === "tr" ? "HIZLI YAKALA" : "QUICK CAPTURE"}</span>
          <h2>{language === "tr" ? "Aklınızdakini bırakın" : "Capture what's on your mind"}</h2>
          <p>{language === "tr" ? "Düşünceyi kaybetmeden seçtiğiniz panonun toplam görev listesine ekleyin." : "Add it to the selected board's total task list before you lose the thought."}</p>
          <textarea value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder={language === "tr" ? "Yeni bir görev veya fikir..." : "A new task or idea..."} rows={4} aria-label={language === "tr" ? "Hızlı eklenecek görev" : "Task to quick capture"} />
          {quickBoards.length > 1 && (
            <label className="quick-board-select">
              {language === "tr" ? "Hedef pano" : "Target board"}
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
            <Plus size={17} /> {language === "tr" ? "Toplam görev listesine ekle" : "Add to total task list"}
          </button>
          <small>{quickBoard ? `${quickBoard.title} · ${language === "tr" ? "atanmamış görev" : "unassigned task"}` : language === "tr" ? "Önce aktif bir projede Kanban panosu oluşturun" : "Create a Kanban board in an active project first"}</small>
        </aside>
      </section>

      <section className="dashboard-grid lower">
        <div className="dashboard-card focus-card">
          <header className="section-header compact"><div><span className="eyebrow">{language === "tr" ? "ŞİMDİ" : "NOW"}</span><h2>{language === "tr" ? "Üzerinde çalıştığınız görevler" : "Tasks you're working on"}</h2></div><span className="count-badge">{activeTasks.length}</span></header>
          <div className="focus-list">
            {activeTasks.slice(0, 5).map(({ task, board }) => {
              const elapsed = getTaskWorkMs(task);
              const days = Math.floor(elapsed / 86_400_000);
              return (
                <button key={task.id} onClick={() => onNavigate({ kind: "board", id: board.id })}>
                  <span className="pulse-dot" />
                  <span className="focus-copy"><strong>{task.title}</strong><small>{board.title}</small></span>
                  <span className={`age-badge ${days >= 5 ? "old" : days >= 2 ? "aging" : ""}`}>
                      {elapsed < 86_400_000 ? language === "tr" ? "Bugün başladı" : "Started today" : language === "tr" ? `Aktif süre: ${formatTaskWorkDuration(elapsed, language)}` : `Active time: ${formatTaskWorkDuration(elapsed, language)}`}
                  </span>
                  <ChevronRight size={15} />
                </button>
              );
            })}
              {activeTasks.length === 0 && <EmptyState title={language === "tr" ? "Aktif görev yok" : "No active tasks"} description={language === "tr" ? "Bir kartı ‘Üzerinde Çalışılanlar’ sütununa taşıdığınızda burada görünür." : "Move a card to an In Progress column and it will appear here."} />}
          </div>
        </div>
        <div className="dashboard-card waiting-card">
          <header className="section-header compact"><div><span className="eyebrow">{language === "tr" ? "DIŞ BAĞIMLILIKLAR" : "EXTERNAL DEPENDENCIES"}</span><h2>{language === "tr" ? "Bekleyen ve engellenenler" : "Waiting and blocked"}</h2></div><CircleAlert size={19} /></header>
          <div className="waiting-list">
            {waitingTasks.slice(0, 5).map(({ task, board }) => (
              <button key={task.id} onClick={() => onNavigate({ kind: "board", id: board.id })}>
                <span className="warning-icon"><CircleAlert size={15} /></span>
                <span><strong>{task.title}</strong><small>{task.waitingReason}</small></span>
                <ChevronRight size={15} />
              </button>
            ))}
              {waitingTasks.length === 0 && <EmptyState title={language === "tr" ? "Bekleyen görev yok" : "No waiting tasks"} description={language === "tr" ? "Akışınızı durduran dış bağımlılık görünmüyor." : "No external dependency is blocking your flow."} />}
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ icon: Icon, tone, label, value, note }: { icon: typeof Home; tone: string; label: string; value: number | string; note: string }) {
  return <article className={`metric-card ${tone}`}><div className="metric-icon"><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function FinanceMetricCard({ tone, label, values, note }: { tone: string; label: string; values: Array<{ currency: CurrencyCode; value: string }>; note: string }) {
  return (
    <article className={`finance-metric ${tone}`}>
      <span className="finance-metric-icon"><BadgeDollarSign size={20} /></span>
      <div><small>{label}</small><div className="money-value-list">{values.map((entry) => <strong key={entry.currency}>{entry.value}<em>{entry.currency}</em></strong>)}</div><p>{note}</p></div>
    </article>
  );
}

function ProjectScreen({
  data,
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
  onBack,
}: {
  data: AppData;
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
  onBack: () => void;
}) {
  const { t, language, locale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const status = getProjectStatus(project);
  const finance = getProjectFinanceTotals(project);
  const statusLabels: Record<ProjectStatus, string> = {
    active: language === "tr" ? "Aktif" : "Active",
    completed: language === "tr" ? "Proje tamamlandı" : "Project completed",
    delivered: language === "tr" ? "Müşteriye teslim edildi" : "Delivered to client",
  };
  const paymentLabel = finance.paymentState === "paid"
    ? language === "tr" ? "Ödeme alındı" : "Paid"
    : finance.paymentState === "overpaid"
      ? language === "tr" ? "Fazla tahsilat" : "Overpaid"
      : finance.paymentState === "partial"
        ? language === "tr" ? "Kısmi tahsilat" : "Partially paid"
        : finance.paymentState === "unpaid"
          ? language === "tr" ? "Tahsilat bekliyor" : "Payment pending"
          : language === "tr" ? "Tutar girilmedi" : "No amount entered";
  const sortedPayments = [...(project.finance?.payments ?? [])].sort((a, b) =>
    b.receivedOn.localeCompare(a.receivedOn),
  );
  const projectIssues = data.issues.filter((issue) => issue.projectId === project.id);
  return (
    <main className="shell-page project-page">
      <button className="project-back-button" onClick={onBack}><ArrowLeft size={16} /> {language === "tr" ? "Projelere dön" : "Back to projects"}</button>
      <section className="project-hero" style={{ "--project-color": project.color } as React.CSSProperties}>
        <div className="project-symbol"><FolderKanban size={25} /></div>
        <div className="project-hero-copy">
          <div className="project-badges"><span className={`project-status-badge ${status}`}>{statusLabels[status]}</span><span className={`payment-badge ${finance.paymentState}`}>{paymentLabel}</span></div>
          <h1>{project.name}</h1>
          <p>{project.clientName ? `${project.clientName} · ${project.description}` : project.description}</p>
        </div>
        <div className="spacer" />
        <button className="secondary-button" onClick={onEditProject}><Pencil size={16} /> {language === "tr" ? "Düzenle" : "Edit"}</button>
        <button className="secondary-button" onClick={() => onNew("mindmap")}><MapIcon size={16} /> {language === "tr" ? "Zihin haritası" : "Mind map"}</button>
        <button className="primary-button" onClick={() => onNew("board")}><Plus size={17} /> {language === "tr" ? "Kanban panosu" : "Kanban board"}</button>
        <div className="relative-menu"><button className="icon-button" onClick={() => setMenuOpen((value) => !value)} aria-label={language === "tr" ? "Proje menüsü" : "Project menu"} aria-haspopup="menu" aria-expanded={menuOpen}><MoreHorizontal size={18} /></button>{menuOpen && <div className="context-menu" role="menu"><button role="menuitem" onClick={onArchiveProject}><Archive size={15} /> {language === "tr" ? "Projeyi arşivle" : "Archive project"}</button></div>}</div>
      </section>
      <section className="project-summary-strip">
        <span><LayoutDashboard size={16} /><strong>{boards.length}</strong> {language === "tr" ? "Kanban panosu" : "Kanban boards"}</span>
        <span><MapIcon size={16} /><strong>{mindMaps.length}</strong> {language === "tr" ? "zihin haritası" : "mind maps"}</span>
        <span><ListTodo size={16} /><strong>{boards.reduce((sum, board) => sum + Object.keys(board.tasks).length, 0)}</strong> {language === "tr" ? "toplam görev" : "total tasks"}</span>
        <button onClick={() => onNavigate({ kind: "issues" })}><CircleAlert size={16} /><strong>{projectIssues.filter((issue) => issue.status !== "closed").length}</strong> {language === "tr" ? "açık sorun" : "open problems"}</button>
      </section>

      <BurnupChart data={data} project={project} />

      <section className="project-overview-grid">
        <article className="project-command-card lifecycle-card">
          <header><div><span className="eyebrow">{language === "tr" ? "PROJE AŞAMASI" : "PROJECT STAGE"}</span><h2>{language === "tr" ? "Proje hangi aşamada?" : "What stage is the project in?"}</h2></div><CheckCircle2 size={20} /></header>
          <div className="lifecycle-steps" role="group" aria-label={language === "tr" ? "Proje aşaması" : "Project stage"}>
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
            {status === "active" && (language === "tr" ? "Çalışma devam ediyor; aktif proje değeri hesabına dahildir." : "Work is in progress and included in active project value.")}
            {status === "completed" && (language === "tr" ? "Üretim tamamlandı; müşteri teslimi bekleniyor." : "Production is complete; client delivery is pending.")}
            {status === "delivered" && (language === "tr" ? "Teslim kaydedildi; kalan alacak tahsil edilene kadar görünür kalır." : "Delivery is recorded; the receivable remains visible until collected.")}
          </p>
        </article>

        <article className={`project-command-card finance-card ${finance.paymentState}`}>
          <header>
            <div><span className="eyebrow">{language === "tr" ? "FİNANS" : "FINANCE"}</span><h2>{project.clientName || (language === "tr" ? "Proje bütçesi" : "Project budget")}</h2></div>
            <BadgeDollarSign size={20} />
          </header>
          {project.finance ? (
            <>
              <div className="project-money-grid">
                <div><span>{language === "tr" ? "Anlaşılan" : "Agreed"}</span><strong>{formatMoney(finance.agreedKurus, finance.currency, language, true)}</strong></div>
                <div><span>{language === "tr" ? "Tahsil edilen" : "Collected"}</span><strong>{formatMoney(finance.collectedKurus, finance.currency, language, true)}</strong></div>
                <div className="receivable"><span>{t("Kalan alacak")}</span><strong>{formatMoney(finance.receivableKurus, finance.currency, language, true)}</strong></div>
              </div>
              <div className="collection-progress" role="progressbar" aria-label={language === "tr" ? "Tahsilat oranı" : "Collection rate"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={finance.collectionRate}>
                <i style={{ width: `${finance.collectionRate}%` }} />
              </div>
              <div className="finance-actions-row"><span className={`payment-badge ${finance.paymentState}`}>{paymentLabel} · {finance.collectionRate}%</span><button className="primary-button" onClick={onAddPayment} disabled={finance.receivableKurus === 0}><Plus size={16} /> {language === "tr" ? "Tahsilat ekle" : "Add payment"}</button></div>
              {sortedPayments.length > 0 && (
                <div className="payment-history">
                  <strong>{language === "tr" ? "Tahsilat geçmişi" : "Payment history"}</strong>
                  {sortedPayments.slice(0, 5).map((payment) => (
                    <div key={payment.id}>
                      <span><strong>{formatMoney(payment.amountKurus, finance.currency, language, true)}</strong><small>{new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${payment.receivedOn}T12:00:00`))}{payment.note ? ` · ${payment.note}` : ""}</small></span>
                      <button className="micro-button" onClick={() => onEditPayment(payment.id)} aria-label={language === "tr" ? "Tahsilatı düzenle" : "Edit payment"}><Pencil size={14} /></button>
                      <button className="micro-button danger" onClick={() => onDeletePayment(payment.id)} aria-label={language === "tr" ? "Tahsilatı sil" : "Delete payment"}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="finance-empty"><BadgeDollarSign size={24} /><div><strong>{language === "tr" ? "Henüz tutar girilmedi" : "No amount entered yet"}</strong><span>{language === "tr" ? "Müşteriyle anlaşılan tutarı ekleyerek alacak ve tahsilatı takip edin." : "Add the agreed amount to track receivables and payments."}</span></div><button className="secondary-button" onClick={onEditProject}>{language === "tr" ? "Finans bilgisi ekle" : "Add financial details"}</button></div>
          )}
        </article>
      </section>
      <section className="section-block">
        <header className="section-header"><div><span className="eyebrow">{language === "tr" ? "ÇALIŞMA ALANLARI" : "WORKSPACES"}</span><h2>{language === "tr" ? "Kanban Panoları" : "Kanban Boards"}</h2></div><button className="text-button" onClick={() => onNew("board")}><Plus size={15} /> {language === "tr" ? "Yeni Kanban panosu" : "New Kanban board"}</button></header>
        <div className="asset-grid">
          {boards.map((board) => <AssetCard key={board.id} item={board} project={project} onOpen={() => onNavigate({ kind: "board", id: board.id })} onDuplicate={() => onDuplicate("board", board.id)} onArchive={() => onArchiveItem("board", board.id)} />)}
          {boards.length === 0 && <CreateCard icon={LayoutDashboard} label={language === "tr" ? "İlk Kanban panosunu oluştur" : "Create your first Kanban board"} onClick={() => onNew("board")} />}
        </div>
      </section>
      <section className="section-block">
        <header className="section-header"><div><span className="eyebrow">{language === "tr" ? "DÜŞÜNCE ALANI" : "THINKING SPACE"}</span><h2>{language === "tr" ? "Zihin Haritaları" : "Mind Maps"}</h2></div><button className="text-button" onClick={() => onNew("mindmap")}><Plus size={15} /> {language === "tr" ? "Yeni zihin haritası" : "New mind map"}</button></header>
        <div className="asset-grid">
          {mindMaps.map((map) => <AssetCard key={map.id} item={map} project={project} onOpen={() => onNavigate({ kind: "mindmap", id: map.id })} onDuplicate={() => onDuplicate("mindmap", map.id)} onArchive={() => onArchiveItem("mindmap", map.id)} />)}
          {mindMaps.length === 0 && <CreateCard icon={MapIcon} label={language === "tr" ? "İlk zihin haritasını oluştur" : "Create your first mind map"} onClick={() => onNew("mindmap")} />}
        </div>
      </section>
    </main>
  );
}

function ProjectCard({ project, data, onOpen }: { project: Project; data: AppData; onOpen: () => void }) {
  const { language } = useI18n();
  const stats = getProjectFlowStats(project, data);
  const status = getProjectStatus(project);
  const finance = getProjectFinanceTotals(project);
  const statusLabel = status === "active" ? language === "tr" ? "Aktif" : "Active" : status === "completed" ? language === "tr" ? "Tamamlandı" : "Completed" : language === "tr" ? "Teslim edildi" : "Delivered";
  return (
    <button className="project-card" onClick={onOpen} style={{ "--project-color": project.color } as React.CSSProperties}>
      <div className="project-card-top"><span className="project-symbol small"><FolderKanban size={20} /></span><span className={`project-status-badge ${status}`}>{statusLabel}</span><ArrowRight size={17} /></div>
      <h3>{project.name}</h3><p>{project.description}</p>
      <div className="project-card-progress"><span><strong>{stats.progress}%</strong> {language === "tr" ? "ilerleme" : "progress"}</span><div role="progressbar" aria-label={language === "tr" ? `${project.name} ilerlemesi` : `${project.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.progress}><i style={{ width: `${stats.progress}%` }} /></div></div>
      {project.finance && <div className="project-card-money"><span>{language === "tr" ? "Kalan alacak" : "Outstanding receivable"}</span><strong>{formatMoney(finance.receivableKurus, finance.currency, language)}</strong><small>{finance.paymentState === "paid" ? language === "tr" ? "Ödeme alındı" : "Paid" : language === "tr" ? `%${finance.collectionRate} tahsil edildi` : `${finance.collectionRate}% collected`}</small></div>}
      <footer><span>{stats.planned} {language === "tr" ? "öncelikli" : "prioritized"}</span><span>{stats.active} {language === "tr" ? "aktif" : "active"}</span><span>{stats.done} {language === "tr" ? "tamamlanan" : "completed"}</span></footer>
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
  const { t, language } = useI18n();
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
          <span className="asset-kind"><>{isBoard ? <LayoutDashboard size={13} /> : <MapIcon size={13} />}</>{language === "tr" ? isBoard ? "KANBAN PANOSU" : "ZİHİN HARİTASI" : isBoard ? "KANBAN BOARD" : "MIND MAP"}</span>
        </div>
        <div className="asset-copy"><span className="asset-project"><i style={{ background: project?.color }} />{project?.name ?? t("Proje")}</span><h3>{item.title}</h3><p>{item.description}</p></div>
        <footer>{isBoard ? <><span>{stats?.committed} {language === "tr" ? "planlanan görev" : "planned tasks"}</span><span>{language === "tr" ? `%${stats?.progress} tamamlandı` : `${stats?.progress}% completed`}</span></> : <><span>{item.nodes.length} {language === "tr" ? "fikir" : "ideas"}</span><span>{t("Zihin haritası")}</span></>}<span className="updated">{new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(Math.max(-30, Math.min(0, Math.round((new Date(item.updatedAt).getTime() - referenceTime) / 86_400_000))), "day")}</span></footer>
      </button>
      <div className="asset-menu"><button className="icon-button" onClick={() => setMenu((value) => !value)} aria-label={language === "tr" ? "Çalışma menüsü" : "Item menu"} aria-haspopup="menu" aria-expanded={menu}><MoreHorizontal size={17} /></button>{menu && <div className="context-menu" role="menu"><button role="menuitem" onClick={onDuplicate}><Copy size={15} /> {t("Çoğalt")}</button><button role="menuitem" onClick={onArchive}><Archive size={15} /> {t("Arşivle")}</button></div>}</div>
    </article>
  );
}

function CreateCard({ icon: Icon, label, onClick }: { icon: typeof Home; label: string; onClick: () => void }) {
  const { t } = useI18n();
  return <button className="create-card" onClick={onClick}><span><Icon size={21} /></span><strong>{label}</strong><small>{t("Boş bir çalışma yüzeyiyle başlayın")}</small></button>;
}

function GroupedAssetLibrary({ items, projects, onNavigate, onDuplicate, onArchive, emptyTitle, emptyDescription }: { items: Array<KanbanBoard | MindMap>; projects: Project[]; onNavigate: (screen: Screen) => void; onDuplicate: (item: KanbanBoard | MindMap) => void; onArchive: (item: KanbanBoard | MindMap) => void; emptyTitle: string; emptyDescription: string }) {
  const { language } = useI18n();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = projects.map((project) => ({ project, items: items.filter((item) => item.projectId === project.id) })).filter((group) => group.items.length > 0);
  if (groups.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return <div className="project-asset-groups">{groups.map(({ project, items: projectItems }) => {
    const isCollapsed = collapsed[project.id] === true;
    return <section key={project.id} className="project-asset-group" style={{ "--project-color": project.color } as React.CSSProperties}>
      <header className="project-asset-group-header">
        <button className="group-collapse" onClick={() => setCollapsed((current) => ({ ...current, [project.id]: !isCollapsed }))} aria-expanded={!isCollapsed}><ChevronDown size={18} /><span className="project-group-mark" /><strong>{project.name}</strong><span className="count-badge">{projectItems.length}</span></button>
        <button className="text-button" onClick={() => onNavigate({ kind: "project", id: project.id })}>{language === "tr" ? "Projeyi aç" : "Open project"} <ArrowRight size={15} /></button>
      </header>
      {!isCollapsed && <div className="asset-grid">{projectItems.map((item) => <AssetCard key={item.id} item={item} project={project} onOpen={() => onNavigate({ kind: item.kind, id: item.id })} onDuplicate={() => onDuplicate(item)} onArchive={() => onArchive(item)} />)}</div>}
    </section>;
  })}</div>;
}

function LibraryScreen({ title, description, actionLabel, onAction, children }: { title: string; description: string; actionLabel: string; onAction: () => void; children: React.ReactNode }) {
  const { t } = useI18n();
  return <main className="shell-page library-page"><header className="page-header"><div><span className="eyebrow">{t("ÇALIŞMA ALANI")}</span><h1>{title}</h1><p>{description}</p></div><button className="primary-button large" onClick={onAction}><Plus size={18} /> {actionLabel}</button></header>{children}</main>;
}

function ArchiveScreen({ data, onRestore, onDelete }: { data: AppData; onRestore: (kind: "project" | ItemKind, id: string) => void; onDelete: (kind: "project" | ItemKind, id: string) => void }) {
  const { t } = useI18n();
  const projects = data.projects.filter((item) => item.archived).map((item) => ({ kind: "project" as const, id: item.id, title: item.name, description: item.description, icon: FolderKanban }));
  const boards = data.boards.filter((item) => item.archived).map((item) => ({ kind: "board" as const, id: item.id, title: item.title, description: item.description, icon: LayoutDashboard }));
  const maps = data.mindMaps.filter((item) => item.archived).map((item) => ({ kind: "mindmap" as const, id: item.id, title: item.title, description: item.description, icon: MapIcon }));
  const items = [...projects, ...boards, ...maps];
  return (
    <main className="shell-page archive-page">
      <header className="page-header"><div><span className="eyebrow">{t("GÜVENLİ SAKLAMA")}</span><h1>{t("Arşiv")}</h1><p>{t("Tamamlanan veya şimdilik görünmemesi gereken çalışmalar burada korunur.")}</p></div></header>
      <div className="archive-notice"><Archive size={19} /><div><strong>{t("Arşiv, silmek değildir.")}</strong><span>{t("Her şeyi içeriği ve düzeniyle geri getirebilirsiniz.")}</span></div></div>
      <div className="archive-list">
        {items.map((item) => { const Icon = item.icon; return <article key={`${item.kind}-${item.id}`}><span className="archive-icon"><Icon size={19} /></span><div><strong>{item.title}</strong><p>{item.description}</p><small>{t(item.kind === "project" ? "Proje" : item.kind === "board" ? "Kanban panosu" : "Zihin haritası")}</small></div><button className="secondary-button" onClick={() => onRestore(item.kind, item.id)}><RotateCcw size={15} /> {t("Geri getir")}</button><button className="danger-ghost" onClick={() => onDelete(item.kind, item.id)}><Trash2 size={16} /> {t("Kalıcı sil")}</button></article>; })}
        {items.length === 0 && <EmptyState title={t("Arşiv boş")} description={t("Arşivlediğiniz proje ve çalışmalar burada görünecek.")} />}
      </div>
    </main>
  );
}

function SettingsScreen({
  data,
  workspaces,
  activeWorkspaceId,
  language,
  defaultCurrency,
  onTheme,
  onLanguage,
  onDefaultCurrency,
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
  language: Language;
  defaultCurrency: CurrencyCode;
  onTheme: (theme: ThemeId) => void;
  onLanguage: (language: Language) => void;
  onDefaultCurrency: (currency: CurrencyCode) => void;
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
  const { t } = useI18n();
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
      if (!window.confirm(language === "tr" ? "Mevcut çalışma alanı bu yedekle değiştirilecek. Devam edilsin mi?" : "The current workspace will be replaced with this backup. Continue?")) return;
      onImport(candidate);
    } catch {
      window.alert(language === "tr" ? "Bu dosya geçerli bir Akış çalışma alanı yedeği değil." : "This file is not a valid Flow workspace backup.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <main className="shell-page settings-page">
      <header className="page-header"><div><span className="eyebrow">{t("TERCİHLER")}</span><h1>{t("Ayarlar")}</h1><p>{t("Çalışma alanınızı size ait hissettiren ayrıntılar.")}</p></div></header>
      <section className="settings-section">
        <div className="settings-heading"><h2>{t("Dil ve bölge")}</h2><p>{language === "tr" ? "Arayüz dilini ve yeni projelerde önerilecek para birimini seçin." : "Choose the interface language and the currency suggested for new projects."}</p></div>
        <div className="settings-panel locale-settings">
          <label className="field-label">{t("Uygulama dili")}
            <select value={language} onChange={(event) => onLanguage(event.target.value as Language)}>
              <option value="tr">{languageName("tr", language)}</option>
              <option value="en">{languageName("en", language)}</option>
            </select>
          </label>
          <label className="field-label">{t("Yeni proje varsayılan para birimi")}
            <select value={defaultCurrency} onChange={(event) => onDefaultCurrency(event.target.value as CurrencyCode)}>
              {currencyCodes.map((currency) => <option key={currency} value={currency}>{currencyName(currency, language)} · {currency}</option>)}
            </select>
            <small className="field-help">{t("Bu yalnızca yeni projelerde başlangıç seçimini belirler; mevcut projeleri değiştirmez.")}</small>
          </label>
        </div>
      </section>
      <section className="settings-section workspace-settings-section">
        <div className="settings-heading"><h2>{t("Çalışma alanları")}</h2><p>{t("Kişisel ve iş içeriklerinizi birbirinden tamamen ayrı tutun.")}</p></div>
        <div className="settings-panel">
          <div className="members-header"><span>{activeWorkspaceCount} {t("aktif")} · {workspaces.filter((workspace) => workspace.archived).length} {t("arşivde")}</span><button className="secondary-button" onClick={onNewWorkspace}><Plus size={16} /> {t("Yeni çalışma alanı")}</button></div>
          <div className="workspace-management-list">
            {workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspaceId;
              const taskCount = workspace.data.boards.reduce((sum, board) => sum + Object.keys(board.tasks).length, 0);
              return (
                <div key={workspace.id} className={`${workspace.archived ? "archived" : ""} ${isActive ? "current" : ""}`}>
                  <i style={{ background: workspace.color }} />
                  <span><strong>{workspace.name}</strong><small>{workspace.archived ? t("Arşivlendi") : isActive ? t("Şu anda açık") : language === "tr" ? `${workspace.data.projects.length} proje · ${taskCount} görev` : `${workspace.data.projects.length} projects · ${taskCount} tasks`}</small></span>
                  <div className="workspace-row-actions">
                    {workspace.archived ? (
                      <><button className="text-button" onClick={() => onRestoreWorkspace(workspace.id)}><RotateCcw size={14} /> {t("Geri getir")}</button><button className="danger-ghost" onClick={() => onDeleteWorkspace(workspace.id)}><Trash2 size={14} /> {t("Kalıcı sil")}</button></>
                    ) : (
                      <>{!isActive && <button className="text-button" onClick={() => onSwitchWorkspace(workspace.id)}>{t("Aç")}</button>}<button className="text-button" onClick={() => onEditWorkspace(workspace.id)}><Pencil size={14} /> {t("Adlandır")}</button><button className="danger-ghost" disabled={activeWorkspaceCount <= 1} onClick={() => onArchiveWorkspace(workspace.id)}><Archive size={14} /> {t("Arşivle")}</button></>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="settings-section"><div className="settings-heading"><h2>{t("Çalışma alanı")}</h2><p>{t("Profiliniz selamlamada ve avatarınızda; çalışma alanı adı ise tüm projelerinizin üzerinde görünür.")}</p></div><div className="settings-panel identity-settings"><label className="field-label">{t("Profil adı")}<div className="inline-save"><input value={profileNameDraft} onChange={(event) => setProfileNameDraft(event.target.value)} placeholder={language === "tr" ? "Örn. Hamit Parlak" : "e.g. Alex Morgan"} /><button className="secondary-button" disabled={!profileNameDraft.trim() || profileNameDraft.trim() === currentProfileName} onClick={() => onProfileName(profileNameDraft.trim())}><Check size={15} /> {t("Kaydet")}</button></div><small className="field-help">{t("Yalnız bu cihazdaki kişisel selamlama için kullanılır.")}</small></label><label className="field-label">{t("Çalışma alanı adı")}<div className="inline-save"><input value={name} onChange={(event) => setName(event.target.value)} /><button className="secondary-button" disabled={!name.trim() || name === data.workspaceName} onClick={() => onWorkspaceName(name.trim())}><Check size={15} /> {t("Kaydet")}</button></div></label></div></section>
      <section className="settings-section"><div className="settings-heading"><h2>{t("Tema")}</h2><p>{t("Odak biçiminize uygun görünümü seçin.")}</p></div><div className="theme-grid">{themes.map((theme) => { const Icon = theme.icon; return <button key={theme.id} className={`theme-card ${theme.id} ${data.theme === theme.id ? "selected" : ""}`} aria-pressed={data.theme === theme.id} onClick={() => onTheme(theme.id)}><div className="theme-preview"><i /><i /><i /></div><span><Icon size={17} /><span><strong>{t(theme.name)}</strong><small>{t(theme.description)}</small></span>{data.theme === theme.id && <Check size={17} />}</span></button>; })}</div></section>
      <section className="settings-section"><div className="settings-heading"><h2>{t("Kişiler")}</h2><p>{t("Görev atamak için yerel kişi dizininiz.")}</p></div><div className="settings-panel"><div className="members-header"><span>{data.members.filter((member) => member.active).length} {t("aktif kişi")}</span><button className="secondary-button" onClick={onNewMember}><UserPlus size={16} /> {t("Kişi ekle")}</button></div><div className="settings-members">{data.members.map((member) => <div key={member.id} className={!member.active ? "inactive" : ""}><span className="member-avatar" style={{ background: member.color }}>{member.initials}</span><span><strong>{member.name}</strong><small>{t(member.active ? "Aktif" : "Pasif · geçmiş atamalar korunur")}</small></span><div className="member-actions"><button className="text-button" onClick={() => onToggleMember(member.id)}>{t(member.active ? "Pasifleştir" : "Etkinleştir")}</button><button className="danger-ghost" onClick={() => onDeleteMember(member.id)} aria-label={language === "tr" ? `${member.name} kişisini sil` : `Delete ${member.name}`}><Trash2 size={15} /> {t("Sil")}</button></div></div>)}</div></div></section>
      {desktopInfo ? (
        <section className="settings-section">
          <div className="settings-heading"><h2>{t("Otomatik kayıt")}</h2><p>{t("Hiçbir işlem yapmanız gerekmez. Akış bütün değişiklikleri dosyaya ve yedeklere kendisi yazar.")}</p></div>
          <div className="backup-panel automatic">
            <div><HardDrive size={20} /><span><strong>{t("Save klasörüne otomatik kaydediliyor")}</strong><small className="save-path">{desktopInfo.dataFile}</small></span><span className="status-chip success"><Check size={14} /> {t("Aktif")}</span></div>
            <div><ShieldCheck size={20} /><span><strong>{t("Otomatik güvenlik kopyaları")}</strong><small>{t("Her saat değişiklik varsa yeni bir kopya oluşturulur; son 60 sağlam yedek korunur.")}</small></span><button className="secondary-button" onClick={() => openDesktopSaveFolder()}><FolderOpen size={16} /> {t("Save klasörünü aç")}</button></div>
          </div>
        </section>
      ) : (
        <section className="settings-section"><div className="settings-heading"><h2>{t("Yedekleme")}</h2><p>{t("Tarayıcı sürümünde taşınabilir bir dosya alabilirsiniz.")}</p></div><div className="backup-panel"><div><Download size={20} /><span><strong>{t("Çalışma alanını dışa aktar")}</strong><small>{t("Tüm proje, görev, kişi ve zihin haritası verilerini taşınabilir JSON dosyasına kaydeder.")}</small></span><button className="secondary-button" onClick={onExport}><Download size={16} /> {t("Yedek indir")}</button></div><div><Upload size={20} /><span><strong>{t("Yedekten geri yükle")}</strong><small>{t("Daha önce alınan bir Akış yedeğini bu cihazda açar.")}</small></span><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => importFile(event.target.files?.[0])} /><button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={16} /> {t("Dosya seç")}</button></div></div></section>
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

function ProjectModal({ project, defaultCurrency, onClose, onSave }: { project?: Project; defaultCurrency: CurrencyCode; onClose: () => void; onSave: (draft: ProjectDraft) => void }) {
  const { t, language, locale } = useI18n();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [clientName, setClientName] = useState(project?.clientName ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>(project?.finance?.currency ?? defaultCurrency);
  const [amount, setAmount] = useState(
    project?.finance
      ? (project.finance.agreedAmountKurus / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "",
  );
  const [color, setColor] = useState(project?.color ?? projectColors[0]);
  const parsedAmount = amount.trim() ? parseMoneyToMinor(amount) : undefined;
  const collected = project ? getProjectFinanceTotals(project).collectedKurus : 0;
  const amountError = amount.trim() && parsedAmount === null
    ? language === "tr" ? "Geçerli bir tutar yazın. Örnek: 12.500,50" : "Enter a valid amount. Example: 12,500.50"
    : parsedAmount !== undefined && parsedAmount !== null && parsedAmount < collected
      ? language === "tr"
        ? `Anlaşılan tutar, tahsil edilmiş ${formatMoney(collected, currency, language, true)} tutarından düşük olamaz.`
        : `The agreed amount cannot be lower than the collected ${formatMoney(collected, currency, language, true)}.`
      : !amount.trim() && collected > 0
        ? language === "tr" ? "Tahsilat geçmişi olan projede anlaşılan tutar boş bırakılamaz." : "The agreed amount cannot be empty when the project has payments."
        : "";
  const valid = Boolean(name.trim()) && !amountError;
  const currencyLocked = Boolean(project?.finance?.payments.length);

  return (
    <BaseModal
      title={t(project ? "Proje bilgilerini düzenle" : "Yeni proje")}
      subtitle={t("Hedefi, müşteriyi ve finansal çerçeveyi tek yerde tanımlayın. Finans alanları isteğe bağlıdır.")}
      onClose={onClose}
    >
      <div className="field-grid">
        <label className="field-label">{t("Proje adı")}<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={language === "tr" ? "Örn. Yeni ürün lansmanı" : "e.g. New product launch"} /></label>
        <label className="field-label">{t("Müşteri / kurum")}<input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder={t("İsteğe bağlı")} /></label>
      </div>
      <label className="field-label">{t("Kısa açıklama")}<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("Bu projede neyi başarmak istiyorsunuz?")} /></label>
      <div className="field-grid finance-fields">
        <label className="field-label">{t("Para birimi")}<select value={currency} disabled={currencyLocked} onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>{currencyCodes.map((code) => <option key={code} value={code}>{currencyName(code, language)} · {code}</option>)}</select>{currencyLocked && <span className="field-help">{t("Tahsilat bulunan projede para birimi değiştirilemez.")}</span>}</label>
        <label className="field-label">{t("Müşteriyle anlaşılan tutar")} ({currency})<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={language === "tr" ? "Örn. 125.000,00" : "e.g. 125,000.00"} />{amountError ? <span className="field-error">{amountError}</span> : <span className="field-help">{t("Kişisel veya ücretsiz projelerde boş bırakabilirsiniz.")}</span>}</label>
      </div>
      <div className="field-label">{t("Proje rengi")}<div className="color-picker-row">{projectColors.map((value) => <button key={value} className={color === value ? "selected" : ""} style={{ background: value }} onClick={() => setColor(value)} aria-label={language === "tr" ? `${value} proje rengini seç` : `Select ${value} project color`} aria-pressed={color === value} />)}</div></div>
      <div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>{t("Vazgeç")}</button><button className="primary-button" disabled={!valid} onClick={() => onSave({ name: name.trim(), description: description.trim() || (language === "tr" ? "Yeni çalışma alanı" : "New workspace"), color, clientName: clientName.trim() || undefined, agreedAmountKurus: parsedAmount || undefined, currency })}>{t(project ? "Değişiklikleri kaydet" : "Projeyi oluştur")}</button></div>
    </BaseModal>
  );
}

function PaymentModal({ project, payment, onClose, onSave }: { project: Project; payment?: ProjectPayment; onClose: () => void; onSave: (draft: PaymentDraft) => void }) {
  const { t, language, locale } = useI18n();
  const totals = getProjectFinanceTotals(project);
  const editableMaximum = totals.receivableKurus + (payment?.amountKurus ?? 0);
  const suggested = payment?.amountKurus ?? editableMaximum;
  const [amount, setAmount] = useState(
    (suggested / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
  const localToday = (() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  })();
  const [receivedOn, setReceivedOn] = useState(payment?.receivedOn ?? localToday);
  const [note, setNote] = useState(payment?.note ?? "");
  const parsedAmount = parseMoneyToMinor(amount);
  const amountError = parsedAmount === null
    ? language === "tr" ? "Geçerli ve sıfırdan büyük bir tutar yazın." : "Enter a valid amount greater than zero."
    : parsedAmount > editableMaximum
      ? language === "tr" ? `Bu kayıt en fazla kalan ${formatMoney(editableMaximum, totals.currency, language, true)} olabilir.` : `This payment cannot exceed the remaining ${formatMoney(editableMaximum, totals.currency, language, true)}.`
      : "";

  return (
    <BaseModal title={t(payment ? "Tahsilatı düzenle" : "Tahsilat ekle")} subtitle={`${project.name} · ${t("Kalan alacak")} ${formatMoney(totals.receivableKurus, totals.currency, language, true)}`} onClose={onClose}>
      <label className="field-label">{t("Tutar")} ({totals.currency})<input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />{amountError && <span className="field-error">{amountError}</span>}</label>
      <label className="field-label">{t("Tahsil tarihi")}<input type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} /></label>
      <label className="field-label">{t("Not")}<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={language === "tr" ? "Örn. İlk taksit, havale" : "e.g. First installment, bank transfer"} /></label>
      <div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>{t("Vazgeç")}</button><button className="primary-button" disabled={Boolean(amountError) || !receivedOn || parsedAmount === null} onClick={() => parsedAmount && onSave({ amountKurus: parsedAmount, receivedOn, note: note.trim() || undefined })}>{t(payment ? "Tahsilatı güncelle" : "Tahsilatı kaydet")}</button></div>
    </BaseModal>
  );
}

function ItemModal({ kind, projects, initialProjectId, onClose, onNewProject, onSave }: { kind: ItemKind; projects: Project[]; initialProjectId?: string; onClose: () => void; onNewProject: () => void; onSave: (kind: ItemKind, projectId: string, title: string) => void }) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const Icon = kind === "board" ? LayoutDashboard : MapIcon;
  const titleText = kind === "board" ? tr ? "Yeni Kanban panosu" : "New Kanban board" : tr ? "Yeni zihin haritası" : "New mind map";
  if (projects.length === 0) {
    return (
      <BaseModal title={titleText} subtitle={tr ? "Her çalışma bir projeye bağlıdır." : "Every workspace item belongs to a project."} onClose={onClose}>
        <EmptyState title={tr ? "Önce bir proje oluşturun" : "Create a project first"} description={kind === "board" ? tr ? "Kanban panonuzu düzenli tutmak için önce bağlı olacağı projeyi oluşturun." : "Create the project that will contain this Kanban board first." : tr ? "Zihin haritanızı düzenli tutmak için önce bağlı olacağı projeyi oluşturun." : "Create the project that will contain this mind map first."} actionLabel={tr ? "Yeni proje oluştur" : "Create project"} onAction={onNewProject} />
      </BaseModal>
    );
  }
  return <BaseModal title={titleText} subtitle={kind === "board" ? tr ? "Varsayılan dört sütunla başlayın, sonra dilediğiniz gibi değiştirin." : "Start with four default columns, then customize them." : tr ? "Ana fikri merkeze koyun ve dalları büyütün." : "Put the main idea at the center and grow its branches."} onClose={onClose}><div className="modal-illustration"><Icon size={24} /></div><label className="field-label">{tr ? "Ad" : "Name"}<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "board" ? tr ? "Örn. Ürün Yol Haritası" : "e.g. Product Roadmap" : tr ? "Örn. Strateji Haritası" : "e.g. Strategy Map"} /></label><label className="field-label">{tr ? "Proje" : "Project"}<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>{tr ? "Vazgeç" : "Cancel"}</button><button className="primary-button" disabled={!title.trim() || !projectId} onClick={() => onSave(kind, projectId, title.trim())}>{tr ? "Oluştur" : "Create"}</button></div></BaseModal>;
}

function DuplicateModal({ kind, projects, currentProjectId, onClose, onNewProject, onSave }: { kind: ItemKind; projects: Project[]; currentProjectId?: string; onClose: () => void; onNewProject: () => void; onSave: (projectId: string, structureOnly: boolean) => void }) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [projectId, setProjectId] = useState(currentProjectId ?? projects[0]?.id ?? "");
  const [structureOnly, setStructureOnly] = useState(false);
  if (projects.length === 0) {
    return <BaseModal title={tr ? "Bağımsız bir kopya oluştur" : "Create an independent copy"} subtitle={tr ? "Kopyanın yerleştirileceği aktif bir proje bulunamadı." : "No active project is available for the copy."} onClose={onClose}><EmptyState title={tr ? "Önce bir proje oluşturun" : "Create a project first"} description={tr ? "Kopyayı kullanacağınız projeyi oluşturduktan sonra bu işlemi yeniden deneyebilirsiniz." : "Create the destination project, then try again."} actionLabel={tr ? "Yeni proje oluştur" : "Create project"} onAction={onNewProject} /></BaseModal>;
  }
  return <BaseModal title={tr ? "Bağımsız bir kopya oluştur" : "Create an independent copy"} subtitle={tr ? "Kaynak çalışma değişmeden yeni bir altlık hazırlayın." : "Create a reusable copy without changing the source."} onClose={onClose}><label className="field-label">{tr ? "Hedef proje" : "Destination project"}<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><div className="copy-options"><button className={!structureOnly ? "selected" : ""} aria-pressed={!structureOnly} onClick={() => setStructureOnly(false)}><Copy size={18} /><span><strong>{tr ? "Tüm içerikle" : "With all content"}</strong><small>{kind === "board" ? tr ? "Sütunlar, kartlar ve atamalar" : "Columns, cards and assignments" : tr ? "Tüm fikirler ve bağlantılar" : "All ideas and connections"}</small></span>{!structureOnly && <Check size={17} />}</button><button className={structureOnly ? "selected" : ""} aria-pressed={structureOnly} onClick={() => setStructureOnly(true)}><Blocks size={18} /><span><strong>{tr ? "Yalnız yapı" : "Structure only"}</strong><small>{kind === "board" ? tr ? "Sütunları boş bir şablon gibi kopyala" : "Copy columns as an empty template" : tr ? "Yalnız ana fikri kopyala" : "Copy only the main idea"}</small></span>{structureOnly && <Check size={17} />}</button></div><div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>{tr ? "Vazgeç" : "Cancel"}</button><button className="primary-button" disabled={!projectId} onClick={() => onSave(projectId, structureOnly)}>{tr ? "Kopyayı oluştur" : "Create copy"}</button></div></BaseModal>;
}

function MemberModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, color: string) => void }) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [name, setName] = useState("");
  const [color, setColor] = useState(projectColors[2]);
  return <BaseModal title={tr ? "Çalışma alanına kişi ekle" : "Add person to workspace"} subtitle={tr ? "Bu kişi yerel görev atamalarında kullanılacak." : "This person will be available for local task assignments."} onClose={onClose}><label className="field-label">{tr ? "Ad soyad" : "Full name"}<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={tr ? "Örn. Deniz Yılmaz" : "e.g. Alex Morgan"} /></label><div className="field-label">{tr ? "Avatar rengi" : "Avatar color"}<div className="color-picker-row">{projectColors.map((value) => <button key={value} className={color === value ? "selected" : ""} style={{ background: value }} onClick={() => setColor(value)} aria-label={tr ? `${value} avatar rengini seç` : `Select ${value} avatar color`} aria-pressed={color === value} />)}</div></div><div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>{tr ? "Vazgeç" : "Cancel"}</button><button className="primary-button" disabled={!name.trim()} onClick={() => onSave(name.trim(), color)}>{tr ? "Kişiyi ekle" : "Add person"}</button></div></BaseModal>;
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
  const { language } = useI18n();
  const tr = language === "tr";
  const [name, setName] = useState(workspace?.name ?? "");
  const [color, setColor] = useState(workspace?.color ?? projectColors[0]);
  const normalized = name.trim().toLocaleLowerCase(tr ? "tr-TR" : "en-US");
  const duplicate = existingNames.some((existing) => existing !== workspace?.name && existing.toLocaleLowerCase(tr ? "tr-TR" : "en-US") === normalized);
  const valid = Boolean(normalized) && !duplicate;
  return (
    <BaseModal
      title={workspace ? tr ? "Çalışma alanını yeniden adlandır" : "Rename workspace" : tr ? "Yeni çalışma alanı" : "New workspace"}
      subtitle={workspace ? tr ? "Yeni ad yalnızca bu çalışma alanını etkiler." : "The new name affects only this workspace." : tr ? "Projeleri, finansı, kişileri ve aramaları tamamen ayrı yeni bir alan oluşturun." : "Create a separate space for projects, finances, people and searches."}
      onClose={onClose}
    >
      <label className="field-label">{tr ? "Çalışma alanı adı" : "Workspace name"}<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={tr ? "Örn. Şirket Projeleri" : "e.g. Company Projects"} />{duplicate && <span className="field-error">{tr ? "Bu adla bir çalışma alanı zaten var." : "A workspace with this name already exists."}</span>}</label>
      <div className="field-label">{tr ? "Alan rengi" : "Workspace color"}<div className="color-picker-row">{projectColors.map((value) => <button key={value} className={color === value ? "selected" : ""} style={{ background: value }} onClick={() => setColor(value)} aria-label={tr ? `${value} çalışma alanı rengini seç` : `Select ${value} workspace color`} aria-pressed={color === value} />)}</div></div>
      <div className="workspace-privacy-note"><ShieldCheck size={18} /><span><strong>{tr ? "Tamamen yerel ve ayrı" : "Fully local and separate"}</strong><small>{tr ? "Bu alanda yalnızca burada oluşturduğunuz proje, finans, kişi ve çalışmalar görünür." : "Only the projects, finances, people and work created here are visible in this space."}</small></span></div>
      <div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>{tr ? "Vazgeç" : "Cancel"}</button><button className="primary-button" disabled={!valid} onClick={() => onSave(name.trim(), color)}>{workspace ? tr ? "Adı kaydet" : "Save name" : tr ? "Çalışma alanını oluştur" : "Create workspace"}</button></div>
    </BaseModal>
  );
}

function BaseModal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  const { language } = useI18n();
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
  return <div className="modal-scrim" onMouseDown={onClose}><section ref={modalRef} className="modal-card" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label={language === "tr" ? "Pencereyi kapat" : "Close window"}><X size={18} /></button></header><div className="modal-content">{children}</div></section></div>;
}
