"use client";

import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  GitBranch,
  GripVertical,
  Hand,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { newId } from "../seed";
import { formatTaskWorkDuration, getTaskWorkMs } from "../taskTiming";
import { getBoardFlowStats } from "../workspaceAnalytics";
import { effortPointOptions } from "../v4Workflows";
import { EffortGuide } from "./EffortGuide";
import type {
  BoardColumn,
  EffortPoints,
  KanbanBoard,
  LabelDefinition,
  Member,
  Priority,
  TaskCard,
} from "../types";
import { CanvasZoomControls } from "./CanvasZoomControls";
import { useCanvasPan } from "./useCanvasPan";
import { useCanvasZoom } from "./useCanvasZoom";

interface BoardViewProps {
  board: KanbanBoard;
  projectName: string;
  members: Member[];
  labels: LabelDefinition[];
  onBack: () => void;
  onRename: (title: string, description: string) => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onAddColumn: (title: string, color: string, role?: BoardColumn["role"]) => void;
  onEditColumn: (columnId: string, title: string, color: string, role?: BoardColumn["role"]) => void;
  onDeleteColumn: (columnId: string) => void;
  onReorderColumn: (columnId: string, direction: -1 | 1) => void;
  onSaveTask: (columnId: string, task: TaskCard, isNew: boolean) => void;
  onDeleteTask: (columnId: string, taskId: string) => void;
  onMoveTask: (
    taskId: string,
    fromColumnId: string,
    toColumnId: string,
    beforeTaskId?: string,
  ) => void;
  onAddLabel: (name: string, color: string) => string;
  onDeleteLabel: (labelId: string) => boolean;
  onZoomChange: (zoom: number) => void;
  onOpenTaskSource: (task: TaskCard) => void;
}

const priorityNames: Record<Priority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

const columnColors = ["#8b7cf6", "#5d9cec", "#f2a55f", "#65af87", "#d56d85"];

interface TaskPlacement {
  columnId: string;
  beforeTaskId?: string;
}

