"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CanvasZoomOptions {
  initialZoom?: number;
  minZoom: number;
  maxZoom: number;
  defaultZoom?: number;
  step?: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  onZoomChange: (zoom: number) => void;
}

interface ZoomAnchor {
  clientX?: number;
  clientY?: number;
}

export function clampZoom(value: number, minZoom: number, maxZoom: number) {
  const clamped = Math.min(maxZoom, Math.max(minZoom, value));
  return Math.round(clamped * 100) / 100;
}

export function useCanvasZoom({
  initialZoom = 1,
  minZoom,
  maxZoom,
  defaultZoom = 1,
  step = 0.1,
  scrollRef,
  onZoomChange,
}: CanvasZoomOptions) {
  const startingZoom = clampZoom(initialZoom, minZoom, maxZoom);
  const [zoom, setZoom] = useState(startingZoom);
  const zoomRef = useRef(startingZoom);
  const persistedZoomRef = useRef(startingZoom);
  const onZoomChangeRef = useRef(onZoomChange);
  const mountedRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const pendingScrollRef = useRef({ left: 0, top: 0 });

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      persistedZoomRef.current = zoom;
      onZoomChangeRef.current(zoom);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [zoom]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      if (zoomRef.current === persistedZoomRef.current) return;
      persistedZoomRef.current = zoomRef.current;
      onZoomChangeRef.current(zoomRef.current);
    },
    [],
  );

  const applyZoom = useCallback(
    (value: number, anchor: ZoomAnchor = {}) => {
      const previousZoom = zoomRef.current;
      const nextZoom = clampZoom(value, minZoom, maxZoom);
      if (nextZoom === previousZoom) return;

      const container = scrollRef.current;
      let contentX = 0;
      let contentY = 0;
      let pointerX = 0;
      let pointerY = 0;

      if (container) {
        const bounds = container.getBoundingClientRect();
        const styles = window.getComputedStyle(container);
        const insetX = container.clientLeft + Number.parseFloat(styles.paddingLeft || "0");
        const insetY = container.clientTop + Number.parseFloat(styles.paddingTop || "0");
        const virtualScrollLeft = scrollFrameRef.current === null
          ? container.scrollLeft
          : pendingScrollRef.current.left;
        const virtualScrollTop = scrollFrameRef.current === null
          ? container.scrollTop
          : pendingScrollRef.current.top;
        pointerX = anchor.clientX === undefined
          ? container.clientWidth / 2
          : anchor.clientX - bounds.left;
        pointerY = anchor.clientY === undefined
          ? container.clientHeight / 2
          : anchor.clientY - bounds.top;
        contentX = (virtualScrollLeft + pointerX - insetX) / previousZoom;
        contentY = (virtualScrollTop + pointerY - insetY) / previousZoom;
        pendingScrollRef.current = {
          left: Math.max(0, contentX * nextZoom + insetX - pointerX),
          top: Math.max(0, contentY * nextZoom + insetY - pointerY),
        };
      }

      zoomRef.current = nextZoom;
      setZoom(nextZoom);

      if (container) {
        if (scrollFrameRef.current === null) {
          scrollFrameRef.current = window.requestAnimationFrame(() => {
            scrollFrameRef.current = null;
            const currentContainer = scrollRef.current;
            if (!currentContainer) return;
            currentContainer.scrollLeft = pendingScrollRef.current.left;
            currentContainer.scrollTop = pendingScrollRef.current.top;
          });
        }
      }
    },
    [maxZoom, minZoom, scrollRef],
  );

  const zoomIn = useCallback(() => applyZoom(zoomRef.current + step), [applyZoom, step]);
  const zoomOut = useCallback(() => applyZoom(zoomRef.current - step), [applyZoom, step]);
  const resetZoom = useCallback(() => applyZoom(defaultZoom), [applyZoom, defaultZoom]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.deltaY === 0) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? step : -step;
      applyZoom(zoomRef.current + direction, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [applyZoom, scrollRef, step]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key === "0") {
        event.preventDefault();
        resetZoom();
        return;
      }
      if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") {
        event.preventDefault();
        zoomIn();
        return;
      }
      if (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract") {
        event.preventDefault();
        zoomOut();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetZoom, zoomIn, zoomOut]);

  return {
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    isMinZoom: zoom <= minZoom,
    isMaxZoom: zoom >= maxZoom,
  };
}
