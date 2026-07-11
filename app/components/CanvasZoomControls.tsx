"use client";

import { ZoomIn, ZoomOut } from "lucide-react";

interface CanvasZoomControlsProps {
  label: string;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  isMinZoom: boolean;
  isMaxZoom: boolean;
}

export function CanvasZoomControls({
  label,
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  isMinZoom,
  isMaxZoom,
}: CanvasZoomControlsProps) {
  return (
    <div className="canvas-zoom-controls" role="group" aria-label={`${label} yakınlaştırma araçları`}>
      <button
        className="icon-button"
        onClick={onZoomOut}
        disabled={isMinZoom}
        aria-label="Uzaklaştır"
        title="Uzaklaştır (Ctrl + -)"
      >
        <ZoomOut size={17} />
      </button>
      <button
        className="zoom-value"
        onClick={onReset}
        aria-label={`Yakınlaştırma yüzde ${Math.round(zoom * 100)}. Yüzde 100'e sıfırla`}
        title="Yüzde 100'e sıfırla (Ctrl + 0)"
      >
        %{Math.round(zoom * 100)}
      </button>
      <button
        className="icon-button"
        onClick={onZoomIn}
        disabled={isMaxZoom}
        aria-label="Yakınlaştır"
        title="Yakınlaştır (Ctrl + +)"
      >
        <ZoomIn size={17} />
      </button>
      <span className="zoom-hint">Ctrl + tekerlek</span>
    </div>
  );
}
