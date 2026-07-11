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
import type { MindMap, MindNode } from "../types";
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
}

export function MindMapView({
  map,
  projectName,
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
}: MindMapViewProps) {
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
          <button className="icon-button" onClick={onBack} aria-label="Projeye dön">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="eyebrow">{projectName} / Zihin haritası</div>
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
              <button className="title-button" onClick={() => setEditingTitle(true)} aria-label="Zihin haritası adını düzenle">
                <h1>{map.title}</h1>
              </button>
            )}
            <p>{map.description}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={onDuplicate}><Copy size={16} /> Çoğalt</button>
          <button className="secondary-button" onClick={onArchive}><Archive size={16} /> Arşivle</button>
          <button className="primary-button" onClick={() => addChild(selected?.id)}>
            <GitBranch size={16} /> Alt fikir ekle
          </button>
        </div>
      </header>

      <div className="map-toolbar" role="toolbar" aria-label="Zihin haritası araçları">
        <button className="tool-button" onClick={() => addChild(selected?.id)} disabled={!selected}>
          <Plus size={16} /> Alt fikir
        </button>
        <button className="tool-button" onClick={() => addChild(selected?.parentId)} disabled={!selected?.parentId}>
          <GitBranch size={16} /> Kardeş fikir
        </button>
        <span className="toolbar-divider" />
        <CanvasZoomControls
          label="Zihin haritası"
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
          isMinZoom={isMinZoom}
          isMaxZoom={isMaxZoom}
        />
        <button className="tool-button" onClick={() => centerMap()}><Focus size={16} /> Merkezle</button>
        <button className="tool-button" onClick={fitMap}><Maximize2 size={16} /> Tümünü sığdır</button>
        <button className="tool-button" onClick={onAutoLayout}><LayoutGrid size={16} /> Otomatik düzen</button>
        <div className="spacer" />
        <button className={`tool-button ${outlineOpen ? "active" : ""}`} aria-pressed={outlineOpen} onClick={() => setOutlineOpen((value) => !value)}>
          <ListTree size={16} /> Anahat
        </button>
        <button className={`tool-button ${inspectorOpen ? "active" : ""}`} aria-pressed={inspectorOpen} onClick={() => setInspectorOpen((value) => !value)}>
          {inspectorOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />} Ayrıntılar
        </button>
      </div>

      <div className="map-workspace">
        {outlineOpen && (
          <aside className="map-outline" aria-label="Zihin haritası anahat görünümü">
            <header><ListTree size={17} /><strong>Anahat</strong><span>{map.nodes.length} fikir</span></header>
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

        <div className="map-scroll" ref={scrollRef} role="region" aria-label="Zihin haritası tuvali. Boş alanda sürükleyerek gezinebilirsiniz.">
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
                  aria-label={`${node.title}, ${!node.parentId ? "ana konu" : "fikir"}`}
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
                  <span className="mind-node-kicker">{!node.parentId ? "ANA KONU" : "FİKİR"}</span>
                  <strong>{node.title}</strong>
                  {node.note && <small>{node.note}</small>}
                </button>
              ))}
              <div className="canvas-hint"><Hand size={15} /> Boş alanda sürükleyerek gezinin · fikir kartlarını tutarak düzenleyin</div>
            </div>
          </div>
        </div>

        {selected && inspectorOpen && (
          <NodeInspector
            key={selected.id}
            node={selected}
            onCollapse={() => setInspectorOpen(false)}
            onUpdate={(patch) => onUpdateNode(selected.id, patch)}
            onDelete={() => {
              const childCount = map.nodes.filter((node) => node.parentId === selected.id).length;
              const message = childCount
                ? "Bu fikirle birlikte tüm alt dallar da silinecek. Devam edilsin mi?"
                : "Bu fikir silinsin mi?";
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

function NodeInspector({ node, onUpdate, onDelete, onCollapse }: { node: MindNode; onUpdate: (patch: Partial<MindNode>) => void; onDelete: () => void; onCollapse: () => void }) {
  const [title, setTitle] = useState(node.title);
  const [note, setNote] = useState(node.note);
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
    <aside className="node-inspector" aria-label="Fikir ayrıntıları">
      <header><div><span className="eyebrow">Seçili fikir</span><h3>Düşünceyi geliştir</h3></div><button className="icon-button" onClick={onCollapse} aria-label="Fikir ayrıntılarını daralt"><PanelRightClose size={17} /></button></header>
      <label className="field-label">
        Başlık
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (!title.trim()) setTitle(node.title);
          }}
          aria-invalid={!title.trim()}
        />
        {!title.trim() && <span className="field-error">Fikir başlığı boş bırakılamaz.</span>}
      </label>
      <label className="field-label">
        Not
        <textarea
          rows={5}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Bu fikrin bağlamı..."
        />
      </label>
      <div className="field-label">
        <span><Palette size={15} /> Renk</span>
        <div className="color-picker-row node-colors">
          {nodeColors.map((color) => (
            <button
              key={color}
              className={`${color} ${node.color === color ? "selected" : ""}`}
              onClick={() => onUpdate({ color })}
              aria-label={`${nodeColorNames[color]} rengini seç`}
              aria-pressed={node.color === color}
            />
          ))}
        </div>
      </div>
      {node.parentId && <button className="danger-ghost wide" onClick={onDelete}><Trash2 size={16} /> Bu dalı sil</button>}
      <div className="inspector-tip"><Minus size={14} /><span>İpucu: Fikir kartını sürükleyerek konumlandırın; boş alanı sürükleyerek haritada gezinin.</span></div>
    </aside>
  );
}
