import type { AppData, CurrencyCode, Language, LocalWorkspace, WorkspaceStore } from "./types";

export const PERSONAL_WORKSPACE_NAME = "Kişisel Alanım";

export function createWorkspaceStoreFromLegacy(
  data: AppData,
  workspaceId = "workspace-personal",
  stamp = data.updatedAt,
): WorkspaceStore {
  const migratedData = { ...data, workspaceName: PERSONAL_WORKSPACE_NAME };
  return {
    version: 4,
    activeWorkspaceId: workspaceId,
    workspaces: [{
      id: workspaceId,
      name: PERSONAL_WORKSPACE_NAME,
      color: "#6558c7",
      archived: false,
      createdAt: stamp,
      updatedAt: stamp,
      data: migratedData,
    }],
    preferences: { defaultCurrency: "TRY", freshInstallation: false },
    updatedAt: stamp,
  };
}

export function createFreshWorkspaceStore(stamp = new Date().toISOString()): WorkspaceStore {
  const name = "Akış / Flow";
  const data: AppData = {
    version: 2,
    workspaceName: name,
    theme: "linen",
    projects: [],
    boards: [],
    mindMaps: [],
    members: [],
    labels: [],
    issues: [],
    calendarEvents: [],
    updatedAt: stamp,
  };
  return {
    version: 4,
    activeWorkspaceId: "workspace-personal",
    workspaces: [{
      id: "workspace-personal",
      name,
      color: "#6558c7",
      archived: false,
      createdAt: stamp,
      updatedAt: stamp,
      data,
    }],
    preferences: { defaultCurrency: "TRY", freshInstallation: true },
    updatedAt: stamp,
  };
}

export function setWorkspacePreferences(
  store: WorkspaceStore,
  patch: { language?: Language; defaultCurrency?: CurrencyCode; freshInstallation?: boolean },
  stamp: string,
): WorkspaceStore {
  return {
    ...store,
    preferences: { ...store.preferences, ...patch },
    updatedAt: stamp,
  };
}

export function createBlankWorkspace(
  id: string,
  name: string,
  color: string,
  source: Pick<AppData, "profileName" | "theme">,
  stamp: string,
): LocalWorkspace {
  return {
    id,
    name,
    color,
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
    data: {
      version: 2,
      workspaceName: name,
      profileName: source.profileName,
      theme: source.theme,
      projects: [],
      boards: [],
      mindMaps: [],
      members: [],
      labels: [],
      issues: [],
      calendarEvents: [],
      updatedAt: stamp,
    },
  };
}

export function getActiveWorkspace(store: WorkspaceStore): LocalWorkspace | null {
  return store.workspaces.find((workspace) => workspace.id === store.activeWorkspaceId && !workspace.archived) ?? null;
}

export function updateActiveWorkspaceData(
  store: WorkspaceStore,
  updater: (data: AppData) => AppData,
  stamp: string,
): WorkspaceStore {
  return {
    ...store,
    workspaces: store.workspaces.map((workspace) => {
      if (workspace.id !== store.activeWorkspaceId) return workspace;
      const updated = updater(workspace.data);
      return {
        ...workspace,
        updatedAt: stamp,
        data: { ...updated, workspaceName: workspace.name, updatedAt: stamp },
      };
    }),
    updatedAt: stamp,
  };
}

export function renameWorkspace(store: WorkspaceStore, workspaceId: string, name: string, stamp: string, color?: string): WorkspaceStore {
  return {
    ...store,
    workspaces: store.workspaces.map((workspace) => workspace.id === workspaceId
      ? { ...workspace, name, color: color ?? workspace.color, updatedAt: stamp, data: { ...workspace.data, workspaceName: name, updatedAt: stamp } }
      : workspace),
    updatedAt: stamp,
  };
}

export function switchWorkspace(store: WorkspaceStore, workspaceId: string, stamp: string): WorkspaceStore {
  const target = store.workspaces.find((workspace) => workspace.id === workspaceId && !workspace.archived);
  return target ? { ...store, activeWorkspaceId: workspaceId, updatedAt: stamp } : store;
}

export function archiveWorkspace(store: WorkspaceStore, workspaceId: string, stamp: string): WorkspaceStore {
  const active = store.workspaces.filter((workspace) => !workspace.archived);
  if (active.length <= 1 || !active.some((workspace) => workspace.id === workspaceId)) return store;
  const nextActiveId = store.activeWorkspaceId === workspaceId
    ? active.find((workspace) => workspace.id !== workspaceId)!.id
    : store.activeWorkspaceId;
  return {
    ...store,
    activeWorkspaceId: nextActiveId,
    workspaces: store.workspaces.map((workspace) => workspace.id === workspaceId
      ? { ...workspace, archived: true, updatedAt: stamp }
      : workspace),
    updatedAt: stamp,
  };
}

export function restoreWorkspace(store: WorkspaceStore, workspaceId: string, stamp: string): WorkspaceStore {
  return {
    ...store,
    workspaces: store.workspaces.map((workspace) => workspace.id === workspaceId
      ? { ...workspace, archived: false, updatedAt: stamp }
      : workspace),
    updatedAt: stamp,
  };
}

export function deleteArchivedWorkspace(store: WorkspaceStore, workspaceId: string, stamp: string): WorkspaceStore {
  const target = store.workspaces.find((workspace) => workspace.id === workspaceId);
  if (!target?.archived) return store;
  return {
    ...store,
    workspaces: store.workspaces.filter((workspace) => workspace.id !== workspaceId),
    updatedAt: stamp,
  };
}
