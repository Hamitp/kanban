import assert from "node:assert/strict";
import test from "node:test";

const {
  getOpenIssueSummary,
  getPortfolioOpenIssueSummary,
  getProjectOpenIssueSummary,
} = await import(new URL("../app/dashboardAnalytics.ts", import.meta.url));

const stamp = "2026-07-10T09:00:00.000Z";

function issue(id, projectId, overrides = {}) {
  return {
    id,
    projectId,
    title: id,
    severity: "medium",
    status: "open",
    updatedAt: stamp,
    ...overrides,
  };
}

function project(id, overrides = {}) {
  return {
    id,
    name: id,
    description: "",
    color: "#6558c7",
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}

test("open issue summary excludes closed records and orders actionable problems", () => {
  const input = [
    issue("medium-new", "active", { updatedAt: "2026-07-12T10:00:00.000Z" }),
    issue("high", "active", { severity: "high" }),
    issue("critical-current", "active", { severity: "critical", followUpDate: "2026-07-13" }),
    issue("critical-overdue", "active", { severity: "critical", followUpDate: "2026-07-12" }),
    issue("verifying", "active", { status: "verifying" }),
    issue("closed", "active", { severity: "critical", status: "closed" }),
  ];
  const originalOrder = input.map((item) => item.id);
  const summary = getOpenIssueSummary(input, new Date(2026, 6, 13, 12));

  assert.equal(summary.open, 5);
  assert.equal(summary.critical, 2);
  assert.equal(summary.high, 1);
  assert.equal(summary.verifying, 1);
  assert.equal(summary.overdueFollowUps, 1);
  assert.deepEqual(summary.items.map((item) => item.id), [
    "critical-overdue",
    "critical-current",
    "high",
    "medium-new",
    "verifying",
  ]);
  assert.deepEqual(input.map((item) => item.id), originalOrder);
});

test("portfolio problem summary only contains active non-archived projects", () => {
  const data = {
    projects: [
      project("active"),
      project("completed", { status: "completed" }),
      project("delivered", { status: "delivered" }),
      project("archived", { archived: true }),
    ],
    issues: [
      issue("active-issue", "active"),
      issue("completed-issue", "completed"),
      issue("delivered-issue", "delivered"),
      issue("archived-issue", "archived"),
    ],
  };

  assert.deepEqual(
    getPortfolioOpenIssueSummary(data).items.map((item) => item.id),
    ["active-issue"],
  );
  assert.deepEqual(
    getProjectOpenIssueSummary(data, "completed").items.map((item) => item.id),
    ["completed-issue"],
  );
});
