import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Akış application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="tr"/i);
  assert.match(html, /<title>Akış — Yerel Kanban ve Mind Map<\/title>/i);
  assert.match(html, /Akış hazırlanıyor/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships local-first persistence, offline shell, analytics, and task timing", async () => {
  const [app, storage, types, manifest, serviceWorker, packageJson] = await Promise.all([
    readFile(new URL("../app/AkisApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(storage, /indexedDB\.open/);
  assert.match(storage, /saveWorkspace/);
  assert.match(types, /workSessions/);
  assert.match(types, /completedAt/);
  assert.match(app, /PORTFÖY SAĞLIĞI/);
  assert.match(app, /Ortalama çevrim/);
  assert.match(app, /navigator\.storage/);
  assert.match(serviceWorker, /caches\.open/);
  assert.match(manifest, /"display": "standalone"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

test("starts, closes, and resumes task work sessions across semantic columns", async () => {
  const { getTaskWorkDays, getTaskWorkMs, transitionTaskTiming } = await import(
    new URL("../app/taskTiming.ts", import.meta.url)
  );
  const start = "2026-07-01T08:00:00.000Z";
  const finish = "2026-07-03T09:00:00.000Z";
  const baseTask = {
    id: "task-1",
    title: "Süre testi",
    description: "",
    priority: "medium",
    labelIds: [],
    assigneeIds: [],
    createdAt: start,
    updatedAt: start,
  };

  const active = transitionTaskTiming(baseTask, "planned", "active", start);
  assert.deepEqual(active.workSessions, [{ startedAt: start }]);
  assert.equal(getTaskWorkMs(active, new Date(finish).getTime()), 49 * 60 * 60 * 1000);
  assert.equal(getTaskWorkDays(active, new Date(finish).getTime()), 3);

  const complete = transitionTaskTiming(active, "active", "done", finish);
  assert.equal(complete.completedAt, finish);
  assert.equal(complete.workSessions.at(-1).endedAt, finish);

  const resumed = transitionTaskTiming(complete, "done", "active", "2026-07-04T08:00:00.000Z");
  assert.equal(resumed.completedAt, undefined);
  assert.equal(resumed.workSessions.length, 2);
  assert.equal(resumed.workSessions.at(-1).endedAt, undefined);
});
