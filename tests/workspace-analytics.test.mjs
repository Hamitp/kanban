import assert from "node:assert/strict";
import test from "node:test";

const { getBoardFlowStats, getWeeklyThroughput } = await import(
  new URL("../app/workspaceAnalytics.ts", import.meta.url)
);

test("board progress uses planned, active, and done tasks consistently", () => {
  const board = {
    tasks: {
      backlog: { id: "backlog" },
      planned: { id: "planned" },
      active: { id: "active", waitingReason: "Müşteri" },
      done: { id: "done", waitingReason: "Eski not" },
    },
    columns: [
      { role: "backlog", taskIds: ["backlog"] },
      { role: "planned", taskIds: ["planned"] },
      { role: "active", taskIds: ["active"] },
      { role: "done", taskIds: ["done"] },
    ],
  };
  const stats = getBoardFlowStats(board);
  assert.equal(stats.committed, 3);
  assert.equal(stats.progress, 33);
  assert.equal(stats.waiting, 1);
});

test("weekly throughput places completed tasks in Monday buckets", () => {
  const tasks = [
    { task: { completedAt: "2026-07-08T10:00:00.000Z" } },
    { task: { completedAt: "2026-07-09T10:00:00.000Z" } },
  ];
  const buckets = getWeeklyThroughput(tasks, new Date("2026-07-12T12:00:00.000Z"), 2);
  assert.deepEqual(buckets.map((bucket) => bucket.count), [0, 2]);
});
