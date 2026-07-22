import assert from "node:assert/strict";
import test from "node:test";

const {
  getBoardFlowStats,
  getLocatedTasks,
  getMemberWorkload,
  getWeeklyThroughput,
  sortMemberWorkload,
} = await import(
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

function workloadWorkspace() {
  const task = (id, assigneeIds, effortPoints) => ({
    id,
    title: id,
    description: "",
    priority: "low",
    effortPoints,
    labelIds: [],
    assigneeIds,
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-07-01T09:00:00.000Z",
  });
  const board = (id, projectId, tasks, columns, archived = false) => ({
    id,
    kind: "board",
    projectId,
    title: id,
    description: "",
    tasks,
    columns,
    archived,
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-07-01T09:00:00.000Z",
  });
  return {
    members: [
      { id: "ada", name: "Ada", initials: "AA", color: "#6558c7", active: true },
      { id: "bora", name: "Bora", initials: "BB", color: "#4f9b79", active: true },
      { id: "cem", name: "Cem", initials: "CC", color: "#ca5d65", active: false },
      { id: "deniz", name: "Deniz", initials: "DD", color: "#5d9cec", active: true },
    ],
    projects: [
      { id: "active", name: "Aktif", status: "active", archived: false },
      { id: "completed", name: "Biten", status: "completed", archived: false },
      { id: "delivered", name: "Teslim", status: "delivered", archived: false },
      { id: "archived", name: "Arşiv", status: "active", archived: true },
    ],
    boards: [
      board("active-board", "active", {
        backlog: task("backlog", ["ada"], 2),
        planned: task("planned", ["ada"], 3),
        "active-task": task("active-task", ["ada", "bora", "cem"], 8),
        missing: task("missing", ["bora"], undefined),
        invalid: task("invalid", ["bora"], 21),
        done: task("done", ["ada"], 13),
      }, [
        { id: "backlog-column", title: "Toplam", role: "backlog", taskIds: ["backlog", "missing"] },
        { id: "planned-column", title: "Plan", role: "planned", taskIds: ["planned", "invalid"] },
        { id: "active-column", title: "Aktif", role: "active", taskIds: ["active-task"] },
        { id: "done-column", title: "Bitti", role: "done", taskIds: ["done"] },
      ]),
      board("completed-board", "completed", { task: task("completed-task", ["ada"], 13) }, [{ id: "c", title: "Aktif", role: "active", taskIds: ["task"] }]),
      board("delivered-board", "delivered", { task: task("delivered-task", ["ada"], 13) }, [{ id: "d", title: "Aktif", role: "active", taskIds: ["task"] }]),
      board("archived-project-board", "archived", { task: task("archived-project-task", ["ada"], 13) }, [{ id: "a", title: "Aktif", role: "active", taskIds: ["task"] }]),
      board("archived-board", "active", { task: task("archived-board-task", ["ada"], 13) }, [{ id: "ab", title: "Aktif", role: "active", taskIds: ["task"] }], true),
    ],
  };
}

test("member workload includes every unfinished task in active projects", () => {
  const data = workloadWorkspace();
  const workload = getMemberWorkload(data, getLocatedTasks(data));

  assert.deepEqual(workload.map(({ member, count, effortPoints }) => ({
    member: member.id,
    count,
    effortPoints,
  })), [
    { member: "ada", count: 3, effortPoints: 13 },
    { member: "bora", count: 3, effortPoints: 10 },
    { member: "deniz", count: 0, effortPoints: 0 },
  ]);
});

test("workload sorting follows the selected metric without mutating data", () => {
  const input = [
    { member: { id: "easy", name: "Ada" }, count: 5, effortPoints: 5 },
    { member: { id: "hard", name: "Bora" }, count: 1, effortPoints: 13 },
  ];

  assert.deepEqual(sortMemberWorkload(input, "tasks").map((item) => item.member.id), ["easy", "hard"]);
  assert.deepEqual(sortMemberWorkload(input, "points").map((item) => item.member.id), ["hard", "easy"]);
  assert.deepEqual(input.map((item) => item.member.id), ["easy", "hard"]);
});
