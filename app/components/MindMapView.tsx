"use client";

import {
  Archive,
  ArrowLeft,
  ChevronRight,
  Copy,
  Focus,
  GitBranch,
  Hand,
  LayoutGrid,
  ListTree,
  Maximize2,
  Minus,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { KanbanBoard, MindMap, MindNode } from "../types";
import { CanvasZoomControls } from "./CanvasZoomControls";
import { useCanvasPan } from "./useCanvasPan";
import { useCanvasZoom } from "./useCanvasZoom";

const nodeColors = ["violet", "coral", "sage", "blue", "amber"];
const nodeColorNames: Record<string, string> = {
  violet: "Eflatun",
  coral: "Mercan",
  sage: "Adaçayı",
  blue: "Mavi",
  amber: "Kehribar",
};
const nodeWidth = 202;
const nodeHeight = 78;

interface MindMapViewProps {
  map: MindMap;
  projectName: string;
  boards: KanbanBoard[];
  onBack: () => void;
  onRename: (title: string, description: string) => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onAddNode: (parentId?: string) => string;
  onUpdateNode: (nodeId: string, patch: Partial<MindNode>) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onAutoLayout: () => void;
  onZoomChange: (zoom: number) => void;
  onCreateTaskFromNode: (nodeId: string, boardId: string, columnId: string) => void;
  onOpenLinkedTask: (boardId: string, taskId: string) => void;
}

export function MindMapView({
  map,
  projectName,
  boards,
  onBack,
  onRename,
  onArchive,
  onDuplicate,
  onAddNode,
  onUpdateNode,
  onMoveNode,
  onDeleteNode,
  onAutoLayout,
  onZoomChange,
  onCreateTaskFromNode,
  onOpenLinkedTask,
}: MindMapViewProps) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [selectedId, setSelectedId] = useState(map.nodes[0]?.id);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    isMinZoom,
    isMaxZoom,
  } = useCanvasZoom({
    initialZoom: map.zoom ?? 1,
    minZoom: 0.5,
    maxZoom: 1.8,
    scrollRef,
    onZoomChange,
  });
  useCanvasPan({
    scrollRef,
    canStartWithLeftButton: (target) =>
      target instanceof Element &&
      !target.closest(".mind-node, button, input, textarea, select, a"),
  });
  const [drag, setDrag] = useState<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    x: number;
    y: number;
  } | null>(null);

  const selected = map.nodes.find((node) => node.id === selectedId) ?? map.nodes[0];
  const root = map.nodes.find((node) => !node.parentId);
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (!drag) return;
    const handleMove = (event: PointerEvent) => {
      setDrag((current) =>
        current
          ? {
              ...current,
              x: Math.max(30, current.originX + (event.clientX - current.startX) / zoom),
              y: Math.max(30, current.originY + (event.clientY - current.startY) / zoom),
            }
          : null,
      );
    };
    const handleUp = () => {
      setDrag((current) => {
        if (current) onMoveNode(current.id, Math.round(current.x), Math.round(current.y));
        return null;
      });
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
    window.addEventListener("pointercancel", handleUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [drag, onMoveNode, zoom]);

  const displayNodes = useMemo(
    () =>
      map.nodes.map((node) =>
        drag?.id === node.id ? { ...node, x: drag.x, y: drag.y } : node,
      ),
    [drag, map.nodes],
  );
  const canvasSize = useMemo(() => ({
    width: Math.max(1500, ...displayNodes.map((node) => node.x + nodeWidth + 300)),
    height: Math.max(900, ...displayNodes.map((node) => node.y + nodeHeight + 220)),
  }), [displayNodes]);

  const treeRows = useMemo(() => {
    if (!root) return [];
    const rows: Array<{ node: MindNode; depth: number }> = [];
    const visit = (node: MindNode, depth: number) => {
      rows.push({ node, depth });
      map.nodes.filter((child) => child.parentId === node.id).forEach((child) => visit(child, depth + 1));
    };
    visit(root, 0);
    return rows;
  }, [map.nodes, root]);

  const centerMap = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = scrollRef.current;
    if (!container || !root) return;
    container.scrollTo({
      left: Math.max(0, (root.x + nodeWidth / 2) * zoom - container.clientWidth / 2),
      top: Math.max(0, (root.y + nodeHeight / 2) * zoom - container.clientHeight / 2),
      behavior,
    });
  }, [root, scrollRef, zoom]);

  const fitMap = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !displayNodes.length) return;
    const minX = Math.min(...displayNodes.map((node) => node.x));
    const minY = Math.min(...displayNodes.map((node) => node.y));
    const maxX = Math.max(...displayNodes.map((node) => node.x + nodeWidth));
    const maxY = Math.max(...displayNodes.map((node) => node.y + nodeHeight));
    const nextZoom = Math.max(0.5, Math.min(1.4, Math.min(
      (container.clientWidth - 100) / Math.max(1, maxX - minX),
      (container.clientHeight - 100) / Math.max(1, maxY - minY),
    )));
    if (Math.abs(nextZoom - zoom) > 0.04) setZoom(nextZoom);
    window.requestAnimationFrame(() => {
      container.scrollTo({
        left: Math.max(0, minX * nextZoom - 50),
        top: Math.max(0, minY * nextZoom - 50),
        behavior: "smooth",
      });
    });
  }, [displayNodes, scrollRef, setZoom, zoom]);

  useEffect(() => {
    if (hasCenteredRef.current || !root) return;
    hasCenteredRef.current = true;
    const frame = window.requestAnimationFrame(() => centerMap("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [centerMap, root]);

  function addChild(parentId?: string) {
    const id = onAddNode(parentId);
    setSelectedId(id);
  }

  return (
    <div className="work-view mindmap-view">
      <header className="work-header map-header">
        <div className="work-heading">
          <button className="icon-button" onClick={onBack} aria-label={tr ? "Projeye dön" : "Back to project"}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="eyebrow">{projectName} / {tr ? "Zihin haritası" : "Mind map"}</div>
            {editingTitle ? (
              <input
                className="inline-title-input"
                autoFocus
                defaultValue={map.title}
                onBlur={(event) => {
                  onRename(event.target.value.trim() || map.title, map.description);
                  setEditingTitle(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            ) : (
              <button className="title-button" onClick={() => setEditingTitle(true)} aria-label={tr ? "Zihin haritası adını düzenle" : "Edit mind map name"}>
                <h1>{map.title}</h1>
              </button>
            )}
            <p>{map.description}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={onDuplicate}><Copy size={16} /> {tr ? "Çoğalt" : "Duplicate"}</button>
          <button className="secondary-button" onClick={onArchive}><Archive size={16} /> {tr ? "Arşivle" : "Archive"}</button>
          <button className="primary-button" onClick={() => addChild(selected?.id)}>
            <GitBranch size={16} /> {tr ? "Alt fikir ekle" : "Add child idea"}
          </button>
        </div>
      </header>

      <div className="map-toolbar" role="toolbar" aria-label={tr ? "Zihin haritası araçları" : "Mind map tools"}>
        <button className="tool-button" onClick={() => addChild(selected?.id)} disabled={!selected}>
          <Plus size={16} /> {tr ? "Alt fikir" : "Child idea"}
        </button>
        <button className="tool-button" onClick={() => addChild(selected?.parentId)} disabled={!selected?.parentId}>
          <GitBranch size={16} /> {tr ? "Kardeş fikir" : "Sibling idea"}
        </button>
        <span className="toolbar-divider" />
        <CanvasZoomControls
          label={tr ? "Zihin haritası" : "Mind map"}
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
          isMinZoom={isMinZoom}
          isMaxZoom={isMaxZoom}
        />
        <button className="tool-button" onClick={() => centerMap()}><Focus size={16} /> {tr ? "Merkezle" : "Center"}</button>
        <button className="tool-button" onClick={fitMap}><Maximize2 size={16} /> {tr ? "Tümünü sığdır" : "Fit all"}</button>
        <button className="tool-button" onClick={onAutoLayout}><LayoutGrid size={16} /> {tr ? "Otomatik düzen" : "Auto layout"}</button>
        <div className="spacer" />
        <button className={`tool-button ${outlineOpen ? "active" : ""}`} aria-pressed={outlineOpen} onClick={() => setOutlineOpen((value) => !value)}>
          <ListTree size={16} /> {tr ? "Anahat" : "Outline"}
        </button>
        <button className={`tool-button ${inspectorOpen ? "active" : ""}`} aria-pressed={inspectorOpen} onClick={() => setInspectorOpen((value) => !value)}>
          {inspectorOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />} {tr ? "Ayrıntılar" : "Details"}
        </button>
      </div>

      <div className="map-workspace">
        {outlineOpen && (
          <aside className="map-outline" aria-label={tr ? "Zihin haritası anahat görünümü" : "Mind map outline view"}>
            <header><ListTree size={17} /><strong>{tr ? "Anahat" : "Outline"}</strong><span>{map.nodes.length} {tr ? "fikir" : "ideas"}</span></header>
            <div className="outline-tree">
              {treeRows.map(({ node, depth }) => (
                <button
                  key={node.id}
                  className={node.id === selected?.id ? "active" : ""}
                  aria-current={node.id === selected?.id ? "true" : undefined}
                  style={{ paddingLeft: 12 + depth * 18 }}
                  onClick={() => setSelectedId(node.id)}
                >
                  {depth > 0 && <ChevronRight size={13} />}
                  <i className={`node-dot ${node.color}`} />
                  <span>{node.title}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        <div className="map-scroll" ref={scrollRef} role="region" aria-label={tr ? "Zihin haritası tuvali. Boş alanda sürükleyerek gezinebilirsiniz." : "Mind map canvas. Drag empty space to pan."}>
          <div className="map-canvas-grid" style={{ width: canvasSize.width * zoom, height: canvasSize.height * zoom }}>
            <div className="map-canvas" style={{ width: canvasSize.width, height: canvasSize.height, transform: `scale(${zoom})` }}>
              <svg className="map-edges" width={canvasSize.width} height={canvasSize.height} aria-hidden="true">
                {displayNodes
                  .filter((node) => node.parentId)
                  .map((node) => {
                    const parent = displayNodes.find((candidate) => candidate.id === node.parentId);
                    if (!parent) return null;
                    const fromX = parent.x + nodeWidth / 2;
                    const fromY = parent.y + nodeHeight / 2;
                    const toX = node.x + nodeWidth / 2;
                    const toY = node.y + nodeHeight / 2;
                    const bend = Math.max(50, Math.abs(toX - fromX) * 0.45);
                    const direction = toX >= fromX ? 1 : -1;
                    return (
                      <path
                        key={`${parent.id}-${node.id}`}
                        d={`M ${fromX} ${fromY} C ${fromX + bend * direction} ${fromY}, ${toX - bend * direction} ${toY}, ${toX} ${toY}`}
                        className={`map-edge ${node.color}`}
                      />
                    );
                  })}
              </svg>
              {displayNodes.map((node) => (
                <button
                  key={node.id}
                  className={`mind-node ${node.color} ${node.id === selected?.id ? "selected" : ""} ${!node.parentId ? "root" : ""}`}
                  aria-label={`${node.title}, ${!node.parentId ? tr ? "ana konu" : "main topic" : tr ? "fikir" : "idea"}`}
                  aria-pressed={node.id === selected?.id}
                  style={{ left: node.x, top: node.y }}
                  onClick={() => setSelectedId(node.id)}
                  onDoubleClick={() => setSelectedId(node.id)}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    setSelectedId(node.id);
                    setDrag({
                      id: node.id,
                      startX: event.clientX,
                      startY: event.clientY,
                      originX: node.x,
                      originY: node.y,
                      x: node.x,
                      y: node.y,
                    });
                  }}
                >
                  <span className="mind-node-kicker">{!node.parentId ? tr ? "ANA KONU" : "MAIN TOPIC" : tr ? "FİKİR" : "IDEA"}</span>
                  <strong>{node.title}</strong>
                  {node.note && <small>{node.note}</small>}
                </button>
              ))}
              <div className="canvas-hint"><Hand size={15} /> {tr ? "Boş alanda sürükleyerek gezinin · fikir kartlarını tutarak düzenleyin" : "Drag empty space to pan · drag idea cards to arrange"}</div>
            </div>
          </div>
        </div>

        {selected && inspectorOpen && (
          <NodeInspector
            key={selected.id}
            node={selected}
            boards={boards}
            onCollapse={() => setInspectorOpen(false)}
            onCreateTask={(boardId, columnId) => onCreateTaskFromNode(selected.id, boardId, columnId)}
            onOpenLinkedTask={onOpenLinkedTask}
            onUpdate={(patch) => onUpdateNode(selected.id, patch)}
            onDelete={() => {
              const childCount = map.nodes.filter((node) => node.parentId === selected.id).length;
              const message = childCount
                ? tr ? "Bu fikirle birlikte tüm alt dallar da silinecek. Devam edilsin mi?" : "This idea and all of its branches will be deleted. Continue?"
                : tr ? "Bu fikir silinsin mi?" : "Delete this idea?";
              if (!window.confirm(message)) return;
              onDeleteNode(selected.id);
              setSelectedId(selected.parentId ?? root?.id ?? "");
            }}
          />
        )}
      </div>
    </div>
  );
}

function NodeInspector({ node, boards, onUpdate, onDelete, onCollapse, onCreateTask, onOpenLinkedTask }: { node: MindNode; boards: KanbanBoard[]; onUpdate: (patch: Partial<MindNode>) => void; onDelete: () => void; onCollapse: () => void; onCreateTask: (boardId: string, columnId: string) => void; onOpenLinkedTask: (boardId: string, taskId: string) => void }) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [title, setTitle] = useState(node.title);
  const [note, setNote] = useState(node.note);
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");
  const targetBoard = boards.find((board) => board.id === boardId) ?? boards[0];
  const [columnId, setColumnId] = useState(targetBoard?.columns[0]?.id ?? "");
  const onUpdateRef = useRef(onUpdate);
  const draftRef = useRef({ title, note });
  const persistedRef = useRef({ title: node.title, note: node.note });
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);
  useEffect(() => {
    draftRef.current = { title, note };
    const timer = window.setTimeout(() => {
      const cleanTitle = title.trim();
      const cleanNote = note.trim();
      if (!cleanTitle) return;
      if (cleanTitle === persistedRef.current.title && cleanNote === persistedRef.current.note) return;
      persistedRef.current = { title: cleanTitle, note: cleanNote };
      onUpdateRef.current({ title: cleanTitle, note: cleanNote });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [note, title]);
  useEffect(() => () => {
    const cleanTitle = draftRef.current.title.trim();
    const cleanNote = draftRef.current.note.trim();
    if (!cleanTitle) return;
    if (cleanTitle === persistedRef.current.title && cleanNote === persistedRef.current.note) return;
    onUpdateRef.current({ title: cleanTitle, note: cleanNote });
  }, []);
  return (
    <aside className="node-inspector" aria-label={tr ? "Fikir ayrıntıları" : "Idea details"}>
      <header><div><span className="eyebrow">{tr ? "Seçili fikir" : "Selected idea"}</span><h3>{tr ? "Düşünceyi geliştir" : "Develop the idea"}</h3></div><button className="icon-button" onClick={onCollapse} aria-label={tr ? "Fikir ayrıntılarını daralt" : "Collapse idea details"}><PanelRightClose size={17} /></button></header>
      <label className="field-label">
        {tr ? "Başlık" : "Title"}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (!title.trim()) setTitle(node.title);
          }}
          aria-invalid={!title.trim()}
        />
        {!title.trim() && <span className="field-error">{tr ? "Fikir başlığı boş bırakılamaz." : "Idea title cannot be empty."}</span>}
      </label>
      <label className="field-label">
        {tr ? "Not" : "Note"}
        <textarea
          rows={5}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={tr ? "Bu fikrin bağlamı..." : "Context for this idea..."}
        />
      </label>
      <div className="field-label">
        <span><Palette size={15} /> {tr ? "Renk" : "Color"}</span>
        <div className="color-picker-row node-colors">
          {nodeColors.map((color) => (
            <button
              key={color}
              className={`${color} ${node.color === color ? "selected" : ""}`}
              onClick={() => onUpdate({ color })}
              aria-label={tr ? `${nodeColorNames[color]} rengini seç` : `Select ${color} color`}
              aria-pressed={node.color === color}
            />
          ))}
        </div>
      </div>
      <section className="idea-to-task">
        <span className="eyebrow">{tr ? "FİKİRDEN EYLEME" : "IDEA TO ACTION"}</span>
        {node.linkedTask ? (
          <><strong>{tr ? "Bu fikir bir Kanban görevine bağlı" : "This idea is linked to a Kanban task"}</strong><button className="secondary-button wide" onClick={() => onOpenLinkedTask(node.linkedTask!.boardId, node.linkedTask!.taskId)}><ListTree size={16} /> {tr ? "Bağlı görevi aç" : "Open linked task"}</button></>
        ) : boards.length ? (
          <><strong>{tr ? "Fikri görev olarak planla" : "Plan this idea as a task"}</strong><select value={targetBoard?.id ?? ""} onChange={(event) => { const next = boards.find((board) => board.id === event.target.value); setBoardId(event.target.value); setColumnId(next?.columns[0]?.id ?? ""); }}>{boards.map((board) => <option key={board.id} value={board.id}>{board.title}</option>)}</select><select value={columnId} onChange={(event) => setColumnId(event.target.value)}>{targetBoard?.columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</select><button className="primary-button wide" disabled={!targetBoard || !columnId} onClick={() => targetBoard && onCreateTask(targetBoard.id, columnId)}><Plus size={16} /> {tr ? "Kanban görevine dönüştür" : "Convert to Kanban task"}</button></>
        ) : <small>{tr ? "Önce bu projede bir Kanban panosu oluşturun." : "Create a Kanban board in this project first."}</small>}
      </section>
      {node.parentId && <button className="danger-ghost wide" onClick={onDelete}><Trash2 size={16} /> {tr ? "Bu dalı sil" : "Delete this branch"}</button>}
      <div className="inspector-tip"><Minus size={14} /><span>{tr ? "İpucu: Fikir kartını sürükleyerek konumlandırın; boş alanı sürükleyerek haritada gezinin." : "Tip: Drag idea cards to position them; drag empty space to pan around the map."}</span></div>
    </aside>
  );
}
