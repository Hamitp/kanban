"use client";

import {
  Archive,
  ArrowRight,
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
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BoardView } from "./components/BoardView";
import { MindMapView } from "./components/MindMapView";
import { createBoard, createMindMap, createSeedData, newId } from "./seed";
import {
  getDesktopSaveInfo,
  isDesktopRuntime,
  isWorkspaceData,
  loadWorkspace,
  openDesktopSaveFolder,
  saveWorkspace,
} from "./storage";
import { getTaskWorkMs, transitionTaskTiming } from "./taskTiming";
import type { DesktopSaveInfo } from "./desktop";
import type {
  AppData,
  ItemKind,
  KanbanBoard,
  MindMap,
  MindNode,
  Project,
  Screen,
  TaskCard,
  ThemeId,
} from "./types";

type ModalState =
  | { type: "project" }
  | { type: "item"; kind: ItemKind; projectId?: string }
  | { type: "duplicate"; kind: ItemKind; id: string }
  | { type: "member" }
  | null;

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

export default function AkisApp() {
  const [data, setData] = useState<AppData | null>(null);
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
  const pastRef = useRef<AppData[]>([]);
  const futureRef = useRef<AppData[]>([]);
  const hydrated = useRef(false);

  useEffect(() => {
    loadWorkspace()
      .then((stored) => setData(stored ?? createSeedData()))
      .catch(() => setFatalLoadError(true))
      .finally(() => {
        hydrated.current = true;
      });
    if (!isDesktopRuntime() && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    if (!isDesktopRuntime()) navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!data || !hydrated.current) return;
    document.documentElement.dataset.theme = data.theme;
    let cancelled = false;
    let retryTimer: number | undefined;
    const persist = () => {
      if (cancelled) return;
      setSaveState("saving");
      saveWorkspace(data)
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
    const timer = window.setTimeout(persist, isDesktopRuntime() ? 0 : 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [data]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if (
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
    setData((current) => {
      if (!current) return current;
      if (track) {
        pastRef.current = [...pastRef.current.slice(-39), current];
        futureRef.current = [];
      }
      const updated = updater(current);
      return { ...updated, updatedAt: now() };
    });
    if (track) setHistoryVersion((value) => value + 1);
  }, []);

  function undo() {
    if (!data || pastRef.current.length === 0) return;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [data, ...futureRef.current.slice(0, 39)];
    setData(previous);
    setToast({ message: "Son işlem geri alındı" });
    setHistoryVersion((value) => value + 1);
  }

  function redo() {
    if (!data || futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-39), data];
    setData(next);
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

  const activeProjects = data.projects.filter((project) => !project.archived);
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

  function createProjectItem(name: string, description: string, color: string) {
    const project: Project = {
      id: newId(),
      name,
      description,
      color,
      archived: false,
      createdAt: now(),
      updatedAt: now(),
    };
    commit((current) => ({ ...current, projects: [...current.projects, project] }));
    setModal(null);
    navigate({ kind: "project", id: project.id });
    showToast("Yeni proje hazır");
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
    showToast(kind === "board" ? "Yeni Kanban hazır" : "Yeni mind map hazır");
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
              return [clonedId, { ...task, id: clonedId, createdAt: stamp, updatedAt: stamp }];
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
        projects={activeProjects}
        onToggle={() => setSidebarOpen((value) => !value)}
        onNavigate={navigate}
        onNewProject={() => setModal({ type: "project" })}
      />
      <div className="app-main">
        <Topbar
          workspaceName={data.workspaceName}
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
            onEditColumn={(columnId, title, color, role) =>
              commit((current) => ({
                ...current,
                boards: current.boards.map((board) =>
                  board.id === currentBoard.id
                    ? { ...board, columns: board.columns.map((column) => (column.id === columnId ? { ...column, title, color, role } : column)), updatedAt: now() }
                    : board,
                ),
              }))
            }
            onDeleteColumn={(columnId) => {
              const column = currentBoard.columns.find((item) => item.id === columnId);
              if (!column) return;
              if (column.taskIds.length) {
                showToast("Önce sütundaki işleri başka bir sütuna taşıyın");
                return;
              }
              if (currentBoard.columns.length === 1) {
                showToast("Boardda en az bir sütun kalmalı");
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
            onRestore={(kind, id) => {
              commit((current) => {
                if (kind === "project") return { ...current, projects: current.projects.map((item) => (item.id === id ? { ...item, archived: false } : item)) };
                if (kind === "board") return { ...current, boards: current.boards.map((item) => (item.id === id ? { ...item, archived: false } : item)) };
                return { ...current, mindMaps: current.mindMaps.map((item) => (item.id === id ? { ...item, archived: false } : item)) };
              });
              showToast("Çalışma geri getirildi", true);
            }}
            onDelete={(kind, id) => {
              if (!window.confirm("Bu çalışma kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?")) return;
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
              });
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
                assigneeIds: [data.members[0]?.id].filter(Boolean),
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
              showToast("İş, toplam iş listesine eklendi");
            }}
            onTheme={(theme) => commit((current) => ({ ...current, theme }), false)}
            onWorkspaceName={(workspaceName) => commit((current) => ({ ...current, workspaceName }))}
            onNewMember={() => setModal({ type: "member" })}
            onToggleMember={(memberId) =>
              commit((current) => ({
                ...current,
                members: current.members.map((member) =>
                  member.id === memberId ? { ...member, active: !member.active } : member,
                ),
              }))
            }
            onExport={() => exportWorkspace(data)}
            onImport={(imported) => {
              pastRef.current = [...pastRef.current.slice(-39), data];
              futureRef.current = [];
              setData({ ...imported, updatedAt: now() });
              setHistoryVersion((value) => value + 1);
              showToast("Yedek başarıyla geri yüklendi", true);
            }}
          />
        )}
      </div>

      {modal?.type === "project" && (
        <ProjectModal onClose={() => setModal(null)} onSave={createProjectItem} />
      )}
      {modal?.type === "item" && (
        <ItemModal
          kind={modal.kind}
          projects={activeProjects}
          initialProjectId={modal.projectId}
          onClose={() => setModal(null)}
          onSave={createItem}
        />
      )}
      {modal?.type === "duplicate" && (
        <DuplicateModal
          kind={modal.kind}
          projects={activeProjects}
          currentProjectId={
            modal.kind === "board"
              ? data.boards.find((item) => item.id === modal.id)?.projectId
              : data.mindMaps.find((item) => item.id === modal.id)?.projectId
          }
          onClose={() => setModal(null)}
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
  onToggle,
  onNavigate,
  onNewProject,
}: {
  open: boolean;
  screen: Screen;
  projects: Project[];
  onToggle: () => void;
  onNavigate: (screen: Screen) => void;
  onNewProject: () => void;
}) {
  const nav = [
    { kind: "home" as const, label: "Genel Bakış", icon: Home },
    { kind: "projects" as const, label: "Projeler", icon: FolderKanban },
    { kind: "boards" as const, label: "Kanbanlar", icon: LayoutDashboard },
    { kind: "mindmaps" as const, label: "Mind Mapler", icon: MapIcon },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <button className="brand-button" onClick={() => onNavigate({ kind: "home" })}>
          <span className="brand-mark"><Blocks size={20} /></span>
          {open && <span><strong>Akış</strong><small>Yerel çalışma alanı</small></span>}
        </button>
        <button className="icon-button sidebar-toggle" onClick={onToggle} aria-label={open ? "Menüyü daralt" : "Menüyü genişlet"}>
          {open ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        </button>
      </div>
      <nav className="main-nav" aria-label="Ana menü">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = screen.kind === item.kind;
          return (
            <button key={item.kind} className={active ? "active" : ""} onClick={() => onNavigate({ kind: item.kind })} title={!open ? item.label : undefined}>
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
              onClick={() => onNavigate({ kind: "project", id: project.id })}
            >
              <i style={{ background: project.color }} />
              <span>{project.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="sidebar-bottom">
        <button className={screen.kind === "archive" ? "active" : ""} onClick={() => onNavigate({ kind: "archive" })} title={!open ? "Arşiv" : undefined}>
          <Archive size={18} /> {open && <span>Arşiv</span>}
        </button>
        <button className={screen.kind === "settings" ? "active" : ""} onClick={() => onNavigate({ kind: "settings" })} title={!open ? "Ayarlar" : undefined}>
          <Settings2 size={18} /> {open && <span>Ayarlar</span>}
        </button>
      </div>
    </aside>
  );
}

function Topbar({
  workspaceName,
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
  const results = normalized
    ? [
        ...projects.filter((item) => item.name.toLocaleLowerCase("tr").includes(normalized)).map((item) => ({ key: `p-${item.id}`, title: item.name, meta: "Proje", screen: { kind: "project", id: item.id } as Screen, icon: FolderKanban })),
        ...boards.filter((item) => `${item.title} ${item.description}`.toLocaleLowerCase("tr").includes(normalized)).map((item) => ({ key: `b-${item.id}`, title: item.title, meta: "Kanban", screen: { kind: "board", id: item.id } as Screen, icon: LayoutDashboard })),
        ...mindMaps.filter((item) => `${item.title} ${item.description}`.toLocaleLowerCase("tr").includes(normalized)).map((item) => ({ key: `m-${item.id}`, title: item.title, meta: "Mind map", screen: { kind: "mindmap", id: item.id } as Screen, icon: MapIcon })),
        ...boards.flatMap((board) =>
          Object.values(board.tasks)
            .filter((task) => `${task.title} ${task.description}`.toLocaleLowerCase("tr").includes(normalized))
            .map((task) => ({ key: `t-${task.id}`, title: task.title, meta: `${board.title} · İş`, screen: { kind: "board", id: board.id } as Screen, icon: ListTodo })),
        ),
      ].slice(0, 8)
    : [];

  const crumb = (() => {
    if (screen.kind === "project") return projects.find((item) => item.id === screen.id)?.name;
    if (screen.kind === "board") return boards.find((item) => item.id === screen.id)?.title;
    if (screen.kind === "mindmap") return mindMaps.find((item) => item.id === screen.id)?.title;
    const names: Record<string, string> = { home: "Genel Bakış", projects: "Projeler", boards: "Kanbanlar", mindmaps: "Mind Mapler", archive: "Arşiv", settings: "Ayarlar" };
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
          />
          <kbd>Ctrl K</kbd>
        </label>
        {searchOpen && (
          <div className="search-popover">
            <header><span>{normalized ? `“${query}” için sonuçlar` : "Proje, iş veya fikir arayın"}</span><button onClick={() => onSearchOpen(false)}><X size={15} /></button></header>
            {results.map((result) => {
              const Icon = result.icon;
              return <button key={result.key} onClick={() => { onNavigate(result.screen); onSearchOpen(false); }}><Icon size={17} /><span><strong>{result.title}</strong><small>{result.meta}</small></span><ArrowRight size={15} /></button>;
            })}
            {normalized && results.length === 0 && <div className="empty-search">Eşleşen sonuç bulunamadı.</div>}
          </div>
        )}
      </div>
      <div className="topbar-actions">
        <div className={`save-indicator ${saveState}`}>
          <i /> {saveState === "saving" ? "Kaydediliyor" : saveState === "error" ? "Kaydedilemedi · yeniden deneniyor" : `${isDesktopRuntime() ? "Save klasörüne kaydedildi" : "Yerelde kayıtlı"}${savedAt ? ` · ${savedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
        </div>
        <button className="icon-button" onClick={onUndo} disabled={!canUndo} aria-label="Geri al"><Undo2 size={17} /></button>
        <button className="icon-button" onClick={onRedo} disabled={!canRedo} aria-label="Yinele"><Redo2 size={17} /></button>
        <span className="user-avatar">HP</span>
      </div>
    </header>
  );
}

function ShellContent({
  screen,
  data,
  onNavigate,
  onModal,
  onArchiveItem,
  onArchiveProject,
  onRestore,
  onDelete,
  onQuickTask,
  onTheme,
  onWorkspaceName,
  onNewMember,
  onToggleMember,
  onExport,
  onImport,
}: {
  screen: Screen;
  data: AppData;
  onNavigate: (screen: Screen) => void;
  onModal: (modal: ModalState) => void;
  onArchiveItem: (kind: ItemKind, id: string) => void;
  onArchiveProject: (id: string) => void;
  onRestore: (kind: "project" | ItemKind, id: string) => void;
  onDelete: (kind: "project" | ItemKind, id: string) => void;
  onQuickTask: (boardId: string, title: string) => void;
  onTheme: (theme: ThemeId) => void;
  onWorkspaceName: (name: string) => void;
  onNewMember: () => void;
  onToggleMember: (id: string) => void;
  onExport: () => void;
  onImport: (data: AppData) => void;
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
    if (!project) return <EmptyState title="Proje bulunamadı" description="Bu proje kaldırılmış olabilir." />;
    return (
      <ProjectScreen
        project={project}
        boards={data.boards.filter((board) => board.projectId === project.id && !board.archived)}
        mindMaps={data.mindMaps.filter((map) => map.projectId === project.id && !map.archived)}
        onNavigate={onNavigate}
        onNew={(kind) => onModal({ type: "item", kind, projectId: project.id })}
        onArchiveProject={() => onArchiveProject(project.id)}
        onDuplicate={(kind, id) => onModal({ type: "duplicate", kind, id })}
        onArchiveItem={onArchiveItem}
      />
    );
  }
  if (screen.kind === "projects") {
    return (
      <LibraryScreen
        title="Projeler"
        description="Bütün çalışma alanlarınız tek bakışta."
        actionLabel="Yeni proje"
        onAction={() => onModal({ type: "project" })}
      >
        <div className="project-grid">
          {data.projects.filter((project) => !project.archived).map((project) => (
            <ProjectCard key={project.id} project={project} data={data} onOpen={() => onNavigate({ kind: "project", id: project.id })} />
          ))}
        </div>
      </LibraryScreen>
    );
  }
  if (screen.kind === "boards" || screen.kind === "mindmaps") {
    const isBoard = screen.kind === "boards";
    const items = isBoard
      ? data.boards.filter((item) => !item.archived)
      : data.mindMaps.filter((item) => !item.archived);
    return (
      <LibraryScreen
        title={isBoard ? "Kanban Boardlar" : "Mind Mapler"}
        description={isBoard ? "Önceliklerinizi akışa dönüştüren çalışma yüzeyleri." : "Düşünceleriniz arasındaki bağları görünür kılın."}
        actionLabel={isBoard ? "Yeni Kanban" : "Yeni Mind Map"}
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
        data={data}
        onTheme={onTheme}
        onWorkspaceName={onWorkspaceName}
        onNewMember={onNewMember}
        onToggleMember={onToggleMember}
        onExport={onExport}
        onImport={onImport}
      />
    );
  }
  return null;
}

function getProjectStats(project: Project, data: AppData) {
  const boards = data.boards.filter((board) => board.projectId === project.id && !board.archived);
  let backlog = 0;
  let planned = 0;
  let active = 0;
  let done = 0;
  let waiting = 0;
  const completionTimes: number[] = [];
  boards.forEach((board) => {
    board.columns.forEach((column) => {
      if (column.role === "backlog") backlog += column.taskIds.length;
      if (column.role === "planned") planned += column.taskIds.length;
      if (column.role === "active") active += column.taskIds.length;
      if (column.role === "done") done += column.taskIds.length;
    });
    Object.values(board.tasks).forEach((task) => {
      if (task.waitingReason) waiting += 1;
      if (task.completedAt && task.workSessions?.length) completionTimes.push(getTaskWorkMs(task));
    });
  });
  const committed = planned + active + done;
  const progress = committed ? Math.round((done / committed) * 100) : 0;
  const averageDays = completionTimes.length
    ? Math.max(1, Math.round(completionTimes.reduce((sum, value) => sum + value, 0) / completionTimes.length / 86_400_000))
    : 0;
  return { boards: boards.length, backlog, planned, active, done, waiting, committed, progress, averageDays };
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
  const activeProjects = data.projects.filter((project) => !project.archived);
  const projectStats = activeProjects.map((project) => ({ project, stats: getProjectStats(project, data) }));
  const activeBoards = data.boards.filter((board) => !board.archived && activeProjects.some((project) => project.id === board.projectId));
  const activeTasks = activeBoards.flatMap((board) => {
    const column = board.columns.find((item) => item.role === "active");
    return (column?.taskIds ?? []).map((id) => ({ task: board.tasks[id], board })).filter((item) => item.task);
  });
  const waitingTasks = activeBoards.flatMap((board) =>
    Object.values(board.tasks).filter((task) => task.waitingReason).map((task) => ({ task, board })),
  );
  const totalDone = projectStats.reduce((sum, item) => sum + item.stats.done, 0);
  const totalCommitted = projectStats.reduce((sum, item) => sum + item.stats.committed, 0);
  const averageProgress = totalCommitted ? Math.round((totalDone / totalCommitted) * 100) : 0;
  const cycleSamples = activeBoards.flatMap((board) => Object.values(board.tasks).filter((task) => task.completedAt && task.workSessions?.length));
  const averageCycle = cycleSamples.length
    ? Math.max(1, Math.round(cycleSamples.reduce((sum, task) => sum + getTaskWorkMs(task), 0) / cycleSamples.length / 86_400_000))
    : 0;
  const quickBoard = data.boards.find((board) => !board.archived);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";

  return (
    <main className="shell-page home-page">
      <section className="home-hero">
        <div>
          <span className="eyebrow">{new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span>
          <h1>{greeting}, Hamit.</h1>
          <p>Zihniniz açık, işleriniz görünür. Bugün en anlamlı adıma odaklanın.</p>
        </div>
        <button className="primary-button large" onClick={onNewProject}><Plus size={18} /> Yeni proje</button>
      </section>

      <section className="metric-grid" aria-label="Çalışma alanı özeti">
        <MetricCard icon={FolderKanban} tone="violet" label="Aktif proje" value={activeProjects.length} note={`${activeBoards.length} Kanban board`} />
        <MetricCard icon={ListTodo} tone="blue" label="Üzerinde çalışılan" value={activeTasks.length} note={`${waitingTasks.length} iş beklemede`} />
        <MetricCard icon={CheckCircle2} tone="green" label="Tamamlanan" value={totalDone} note={`Genel ilerleme %${averageProgress}`} />
        <MetricCard icon={RotateCcw} tone="amber" label="Ortalama çevrim" value={averageCycle ? `${averageCycle} gün` : "—"} note={`${cycleSamples.length} tamamlanan işten`} />
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
                  <div className="health-title"><i style={{ background: project.color }} /><strong>{project.name}</strong><span>{stats.boards} board</span></div>
                  <div className="segmented-progress" aria-label={`${project.name} ilerlemesi yüzde ${stats.progress}`}>
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
          <p>Düşünceyi kaybetmeden ilk boardunuzun toplam iş listesine ekleyin.</p>
          <textarea value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} placeholder="Yeni bir iş veya fikir..." rows={4} />
          <button
            className="primary-button wide"
            disabled={!quickTitle.trim() || !quickBoard}
            onClick={() => {
              if (!quickBoard) return;
              onQuickTask(quickBoard.id, quickTitle.trim());
              setQuickTitle("");
            }}
          >
            <Plus size={17} /> Toplam iş listesine ekle
          </button>
          <small>{quickBoard ? quickBoard.title : "Önce bir Kanban board oluşturun"}</small>
        </aside>
      </section>

      <section className="dashboard-grid lower">
        <div className="dashboard-card focus-card">
          <header className="section-header compact"><div><span className="eyebrow">ŞİMDİ</span><h2>Üzerinde çalıştığınız işler</h2></div><span className="count-badge">{activeTasks.length}</span></header>
          <div className="focus-list">
            {activeTasks.slice(0, 5).map(({ task, board }) => {
              const elapsed = getTaskWorkMs(task);
              const days = Math.floor(elapsed / 86_400_000);
              return (
                <button key={task.id} onClick={() => onNavigate({ kind: "board", id: board.id })}>
                  <span className="pulse-dot" />
                  <span className="focus-copy"><strong>{task.title}</strong><small>{board.title}</small></span>
                  <span className={`age-badge ${days >= 5 ? "old" : days >= 2 ? "aging" : ""}`}>
                    {elapsed < 86_400_000 ? "Bugün başladı" : `${days} gündür aktif`}
                  </span>
                  <ChevronRight size={15} />
                </button>
              );
            })}
            {activeTasks.length === 0 && <EmptyState title="Aktif iş yok" description="Bir kartı ‘Üzerinde Çalışılanlar’ sütununa taşıdığınızda burada görünür." />}
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
            {waitingTasks.length === 0 && <EmptyState title="Bekleyen iş yok" description="Akışınızı durduran dış bağımlılık görünmüyor." />}
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ icon: Icon, tone, label, value, note }: { icon: typeof Home; tone: string; label: string; value: number | string; note: string }) {
  return <article className={`metric-card ${tone}`}><div className="metric-icon"><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function ProjectScreen({
  project,
  boards,
  mindMaps,
  onNavigate,
  onNew,
  onArchiveProject,
  onDuplicate,
  onArchiveItem,
}: {
  project: Project;
  boards: KanbanBoard[];
  mindMaps: MindMap[];
  onNavigate: (screen: Screen) => void;
  onNew: (kind: ItemKind) => void;
  onArchiveProject: () => void;
  onDuplicate: (kind: ItemKind, id: string) => void;
  onArchiveItem: (kind: ItemKind, id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main className="shell-page project-page">
      <section className="project-hero" style={{ "--project-color": project.color } as React.CSSProperties}>
        <div className="project-symbol"><FolderKanban size={25} /></div>
        <div><span className="eyebrow">PROJE</span><h1>{project.name}</h1><p>{project.description}</p></div>
        <div className="spacer" />
        <button className="secondary-button" onClick={() => onNew("mindmap")}><MapIcon size={16} /> Mind map</button>
        <button className="primary-button" onClick={() => onNew("board")}><Plus size={17} /> Kanban ekle</button>
        <div className="relative-menu"><button className="icon-button" onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal size={18} /></button>{menuOpen && <div className="context-menu"><button onClick={onArchiveProject}><Archive size={15} /> Projeyi arşivle</button></div>}</div>
      </section>
      <section className="project-summary-strip">
        <span><LayoutDashboard size={16} /><strong>{boards.length}</strong> Kanban</span>
        <span><MapIcon size={16} /><strong>{mindMaps.length}</strong> Mind map</span>
        <span><ListTodo size={16} /><strong>{boards.reduce((sum, board) => sum + Object.keys(board.tasks).length, 0)}</strong> toplam iş</span>
      </section>
      <section className="section-block">
        <header className="section-header"><div><span className="eyebrow">ÇALIŞMA YÜZEYLERİ</span><h2>Kanban Boardlar</h2></div><button className="text-button" onClick={() => onNew("board")}><Plus size={15} /> Yeni Kanban</button></header>
        <div className="asset-grid">
          {boards.map((board) => <AssetCard key={board.id} item={board} project={project} onOpen={() => onNavigate({ kind: "board", id: board.id })} onDuplicate={() => onDuplicate("board", board.id)} onArchive={() => onArchiveItem("board", board.id)} />)}
          {boards.length === 0 && <CreateCard icon={LayoutDashboard} label="İlk Kanban boardu oluştur" onClick={() => onNew("board")} />}
        </div>
      </section>
      <section className="section-block">
        <header className="section-header"><div><span className="eyebrow">DÜŞÜNCE ALANI</span><h2>Mind Mapler</h2></div><button className="text-button" onClick={() => onNew("mindmap")}><Plus size={15} /> Yeni Mind Map</button></header>
        <div className="asset-grid">
          {mindMaps.map((map) => <AssetCard key={map.id} item={map} project={project} onOpen={() => onNavigate({ kind: "mindmap", id: map.id })} onDuplicate={() => onDuplicate("mindmap", map.id)} onArchive={() => onArchiveItem("mindmap", map.id)} />)}
          {mindMaps.length === 0 && <CreateCard icon={MapIcon} label="İlk mind map'i oluştur" onClick={() => onNew("mindmap")} />}
        </div>
      </section>
    </main>
  );
}

function ProjectCard({ project, data, onOpen }: { project: Project; data: AppData; onOpen: () => void }) {
  const stats = getProjectStats(project, data);
  return (
    <button className="project-card" onClick={onOpen} style={{ "--project-color": project.color } as React.CSSProperties}>
      <div className="project-card-top"><span className="project-symbol small"><FolderKanban size={20} /></span><ArrowRight size={17} /></div>
      <h3>{project.name}</h3><p>{project.description}</p>
      <div className="project-card-progress"><span><strong>{stats.progress}%</strong> ilerleme</span><div><i style={{ width: `${stats.progress}%` }} /></div></div>
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
  const stats = isBoard
    ? (() => {
        const done = item.columns.filter((column) => column.role === "done").reduce((sum, column) => sum + column.taskIds.length, 0);
        const total = Object.keys(item.tasks).length;
        return { done, total, progress: total ? Math.round((done / total) * 100) : 0 };
      })()
    : null;
  return (
    <article className="asset-card">
      <button className="asset-main" onClick={onOpen}>
        <div className={`asset-preview ${isBoard ? "board" : "map"}`}>
          {isBoard ? (
            <>{item.columns.slice(0, 4).map((column) => <i key={column.id} style={{ borderColor: column.color }}><span /><span /><span /></i>)}</>
          ) : (
            <><i className="map-line one" /><i className="map-line two" /><span className="map-node-preview root" /><span className="map-node-preview a" /><span className="map-node-preview b" /></>
          )}
          <span className="asset-kind"><>{isBoard ? <LayoutDashboard size={13} /> : <MapIcon size={13} />}</>{isBoard ? "KANBAN" : "MIND MAP"}</span>
        </div>
        <div className="asset-copy"><span className="asset-project"><i style={{ background: project?.color }} />{project?.name ?? "Proje"}</span><h3>{item.title}</h3><p>{item.description}</p></div>
        <footer>{isBoard ? <><span>{stats?.total} iş</span><span>%{stats?.progress} tamamlandı</span></> : <><span>{item.nodes.length} fikir</span><span>Mind map</span></>}<span className="updated">{new Intl.RelativeTimeFormat("tr", { numeric: "auto" }).format(Math.max(-30, Math.min(0, Math.round((new Date(item.updatedAt).getTime() - referenceTime) / 86_400_000))), "day")}</span></footer>
      </button>
      <div className="asset-menu"><button className="icon-button" onClick={() => setMenu((value) => !value)} aria-label="Çalışma menüsü"><MoreHorizontal size={17} /></button>{menu && <div className="context-menu"><button onClick={onDuplicate}><Copy size={15} /> Çoğalt</button><button onClick={onArchive}><Archive size={15} /> Arşivle</button></div>}</div>
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
        {items.map((item) => { const Icon = item.icon; return <article key={`${item.kind}-${item.id}`}><span className="archive-icon"><Icon size={19} /></span><div><strong>{item.title}</strong><p>{item.description}</p><small>{item.kind === "project" ? "Proje" : item.kind === "board" ? "Kanban board" : "Mind map"}</small></div><button className="secondary-button" onClick={() => onRestore(item.kind, item.id)}><RotateCcw size={15} /> Geri getir</button><button className="danger-ghost" onClick={() => onDelete(item.kind, item.id)}><Trash2 size={16} /> Kalıcı sil</button></article>; })}
        {items.length === 0 && <EmptyState title="Arşiv boş" description="Arşivlediğiniz proje ve çalışmalar burada görünecek." />}
      </div>
    </main>
  );
}

function SettingsScreen({
  data,
  onTheme,
  onWorkspaceName,
  onNewMember,
  onToggleMember,
  onExport,
  onImport,
}: {
  data: AppData;
  onTheme: (theme: ThemeId) => void;
  onWorkspaceName: (name: string) => void;
  onNewMember: () => void;
  onToggleMember: (id: string) => void;
  onExport: () => void;
  onImport: (data: AppData) => void;
}) {
  const [name, setName] = useState(data.workspaceName);
  const fileRef = useRef<HTMLInputElement>(null);
  const [desktopInfo, setDesktopInfo] = useState<DesktopSaveInfo | null>(null);
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
      <section className="settings-section"><div className="settings-heading"><h2>Çalışma alanı</h2><p>Başlık, tüm projelerinizin üzerinde görünür.</p></div><div className="settings-panel"><label className="field-label">Çalışma alanı adı<div className="inline-save"><input value={name} onChange={(event) => setName(event.target.value)} /><button className="secondary-button" disabled={!name.trim() || name === data.workspaceName} onClick={() => onWorkspaceName(name.trim())}><Check size={15} /> Kaydet</button></div></label></div></section>
      <section className="settings-section"><div className="settings-heading"><h2>Tema</h2><p>Odak biçiminize uygun görünümü seçin.</p></div><div className="theme-grid">{themes.map((theme) => { const Icon = theme.icon; return <button key={theme.id} className={`theme-card ${theme.id} ${data.theme === theme.id ? "selected" : ""}`} onClick={() => onTheme(theme.id)}><div className="theme-preview"><i /><i /><i /></div><span><Icon size={17} /><span><strong>{theme.name}</strong><small>{theme.description}</small></span>{data.theme === theme.id && <Check size={17} />}</span></button>; })}</div></section>
      <section className="settings-section"><div className="settings-heading"><h2>Kişiler</h2><p>Görev atamak için yerel kişi dizininiz.</p></div><div className="settings-panel"><div className="members-header"><span>{data.members.filter((member) => member.active).length} aktif kişi</span><button className="secondary-button" onClick={onNewMember}><UserPlus size={16} /> Kişi ekle</button></div><div className="settings-members">{data.members.map((member) => <div key={member.id} className={!member.active ? "inactive" : ""}><span className="member-avatar" style={{ background: member.color }}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.active ? "Aktif" : "Pasif · geçmiş atamalar korunur"}</small></span><button className="text-button" onClick={() => onToggleMember(member.id)}>{member.active ? "Pasifleştir" : "Etkinleştir"}</button></div>)}</div></div></section>
      {desktopInfo ? (
        <section className="settings-section">
          <div className="settings-heading"><h2>Otomatik kayıt</h2><p>Hiçbir işlem yapmanız gerekmez. Akış bütün değişiklikleri dosyaya ve yedeklere kendisi yazar.</p></div>
          <div className="backup-panel automatic">
            <div><HardDrive size={20} /><span><strong>Save klasörüne otomatik kaydediliyor</strong><small className="save-path">{desktopInfo.dataFile}</small></span><span className="status-chip success"><Check size={14} /> Aktif</span></div>
            <div><ShieldCheck size={20} /><span><strong>Otomatik güvenlik kopyaları</strong><small>Her saat değişiklik varsa yeni bir kopya oluşturulur; son 60 sağlam yedek korunur.</small></span><button className="secondary-button" onClick={() => openDesktopSaveFolder()}><FolderOpen size={16} /> Save klasörünü aç</button></div>
          </div>
        </section>
      ) : (
        <section className="settings-section"><div className="settings-heading"><h2>Yedekleme</h2><p>Tarayıcı sürümünde taşınabilir bir dosya alabilirsiniz.</p></div><div className="backup-panel"><div><Download size={20} /><span><strong>Çalışma alanını dışa aktar</strong><small>Tüm proje, görev, kişi ve mind map verilerini taşınabilir JSON dosyasına kaydeder.</small></span><button className="secondary-button" onClick={onExport}><Download size={16} /> Yedek indir</button></div><div><Upload size={20} /><span><strong>Yedekten geri yükle</strong><small>Daha önce alınan bir Akış yedeğini bu cihazda açar.</small></span><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => importFile(event.target.files?.[0])} /><button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={16} /> Dosya seç</button></div></div></section>
      )}
    </main>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span><Sparkles size={18} /></span><strong>{title}</strong><p>{description}</p></div>;
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

function ProjectModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, description: string, color: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(projectColors[0]);
  return <BaseModal title="Yeni proje" subtitle="Bir hedefi kendi çalışma yüzeyleriyle organize edin." onClose={onClose}><label className="field-label">Proje adı<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Örn. Yeni ürün lansmanı" /></label><label className="field-label">Kısa açıklama<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Bu projede neyi başarmak istiyorsunuz?" /></label><div className="field-label">Proje rengi<div className="color-picker-row">{projectColors.map((value) => <button key={value} className={color === value ? "selected" : ""} style={{ background: value }} onClick={() => setColor(value)} />)}</div></div><div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!name.trim()} onClick={() => onSave(name.trim(), description.trim() || "Yeni çalışma alanı", color)}>Projeyi oluştur</button></div></BaseModal>;
}

function ItemModal({ kind, projects, initialProjectId, onClose, onSave }: { kind: ItemKind; projects: Project[]; initialProjectId?: string; onClose: () => void; onSave: (kind: ItemKind, projectId: string, title: string) => void }) {
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const Icon = kind === "board" ? LayoutDashboard : MapIcon;
  return <BaseModal title={kind === "board" ? "Yeni Kanban board" : "Yeni mind map"} subtitle={kind === "board" ? "Varsayılan dört sütunla başlayın, sonra dilediğiniz gibi değiştirin." : "Ana fikri merkeze koyun ve dalları büyütün."} onClose={onClose}><div className="modal-illustration"><Icon size={24} /></div><label className="field-label">Ad<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "board" ? "Örn. Ürün Yol Haritası" : "Örn. Strateji Haritası"} /></label><label className="field-label">Proje<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!title.trim() || !projectId} onClick={() => onSave(kind, projectId, title.trim())}>Oluştur</button></div></BaseModal>;
}

function DuplicateModal({ kind, projects, currentProjectId, onClose, onSave }: { kind: ItemKind; projects: Project[]; currentProjectId?: string; onClose: () => void; onSave: (projectId: string, structureOnly: boolean) => void }) {
  const [projectId, setProjectId] = useState(currentProjectId ?? projects[0]?.id ?? "");
  const [structureOnly, setStructureOnly] = useState(false);
  return <BaseModal title="Bağımsız bir kopya oluştur" subtitle="Kaynak çalışma değişmeden yeni bir altlık hazırlayın." onClose={onClose}><label className="field-label">Hedef proje<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><div className="copy-options"><button className={!structureOnly ? "selected" : ""} onClick={() => setStructureOnly(false)}><Copy size={18} /><span><strong>Tüm içerikle</strong><small>{kind === "board" ? "Sütunlar, kartlar ve atamalar" : "Tüm fikirler ve bağlantılar"}</small></span>{!structureOnly && <Check size={17} />}</button><button className={structureOnly ? "selected" : ""} onClick={() => setStructureOnly(true)}><Blocks size={18} /><span><strong>Yalnız yapı</strong><small>{kind === "board" ? "Sütunları boş bir şablon gibi kopyala" : "Yalnız ana fikri kopyala"}</small></span>{structureOnly && <Check size={17} />}</button></div><div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!projectId} onClick={() => onSave(projectId, structureOnly)}>Kopyayı oluştur</button></div></BaseModal>;
}

function MemberModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, color: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(projectColors[2]);
  return <BaseModal title="Çalışma alanına kişi ekle" subtitle="Bu kişi yerel görev atamalarında kullanılacak." onClose={onClose}><label className="field-label">Ad soyad<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Örn. Deniz Yılmaz" /></label><div className="field-label">Avatar rengi<div className="color-picker-row">{projectColors.map((value) => <button key={value} className={color === value ? "selected" : ""} style={{ background: value }} onClick={() => setColor(value)} />)}</div></div><div className="modal-actions"><div className="spacer" /><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!name.trim()} onClick={() => onSave(name.trim(), color)}>Kişiyi ekle</button></div></BaseModal>;
}

function BaseModal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-scrim" onMouseDown={onClose}><section className="modal-card" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><X size={18} /></button></header><div className="modal-content">{children}</div></section></div>;
}
