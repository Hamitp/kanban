"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { useI18n } from "../i18n";

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
  const { language } = useI18n();
  const isTr = language === "tr";
  return (
    <div className="canvas-zoom-controls" role="group" aria-label={isTr ? `${label} yakınlaştırma araçları` : `${label} zoom controls`}>
      <button
        className="icon-button"
        onClick={onZoomOut}
        disabled={isMinZoom}
        aria-label={isTr ? "Uzaklaştır" : "Zoom out"}
        title={isTr ? "Uzaklaştır (Ctrl + -)" : "Zoom out (Ctrl + -)"}
      >
        <ZoomOut size={17} />
      </button>
      <button
        className="zoom-value"
        onClick={onReset}
        aria-label={isTr ? `Yakınlaştırma yüzde ${Math.round(zoom * 100)}. Yüzde 100'e sıfırla` : `Zoom ${Math.round(zoom * 100)} percent. Reset to 100 percent`}
        title={isTr ? "Yüzde 100'e sıfırla (Ctrl + 0)" : "Reset to 100 percent (Ctrl + 0)"}
      >
        %{Math.round(zoom * 100)}
      </button>
      <button
        className="icon-button"
        onClick={onZoomIn}
        disabled={isMaxZoom}
        aria-label={isTr ? "Yakınlaştır" : "Zoom in"}
        title={isTr ? "Yakınlaştır (Ctrl + +)" : "Zoom in (Ctrl + +)"}
      >
        <ZoomIn size={17} />
      </button>
      <span className="zoom-hint">{isTr ? "Ctrl + tekerlek" : "Ctrl + wheel"}</span>
    </div>
  );
}
