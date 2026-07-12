import assert from "node:assert/strict";
import test from "node:test";

const {
  appendTaskTransition,
  createProblemIssue,
  getIssueInsights,
  getProjectBurnup,
  transitionIssueStatus,
} = await import(new URL("../app/v4Workflows.ts", import.meta.url));

const stamp = "2026-07-01T09:00:00.000Z";

function workspaceWithTasks() {
  return {
    version: 2,
    workspaceName: "Test",
    theme: "linen",
    projects: [{ id: "p1", name: "Proje", description: "", color: "#6558c7", archived: false, createdAt: stamp, updatedAt: stamp }],
    boards: [{
      id: "b1", kind: "board", projectId: "p1", title: "Pano", description: "", archived: false, createdAt: stamp, updatedAt: stamp,
      columns: [
        { id: "backlog", title: "Toplam", color: "#aaa", role: "backlog", taskIds: ["t0"] },
        { id: "planned", title: "Plan", color: "#55a", role: "planned", taskIds: ["t1"] },
        { id: "done", title: "Bitti", color: "#5a5", role: "done", taskIds: ["t2"] },
      ],
      tasks: {
        t0: { id: "t0", title: "Backlog", description: "", priority: "medium", effortPoints: 8, labelIds: [], assigneeIds: [], createdAt: stamp, updatedAt: stamp },
        t1: { id: "t1", title: "Plan", description: "", priority: "medium", effortPoints: 3, labelIds: [], assigneeIds: [], transitions: [{ id: "x1", toColumnId: "planned", toRole: "planned", occurredAt: "2026-07-02T09:00:00.000Z" }], createdAt: stamp, updatedAt: stamp },
        t2: { id: "t2", title: "Bitti", description: "", priority: "high", effortPoints: 5, labelIds: [], assigneeIds: [], transitions: [{ id: "x2", toColumnId: "planned", toRole: "planned", occurredAt: "2026-07-03T09:00:00.000Z" }, { id: "x3", fromColumnId: "planned", toColumnId: "done", fromRole: "planned", toRole: "done", occurredAt: "2026-07-05T09:00:00.000Z" }], completedAt: "2026-07-05T09:00:00.000Z", createdAt: stamp, updatedAt: stamp },
      },
    }],
    mindMaps: [], members: [], labels: [], issues: [], calendarEvents: [], updatedAt: stamp,
  };
}

test("task transitions append without losing previous history", () => {
  const task = workspaceWithTasks().boards[0].tasks.t1;
  const moved = appendTaskTransition(task, { fromColumnId: "planned", toColumnId: "done", fromRole: "planned", toRole: "done", occurredAt: "2026-07-08T10:00:00.000Z" }, "x4");
  assert.equal(moved.transitions.length, 2);
  assert.equal(moved.transitions[1].toRole, "done");
  assert.equal(moved.updatedAt, "2026-07-08T10:00:00.000Z");
});

test("burn-up excludes backlog and supports task and effort views", () => {
  const data = workspaceWithTasks();
  const taskView = getProjectBurnup(data, "p1", { today: new Date("2026-07-10T12:00:00.000Z"), language: "tr" });
  const pointView = getProjectBurnup(data, "p1", { today: new Date("2026-07-10T12:00:00.000Z"), mode: "points" });
  assert.deepEqual({ total: taskView.total, completed: taskView.completed, remaining: taskView.remaining }, { total: 2, completed: 1, remaining: 1 });
  assert.deepEqual({ total: pointView.total, completed: pointView.completed, remaining: pointView.remaining }, { total: 8, completed: 5, remaining: 3 });
});

test("a problem cannot close before effectiveness verification", () => {
  const issue = createProblemIssue("i1", "p1", "Tekrarlayan hata", stamp);
  assert.equal(transitionIssueStatus(issue, "closed", stamp), null);
  const verified = { ...issue, verificationEffective: true, rootCause: "Standart eksik" };
  const closed = transitionIssueStatus(verified, "closed", "2026-07-09T09:00:00.000Z");
  assert.equal(closed.status, "closed");
  assert.equal(getIssueInsights([closed]).rootCauses[0][0], "Standart eksik");
});
