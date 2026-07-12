import type { AppData } from "./types";

export function countMemberAssignments(data: Pick<AppData, "boards">, memberId: string): number {
  return data.boards.reduce(
    (total, board) => total + Object.values(board.tasks).filter((task) => task.assigneeIds.includes(memberId)).length,
    0,
  );
}

export function removeMemberFromWorkspace(data: AppData, memberId: string, changedAt: string): AppData {
  return {
    ...data,
    members: data.members.filter((member) => member.id !== memberId),
    boards: data.boards.map((board) => {
      const hasAssignments = Object.values(board.tasks).some((task) => task.assigneeIds.includes(memberId));
      if (!hasAssignments) return board;
      const tasks = Object.fromEntries(
        Object.entries(board.tasks).map(([taskId, task]) => [
          taskId,
          task.assigneeIds.includes(memberId)
            ? {
                ...task,
                assigneeIds: task.assigneeIds.filter((assigneeId) => assigneeId !== memberId),
                updatedAt: changedAt,
              }
            : task,
        ]),
      ) as typeof board.tasks;
      return { ...board, tasks, updatedAt: changedAt };
    }),
  };
}
