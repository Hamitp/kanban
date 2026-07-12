import assert from "node:assert/strict";
import test from "node:test";

const {
  archiveWorkspace,
  createBlankWorkspace,
  createWorkspaceStoreFromLegacy,
  deleteArchivedWorkspace,
  getActiveWorkspace,
  renameWorkspace,
  restoreWorkspace,
  switchWorkspace,
  updateActiveWorkspaceData,
} = await import(new URL("../app/workspaceManagement.ts", import.meta.url));
const { normalizeWorkspaceStore } = await import(new URL("../app/storage.ts", import.meta.url));
const { createProblemIssue } = await import(new URL("../app/v4Workflows.ts", import.meta.url));

function legacyData() {
  return {
    version: 1,
    workspaceName: "Eski Alan",
    profileName: "Hamit Parlak",
    theme: "linen",
    projects: [{ id: "project-1", name: "Özel Proje", description: "Gizli", color: "#123456", archived: false, finance: { currency: "TRY", agreedAmountKurus: 250000, payments: [] }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    boards: [{ id: "board-1", kind: "board", projectId: "project-1", title: "Özel Pano", description: "", columns: [{ id: "column-1", title: "İşler", color: "#123456", taskIds: ["task-1"] }], tasks: { "task-1": { id: "task-1", title: "Özel görev", description: "", priority: "medium", labelIds: [], assigneeIds: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } }, archived: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    mindMaps: [],
    members: [],
    labels: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("v1 data migrates losslessly into the named personal workspace", () => {
  const legacy = legacyData();
  const store = normalizeWorkspaceStore(legacy);

  assert.ok(store);
  assert.equal(store.version, 4);
  assert.deepEqual(store.preferences, { defaultCurrency: "TRY", freshInstallation: false });
  assert.equal(store.workspaces.length, 1);
  assert.equal(store.workspaces[0].name, "Kişisel Alanım");
  assert.equal(store.workspaces[0].data.workspaceName, "Kişisel Alanım");
  assert.equal(store.workspaces[0].data.projects[0].finance.agreedAmountKurus, 250000);
  assert.equal(store.workspaces[0].data.boards[0].tasks["task-1"].title, "Özel görev");
  assert.equal(store.workspaces[0].data.version, 2);
  assert.equal(store.workspaces[0].data.boards[0].tasks["task-1"].effortPoints, 1);
  assert.deepEqual(store.workspaces[0].data.issues, []);
  assert.deepEqual(store.workspaces[0].data.calendarEvents, []);
  assert.equal(legacy.workspaceName, "Eski Alan");
});

test("v2 workspace stores migrate to v4 without changing workspace content", () => {
  const stamp = "2026-04-01T00:00:00.000Z";
  const v3 = createWorkspaceStoreFromLegacy(legacyData(), "personal", stamp);
  const v2 = structuredClone(v3);
  delete v2.preferences;
  v2.version = 2;
  const migrated = normalizeWorkspaceStore(v2);
  assert.ok(migrated);
  assert.equal(migrated.version, 4);
  assert.equal(migrated.preferences.defaultCurrency, "TRY");
  assert.equal(migrated.preferences.language, undefined);
  assert.equal(migrated.workspaces[0].data.projects[0].name, "Özel Proje");
});

test("new workspaces are blank and stay isolated from personal data", () => {
  const stamp = "2026-02-01T00:00:00.000Z";
  const personal = createWorkspaceStoreFromLegacy(legacyData(), "personal", stamp);
  const work = createBlankWorkspace("work", "Şirket Projeleri", "#4f8da8", getActiveWorkspace(personal).data, stamp);
  let store = { ...personal, workspaces: [...personal.workspaces, work] };
  store = switchWorkspace(store, "work", stamp);
  store = updateActiveWorkspaceData(store, (data) => ({ ...data, projects: [{ id: "work-project" }] }), stamp);

  assert.equal(getActiveWorkspace(store).name, "Şirket Projeleri");
  assert.deepEqual(store.workspaces.find((item) => item.id === "personal").data.projects.map((project) => project.id), ["project-1"]);
  assert.deepEqual(store.workspaces.find((item) => item.id === "work").data.projects.map((project) => project.id), ["work-project"]);
  assert.deepEqual(work.data.boards, []);
  assert.deepEqual(work.data.members, []);
});

test("workspaces can be named, archived, restored, and only archived ones deleted", () => {
  const stamp = "2026-03-01T00:00:00.000Z";
  const personal = createWorkspaceStoreFromLegacy(legacyData(), "personal", stamp);
  const work = createBlankWorkspace("work", "İş", "#4f8da8", getActiveWorkspace(personal).data, stamp);
  let store = { ...personal, workspaces: [...personal.workspaces, work] };
  store = renameWorkspace(store, "work", "Denar Ekibi", stamp);
  store = switchWorkspace(store, "work", stamp);
  store = archiveWorkspace(store, "work", stamp);

  assert.equal(store.activeWorkspaceId, "personal");
  assert.equal(store.workspaces.find((item) => item.id === "work").archived, true);
  assert.equal(store.workspaces.find((item) => item.id === "work").name, "Denar Ekibi");

  store = restoreWorkspace(store, "work", stamp);
  assert.equal(store.workspaces.find((item) => item.id === "work").archived, false);
  assert.equal(deleteArchivedWorkspace(store, "work", stamp).workspaces.length, 2);
  store = archiveWorkspace(store, "work", stamp);
  store = deleteArchivedWorkspace(store, "work", stamp);
  assert.deepEqual(store.workspaces.map((item) => item.id), ["personal"]);
  assert.equal(archiveWorkspace(store, "personal", stamp), store);
});

test("migration removes broken task links without deleting analysis or ideas", () => {
  const stamp = "2026-07-12T12:00:00.000Z";
  const store = createWorkspaceStoreFromLegacy(legacyData(), "personal", stamp);
  const data = store.workspaces[0].data;
  const issue = createProblemIssue("issue-1", "project-1", "Bağlantı testi", stamp);
  issue.boardId = "board-1";
  issue.taskId = "missing-task";
  issue.actions = [{ id: "action-1", title: "Aksiyon", description: "", assigneeIds: [], effortPoints: 1, linkedTask: { boardId: "board-1", taskId: "missing-task", createdAt: stamp }, createdAt: stamp, updatedAt: stamp }];
  data.issues = [issue];
  data.mindMaps = [{ id: "map-1", kind: "mindmap", projectId: "project-1", title: "Harita", description: "", archived: false, createdAt: stamp, updatedAt: stamp, nodes: [{ id: "node-1", title: "Fikir", note: "", x: 0, y: 0, color: "violet", linkedTask: { boardId: "board-1", taskId: "missing-task", createdAt: stamp } }] }];

  const migrated = normalizeWorkspaceStore(store);
  assert.ok(migrated);
  assert.equal(migrated.workspaces[0].data.issues[0].title, "Bağlantı testi");
  assert.equal(migrated.workspaces[0].data.issues[0].taskId, undefined);
  assert.equal(migrated.workspaces[0].data.issues[0].actions[0].linkedTask, undefined);
  assert.equal(migrated.workspaces[0].data.mindMaps[0].nodes[0].linkedTask, undefined);
  assert.equal(migrated.workspaces[0].data.mindMaps[0].nodes[0].title, "Fikir");
});
