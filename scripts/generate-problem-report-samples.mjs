import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createProblemReportPdf } from "../app/problemReports.ts";

const root = new URL("../", import.meta.url);
const output = new URL("../tmp/pdfs/", import.meta.url);
await mkdir(output, { recursive: true });
const fonts = {
  regular: new Uint8Array(await readFile(new URL("../public/fonts/Vera.ttf", import.meta.url))),
  bold: new Uint8Array(await readFile(new URL("../public/fonts/VeraBd.ttf", import.meta.url))),
};
const stamp = "2026-07-13T09:00:00.000Z";
const categories = ["İnsan", "Süreç", "Araç", "Bilgi", "Kaynak", "Dış etken"];
const input = {
  project: { id: "p1", name: "Karadeniz Ereğli Deniz Üssü Yeni İskele Projesi", description: "", color: "#6558c7", archived: false, createdAt: stamp, updatedAt: stamp },
  members: [{ id: "m1", name: "Çağrı Şen", initials: "ÇŞ", color: "#6558c7", active: true }],
  issue: {
    id: "i1", projectId: "p1", title: "Ölçüm sonuçlarında tekrarlayan sapma", description: "Saha ölçümleri beklenen toleransın dışında kalıyor.", impact: "Teslim tarihi ve kalite riski oluşuyor.", severity: "high", status: "investigating", assigneeIds: ["m1"], observedOn: "2026-07-10",
    evidence: [{ id: "e1", text: "Üç ölçümde aynı yönde sapma görüldü.", createdAt: stamp }, { id: "e2", text: "Cihaz kalibrasyon kaydı güncel değil.", createdAt: stamp }],
    whys: ["Ölçüm cihazı doğru referanslanmadı", "Kalibrasyon kontrolü tamamlanmadı", "Kontrol listesinde zorunlu adım yok", "Prosedür güncel iş akışını kapsamıyor", "Standart sahipliği tanımlanmamış"].map((answer, index) => ({ id: `w${index}`, answer, evidence: index < 3 ? "Saha kaydı ile doğrulandı" : "Ekip görüşmesi", validated: index < 4 })),
    fishbone: categories.map((name, index) => ({ id: `f${index}`, name, causes: [{ id: `c${index}a`, text: ["Eğitim eksik", "Kontrol adımı yok", "Kalibrasyon gecikmiş", "Güncel çizim yok", "Zaman baskısı", "Hava koşulları"][index], evidence: "Gözlem kaydı", rootCause: index === 1 }, { id: `c${index}b`, text: "İkinci olası neden", evidence: "Ekip görüşü", rootCause: false }] })),
    rootCause: "Kalibrasyon standardının süreç sahibi ve zorunlu kontrol adımı olmaması",
    actions: [{ id: "a1", title: "Kalibrasyon kontrol listesini yayınla", description: "Saha başlangıç kontrolüne zorunlu adım ekle", dueDate: "2026-07-20", assigneeIds: ["m1"], effortPoints: 13, createdAt: stamp, updatedAt: stamp }],
    a3: { background: "Müşteri kabul ölçümlerinde sapma oluştu.", currentState: "Ölçümlerin yüzde 20'si tolerans dışında.", targetState: "Tüm ölçümler kabul toleransı içinde.", rootCauseSummary: "Kalibrasyon standardı ve süreç sahipliği eksik.", countermeasures: "Kontrol listesi, sorumlu ataması ve kısa saha eğitimi.", implementationPlan: "Kontrol listesini bir hafta içinde yayınla ve ilk üç ölçümde denetle.", verificationResult: "Yeni ölçümlerin tolerans içinde olduğu doğrulanacak.", standardization: "Prosedür ve işe başlama kontrolüne kalıcı olarak eklenecek.", lessonsLearned: "Kalibrasyon kaydı işe başlamadan önce görünür olmalı." },
    verificationEffective: false, verificationNote: "Yeni ölçüm serisi bekleniyor.", followUpDate: "2026-07-22", createdAt: stamp, updatedAt: stamp,
  },
};

for (const [kind, language, colorMode] of [["a3", "tr", "color"], ["fishbone", "tr", "monochrome"], ["five-whys", "en", "color"], ["combined", "tr", "color"]]) {
  const bytes = await createProblemReportPdf(input, { kind, language, colorMode, generatedAt: new Date(stamp) }, fonts);
  await writeFile(new URL(`sample-${kind}-${language}-${colorMode}.pdf`, output), bytes);
}

process.stdout.write(`Problem report samples generated under ${new URL("tmp/pdfs/", root).pathname}\n`);
