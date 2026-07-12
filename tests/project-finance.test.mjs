import assert from "node:assert/strict";
import test from "node:test";

const {
  getPortfolioFinance,
  getProjectFinanceTotals,
  getProjectStatus,
  parseMoneyToMinor,
  parseTryToKurus,
  transitionProjectStatus,
} = await import(new URL("../app/projectFinance.ts", import.meta.url));

const baseProject = {
  id: "project-1",
  name: "Müşteri projesi",
  description: "",
  color: "#6558c7",
  archived: false,
  createdAt: "2026-07-01T08:00:00.000Z",
  updatedAt: "2026-07-01T08:00:00.000Z",
};

test("legacy projects remain active without finance data", () => {
  assert.equal(getProjectStatus(baseProject), "active");
  assert.equal(getProjectFinanceTotals(baseProject).paymentState, "not-configured");
});

test("partial and final payments calculate receivable without floating point drift", () => {
  const project = {
    ...baseProject,
    finance: {
      currency: "TRY",
      agreedAmountKurus: 1_250_050,
      payments: [
        { id: "p1", amountKurus: 250_000, receivedOn: "2026-07-01", createdAt: "", updatedAt: "" },
        { id: "p2", amountKurus: 1_000_050, receivedOn: "2026-07-02", createdAt: "", updatedAt: "" },
      ],
    },
  };
  const totals = getProjectFinanceTotals(project);
  assert.equal(totals.collectedKurus, 1_250_050);
  assert.equal(totals.receivableKurus, 0);
  assert.equal(totals.paymentState, "paid");
});

test("portfolio separates active work, outstanding receivable, and collected cash", () => {
  const active = {
    ...baseProject,
    finance: {
      currency: "TRY",
      agreedAmountKurus: 2_000_000,
      payments: [{ id: "p1", amountKurus: 500_000, receivedOn: "2026-07-01", createdAt: "", updatedAt: "" }],
    },
  };
  const delivered = {
    ...baseProject,
    id: "project-2",
    status: "delivered",
    finance: {
      currency: "TRY",
      agreedAmountKurus: 1_000_000,
      payments: [{ id: "p2", amountKurus: 1_000_000, receivedOn: "2026-07-02", createdAt: "", updatedAt: "" }],
    },
  };
  const totals = getPortfolioFinance([active, delivered]);
  assert.deepEqual(totals.TRY, {
    activeWorkKurus: 2_000_000,
    receivableKurus: 1_500_000,
    collectedKurus: 1_500_000,
  });
  assert.equal(totals.USD.receivableKurus, 0);
});

test("portfolio never combines different currencies", () => {
  const tryProject = { ...baseProject, finance: { currency: "TRY", agreedAmountKurus: 1_000_000, payments: [] } };
  const usdProject = { ...baseProject, id: "project-usd", finance: { currency: "USD", agreedAmountKurus: 25_000, payments: [] } };
  const totals = getPortfolioFinance([tryProject, usdProject]);
  assert.equal(totals.TRY.activeWorkKurus, 1_000_000);
  assert.equal(totals.USD.activeWorkKurus, 25_000);
  assert.equal(totals.EUR.activeWorkKurus, 0);
});

test("status transitions maintain consistent milestone dates", () => {
  const completed = transitionProjectStatus(baseProject, "completed", "2026-07-03T09:00:00.000Z");
  const delivered = transitionProjectStatus(completed, "delivered", "2026-07-04T09:00:00.000Z");
  const reopened = transitionProjectStatus(delivered, "active", "2026-07-05T09:00:00.000Z");
  assert.equal(completed.completedAt, "2026-07-03T09:00:00.000Z");
  assert.equal(delivered.deliveredAt, "2026-07-04T09:00:00.000Z");
  assert.equal(reopened.completedAt, undefined);
  assert.equal(reopened.deliveredAt, undefined);
});

test("Turkish currency input parses to integer kurus", () => {
  assert.equal(parseTryToKurus("12.500,50 ₺"), 1_250_050);
  assert.equal(parseTryToKurus("12500.50"), 1_250_050);
  assert.equal(parseTryToKurus("-100"), null);
  assert.equal(parseTryToKurus("0"), null);
});

test("localized money input accepts comma and dot decimal conventions", () => {
  assert.equal(parseMoneyToMinor("12,500.50 USD"), 1_250_050);
  assert.equal(parseMoneyToMinor("12.500,50 EUR"), 1_250_050);
});
