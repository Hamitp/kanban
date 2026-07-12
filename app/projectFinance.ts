import type { CurrencyCode, Language, Project, ProjectStatus } from "./types";

export const currencyCodes: CurrencyCode[] = ["TRY", "USD", "EUR", "GBP"];

export type PaymentState = "not-configured" | "unpaid" | "partial" | "paid" | "overpaid";

export interface ProjectFinanceTotals {
  currency: CurrencyCode;
  agreedKurus: number;
  collectedKurus: number;
  receivableKurus: number;
  collectionRate: number;
  paymentState: PaymentState;
}

export interface PortfolioCurrencyTotals {
  activeWorkKurus: number;
  receivableKurus: number;
  collectedKurus: number;
}

export type PortfolioFinance = Record<CurrencyCode, PortfolioCurrencyTotals>;

const emptyCurrencyTotals = (): PortfolioCurrencyTotals => ({
  activeWorkKurus: 0,
  receivableKurus: 0,
  collectedKurus: 0,
});

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
    currency: project.finance?.currency ?? "TRY",
    agreedKurus,
    collectedKurus,
    receivableKurus,
    collectionRate,
    paymentState,
  };
}

export function getPortfolioFinance(projects: Project[]): PortfolioFinance {
  const totals: PortfolioFinance = {
    TRY: emptyCurrencyTotals(),
    USD: emptyCurrencyTotals(),
    EUR: emptyCurrencyTotals(),
    GBP: emptyCurrencyTotals(),
  };
  for (const project of projects) {
    const finance = getProjectFinanceTotals(project);
    const currencyTotals = totals[finance.currency];
    if (!project.archived && getProjectStatus(project) === "active") {
      currencyTotals.activeWorkKurus += finance.agreedKurus;
    }
    currencyTotals.receivableKurus += finance.receivableKurus;
    currencyTotals.collectedKurus += finance.collectedKurus;
  }
  return totals;
}

export function getPortfolioCurrencies(finance: PortfolioFinance, metric?: keyof PortfolioCurrencyTotals): CurrencyCode[] {
  const used = currencyCodes.filter((currency) => metric
    ? finance[currency][metric] > 0
    : Object.values(finance[currency]).some((value) => value > 0));
  return used.length ? used : ["TRY"];
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

export function parseMoneyToMinor(raw: string): number | null {
  const compact = raw
    .trim()
    .replace(/\s/g, "")
    .replace(/[₺$€£]|TRY|USD|EUR|GBP|TL/gi, "");
  if (!compact || compact.startsWith("-") || !/^[0-9.,]+$/.test(compact)) return null;

  const comma = compact.lastIndexOf(",");
  const dot = compact.lastIndexOf(".");
  let normalized = compact;
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? "," : ".";
    const groupSeparator = decimalSeparator === "," ? "." : ",";
    normalized = compact.split(groupSeparator).join("").replace(decimalSeparator, ".");
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? "," : ".";
    const occurrences = compact.split(separator).length - 1;
    const decimalLength = compact.length - compact.lastIndexOf(separator) - 1;
    normalized = occurrences > 1 || decimalLength === 3
      ? compact.split(separator).join("")
      : compact.replace(separator, ".");
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  language: Language,
  showMinor = false,
): string {
  return new Intl.NumberFormat(language === "tr" ? "tr-TR" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: showMinor ? 2 : 0,
    minimumFractionDigits: showMinor ? 2 : 0,
  }).format(minor / 100);
}

export function formatCompactMoney(minor: number, currency: CurrencyCode, language: Language): string {
  return new Intl.NumberFormat(language === "tr" ? "tr-TR" : "en-GB", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(minor / 100);
}

/** Backward-compatible aliases for portable backup consumers and older tests. */
export const parseTryToKurus = parseMoneyToMinor;
export const formatTryKurus = (kurus: number, showKurus = false) => formatMoney(kurus, "TRY", "tr", showKurus);
