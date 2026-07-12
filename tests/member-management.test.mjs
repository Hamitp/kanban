import assert from "node:assert/strict";
import test from "node:test";

const { countMemberAssignments, removeMemberFromWorkspace } = await import(
  new URL("../app/memberManagement.ts", import.meta.url)
);

function workspace() {
  return {
    members: [
      { id: "member-a", name: "Ada", active: true },
      { id: "member-b", name: "Bora", active: false },
    ],
    boards: [
      {
        id: "board-1",
        updatedAt: "old",
        tasks: {
          one: { id: "one", assigneeIds: ["member-a", "member-b"], updatedAt: "old" },
          two: { id: "two", assigneeIds: ["member-a"], updatedAt: "old" },
          three: { id: "three", assigneeIds: [], updatedAt: "old" },
        },
      },
    ],
  };
}

test("member deletion counts and removes assignments without deleting tasks", () => {
  const original = workspace();
  assert.equal(countMemberAssignments(original, "member-a"), 2);

  const next = removeMemberFromWorkspace(original, "member-a", "changed");

  assert.deepEqual(next.members.map((member) => member.id), ["member-b"]);
  assert.deepEqual(Object.keys(next.boards[0].tasks), ["one", "two", "three"]);
  assert.deepEqual(next.boards[0].tasks.one.assigneeIds, ["member-b"]);
  assert.deepEqual(next.boards[0].tasks.two.assigneeIds, []);
  assert.equal(next.boards[0].tasks.one.updatedAt, "changed");
  assert.equal(next.boards[0].tasks.three.updatedAt, "old");
  assert.deepEqual(original.boards[0].tasks.one.assigneeIds, ["member-a", "member-b"]);
});

test("removing an unassigned member leaves board objects untouched", () => {
  const original = workspace();
  const next = removeMemberFromWorkspace(original, "missing", "changed");

  assert.equal(next.boards[0], original.boards[0]);
  assert.equal(countMemberAssignments(original, "missing"), 0);
});
