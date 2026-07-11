import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("canvas zoom clamps safely to the configured range", async () => {
  const { clampZoom } = await import(
    new URL("../app/components/useCanvasZoom.ts", import.meta.url)
  );

  assert.equal(clampZoom(0.2, 0.5, 1.8), 0.5);
  assert.equal(clampZoom(2.4, 0.5, 1.8), 1.8);
  assert.equal(clampZoom(1.299999, 0.5, 1.8), 1.3);
});

test("Kanban and mind map expose wheel, button, and keyboard zoom", async () => {
  const [board, mindMap, controls, hook, types, app] = await Promise.all([
    readFile(new URL("app/components/BoardView.tsx", root), "utf8"),
    readFile(new URL("app/components/MindMapView.tsx", root), "utf8"),
    readFile(new URL("app/components/CanvasZoomControls.tsx", root), "utf8"),
    readFile(new URL("app/components/useCanvasZoom.ts", root), "utf8"),
    readFile(new URL("app/types.ts", root), "utf8"),
    readFile(new URL("app/AkisApp.tsx", root), "utf8"),
  ]);

  assert.match(board, /className="kanban-scroll"[\s\S]*ref=\{scrollRef\}/);
  assert.match(mindMap, /className="map-scroll" ref=\{scrollRef\}/);
  assert.match(hook, /event\.ctrlKey/);
  assert.match(hook, /event\.metaKey/);
  assert.match(hook, /addEventListener\("wheel", handleWheel, \{ passive: false \}\)/);
  assert.match(hook, /event\.key === "0"/);
  assert.match(hook, /pendingScrollRef/);
  assert.match(hook, /contentX \* nextZoom \+ insetX - pointerX/);
  assert.match(controls, /Ctrl \+ tekerlek/);
  assert.match(controls, /onZoomIn/);
  assert.match(controls, /onZoomOut/);
  assert.match(types, /zoom\?: number/);
  assert.match(app, /onZoomChange=\{\(zoom\)/);
  assert.match(app, /false,/);
});
