import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";

const {
  createProblemReportPdf,
  problemReportEmptyText,
  problemReportFilename,
  problemReportFooterText,
  problemReportSeverityLabel,
  problemReportStatusLabel,
} = await import(new URL("../app/problemReports.ts", import.meta.url));

const fontRoot = new URL("../public/fonts/", import.meta.url);
const fonts = {
  regular: new Uint8Array(await readFile(new URL("Vera.ttf", fontRoot))),
  bold: new Uint8Array(await readFile(new URL("VeraBd.ttf", fontRoot))),
};

const stamp = "2026-07-13T09:00:00.000Z";
const input = {
  project: { id: "p1", name: "İskele Güçlendirme Projesi", description: "", color: "#6558c7", archived: false, createdAt: stamp, updatedAt: stamp },
  members: [{ id: "m1", name: "Çağrı Şen", initials: "ÇŞ", color: "#6558c7", active: true }],
  issue: {
    id: "i1", projectId: "p1", title: "Ölçüm sonuçlarında tekrarlayan sapma", description: "Saha ölçümleri beklenen toleransın dışında kalıyor.", impact: "Teslim tarihi ve kalite riski.",
    severity: "high", status: "investigating", assigneeIds: ["m1"], observedOn: "2026-07-10",
    evidence: [{ id: "e1", text: "Üç ölçümde aynı yönde sapma görüldü.", createdAt: stamp }],
    whys: Array.from({ length: 5 }, (_, index) => ({ id: `w${index}`, answer: `${index + 1}. neden açıklaması`, evidence: "Saha gözlemi", validated: index < 4 })),
    fishbone: ["İnsan", "Süreç", "Araç", "Bilgi", "Kaynak", "Dış etken"].map((name, index) => ({ id: `f${index}`, name, causes: [{ id: `c${index}`, text: "Kalibrasyon standardı eksik", evidence: "Kayıt", rootCause: index === 2 }] })),
    rootCause: "Kalibrasyon standardının uygulanmaması",
    actions: [{ id: "a1", title: "Kalibrasyon standardını yayınla", description: "Kontrol listesi oluştur", dueDate: "2026-07-20", assigneeIds: ["m1"], effortPoints: 13, createdAt: stamp, updatedAt: stamp }],
    a3: { background: "Müşteri kabul ölçümlerinde sapma oluştu.", currentState: "Ölçümlerin %20'si tolerans dışında.", targetState: "Tüm ölçümler tolerans içinde.", rootCauseSummary: "Standart eksik.", countermeasures: "Kontrol listesi ve eğitim.", implementationPlan: "Bir hafta içinde uygula.", verificationResult: "Yeni ölçümler izlenecek.", standardization: "Prosedüre ekle.", lessonsLearned: "Kalibrasyon kaydı zorunlu olmalı." },
    verificationEffective: false, verificationNote: "Yeni ölçüm bekleniyor.", followUpDate: "2026-07-22", createdAt: stamp, updatedAt: stamp,
  },
};

async function build(kind, language = "tr", colorMode = "color") {
  const bytes = await createProblemReportPdf(input, { kind, language, colorMode, generatedAt: new Date(stamp) }, fonts);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  return { bytes, document: await PDFDocument.load(bytes) };
}

test("A3 report is a single real A3 landscape page", async () => {
  const { document } = await build("a3");
  assert.equal(document.getPageCount(), 1);
  const { width, height } = document.getPage(0).getSize();
  assert.ok(Math.abs(width - 1190.55) < 0.1);
  assert.ok(Math.abs(height - 841.89) < 0.1);
});

test("visual methods and combined dossier create offline vector PDF pages", async () => {
  assert.equal((await build("five-whys", "en", "monochrome")).document.getPageCount(), 2);
  assert.equal((await build("fishbone")).document.getPageCount(), 2);
  assert.equal((await build("combined")).document.getPageCount(), 8);
});

test("combined dossier paginates every corrective action instead of losing overflow", async () => {
  const baseline = (await build("combined")).document.getPageCount();
  const originalActions = input.issue.actions;
  input.issue.actions = Array.from({ length: 9 }, (_, index) => ({
    ...originalActions[0],
    id: `overflow-action-${index}`,
    title: `Corrective action ${index + 1}`,
  }));
  try {
    const { document } = await build("combined");
    assert.ok(document.getPageCount() >= baseline + 2);
  } finally {
    input.issue.actions = originalActions;
  }
});

test("fishbone detail appendix expands to preserve large cause sets", async () => {
  const originalFishbone = input.issue.fishbone;
  input.issue.fishbone = [{
    id: "many-causes",
    name: "Detailed category",
    causes: Array.from({ length: 80 }, (_, index) => ({
      id: `cause-${index}`,
      text: `Complete cause description ${index + 1} that must remain available in the PDF appendix`,
      evidence: `Evidence record ${index + 1}`,
      rootCause: index === 79,
    })),
  }];
  try {
    const { document } = await build("fishbone");
    assert.ok(document.getPageCount() > 2);
  } finally {
    input.issue.fishbone = originalFishbone;
  }
});

test("report filenames stay stable and safe", () => {
  const filename = problemReportFilename(input, { kind: "combined", language: "tr", colorMode: "color" });
  assert.match(filename, /Sorun-Cozme-Dosyasi\.pdf$/);
  assert.doesNotMatch(filename, /[\\/:*?"<>|]/);
});

test("report metadata and fallback copy follow the selected output language", () => {
  assert.equal(problemReportStatusLabel("investigating", "tr"), "İnceleniyor");
  assert.equal(problemReportStatusLabel("investigating", "en"), "Investigating");
  assert.equal(problemReportSeverityLabel("high", "tr"), "Yüksek");
  assert.equal(problemReportSeverityLabel("high", "en"), "High");
  assert.equal(problemReportEmptyText("tr"), "Henüz içerik girilmedi");
  assert.equal(problemReportEmptyText("en"), "No content entered yet");
  assert.equal(problemReportFooterText("tr"), "Akış - çevrimdışı sorun çözme raporu");
  assert.equal(problemReportFooterText("en"), "Akış - offline problem-solving report");
});

test("report dialog traps keyboard focus and print CSS preserves mixed page formats", async () => {
  const [dialogSource, cssSource] = await Promise.all([
    readFile(new URL("../app/components/ProblemReportDialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(dialogSource, /event\.key === "Escape"/);
  assert.match(dialogSource, /previousFocus\?\.isConnected/);
  assert.match(dialogSource, /event\.key !== "Tab"/);
  assert.match(cssSource, /@page akis-report-a3 \{ size: A3 landscape;/);
  assert.match(cssSource, /@page akis-report-a4 \{ size: A4 portrait;/);
  assert.match(cssSource, /\.report-paper\.portrait-paper \{ page: akis-report-a4;/);
});
