"use client";

import {
  Archive,
  ArrowLeft,
  ChevronRight,
  Copy,
  Focus,
  GitBranch,
  LayoutGrid,
  ListTree,
  Maximize2,
  Minus,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MindMap, MindNode } from "../types";

const nodeColors = ["violet", "coral", "sage", "blue", "amber"];

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
}: MindMapViewProps) {
  const [selectedId, setSelectedId] = useState(map.nodes[0]?.id);
  const [zoom, setZoom] = useState(0.9);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
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
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [drag, onMoveNode, zoom]);

  const displayNodes = useMemo(
    () =>
      map.nodes.map((node) =>
        drag?.id === node.id ? { ...node, x: drag.x, y: drag.y } : node,
      ),
    [drag, map.nodes],
  );

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

  function centerMap() {
    const container = scrollRef.current;
    if (!container || !root) return;
    container.scrollTo({
      left: Math.max(0, root.x * zoom - container.clientWidth / 2 + 90),
      top: Math.max(0, root.y * zoom - container.clientHeight / 2 + 40),
      behavior: "smooth",
    });
  }

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
            <div className="eyebrow">{projectName} / Mind Map</div>
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
              <button className="title-button" onClick={() => setEditingTitle(true)}>
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

      <div className="map-toolbar" aria-label="Mind map araçları">
        <button className="tool-button" onClick={() => addChild(selected?.id)} disabled={!selected}>
          <Plus size={16} /> Alt fikir
        </button>
        <button className="tool-button" onClick={() => addChild(selected?.parentId)} disabled={!selected?.parentId}>
          <GitBranch size={16} /> Kardeş fikir
        </button>
        <span className="toolbar-divider" />
        <button className="icon-button" onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))} aria-label="Uzaklaştır">
          <ZoomOut size={17} />
        </button>
        <span className="zoom-value">%{Math.round(zoom * 100)}</span>
        <button className="icon-button" onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))} aria-label="Yakınlaştır">
          <ZoomIn size={17} />
        </button>
        <button className="tool-button" onClick={centerMap}><Focus size={16} /> Merkezle</button>
        <button className="tool-button" onClick={onAutoLayout}><LayoutGrid size={16} /> Otomatik düzen</button>
        <div className="spacer" />
        <button className={`tool-button ${outlineOpen ? "active" : ""}`} onClick={() => setOutlineOpen((value) => !value)}>
          <ListTree size={16} /> Anahat
        </button>
      </div>

      <div className="map-workspace">
        {outlineOpen && (
          <aside className="map-outline" aria-label="Mind map anahat görünümü">
            <header><ListTree size={17} /><strong>Anahat</strong><span>{map.nodes.length} fikir</span></header>
            <div className="outline-tree">
              {treeRows.map(({ node, depth }) => (
                <button
                  key={node.id}
                  className={node.id === selected?.id ? "active" : ""}
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

        <div className="map-scroll" ref={scrollRef}>
          <div className="map-canvas-grid" style={{ width: 1500 * zoom, height: 900 * zoom }}>
            <div className="map-canvas" style={{ transform: `scale(${zoom})` }}>
              <svg className="map-edges" width="1500" height="900" aria-hidden="true">
                {displayNodes
                  .filter((node) => node.parentId)
                  .map((node) => {
                    const parent = displayNodes.find((candidate) => candidate.id === node.parentId);
                    if (!parent) return null;
                    const fromX = parent.x + 92;
                    const fromY = parent.y + 35;
                    const toX = node.x + 92;
                    const toY = node.y + 35;
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
              <div className="canvas-hint"><Sparkles size={15} /> Fikirleri sürükleyerek düzenleyebilirsiniz</div>
            </div>
          </div>
        </div>

        {selected && (
          <NodeInspector
            key={selected.id}
            node={selected}
            onUpdate={(patch) => onUpdateNode(selected.id, patch)}
            onDelete={() => {
              const childCount = map.nodes.filter((node) => node.parentId === selected.id).length;
              if (childCount && !window.confirm("Bu fikirle birlikte tüm alt dallar da silinecek. Devam edilsin mi?")) return;
              onDeleteNode(selected.id);
              setSelectedId(selected.parentId ?? root?.id);
            }}
          />
        )}
      </div>
    </div>
  );
}

function NodeInspector({ node, onUpdate, onDelete }: { node: MindNode; onUpdate: (patch: Partial<MindNode>) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(node.title);
  const [note, setNote] = useState(node.note);
  return (
    <aside className="node-inspector" aria-label="Fikir ayrıntıları">
      <header><div><span className="eyebrow">Seçili fikir</span><h3>Düşünceyi geliştir</h3></div><Maximize2 size={17} /></header>
      <label className="field-label">
        Başlık
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => title.trim() && onUpdate({ title: title.trim() })}
        />
      </label>
      <label className="field-label">
        Not
        <textarea
          rows={5}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => onUpdate({ note: note.trim() })}
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
              aria-label={`${color} rengini seç`}
            />
          ))}
        </div>
      </div>
      {node.parentId && <button className="danger-ghost wide" onClick={onDelete}><Trash2 size={16} /> Bu dalı sil</button>}
      <div className="inspector-tip"><Minus size={14} /><span>İpucu: Tuvalde sürükleyerek konumlandırın.</span></div>
    </aside>
  );
}

