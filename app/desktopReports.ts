import { invoke, isTauri } from "@tauri-apps/api/core";

export interface ReportExportResult {
  path: string;
  directory: string;
  filename: string;
  destination: "browser-download" | "desktop-exports";
}

export interface ReportWorkspaceIdentity {
  id: string;
  name: string;
}

export async function saveProblemReportPdf(
  bytes: Uint8Array,
  filename: string,
  workspace: ReportWorkspaceIdentity,
): Promise<ReportExportResult> {
  if (isTauri()) {
    return invoke<ReportExportResult>("save_problem_report", {
      filename,
      bytes: Array.from(bytes),
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    });
  }

  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { path: filename, directory: "", filename, destination: "browser-download" };
}

export async function openProblemReportFolder(workspace: ReportWorkspaceIdentity): Promise<void> {
  if (isTauri()) {
    await invoke("open_exports_folder", {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    });
  }
}
