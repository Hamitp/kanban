"use client";

import type { RefObject } from "react";
import { useEffect, useRef } from "react";

interface CanvasPanOptions {
  scrollRef: RefObject<HTMLDivElement | null>;
  canStartWithLeftButton: (target: EventTarget | null) => boolean;
}

export function useCanvasPan({ scrollRef, canStartWithLeftButton }: CanvasPanOptions) {
  const canStartRef = useRef(canStartWithLeftButton);

  useEffect(() => {
    canStartRef.current = canStartWithLeftButton;
  }, [canStartWithLeftButton]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let pan: {
      pointerId: number;
      startX: number;
      startY: number;
      scrollLeft: number;
      scrollTop: number;
    } | null = null;

    const stopPan = (event?: PointerEvent) => {
      if (!pan || (event && event.pointerId !== pan.pointerId)) return;
      if (container.hasPointerCapture(pan.pointerId)) {
        container.releasePointerCapture(pan.pointerId);
      }
      pan = null;
      container.classList.remove("is-panning");
    };

    const handlePointerDown = (event: PointerEvent) => {
      const isMiddleButton = event.button === 1;
      const isAllowedLeftButton = event.button === 0 && canStartRef.current(event.target);
      if (!isMiddleButton && !isAllowedLeftButton) return;
      event.preventDefault();
      pan = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
      container.setPointerCapture(event.pointerId);
      container.classList.add("is-panning");
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!pan || event.pointerId !== pan.pointerId) return;
      event.preventDefault();
      container.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
      container.scrollTop = pan.scrollTop - (event.clientY - pan.startY);
    };

    const handleAuxClick = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", stopPan);
    container.addEventListener("pointercancel", stopPan);
    container.addEventListener("lostpointercapture", stopPan);
    container.addEventListener("auxclick", handleAuxClick);
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", stopPan);
      container.removeEventListener("pointercancel", stopPan);
      container.removeEventListener("lostpointercapture", stopPan);
      container.removeEventListener("auxclick", handleAuxClick);
      container.classList.remove("is-panning");
    };
  }, [scrollRef]);
}
