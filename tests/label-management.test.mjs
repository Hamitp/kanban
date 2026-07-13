import assert from "node:assert/strict";
import test from "node:test";

const { countLabelUsage, removeLabelFromWorkspace } = await import(
  new URL("../app/labelManagement.ts", import.meta.url)
);

function workspace() {
  return {
    labels: [
      { id: "label-a", name: "Bekliyor", color: "#d88932" },
      { id: "label-b", name: "Tasarım", color: "#6d61d4" },
    ],
    boards: [
      {
        id: "board-1",
        updatedAt: "old",
        tasks: {
          one: { id: "one", labelIds: ["label-a", "label-b"], updatedAt: "old" },
          two: { id: "two", labelIds: ["label-a"], updatedAt: "old" },
          three: { id: "three", labelIds: [], updatedAt: "old" },
        },
      },
      {
        id: "board-2",
        updatedAt: "old",
        tasks: {
          four: { id: "four", labelIds: ["label-a"], updatedAt: "old" },
        },
      },
    ],
  };
}

test("label deletion counts usage and removes the label from every task", () => {
  const original = workspace();
  assert.equal(countLabelUsage(original, "label-a"), 3);

  const next = removeLabelFromWorkspace(original, "label-a", "changed");

  assert.deepEqual(next.labels.map((label) => label.id), ["label-b"]);
  assert.deepEqual(next.boards[0].tasks.one.labelIds, ["label-b"]);
  assert.deepEqual(next.boards[0].tasks.two.labelIds, []);
  assert.deepEqual(next.boards[1].tasks.four.labelIds, []);
  assert.equal(next.boards[0].tasks.one.updatedAt, "changed");
  assert.equal(next.boards[0].tasks.three.updatedAt, "old");
  assert.equal(next.boards[0].updatedAt, "changed");
  assert.deepEqual(original.boards[0].tasks.one.labelIds, ["label-a", "label-b"]);
});

test("removing a label preserves unrelated board objects", () => {
  const original = workspace();
  const next = removeLabelFromWorkspace(original, "label-b", "changed");

  assert.equal(countLabelUsage(original, "label-b"), 1);
  assert.equal(next.boards[1], original.boards[1]);
});

test("removing a missing label is safe", () => {
  const original = workspace();
  const next = removeLabelFromWorkspace(original, "missing", "changed");

  assert.equal(countLabelUsage(original, "missing"), 0);
  assert.deepEqual(next.labels, original.labels);
  assert.equal(next.boards[0], original.boards[0]);
  assert.equal(next.boards[1], original.boards[1]);
});
