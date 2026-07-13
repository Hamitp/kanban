import type { Project } from "./types";

export function resolveProblemProjectId(
  projects: Project[],
  requestedProjectId?: string,
): string {
  if (requestedProjectId && projects.some((project) => project.id === requestedProjectId)) {
    return requestedProjectId;
  }
  return projects[0]?.id ?? "";
}
