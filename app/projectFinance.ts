import type { Project, ProjectStatus } from "./types";

export type PaymentState = "not-configured" | "unpaid" | "partial" | "paid" | "overpaid";

export interface ProjectFinanceTotals {
  agreedKurus: number;
  collectedKurus: number;
  receivableKurus: number;
  collectionRate: number;
  paymentState: PaymentState;
}

export function getProjectStatus(project: Project): ProjectStatus {
  return project.status ?? "active";
}

export function getProjectFinanceTotals(project: Project): ProjectFinanceTotals {
  const agreedKurus = Math.max(0, project.finance?.agreedAmountKurus ?? 0);
  const collectedKurus = Math.max(
    0,
    (project.finance?.payments ?? []).reduce(
      (sum, payment) => sum + Math.max(0, payment.amountKurus),
      0,
    ),
  );
  const receivableKurus = Math.max(0, agreedKurus - collectedKurus);
  const collectionRate = agreedKurus
    ? Math.min(100, Math.round((collectedKurus / agreedKurus) * 100))
    : 0;
  const paymentState: PaymentState = !project.finance
    ? "not-configured"
    : collectedKurus === 0
      ? "unpaid"
      : collectedKurus < agreedKurus
        ? "partial"
        : collectedKurus === agreedKurus
          ? "paid"
          : "overpaid";

  return {
    agreedKurus,
    collectedKurus,
    receivableKurus,
    collectionRate,
    paymentState,
  };
}

export function getPortfolioFinance(projects: Project[]) {
  return projects.reduce(
    (totals, project) => {
      const finance = getProjectFinanceTotals(project);
      if (!project.archived && getProjectStatus(project) === "active") {
        totals.activeWorkKurus += finance.agreedKurus;
      }
      totals.receivableKurus += finance.receivableKurus;
      totals.collectedKurus += finance.collectedKurus;
      return totals;
    },
    { activeWorkKurus: 0, receivableKurus: 0, collectedKurus: 0 },
  );
}

export function transitionProjectStatus(
  project: Project,
  status: ProjectStatus,
  changedAt = new Date().toISOString(),
): Project {
  if (status === "active") {
    return { ...project, status, completedAt: undefined, deliveredAt: undefined };
  }
  if (status === "completed") {
    return {
      ...project,
      status,
      completedAt: project.completedAt ?? changedAt,
      deliveredAt: undefined,
    };
  }
  return {
    ...project,
    status,
    completedAt: project.completedAt ?? changedAt,
    deliveredAt: project.deliveredAt ?? changedAt,
  };
}

export function parseTryToKurus(raw: string): number | null {
  const compact = raw
    .trim()
    .replace(/\s/g, "")
    .replace(/₺|TL/gi, "");
  if (!compact || compact.startsWith("-") || !/^[0-9.,]+$/.test(compact)) return null;

  let normalized = compact;
  if (compact.includes(",")) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else {
    const dotCount = (compact.match(/\./g) ?? []).length;
    const decimalLength = compact.includes(".") ? compact.length - compact.lastIndexOf(".") - 1 : 0;
    if (dotCount > 1 || decimalLength === 3) normalized = compact.replace(/\./g, "");
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const kurus = Math.round(amount * 100);
  return Number.isSafeInteger(kurus) ? kurus : null;
}

export function formatTryKurus(kurus: number, showKurus = false) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: showKurus ? 2 : 0,
    minimumFractionDigits: showKurus ? 2 : 0,
  }).format(kurus / 100);
}
