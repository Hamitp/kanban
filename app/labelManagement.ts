import type { AppData } from "./types";

export function countLabelUsage(data: Pick<AppData, "boards">, labelId: string): number {
  return data.boards.reduce(
    (total, board) => total + Object.values(board.tasks).filter((task) => task.labelIds.includes(labelId)).length,
    0,
  );
}

export function removeLabelFromWorkspace(data: AppData, labelId: string, changedAt: string): AppData {
  return {
    ...data,
    labels: data.labels.filter((label) => label.id !== labelId),
    boards: data.boards.map((board) => {
      const hasUsage = Object.values(board.tasks).some((task) => task.labelIds.includes(labelId));
      if (!hasUsage) return board;

      const tasks = Object.fromEntries(
        Object.entries(board.tasks).map(([taskId, task]) => [
          taskId,
          task.labelIds.includes(labelId)
            ? {
                ...task,
                labelIds: task.labelIds.filter((taskLabelId) => taskLabelId !== labelId),
                updatedAt: changedAt,
              }
            : task,
        ]),
      ) as typeof board.tasks;

      return { ...board, tasks, updatedAt: changedAt };
    }),
  };
}
