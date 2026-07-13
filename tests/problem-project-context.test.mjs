import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { resolveProblemProjectId } = await import(
  new URL("../app/problemContext.ts", import.meta.url)
);

const projects = [
  { id: "project-a" },
  { id: "project-b" },
];

test("problem quick capture honors a valid project context and falls back safely", () => {
  assert.equal(resolveProblemProjectId(projects, "project-b"), "project-b");
  assert.equal(resolveProblemProjectId(projects, "missing"), "project-a");
  assert.equal(resolveProblemProjectId([], "project-b"), "");
});

test("project problem navigation carries projectId into the quick capture screen", async () => {
  const root = new URL("../", import.meta.url);
  const [types, app, panels, problems] = await Promise.all([
    readFile(new URL("app/types.ts", root), "utf8"),
    readFile(new URL("app/AkisApp.tsx", root), "utf8"),
    readFile(new URL("app/components/DashboardPanels.tsx", root), "utf8"),
    readFile(new URL("app/components/ProblemSolvingScreen.tsx", root), "utf8"),
  ]);

  assert.match(types, /kind: "issues"; projectId\?: string/);
  assert.match(panels, /onNavigate\(\{ kind: "issues", projectId \}\)/);
  assert.match(app, /initialProjectId=\{screen\.projectId\}/);
  assert.match(problems, /resolveProblemProjectId\(projects, initialProjectId\)/);
});
