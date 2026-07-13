import { localDateKey } from "./calendarAgenda.ts";
import { getProjectStatus } from "./projectFinance.ts";
import type { AppData, IssueSeverity, ProblemIssue } from "./types";

export interface OpenIssueSummary {
  open: number;
  critical: number;
  high: number;
  verifying: number;
  overdueFollowUps: number;
  items: ProblemIssue[];
}

const severityRank: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function getOpenIssueSummary(
  issues: ProblemIssue[],
  today = new Date(),
): OpenIssueSummary {
  const todayKey = localDateKey(today);
  const openItems = issues.filter((issue) => issue.status !== "closed");
  const isOverdue = (issue: ProblemIssue) => Boolean(
    issue.followUpDate && issue.followUpDate < todayKey,
  );
  const items = [...openItems].sort((left, right) =>
    severityRank[left.severity] - severityRank[right.severity]
      || Number(isOverdue(right)) - Number(isOverdue(left))
      || right.updatedAt.localeCompare(left.updatedAt),
  );

  return {
    open: openItems.length,
    critical: openItems.filter((issue) => issue.severity === "critical").length,
    high: openItems.filter((issue) => issue.severity === "high").length,
    verifying: openItems.filter((issue) => issue.status === "verifying").length,
    overdueFollowUps: openItems.filter(isOverdue).length,
    items,
  };
}

export function getProjectOpenIssueSummary(
  data: AppData,
  projectId: string,
  today = new Date(),
): OpenIssueSummary {
  return getOpenIssueSummary(
    data.issues.filter((issue) => issue.projectId === projectId),
    today,
  );
}

export function getPortfolioOpenIssueSummary(
  data: AppData,
  today = new Date(),
): OpenIssueSummary {
  const activeProjectIds = new Set(
    data.projects
      .filter((project) => !project.archived && getProjectStatus(project) === "active")
      .map((project) => project.id),
  );
  return getOpenIssueSummary(
    data.issues.filter((issue) => activeProjectIds.has(issue.projectId)),
    today,
  );
}
