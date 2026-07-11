"use client";

import {
  Archive,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  GripVertical,
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
import { newId } from "../seed";
import { getTaskWorkMs, getTaskWorkDays } from "../taskTiming";
import type {
  BoardColumn,
  KanbanBoard,
  LabelDefinition,
  Member,
  Priority,
  TaskCard,
} from "../types";
import { CanvasZoomControls } from "./CanvasZoomControls";
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
  onZoomChange: (zoom: number) => void;
}

const priorityNames: Record<Priority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

const columnColors = ["#8b7cf6", "#5d9cec", "#f2a55f", "#65af87", "#d56d85"];

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
  onMoveTask,
  onAddLabel,
  onZoomChange,
}: BoardViewProps) {
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
  const scrollRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
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

  const completed = board.columns
    .filter((column) => column.role === "done")
    .reduce((sum, column) => sum + column.taskIds.length, 0);
  const total = Object.keys(board.tasks).length;

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
          <button className="icon-button" onClick={onBack} aria-label="Projeye dön">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="eyebrow">{projectName} / Kanban</div>
            <button className="title-button" onClick={() => setBoardEditor(true)}>
              <h1>{board.title}</h1>
              <Pencil size={15} />
            </button>
            <p>{board.description}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={onDuplicate}>
            <Copy size={16} /> Çoğalt
          </button>
          <button className="secondary-button" onClick={onArchive}>
            <Archive size={16} /> Arşivle
          </button>
          <button className="primary-button" onClick={() => setColumnEditor("new")}>
            <Plus size={17} /> Sütun ekle
          </button>
        </div>
      </header>

      <div className="board-toolbar">
        <label className="search-field board-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bu boardda ara..."
          />
        </label>
        <button
          className={`filter-chip ${waitingOnly ? "active" : ""}`}
          onClick={() => setWaitingOnly((value) => !value)}
        >
          <CircleAlert size={15} /> Bekleyenler
        </button>
        <CanvasZoomControls
          label="Kanban board"
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
          isMinZoom={isMinZoom}
          isMaxZoom={isMaxZoom}
        />
        <div className="board-progress" aria-label={`${total} işten ${completed} tanesi tamamlandı`}>
          <span>{completed}/{total || 0} tamamlandı</span>
          <div className="progress-track">
            <i style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <main
        className="kanban-scroll"
        ref={scrollRef}
        aria-label={`${board.title} Kanban board`}
      >
        <div className="kanban-grid" style={{ zoom } as React.CSSProperties}>
          {board.columns.map((column, columnIndex) => {
            const taskIds = column.taskIds.filter((id) => visibleTaskIds.has(id));
            return (
              <section
                className="kanban-column"
                key={column.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const payload = event.dataTransfer.getData("application/x-akis-task");
                  if (!payload) return;
                  const { taskId, fromColumnId } = JSON.parse(payload) as {
                    taskId: string;
                    fromColumnId: string;
                  };
                  onMoveTask(taskId, fromColumnId, column.id);
                }}
              >
                <div className="column-accent" style={{ background: column.color }} />
                <header className="column-header">
                  <div>
                    <h2>{column.title}</h2>
                    <span>{column.taskIds.length} iş</span>
                  </div>
                  <div className="column-actions">
                    <button
                      className="micro-button"
                      disabled={columnIndex === 0}
                      onClick={() => onReorderColumn(column.id, -1)}
                      aria-label={`${column.title} sütununu sola taşı`}
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      className="micro-button"
                      disabled={columnIndex === board.columns.length - 1}
                      onClick={() => onReorderColumn(column.id, 1)}
                      aria-label={`${column.title} sütununu sağa taşı`}
                    >
                      <ChevronRight size={15} />
                    </button>
                    <button
                      className="micro-button"
                      onClick={() => setColumnEditor(column)}
                      aria-label={`${column.title} sütununu düzenle`}
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
                        onOpen={() => setSelected({ task, columnId: column.id, isNew: false })}
                        onDropBefore={(draggedId, fromColumnId) =>
                          onMoveTask(draggedId, fromColumnId, column.id, task.id)
                        }
                      />
                    );
                  })}
                  {taskIds.length === 0 && (query || waitingOnly) && (
                    <div className="column-empty">Bu filtreye uyan iş yok.</div>
                  )}
                </div>
                <button className="add-task-button" onClick={() => createTask(column.id)}>
                  <Plus size={16} /> İş ekle
                </button>
              </section>
            );
          })}
          <button className="add-column-card" onClick={() => setColumnEditor("new")}>
            <Plus size={18} /> Yeni sütun
          </button>
        </div>
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
          onMove={(toColumnId) => {
            if (!selected.isNew) {
              onMoveTask(selected.task.id, selected.columnId, toColumnId);
              setSelected((current) => (current ? { ...current, columnId: toColumnId } : null));
            }
          }}
          onSave={(task) => {
            onSaveTask(selected.columnId, task, selected.isNew);
            setSelected(null);
          }}
          onDelete={() => {
            onDeleteTask(selected.columnId, selected.task.id);
            setSelected(null);
          }}
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
  clock,
}: {
  task: TaskCard;
  columnId: string;
  labels: LabelDefinition[];
  members: Member[];
  onOpen: () => void;
  onDropBefore: (taskId: string, fromColumnId: string) => void;
  clock: number;
}) {
  const taskLabels = task.labelIds
    .map((id) => labels.find((label) => label.id === id))
    .filter(Boolean) as LabelDefinition[];
  const assignees = task.assigneeIds
    .map((id) => members.find((member) => member.id === id))
    .filter(Boolean) as Member[];
  const workMs = getTaskWorkMs(task, clock);
  const workDays = getTaskWorkDays(task, clock);
  const hasWorkTime = (task.workSessions?.length ?? 0) > 0;

  return (
    <article
      className={`task-card priority-${task.priority} ${task.waitingReason ? "waiting" : ""}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/x-akis-task",
          JSON.stringify({ taskId: task.id, fromColumnId: columnId }),
        );
      }}
      onDragOver={(event) => event.preventDefault()}
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
      }}
    >
      <button className="task-card-main" onClick={onOpen} aria-label={`${task.title} işini aç`}>
        <div className="task-drag-row">
          <GripVertical size={14} />
          <span className={`priority-dot ${task.priority}`} />
          <span>{priorityNames[task.priority]}</span>
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
              {new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(
                new Date(task.dueDate),
              )}
            </span>
          )}
          {hasWorkTime && (
            <span className={`task-age ${task.completedAt ? "complete" : "active"}`}>
              {task.completedAt ? `${workDays} günde tamamlandı` : workMs < 86_400_000 ? "Bugün başladı" : `${Math.floor(workMs / 86_400_000)} gündür aktif`}
            </span>
          )}
        </footer>
      </button>
    </article>
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
  onMove,
  onAddLabel,
}: {
  task: TaskCard;
  isNew: boolean;
  currentColumnId: string;
  columns: BoardColumn[];
  labels: LabelDefinition[];
  members: Member[];
  onClose: () => void;
  onSave: (task: TaskCard) => void;
  onDelete: () => void;
  onMove: (columnId: string) => void;
  onAddLabel: (name: string, color: string) => string;
}) {
  const [draft, setDraft] = useState(task);
  const [newLabel, setNewLabel] = useState("");

  const toggle = (field: "labelIds" | "assigneeIds", id: string) => {
    setDraft((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((value) => value !== id)
        : [...current[field], id],
    }));
  };

  return (
    <div className="panel-scrim" onMouseDown={onClose}>
      <aside className="task-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="İş ayrıntıları">
        <header className="panel-header">
          <div>
            <span className="eyebrow">{isNew ? "Yeni iş" : "İş ayrıntıları"}</span>
            <h2>{isNew ? "Bir işi yakala" : "İşi düzenle"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Paneli kapat">
            <X size={19} />
          </button>
        </header>
        <div className="panel-body">
          <label className="field-label">
            İş başlığı
            <input
              autoFocus
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Ne yapılması gerekiyor?"
            />
          </label>
          <label className="field-label">
            Açıklama
            <textarea
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="Bağlamı ve beklenen sonucu yazın..."
              rows={4}
            />
          </label>
          {!isNew && (
            <label className="field-label">
              Sütun
              <select value={currentColumnId} onChange={(event) => onMove(event.target.value)}>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="field-grid">
            <label className="field-label">
              Öncelik
              <select
                value={draft.priority}
                onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}
              >
                {Object.entries(priorityNames).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Son tarih
              <input
                type="date"
                value={draft.dueDate ?? ""}
                onChange={(event) => setDraft({ ...draft, dueDate: event.target.value || undefined })}
              />
            </label>
          </div>
          <label className="field-label">
            Bekleme / engel nedeni
            <div className="input-with-icon">
              <CircleAlert size={16} />
              <input
                value={draft.waitingReason ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, waitingReason: event.target.value || undefined })
                }
                placeholder="Örn. müşteriden kritik bilgi bekleniyor"
              />
            </div>
          </label>
          <fieldset className="choice-fieldset">
            <legend>
              <Tag size={15} /> Etiketler
            </legend>
            <div className="choice-grid">
              {labels.map((label) => (
                <label className="choice-pill" key={label.id}>
                  <input
                    type="checkbox"
                    checked={draft.labelIds.includes(label.id)}
                    onChange={() => toggle("labelIds", label.id)}
                  />
                  <i style={{ background: label.color }} /> {label.name}
                </label>
              ))}
            </div>
            <div className="inline-create">
              <input
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="Yeni etiket..."
              />
              <button
                type="button"
                className="secondary-button"
                disabled={!newLabel.trim()}
                onClick={() => {
                  const id = onAddLabel(newLabel.trim(), "#7771c9");
                  setDraft((current) => ({ ...current, labelIds: [...current.labelIds, id] }));
                  setNewLabel("");
                }}
              >
                <Plus size={15} /> Ekle
              </button>
            </div>
          </fieldset>
          <fieldset className="choice-fieldset">
            <legend>
              <UserPlus size={15} /> Atanan kişiler
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
            <button className="danger-ghost" onClick={onDelete}>
              <Trash2 size={16} /> Sil
            </button>
          )}
          <div className="spacer" />
          <button className="secondary-button" onClick={onClose}>Vazgeç</button>
          <button
            className="primary-button"
            disabled={!draft.title.trim()}
            onClick={() => onSave({ ...draft, title: draft.title.trim(), updatedAt: new Date().toISOString() })}
          >
            Kaydet
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
  const [title, setTitle] = useState(column?.title ?? "");
  const [color, setColor] = useState(column?.color ?? columnColors[0]);
  const [role, setRole] = useState<BoardColumn["role"] | "">(column?.role ?? "");
  return (
    <Modal title={column ? "Sütunu düzenle" : "Yeni sütun"} onClose={onClose}>
      <label className="field-label">
        Sütun adı
        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Örn. İncelemede" />
      </label>
      <div className="field-label">
        Renk
        <div className="color-picker-row">
          {columnColors.map((value) => (
            <button
              key={value}
              className={color === value ? "selected" : ""}
              style={{ background: value }}
              onClick={() => setColor(value)}
              aria-label={`${value} rengini seç`}
            />
          ))}
        </div>
      </div>
      <label className="field-label">
        Akış anlamı
        <select value={role} onChange={(event) => setRole(event.target.value as BoardColumn["role"] | "")}>
          <option value="">Özel sütun</option>
          <option value="backlog">Önceliklendirilmemiş havuz</option>
          <option value="planned">Önceliklendirilmiş iş</option>
          <option value="active">Üzerinde çalışılan</option>
          <option value="done">Tamamlanan</option>
        </select>
        <small className="field-help">İlerleme grafikleri ve süre sayacı bu anlamı kullanır.</small>
      </label>
      <div className="modal-actions">
        {onDelete && (
          <button className="danger-ghost" onClick={onDelete}>
            <Trash2 size={16} /> Sütunu sil
          </button>
        )}
        <div className="spacer" />
        <button className="secondary-button" onClick={onClose}>Vazgeç</button>
        <button className="primary-button" disabled={!title.trim()} onClick={() => onSave(title.trim(), color, role || undefined)}>
          Kaydet
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
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  return (
    <Modal title="Board bilgileri" onClose={onClose}>
      <label className="field-label">
        Board adı
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field-label">
        Kısa açıklama
        <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="modal-actions">
        <div className="spacer" />
        <button className="secondary-button" onClick={onClose}>Vazgeç</button>
        <button className="primary-button" disabled={!title.trim()} onClick={() => onSave(title.trim(), description.trim())}>
          Kaydet
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
