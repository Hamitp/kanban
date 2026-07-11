import assert from "node:assert/strict";
import test from "node:test";

const { formatTaskWorkDuration, getTaskWorkMs, transitionTaskTiming } = await import(
  new URL("../app/taskTiming.ts", import.meta.url)
);

const baseTask = {
  id: "task-1",
  title: "Süre testi",
  description: "",
  priority: "medium",
  labelIds: [],
  assigneeIds: [],
  createdAt: "2026-07-01T08:00:00.000Z",
  updatedAt: "2026-07-01T08:00:00.000Z",
};

test("active sessions count every complete 24-hour boundary consistently", () => {
  assert.equal(formatTaskWorkDuration(23 * 60 * 60 * 1000 + 59 * 60 * 1000), "23 sa 59 dk");
  assert.equal(formatTaskWorkDuration(24 * 60 * 60 * 1000), "1 gün");
  assert.equal(formatTaskWorkDuration(47 * 60 * 60 * 1000 + 59 * 60 * 1000), "1 gün 23 sa");
  assert.equal(formatTaskWorkDuration(48 * 60 * 60 * 1000), "2 gün");
});

test("work sessions pause, resume, and complete without losing elapsed time", () => {
  const started = transitionTaskTiming(baseTask, "planned", "active", "2026-07-01T08:00:00.000Z");
  const paused = transitionTaskTiming(started, "active", "planned", "2026-07-02T08:00:00.000Z");
  const resumed = transitionTaskTiming(paused, "planned", "active", "2026-07-03T08:00:00.000Z");
  const completed = transitionTaskTiming(resumed, "active", "done", "2026-07-04T20:00:00.000Z");
  assert.equal(getTaskWorkMs(completed), 60 * 60 * 60 * 1000);
  assert.equal(completed.completedAt, "2026-07-04T20:00:00.000Z");
  assert.equal(formatTaskWorkDuration(getTaskWorkMs(completed)), "2 gün 12 sa");
});
