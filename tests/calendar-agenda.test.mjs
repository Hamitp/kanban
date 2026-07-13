import assert from "node:assert/strict";
import test from "node:test";

const {
  getCalendarAgendaEntries,
  getUpcomingAgendaEntries,
} = await import(new URL("../app/calendarAgenda.ts", import.meta.url));

const stamp = "2026-07-01T09:00:00.000Z";

function task(id, dueDate, overrides = {}) {
  return {
    id,
    title: id,
    dueDate,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}

function fixture() {
  return {
    projects: [
      { id: "p1", archived: false },
      { id: "archived-project", archived: true },
    ],
    boards: [
      {
        id: "b1",
        projectId: "p1",
        archived: false,
        columns: [
          { id: "planned", role: "planned", taskIds: ["today", "last-day", "outside", "completed"] },
          { id: "done", role: "done", taskIds: ["legacy-done"] },
        ],
        tasks: {
          today: task("today", "2026-07-13"),
          "last-day": task("last-day", "2026-07-19"),
          outside: task("outside", "2026-07-20"),
          completed: task("completed", "2026-07-14", { completedAt: "2026-07-12T09:00:00.000Z" }),
          "legacy-done": task("legacy-done", "2026-07-15"),
        },
      },
      {
        id: "archived-board",
        projectId: "p1",
        archived: true,
        columns: [{ id: "planned", role: "planned", taskIds: ["hidden-task"] }],
        tasks: { "hidden-task": task("hidden-task", "2026-07-13") },
      },
      {
        id: "hidden-project-board",
        projectId: "archived-project",
        archived: false,
        columns: [{ id: "planned", role: "planned", taskIds: ["hidden-project-task"] }],
        tasks: { "hidden-project-task": task("hidden-project-task", "2026-07-13") },
      },
    ],
    calendarEvents: [
      { id: "late", title: "Late meeting", date: "2026-07-13", startTime: "14:00", type: "meeting", note: "" },
      { id: "early", title: "Early meeting", date: "2026-07-13", startTime: "09:00", type: "meeting", note: "", projectId: "p1" },
      { id: "independent", title: "Independent", date: "2026-07-16", type: "note", note: "" },
      { id: "hidden-event", title: "Hidden", date: "2026-07-13", type: "planned", note: "", projectId: "archived-project" },
    ],
  };
}

test("calendar agenda combines visible events and unfinished task due dates", () => {
  const entries = getCalendarAgendaEntries(fixture());
  assert.equal(entries.some((entry) => entry.title === "completed"), false);
  assert.equal(entries.some((entry) => entry.title === "legacy-done"), false);
  assert.equal(entries.some((entry) => entry.title.startsWith("hidden")), false);
  assert.deepEqual(
    entries.filter((entry) => entry.date === "2026-07-13").map((entry) => entry.title),
    ["Early meeting", "Late meeting", "today"],
  );
});

test("next seven days includes today through day six and excludes day seven", () => {
  const entries = getUpcomingAgendaEntries(fixture(), {
    today: new Date(2026, 6, 13, 12),
    days: 7,
  });
  assert.equal(entries.some((entry) => entry.title === "today"), true);
  assert.equal(entries.some((entry) => entry.title === "last-day"), true);
  assert.equal(entries.some((entry) => entry.title === "outside"), false);
  assert.equal(entries.some((entry) => entry.title === "Independent"), true);
});

test("seven day window crosses month and year boundaries with local dates", () => {
  const data = {
    projects: [],
    boards: [],
    calendarEvents: [
      { id: "inside", title: "Inside", date: "2027-01-05", type: "planned", note: "" },
      { id: "outside", title: "Outside", date: "2027-01-06", type: "planned", note: "" },
    ],
  };
  assert.deepEqual(
    getUpcomingAgendaEntries(data, { today: new Date(2026, 11, 30, 23, 30), days: 7 }).map((entry) => entry.title),
    ["Inside"],
  );
});
