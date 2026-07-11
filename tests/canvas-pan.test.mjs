import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("canvas pan supports empty-area left drag and middle-button drag", async () => {
  const [hook, board, map] = await Promise.all([
    readFile(new URL("app/components/useCanvasPan.ts", root), "utf8"),
    readFile(new URL("app/components/BoardView.tsx", root), "utf8"),
    readFile(new URL("app/components/MindMapView.tsx", root), "utf8"),
  ]);
  assert.match(hook, /event\.button === 1/);
  assert.match(hook, /event\.button === 0/);
  assert.match(hook, /setPointerCapture/);
  assert.match(hook, /scrollLeft - \(event\.clientX - pan\.startX\)/);
  assert.match(board, /useCanvasPan/);
  assert.match(map, /useCanvasPan/);
});
