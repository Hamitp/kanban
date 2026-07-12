import assert from "node:assert/strict";
import test from "node:test";

const { createTranslator, currencyName, languageName } = await import(
  new URL("../app/i18n.ts", import.meta.url)
);
const { createSeedData } = await import(new URL("../app/seed.ts", import.meta.url));
const { getMonthlyCashflow } = await import(new URL("../app/workspaceAnalytics.ts", import.meta.url));

test("language helpers provide complete first-run labels", () => {
  const en = createTranslator("en");
  assert.equal(en("Genel Bakış"), "Overview");
  assert.equal(en("Ayarlar"), "Settings");
  assert.equal(languageName("tr", "en"), "Turkish");
  assert.equal(currencyName("GBP", "tr"), "İngiliz sterlini");
});

test("fresh seed content follows the selected language", () => {
  const english = createSeedData("en");
  const turkish = createSeedData("tr");
  assert.equal(english.boards[0].columns[0].title, "Backlog");
  assert.equal(turkish.boards[0].columns[0].title, "Toplam İş Listesi");
});

test("monthly cash flow keeps currencies in separate series", () => {
  const data = {
    projects: [
      { finance: { currency: "TRY", agreedAmountKurus: 100_000, payments: [{ amountKurus: 40_000, receivedOn: "2026-07-02" }] } },
      { finance: { currency: "USD", agreedAmountKurus: 20_000, payments: [{ amountKurus: 5_000, receivedOn: "2026-07-03" }] } },
    ],
  };
  const buckets = getMonthlyCashflow(data, new Date("2026-07-12T12:00:00.000Z"), 1, "en");
  assert.equal(buckets[0].amounts.TRY, 40_000);
  assert.equal(buckets[0].amounts.USD, 5_000);
});