export function BoardView({
  board,
  projectName,
  members,
  labels,
  onBack,
  onRename,
  onArchive,
  onDuplicate,
  onAddColumn,
  onEditColumn,
  onDeleteColumn,
  onReorderColumn,
  onSaveTask,
  onDeleteTask,
  onOpenTaskSource,
  onMoveTask,
  onAddLabel,
  onDeleteLabel,
  onZoomChange,
}: BoardViewProps) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [clock, setClock] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [selected, setSelected] = useState<{
    task: TaskCard;
    columnId: string;
    isNew: boolean;
  } | null>(null);
  const [columnEditor, setColumnEditor] = useState<BoardColumn | "new" | null>(null);
  const [boardEditor, setBoardEditor] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ columnId: string; beforeTaskId?: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollSpeedRef = useRef(0);
  const autoScrollFrameRef = useRef<number | null>(null);
  const {
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    isMinZoom,
    isMaxZoom,
  } = useCanvasZoom({
    initialZoom: board.zoom ?? 1,
    minZoom: 0.65,
    maxZoom: 1.6,
    scrollRef,
    onZoomChange,
  });
  useCanvasPan({
    scrollRef,
    canStartWithLeftButton: (target) =>
      target instanceof Element &&
      !target.closest(".kanban-column, .add-column-card, button, input, textarea, select, a"),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
    }
  }, []);

  const visibleTaskIds = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("tr");
    return new Set(
      Object.values(board.tasks)
        .filter((task) => {
          const matchesSearch =
            !search ||
            `${task.title} ${task.description} ${task.waitingReason ?? ""}`
              .toLocaleLowerCase("tr")
              .includes(search);
          return matchesSearch && (!waitingOnly || Boolean(task.waitingReason));
        })
        .map((task) => task.id),
    );
  }, [board.tasks, query, waitingOnly]);

  const flow = getBoardFlowStats(board);
  const completed = flow.done;
  const total = flow.committed;

  function stopDragAutoScroll() {
    autoScrollSpeedRef.current = 0;
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }

  function updateDragAutoScroll(clientX: number) {
    const container = scrollRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const edge = Math.min(96, Math.max(56, bounds.width * 0.09));
    const leftRatio = Math.max(0, Math.min(1, (bounds.left + edge - clientX) / edge));
    const rightRatio = Math.max(0, Math.min(1, (clientX - (bounds.right - edge)) / edge));
    autoScrollSpeedRef.current = leftRatio > 0
      ? -Math.ceil(4 + leftRatio * 18)
      : rightRatio > 0
        ? Math.ceil(4 + rightRatio * 18)
        : 0;

    if (autoScrollSpeedRef.current === 0 || autoScrollFrameRef.current !== null) return;
    const scrollStep = () => {
      const current = scrollRef.current;
      if (!current || autoScrollSpeedRef.current === 0) {
        autoScrollFrameRef.current = null;
        return;
      }
      current.scrollLeft += autoScrollSpeedRef.current;
      autoScrollFrameRef.current = window.requestAnimationFrame(scrollStep);
    };
    autoScrollFrameRef.current = window.requestAnimationFrame(scrollStep);
  }

  function clearDragState() {
    stopDragAutoScroll();
    setDraggingTaskId(null);
    setDropTarget(null);
  }

  function showDropTarget(columnId: string, beforeTaskId?: string) {
    setDropTarget((current) =>
      current?.columnId === columnId && current.beforeTaskId === beforeTaskId
        ? current
        : { columnId, beforeTaskId },
    );
  }

  function createTask(columnId: string) {
    const now = new Date().toISOString();
    setSelected({
      columnId,
      isNew: true,
      task: {
        id: newId(),
        title: "",
        description: "",
        priority: "medium",
        effortPoints: 1,
        labelIds: [],
        assigneeIds: [],
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return (
    <div className="work-view board-view">
      <header className="work-header">
        <div className="work-heading">
          <button className="icon-button" onClick={onBack} aria-label={tr ? "Projeye dön" : "Back to project"}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="eyebrow">{projectName} / {tr ? "Kanban panosu" : "Kanban board"}</div>
            <button className="title-button" onClick={() => setBoardEditor(true)} aria-label={tr ? "Kanban panosu bilgilerini düzenle" : "Edit Kanban board details"}>
              <h1>{board.title}</h1>
              <Pencil size={15} />
            </button>
            <p>{board.description}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={onDuplicate}>
            <Copy size={16} /> {tr ? "Çoğalt" : "Duplicate"}
          </button>
          <button className="secondary-button" onClick={onArchive}>
            <Archive size={16} /> {tr ? "Arşivle" : "Archive"}
          </button>
          <button className="primary-button" onClick={() => setColumnEditor("new")}>
            <Plus size={17} /> {tr ? "Sütun ekle" : "Add column"}
          </button>
        </div>
      </header>

      <div className="board-toolbar">
        <label className="search-field board-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr ? "Bu panoda ara..." : "Search this board..."}
            aria-label={tr ? "Kanban panosunda görev ara" : "Search tasks on Kanban board"}
          />
        </label>
        <button
          className={`filter-chip ${waitingOnly ? "active" : ""}`}
          aria-pressed={waitingOnly}
          onClick={() => setWaitingOnly((value) => !value)}
        >
          <CircleAlert size={15} /> {tr ? "Bekleyenler" : "Waiting"}
        </button>
        <CanvasZoomControls
          label={tr ? "Kanban panosu" : "Kanban board"}
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
          isMinZoom={isMinZoom}
          isMaxZoom={isMaxZoom}
        />
        <div className="board-progress" role="progressbar" aria-label={tr ? "Kanban panosu ilerlemesi" : "Kanban board progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={flow.progress}>
          <span>{flow.progress}% · {completed}/{total || 0} {tr ? "tamamlandı" : "completed"}{flow.backlog ? ` · ${flow.backlog} ${tr ? "havuzda" : "in backlog"}` : ""}</span>
          <div className="progress-track">
            <i style={{ width: `${flow.progress}%` }} />
          </div>
        </div>
      </div>

      <main
        className="kanban-scroll"
        ref={scrollRef}
        aria-label={`${board.title} ${tr ? "Kanban panosu" : "Kanban board"}`}
        onDragOver={(event) => {
          if (!draggingTaskId) return;
          updateDragAutoScroll(event.clientX);
          if (event.target instanceof Element && !event.target.closest(".kanban-column")) {
            setDropTarget(null);
          }
        }}
      >
        <div className="kanban-grid" style={{ zoom } as React.CSSProperties}>
          {board.columns.map((column, columnIndex) => {
            const taskIds = column.taskIds.filter((id) => visibleTaskIds.has(id));
            const isColumnDropTarget = Boolean(
              draggingTaskId
              && dropTarget?.columnId === column.id
              && !dropTarget.beforeTaskId,
            );
            return (
              <section
                className={`kanban-column ${isColumnDropTarget ? "drop-target" : ""}`}
                key={column.id}
                onDragOver={(event) => {
                  if (!draggingTaskId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  updateDragAutoScroll(event.clientX);
                  showDropTarget(column.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const payload = event.dataTransfer.getData("application/x-akis-task");
                  if (!payload) return;
                  const { taskId, fromColumnId } = JSON.parse(payload) as {
                    taskId: string;
                    fromColumnId: string;
                  };
                  onMoveTask(taskId, fromColumnId, column.id);
                  clearDragState();
                }}
              >
                <div className="column-accent" style={{ background: column.color }} />
                <header className="column-header">
                  <div>
                    <h2>{column.title}</h2>
                    <span>{column.taskIds.length} {tr ? "görev" : column.taskIds.length === 1 ? "task" : "tasks"}</span>
                  </div>
                  <div className="column-actions">
                    <button
                      className="micro-button"
                      disabled={columnIndex === 0}
                      onClick={() => onReorderColumn(column.id, -1)}
                      aria-label={tr ? `${column.title} sütununu sola taşı` : `Move ${column.title} column left`}
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      className="micro-button"
                      disabled={columnIndex === board.columns.length - 1}
                      onClick={() => onReorderColumn(column.id, 1)}
                      aria-label={tr ? `${column.title} sütununu sağa taşı` : `Move ${column.title} column right`}
                    >
                      <ChevronRight size={15} />
                    </button>
                    <button
                      className="micro-button"
                      onClick={() => setColumnEditor(column)}
                      aria-label={tr ? `${column.title} sütununu düzenle` : `Edit ${column.title} column`}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </header>

                <div className="task-stack">
                  {taskIds.map((taskId) => {
                    const task = board.tasks[taskId];
                    return (
                      <TaskCardView
                        key={task.id}
                        task={task}
                        columnId={column.id}
                        labels={labels}
                        members={members}
                        clock={clock}
                        isDragSource={draggingTaskId === task.id}
                        isDropTarget={Boolean(
                          draggingTaskId
                          && draggingTaskId !== task.id
                          && dropTarget?.columnId === column.id
                          && dropTarget.beforeTaskId === task.id,
                        )}
                        onDragBegin={() => {
                          setDraggingTaskId(task.id);
                          setDropTarget(null);
                        }}
                        onDragHover={(clientX) => {
                          updateDragAutoScroll(clientX);
                          showDropTarget(column.id, task.id);
                        }}
                        onDragFinish={clearDragState}
                        onOpen={() => setSelected({ task, columnId: column.id, isNew: false })}
                        onDropBefore={(draggedId, fromColumnId) =>
                          onMoveTask(draggedId, fromColumnId, column.id, task.id)
                        }
                      />
                    );
                  })}
                  {taskIds.length === 0 && (query || waitingOnly) && (
                    <div className="column-empty">{tr ? "Bu filtreye uyan görev yok." : "No tasks match this filter."}</div>
                  )}
                  {isColumnDropTarget && <div className="column-drop-placeholder" aria-hidden="true">{tr ? "Sütunun sonuna bırak" : "Drop at end of column"}</div>}
                </div>
                <button className="add-task-button" onClick={() => createTask(column.id)}>
                  <Plus size={16} /> {tr ? "Görev ekle" : "Add task"}
                </button>
              </section>
            );
          })}
          <button className="add-column-card" onClick={() => setColumnEditor("new")}>
            <Plus size={18} /> {tr ? "Yeni sütun" : "New column"}
          </button>
        </div>
        <div className="canvas-navigation-hint"><Hand size={15} /> {tr ? "Boş alanda sol tuşla, her yerde orta tuşla sürükleyerek gezinin" : "Drag empty space with the left button, or anywhere with the middle button, to pan"}</div>
      </main>

      {selected && (
        <TaskPanel
          key={`${selected.task.id}-${selected.isNew}`}
          task={selected.task}
          isNew={selected.isNew}
          currentColumnId={selected.columnId}
          columns={board.columns}
          members={members}
          labels={labels}
          onClose={() => setSelected(null)}
          onAddLabel={onAddLabel}
          onDeleteLabel={onDeleteLabel}
          onSave={(task, targetColumnId, placement) => {
            onSaveTask(selected.isNew ? targetColumnId : selected.columnId, task, selected.isNew);
            const requestedMove = placement
              ?? (!selected.isNew && targetColumnId !== selected.columnId
                ? { columnId: targetColumnId }
                : undefined);
            if (!selected.isNew && requestedMove) {
              onMoveTask(selected.task.id, selected.columnId, requestedMove.columnId, requestedMove.beforeTaskId);
            }
            setSelected(null);
          }}
          onDelete={() => {
            onDeleteTask(selected.columnId, selected.task.id);
            setSelected(null);
          }}
          onOpenSource={() => onOpenTaskSource(selected.task)}
        />
      )}

      {columnEditor && (
        <ColumnEditor
          column={columnEditor === "new" ? undefined : columnEditor}
          onClose={() => setColumnEditor(null)}
          onSave={(title, color, role) => {
            if (columnEditor === "new") onAddColumn(title, color, role);
            else onEditColumn(columnEditor.id, title, color, role);
            setColumnEditor(null);
          }}
          onDelete={
            columnEditor === "new"
              ? undefined
              : () => {
                  onDeleteColumn(columnEditor.id);
                  setColumnEditor(null);
                }
          }
        />
      )}

      {boardEditor && (
        <BoardEditor
          title={board.title}
          description={board.description}
          onClose={() => setBoardEditor(false)}
          onSave={(title, description) => {
            onRename(title, description);
            setBoardEditor(false);
          }}
        />
      )}
    </div>
  );
}

function TaskCardView({
  task,
  columnId,
  labels,
  members,
  onOpen,
  onDropBefore,
  onDragBegin,
  onDragHover,
  onDragFinish,
  isDragSource,
  isDropTarget,
  clock,
}: {
  task: TaskCard;
  columnId: string;
  labels: LabelDefinition[];
  members: Member[];
  onOpen: () => void;
  onDropBefore: (taskId: string, fromColumnId: string) => void;
  onDragBegin: () => void;
  onDragHover: (clientX: number) => void;
  onDragFinish: () => void;
  isDragSource: boolean;
  isDropTarget: boolean;
  clock: number;
}) {
  const { language } = useI18n();
  const tr = language === "tr";
  const taskLabels = task.labelIds
    .map((id) => labels.find((label) => label.id === id))
    .filter(Boolean) as LabelDefinition[];
  const assignees = task.assigneeIds
    .map((id) => members.find((member) => member.id === id))
    .filter(Boolean) as Member[];
  const workMs = getTaskWorkMs(task, clock);
  const hasWorkTime = (task.workSessions?.length ?? 0) > 0;

  return (
    <div
      className={`task-drop-zone ${isDropTarget ? "active" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        onDragHover(event.clientX);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const payload = event.dataTransfer.getData("application/x-akis-task");
        if (!payload) return;
        const { taskId, fromColumnId } = JSON.parse(payload) as {
          taskId: string;
          fromColumnId: string;
        };
        if (taskId !== task.id) onDropBefore(taskId, fromColumnId);
        onDragFinish();
      }}
    >
      {isDropTarget && <div className="task-drop-indicator" aria-hidden="true">{tr ? "Buraya bırak" : "Drop here"}</div>}
      <article
        className={`task-card priority-${task.priority} ${task.waitingReason ? "waiting" : ""} ${isDragSource ? "drag-source" : ""}`}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "application/x-akis-task",
            JSON.stringify({ taskId: task.id, fromColumnId: columnId }),
          );
          onDragBegin();
        }}
        onDragEnd={onDragFinish}
      >
      <button className="task-card-main" onClick={onOpen} aria-label={tr ? `${task.title} görevini aç` : `Open task ${task.title}`}>
        <div className="task-drag-row">
          <GripVertical size={14} />
          <span className={`priority-dot ${task.priority}`} />
          <span>{tr ? priorityNames[task.priority] : ({ low: "Low", medium: "Medium", high: "High", critical: "Critical" } as Record<Priority, string>)[task.priority]}</span>
          <span className="effort-badge">{task.effortPoints ?? 1} {tr ? "puan" : "pts"}</span>
        </div>
        <h3>{task.title}</h3>
        {task.waitingReason && (
          <div className="waiting-banner">
            <CircleAlert size={14} /> {task.waitingReason}
          </div>
        )}
        {taskLabels.length > 0 && (
          <div className="task-labels">
            {taskLabels.slice(0, 3).map((label) => (
              <span key={label.id} style={{ "--label-color": label.color } as React.CSSProperties}>
                {label.name}
              </span>
            ))}
          </div>
        )}
        <footer className="task-footer">
          <div className="avatar-stack">
            {assignees.slice(0, 3).map((member) => (
              <span key={member.id} style={{ background: member.color }} title={member.name}>
                {member.initials}
              </span>
            ))}
            {assignees.length === 0 && <Users size={15} />}
          </div>
          {task.dueDate && (
            <span className="due-date">
              <CalendarDays size={13} />
              {new Intl.DateTimeFormat(tr ? "tr-TR" : "en-US", { day: "numeric", month: "short" }).format(
                new Date(task.dueDate),
              )}
            </span>
          )}
          {hasWorkTime && (
            <span className={`task-age ${task.completedAt ? "complete" : "active"}`}>
              {task.completedAt
                ? tr ? `Tamamlanma süresi: ${formatTaskWorkDuration(workMs, language)}` : `Completion time: ${formatTaskWorkDuration(workMs, language)}`
                : workMs < 86_400_000
                  ? tr ? "Bugün başladı" : "Started today"
                  : tr ? `Aktif süre: ${formatTaskWorkDuration(workMs, language)}` : `Active time: ${formatTaskWorkDuration(workMs, language)}`}
            </span>
          )}
        </footer>
      </button>
      </article>
    </div>
  );
}

function TaskPanel({
  task,
  isNew,
  currentColumnId,
  columns,
  labels,
  members,
  onClose,
  onSave,
  onDelete,
  onAddLabel,
  onDeleteLabel,
  onOpenSource,
}: {
  task: TaskCard;
  isNew: boolean;
  currentColumnId: string;
  columns: BoardColumn[];
  labels: LabelDefinition[];
  members: Member[];
  onClose: () => void;
  onSave: (task: TaskCard, targetColumnId: string, placement?: TaskPlacement) => void;
  onDelete: () => void;
  onAddLabel: (name: string, color: string) => string;
  onDeleteLabel: (labelId: string) => boolean;
  onOpenSource: () => void;
}) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [draft, setDraft] = useState(task);
  const [targetColumnId, setTargetColumnId] = useState(currentColumnId);
  const [newLabel, setNewLabel] = useState("");
  const [pendingLabels, setPendingLabels] = useState<string[]>([]);
  const currentColumnIndex = columns.findIndex((column) => column.id === currentColumnId);
  const currentColumn = columns[currentColumnIndex];
  const currentTaskIndex = currentColumn?.taskIds.indexOf(task.id) ?? -1;
  const hasValidTitle = Boolean(draft.title.trim());
  const canMoveUp = hasValidTitle && !isNew && currentTaskIndex > 0;
  const canMoveDown = hasValidTitle && !isNew && currentTaskIndex >= 0 && currentTaskIndex < (currentColumn?.taskIds.length ?? 0) - 1;
  const canMoveLeft = hasValidTitle && !isNew && currentColumnIndex > 0;
  const canMoveRight = hasValidTitle && !isNew && currentColumnIndex >= 0 && currentColumnIndex < columns.length - 1;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const toggle = (field: "labelIds" | "assigneeIds", id: string) => {
    setDraft((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((value) => value !== id)
        : [...current[field], id],
    }));
  };

  function saveDraft(nextColumnId = targetColumnId, placement?: TaskPlacement) {
    if (!draft.title.trim()) return;
    const newLabelIds = pendingLabels.map((label) => onAddLabel(label, "#7771c9"));
    onSave(
      {
        ...draft,
        title: draft.title.trim(),
        labelIds: [...draft.labelIds, ...newLabelIds],
        updatedAt: new Date().toISOString(),
      },
      nextColumnId,
      placement,
    );
  }

  function deleteLabel(labelId: string) {
    if (!onDeleteLabel(labelId)) return;
    setDraft((current) => ({
      ...current,
      labelIds: current.labelIds.filter((id) => id !== labelId),
    }));
  }

  return (
    <div className="panel-scrim" onMouseDown={onClose}>
      <aside className="task-panel" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={tr ? "Görev ayrıntıları" : "Task details"}>
        <header className="panel-header">
          <div>
            <span className="eyebrow">{isNew ? tr ? "Yeni görev" : "New task" : tr ? "Görev ayrıntıları" : "Task details"}</span>
            <h2>{isNew ? tr ? "Bir görevi yakala" : "Capture a task" : tr ? "Görevi düzenle" : "Edit task"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={tr ? "Paneli kapat" : "Close panel"}>
            <X size={19} />
          </button>
        </header>
        <div className="panel-body">
          <label className="field-label">
            {tr ? "Görev başlığı" : "Task title"}
            <input
              autoFocus
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder={tr ? "Ne yapılması gerekiyor?" : "What needs to be done?"}
            />
          </label>
          <label className="field-label">
            {tr ? "Açıklama" : "Description"}
            <textarea
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder={tr ? "Bağlamı ve beklenen sonucu yazın..." : "Add context and the expected outcome..."}
              rows={4}
            />
          </label>
          <label className="field-label">
            {tr ? "Sütun" : "Column"}
            <select value={targetColumnId} onChange={(event) => setTargetColumnId(event.target.value)}>
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
            </select>
          </label>
          {!isNew && (
            <div className="task-move-actions" role="group" aria-label={tr ? "Görevi hızlı taşı" : "Quickly move task"}>
              <span>{tr ? "Hızlı taşı" : "Quick move"}</span>
              <div>
                <button type="button" className="micro-button" disabled={!canMoveUp} onClick={() => saveDraft(currentColumnId, { columnId: currentColumnId, beforeTaskId: currentColumn?.taskIds[currentTaskIndex - 1] })}><ArrowUp size={15} /> {tr ? "Yukarı" : "Up"}</button>
                <button type="button" className="micro-button" disabled={!canMoveDown} onClick={() => saveDraft(currentColumnId, { columnId: currentColumnId, beforeTaskId: currentColumn?.taskIds[currentTaskIndex + 2] })}><ArrowDown size={15} /> {tr ? "Aşağı" : "Down"}</button>
                <button type="button" className="micro-button" disabled={!canMoveLeft} onClick={() => saveDraft(currentColumnId, { columnId: columns[currentColumnIndex - 1].id })}><ChevronLeft size={15} /> {tr ? "Önceki sütun" : "Previous column"}</button>
                <button type="button" className="micro-button" disabled={!canMoveRight} onClick={() => saveDraft(currentColumnId, { columnId: columns[currentColumnIndex + 1].id })}><ChevronRight size={15} /> {tr ? "Sonraki sütun" : "Next column"}</button>
              </div>
            </div>
          )}
          <div className="field-grid">
            <label className="field-label">
              {tr ? "Öncelik" : "Priority"}
              <select
                value={draft.priority}
                onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}
              >
                {Object.entries(priorityNames).map(([value, name]) => (
                  <option key={value} value={value}>
                    {tr ? name : ({ low: "Low", medium: "Medium", high: "High", critical: "Critical" } as Record<string, string>)[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              {tr ? "İş yükü puanı" : "Effort points"}
              <select value={draft.effortPoints ?? 1} onChange={(event) => setDraft({ ...draft, effortPoints: Number(event.target.value) as EffortPoints })}>
                {effortPointOptions.map((point) => <option key={point} value={point}>{point}</option>)}
              </select>
            </label>
            <label className="field-label">
              {tr ? "Son tarih" : "Due date"}
              <input
                type="date"
                value={draft.dueDate ?? ""}
                onChange={(event) => setDraft({ ...draft, dueDate: event.target.value || undefined })}
              />
            </label>
          </div>
          <EffortGuide />
          {(draft.sourceLinks?.length ?? 0) > 0 && <button type="button" className="task-source-note" onClick={onOpenSource}><GitBranch size={15} /><span>{tr ? "Bu görev bir analiz veya zihin haritasından oluşturuldu. Kaynağı aç." : "This task was created from an analysis or mind map. Open its source."}</span><ChevronRight size={15} /></button>}
          <label className="field-label">
            {tr ? "Bekleme / engel nedeni" : "Waiting / blocker reason"}
            <div className="input-with-icon">
              <CircleAlert size={16} />
              <input
                value={draft.waitingReason ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, waitingReason: event.target.value || undefined })
                }
                placeholder={tr ? "Örn. müşteriden kritik bilgi bekleniyor" : "e.g. waiting for critical information from client"}
              />
            </div>
          </label>
          <fieldset className="choice-fieldset">
            <legend>
              <Tag size={15} /> {tr ? "Etiketler" : "Labels"}
            </legend>
            <div className="choice-grid">
              {labels.map((label) => (
                <div className="label-choice-item" key={label.id}>
                  <label className="choice-pill">
                    <input
                      type="checkbox"
                      checked={draft.labelIds.includes(label.id)}
                      onChange={() => toggle("labelIds", label.id)}
                    />
                    <i style={{ background: label.color }} /> {label.name}
                  </label>
                  <button
                    type="button"
                    className="label-delete-button"
                    onClick={() => deleteLabel(label.id)}
                    aria-label={tr ? `${label.name} etiketini sil` : `Delete ${label.name} label`}
                    title={tr ? "Etiketi sil" : "Delete label"}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {pendingLabels.map((label) => (
                <span className="choice-pill pending" key={label}>
                  <i style={{ background: "#7771c9" }} />{label} · {tr ? "yeni" : "new"}
                  <button
                    type="button"
                    onClick={() => setPendingLabels((current) => current.filter((item) => item !== label))}
                    aria-label={tr ? `${label} yeni etiketini kaldır` : `Remove new ${label} label`}
                    title={tr ? "Yeni etiketi kaldır" : "Remove new label"}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="inline-create">
              <input
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder={tr ? "Yeni etiket..." : "New label..."}
              />
              <button
                type="button"
                className="secondary-button"
                disabled={!newLabel.trim()}
                onClick={() => {
                  const label = newLabel.trim();
                  if (!pendingLabels.some((item) => item.toLocaleLowerCase(language) === label.toLocaleLowerCase(language))) {
                    setPendingLabels((current) => [...current, label]);
                  }
                  setNewLabel("");
                }}
              >
                <Plus size={15} /> {tr ? "Ekle" : "Add"}
              </button>
            </div>
          </fieldset>
          <fieldset className="choice-fieldset">
            <legend>
              <UserPlus size={15} /> {tr ? "Atanan kişiler" : "Assignees"}
            </legend>
            <div className="member-choice-list">
              {members.filter((member) => member.active).map((member) => (
                <label key={member.id}>
                  <input
                    type="checkbox"
                    checked={draft.assigneeIds.includes(member.id)}
                    onChange={() => toggle("assigneeIds", member.id)}
                  />
                  <span className="member-avatar" style={{ background: member.color }}>
                    {member.initials}
                  </span>
                  {member.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <footer className="panel-footer">
          {!isNew && (
            <button className="danger-ghost" onClick={() => window.confirm(tr ? "Bu görev silinsin mi?" : "Delete this task?") && onDelete()}>
              <Trash2 size={16} /> {tr ? "Sil" : "Delete"}
            </button>
          )}
          <div className="spacer" />
          <button className="secondary-button" onClick={onClose}>{tr ? "Vazgeç" : "Cancel"}</button>
          <button
            className="primary-button"
            disabled={!hasValidTitle}
            onClick={() => saveDraft()}
          >
            {tr ? "Kaydet" : "Save"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function ColumnEditor({
  column,
  onClose,
  onSave,
  onDelete,
}: {
  column?: BoardColumn;
  onClose: () => void;
  onSave: (title: string, color: string, role?: BoardColumn["role"]) => void;
  onDelete?: () => void;
}) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [title, setTitle] = useState(column?.title ?? "");
  const [color, setColor] = useState(column?.color ?? columnColors[0]);
  const [role, setRole] = useState<BoardColumn["role"] | "">(column?.role ?? "");
  return (
    <Modal title={column ? tr ? "Sütunu düzenle" : "Edit column" : tr ? "Yeni sütun" : "New column"} onClose={onClose}>
      <label className="field-label">
        {tr ? "Sütun adı" : "Column name"}
        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={tr ? "Örn. İncelemede" : "e.g. In review"} />
      </label>
      <div className="field-label">
        {tr ? "Renk" : "Color"}
        <div className="color-picker-row">
          {columnColors.map((value) => (
            <button
              key={value}
              className={color === value ? "selected" : ""}
              style={{ background: value }}
              onClick={() => setColor(value)}
              aria-label={tr ? `${value} rengini seç` : `Select ${value} color`}
              aria-pressed={color === value}
            />
          ))}
        </div>
      </div>
      <label className="field-label">
        {tr ? "Akış anlamı" : "Workflow meaning"}
        <select value={role} onChange={(event) => setRole(event.target.value as BoardColumn["role"] | "")}>
          <option value="">{tr ? "Özel sütun" : "Custom column"}</option>
          <option value="backlog">{tr ? "Önceliklendirilmemiş havuz" : "Unprioritized backlog"}</option>
          <option value="planned">{tr ? "Önceliklendirilmiş görev" : "Prioritized task"}</option>
          <option value="active">{tr ? "Üzerinde çalışılan" : "In progress"}</option>
          <option value="done">{tr ? "Tamamlanan" : "Completed"}</option>
        </select>
        <small className="field-help">{tr ? "İlerleme grafikleri ve süre sayacı bu anlamı kullanır." : "Progress charts and the duration timer use this meaning."}</small>
      </label>
      <div className="modal-actions">
        {onDelete && (
          <button className="danger-ghost" onClick={onDelete}>
            <Trash2 size={16} /> {tr ? "Sütunu sil" : "Delete column"}
          </button>
        )}
        <div className="spacer" />
        <button className="secondary-button" onClick={onClose}>{tr ? "Vazgeç" : "Cancel"}</button>
        <button className="primary-button" disabled={!title.trim()} onClick={() => onSave(title.trim(), color, role || undefined)}>
          {tr ? "Kaydet" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

function BoardEditor({
  title: initialTitle,
  description: initialDescription,
  onClose,
  onSave,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onSave: (title: string, description: string) => void;
}) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  return (
    <Modal title={tr ? "Kanban panosu bilgileri" : "Kanban board details"} onClose={onClose}>
      <label className="field-label">
        {tr ? "Kanban panosu adı" : "Kanban board name"}
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field-label">
        {tr ? "Kısa açıklama" : "Short description"}
        <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="modal-actions">
        <div className="spacer" />
        <button className="secondary-button" onClick={onClose}>{tr ? "Vazgeç" : "Cancel"}</button>
        <button className="primary-button" disabled={!title.trim()} onClick={() => onSave(title.trim(), description.trim())}>
          {tr ? "Kaydet" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><X size={18} /></button>
        </header>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}
