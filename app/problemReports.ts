import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { IssueSeverity, IssueStatus, Language, Member, ProblemIssue, Project } from "./types";

export type ProblemReportKind = "a3" | "fishbone" | "five-whys" | "combined";
export type ProblemReportColorMode = "color" | "monochrome";

export interface ProblemReportInput {
  issue: ProblemIssue;
  project?: Project;
  members: Member[];
}

export interface ProblemReportOptions {
  kind: ProblemReportKind;
  language: Language;
  colorMode: ProblemReportColorMode;
  generatedAt?: Date;
}

export interface ProblemReportFonts {
  regular: Uint8Array;
  bold: Uint8Array;
}

const A3_LANDSCAPE: [number, number] = [1190.55, 841.89];
const A4_PORTRAIT: [number, number] = [595.28, 841.89];

interface ReportFonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface Palette {
  ink: RGB;
  softInk: RGB;
  faint: RGB;
  paper: RGB;
  panel: RGB;
  line: RGB;
  accent: RGB;
  accentSoft: RGB;
  success: RGB;
  danger: RGB;
  warning: RGB;
}

function reportPalette(mode: ProblemReportColorMode): Palette {
  if (mode === "monochrome") {
    return {
      ink: rgb(0.05, 0.05, 0.05), softInk: rgb(0.25, 0.25, 0.25), faint: rgb(0.45, 0.45, 0.45),
      paper: rgb(1, 1, 1), panel: rgb(0.96, 0.96, 0.96), line: rgb(0.72, 0.72, 0.72),
      accent: rgb(0.08, 0.08, 0.08), accentSoft: rgb(0.9, 0.9, 0.9), success: rgb(0.2, 0.2, 0.2),
      danger: rgb(0, 0, 0), warning: rgb(0.35, 0.35, 0.35),
    };
  }
  return {
    ink: rgb(0.05, 0.08, 0.14), softInk: rgb(0.3, 0.34, 0.42), faint: rgb(0.48, 0.51, 0.58),
    paper: rgb(1, 1, 1), panel: rgb(0.965, 0.96, 0.985), line: rgb(0.82, 0.81, 0.86),
    accent: rgb(0.38, 0.3, 0.78), accentSoft: rgb(0.91, 0.89, 0.98), success: rgb(0.19, 0.53, 0.39),
    danger: rgb(0.78, 0.18, 0.22), warning: rgb(0.78, 0.48, 0.12),
  };
}

const copy = {
  tr: {
    a3: "A3 SORUN ÇÖZME RAPORU", fishbone: "BALIK KILÇIĞI - NEDEN ANALİZİ", whys: "5 NEDEN - KÖK NEDEN ZİNCİRİ",
    dossier: "BİRLEŞİK SORUN ÇÖZME DOSYASI", project: "Proje", problem: "Sorun", generated: "Oluşturma tarihi",
    status: "Durum", severity: "Önem", owners: "Sorumlular", background: "1. Arka plan", currentState: "2. Mevcut durum",
    targetState: "3. Hedef durum", rootCauseSummary: "4. Kök neden", countermeasures: "5. Karşı önlemler",
    implementationPlan: "6. Uygulama planı", verificationResult: "7. Sonuç doğrulaması", standardization: "8. Standardizasyon",
    lessonsLearned: "9. Öğrenilen dersler", evidence: "Kanıt", validated: "Doğrulandı", notValidated: "Doğrulanmadı",
    rootCause: "KÖK NEDEN", possibleCause: "Olası neden", impact: "Etki", observations: "Kanıt ve gözlemler",
    actions: "Düzeltici aksiyonlar", verification: "Doğrulama ve takip", due: "Son tarih", effort: "İş yükü", owner: "Sorumlu",
    followUp: "Takip tarihi", effective: "Çözüm etkili olarak doğrulandı", ineffective: "Etkinlik henüz doğrulanmadı",
    page: "Sayfa", noContent: "Henüz içerik girilmedi", continued: "devam", why: "Neden", causeEvidence: "Kanıt / gözlem",
    summary: "Sorun özeti", reportLanguageNote: "Kullanıcı tarafından yazılan içerik özgün dilinde korunur.",
  },
  en: {
    a3: "A3 PROBLEM-SOLVING REPORT", fishbone: "FISHBONE - CAUSE ANALYSIS", whys: "5 WHYS - ROOT CAUSE CHAIN",
    dossier: "COMBINED PROBLEM-SOLVING DOSSIER", project: "Project", problem: "Problem", generated: "Generated",
    status: "Status", severity: "Severity", owners: "Owners", background: "1. Background", currentState: "2. Current state",
    targetState: "3. Target state", rootCauseSummary: "4. Root cause", countermeasures: "5. Countermeasures",
    implementationPlan: "6. Implementation plan", verificationResult: "7. Result verification", standardization: "8. Standardization",
    lessonsLearned: "9. Lessons learned", evidence: "Evidence", validated: "Validated", notValidated: "Not validated",
    rootCause: "ROOT CAUSE", possibleCause: "Possible cause", impact: "Impact", observations: "Evidence and observations",
    actions: "Corrective actions", verification: "Verification and follow-up", due: "Due", effort: "Effort", owner: "Owner",
    followUp: "Follow-up", effective: "Solution verified as effective", ineffective: "Effectiveness not verified yet",
    page: "Page", noContent: "No content entered yet", continued: "continued", why: "Why", causeEvidence: "Evidence / observation",
    summary: "Problem summary", reportLanguageNote: "User-entered content remains in its original language.",
  },
} as const;

export async function loadProblemReportFonts(): Promise<ProblemReportFonts> {
  const regularUrl = new URL("../public/fonts/Vera.ttf", import.meta.url);
  const boldUrl = new URL("../public/fonts/VeraBd.ttf", import.meta.url);
  const [regular, bold] = await Promise.all([
    fetch(regularUrl).then((response) => response.arrayBuffer()),
    fetch(boldUrl).then((response) => response.arrayBuffer()),
  ]);
  return { regular: new Uint8Array(regular), bold: new Uint8Array(bold) };
}

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const paragraphs = (text.trim() || " ").split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= width) { line = word; continue; }
      let piece = "";
      for (const character of word) {
        if (piece && font.widthOfTextAtSize(piece + character, size) > width) { lines.push(piece); piece = character; }
        else piece += character;
      }
      line = piece;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function fittedLines(text: string, font: PDFFont, width: number, height: number, preferred = 9, minimum = 5.2) {
  for (let size = preferred; size >= minimum; size -= 0.4) {
    const lineHeight = size * 1.35;
    const lines = wrapText(text, font, size, width);
    if (lines.length * lineHeight <= height) return { lines, size, lineHeight, truncated: false };
  }
  const size = minimum;
  const lineHeight = size * 1.35;
  const limit = Math.max(1, Math.floor(height / lineHeight));
  const lines = wrapText(text, font, size, width);
  const visible = lines.slice(0, limit);
  if (visible.length) visible[visible.length - 1] = `${visible[visible.length - 1].replace(/[. ]+$/, "")}...`;
  return { lines: visible, size, lineHeight, truncated: lines.length > limit };
}

function drawWrapped(page: PDFPage, text: string, options: { x: number; y: number; width: number; height: number; font: PDFFont; size?: number; color: RGB }) {
  const fitted = fittedLines(text, options.font, options.width, options.height, options.size ?? 9);
  fitted.lines.forEach((line, index) => page.drawText(line, {
    x: options.x, y: options.y - index * fitted.lineHeight, size: fitted.size, font: options.font, color: options.color,
  }));
  return fitted.truncated;
}

function drawBox(page: PDFPage, fonts: ReportFonts, palette: Palette, options: { x: number; y: number; width: number; height: number; title: string; text: string; emptyText: string; index?: string }) {
  page.drawRectangle({ x: options.x, y: options.y, width: options.width, height: options.height, color: palette.panel, borderColor: palette.line, borderWidth: 1 });
  page.drawRectangle({ x: options.x, y: options.y + options.height - 29, width: options.width, height: 29, color: palette.accentSoft });
  if (options.index) {
    page.drawCircle({ x: options.x + 18, y: options.y + options.height - 14.5, size: 9, color: palette.accent });
    page.drawText(options.index, { x: options.x + 15, y: options.y + options.height - 18, size: 8, font: fonts.bold, color: palette.paper });
  }
  page.drawText(options.title, { x: options.x + (options.index ? 34 : 12), y: options.y + options.height - 19, size: 9, font: fonts.bold, color: palette.ink });
  const text = options.text.trim() || options.emptyText;
  const truncated = drawWrapped(page, text, { x: options.x + 12, y: options.y + options.height - 45, width: options.width - 24, height: options.height - 56, font: fonts.regular, size: 8.8, color: palette.softInk });
  if (truncated) page.drawText("...", { x: options.x + options.width - 22, y: options.y + 9, size: 8, font: fonts.bold, color: palette.danger });
}

function ownerNames(input: ProblemReportInput): string {
  return input.issue.assigneeIds.map((id) => input.members.find((member) => member.id === id)?.name).filter(Boolean).join(", ") || "-";
}

export function problemReportStatusLabel(status: IssueStatus, language: Language): string {
  const labels = language === "tr"
    ? { open: "Açık", investigating: "İnceleniyor", implementing: "Çözüm uygulanıyor", verifying: "Doğrulanıyor", closed: "Kapalı" }
    : { open: "Open", investigating: "Investigating", implementing: "Implementing", verifying: "Verifying", closed: "Closed" };
  return labels[status];
}

export function problemReportSeverityLabel(severity: IssueSeverity, language: Language): string {
  const labels = language === "tr" ? { low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik" } : { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
  return labels[severity];
}

export function problemReportEmptyText(language: Language): string {
  return copy[language].noContent;
}

export function problemReportFooterText(language: Language): string {
  return language === "tr" ? "Akış - çevrimdışı sorun çözme raporu" : "Akış - offline problem-solving report";
}

function drawReportHeader(page: PDFPage, input: ProblemReportInput, options: ProblemReportOptions, fonts: ReportFonts, palette: Palette, title: string) {
  const labels = copy[options.language];
  const width = page.getWidth();
  page.drawRectangle({ x: 0, y: page.getHeight() - 78, width, height: 78, color: palette.ink });
  page.drawRectangle({ x: 0, y: page.getHeight() - 78, width: 9, height: 78, color: palette.accent });
  page.drawText(title, { x: 28, y: page.getHeight() - 34, size: 17, font: fonts.bold, color: palette.paper });
  page.drawText(`${labels.project}: ${input.project?.name ?? "-"}`, { x: 28, y: page.getHeight() - 56, size: 8.5, font: fonts.regular, color: rgb(0.86, 0.88, 0.92) });
  const info = `${labels.status}: ${problemReportStatusLabel(input.issue.status, options.language)}   |   ${labels.severity}: ${problemReportSeverityLabel(input.issue.severity, options.language)}   |   ${labels.generated}: ${new Intl.DateTimeFormat(options.language === "tr" ? "tr-TR" : "en-GB").format(options.generatedAt ?? new Date())}`;
  page.drawText(info, { x: width - fonts.regular.widthOfTextAtSize(info, 8.2) - 28, y: page.getHeight() - 52, size: 8.2, font: fonts.regular, color: rgb(0.86, 0.88, 0.92) });
}

function drawFooter(page: PDFPage, options: ProblemReportOptions, fonts: ReportFonts, palette: Palette, pageNumber: number) {
  const labels = copy[options.language];
  page.drawLine({ start: { x: 28, y: 23 }, end: { x: page.getWidth() - 28, y: 23 }, thickness: 0.7, color: palette.line });
  page.drawText(problemReportFooterText(options.language), { x: 28, y: 10, size: 6.8, font: fonts.regular, color: palette.faint });
  const pageLabel = `${labels.page} ${pageNumber}`;
  page.drawText(pageLabel, { x: page.getWidth() - 28 - fonts.regular.widthOfTextAtSize(pageLabel, 6.8), y: 10, size: 6.8, font: fonts.regular, color: palette.faint });
}

function addA3Page(doc: PDFDocument, input: ProblemReportInput, options: ProblemReportOptions, fonts: ReportFonts, palette: Palette) {
  const labels = copy[options.language];
  const page = doc.addPage(A3_LANDSCAPE);
  drawReportHeader(page, input, options, fonts, palette, labels.a3);
  const margin = 28; const gap = 10; const top = page.getHeight() - 92; const bottom = 36;
  const width = (page.getWidth() - margin * 2 - gap * 2) / 3;
  const height = (top - bottom - gap * 2) / 3;
  const fields: Array<[keyof ProblemIssue["a3"], string]> = [
    ["background", labels.background], ["currentState", labels.currentState], ["targetState", labels.targetState],
    ["rootCauseSummary", labels.rootCauseSummary], ["countermeasures", labels.countermeasures], ["implementationPlan", labels.implementationPlan],
    ["verificationResult", labels.verificationResult], ["standardization", labels.standardization], ["lessonsLearned", labels.lessonsLearned],
  ];
  fields.forEach(([key, title], index) => {
    const column = index % 3; const row = Math.floor(index / 3);
    drawBox(page, fonts, palette, { x: margin + column * (width + gap), y: top - (row + 1) * height - row * gap, width, height, title, text: input.issue.a3[key], emptyText: labels.noContent, index: String(index + 1) });
  });
  drawFooter(page, options, fonts, palette, doc.getPageCount());
}

function drawArrow(page: PDFPage, x1: number, y: number, x2: number, palette: Palette) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 2, color: palette.accent });
  page.drawLine({ start: { x: x2 - 7, y: y + 5 }, end: { x: x2, y }, thickness: 2, color: palette.accent });
  page.drawLine({ start: { x: x2 - 7, y: y - 5 }, end: { x: x2, y }, thickness: 2, color: palette.accent });
}

function addTextAppendixPages(
  doc: PDFDocument,
  input: ProblemReportInput,
  options: ProblemReportOptions,
  fonts: ReportFonts,
  palette: Palette,
  title: string,
  blocks: Array<{ heading: string; body: string }>,
) {
  if (!blocks.length) return;
  const labels = copy[options.language];
  const left = 34;
  const width = A4_PORTRAIT[0] - left * 2;
  const bottom = 43;
  let page: PDFPage | undefined;
  let y = 730;

  const finishPage = () => {
    if (page) drawFooter(page, options, fonts, palette, doc.getPageCount());
  };
  const beginPage = (continued = false) => {
    finishPage();
    page = doc.addPage(A4_PORTRAIT);
    drawReportHeader(page, input, options, fonts, palette, continued ? `${title} (${labels.continued})` : title);
    y = 730;
  };
  const drawLines = (lines: string[], font: PDFFont, size: number, color: RGB, lineHeight: number, continuationHeading?: string) => {
    const remaining = [...lines];
    while (remaining.length) {
      if (!page || y - lineHeight < bottom) {
        beginPage(true);
        if (continuationHeading) {
          page!.drawText(`${continuationHeading} (${labels.continued})`, { x: left, y, size: 9.5, font: fonts.bold, color: palette.ink });
          y -= 18;
        }
      }
      const capacity = Math.max(1, Math.floor((y - bottom) / lineHeight));
      const visible = remaining.splice(0, capacity);
      visible.forEach((line) => {
        page!.drawText(line || " ", { x: left, y, size, font, color });
        y -= lineHeight;
      });
    }
  };

  beginPage();
  blocks.forEach((block) => {
    const headingLines = wrapText(block.heading, fonts.bold, 10, width);
    const bodyLines = wrapText(block.body.trim() || labels.noContent, fonts.regular, 8.3, width);
    if (y < bottom + 55) beginPage(true);
    drawLines(headingLines, fonts.bold, 10, palette.ink, 13);
    y -= 3;
    drawLines(bodyLines, fonts.regular, 8.3, palette.softInk, 11, block.heading);
    y -= 9;
    if (page && y > bottom + 8) {
      page.drawLine({ start: { x: left, y: y + 4 }, end: { x: left + width, y: y + 4 }, thickness: 0.6, color: palette.line });
    }
  });
  finishPage();
}

function addFiveWhyPages(doc: PDFDocument, input: ProblemReportInput, options: ProblemReportOptions, fonts: ReportFonts, palette: Palette) {
  const labels = copy[options.language];
  const whys = input.issue.whys.filter((why) => why.answer.trim() || why.evidence.trim());
  const chunks = whys.length ? Array.from({ length: Math.ceil(whys.length / 5) }, (_, index) => whys.slice(index * 5, index * 5 + 5)) : [[]];
  chunks.forEach((chunk, chunkIndex) => {
    const page = doc.addPage(A3_LANDSCAPE);
    drawReportHeader(page, input, options, fonts, palette, chunks.length > 1 ? `${labels.whys} (${chunkIndex + 1}/${chunks.length})` : labels.whys);
    const margin = 30; const gap = 18; const cards = chunk.length + 1; const width = Math.min(180, (page.getWidth() - margin * 2 - gap * (cards - 1)) / cards);
    const totalWidth = width * cards + gap * (cards - 1); const startX = (page.getWidth() - totalWidth) / 2; const y = 205; const height = 470;
    const nodes = [{ answer: input.issue.description || input.issue.title, evidence: input.issue.impact, validated: true, title: labels.problem }, ...chunk.map((why, index) => ({ ...why, title: `${labels.why} ${chunkIndex * 5 + index + 1}` }))];
    nodes.forEach((node, index) => {
      const x = startX + index * (width + gap);
      page.drawRectangle({ x, y, width, height, color: index === 0 ? palette.accentSoft : palette.panel, borderColor: node.validated ? palette.success : palette.line, borderWidth: node.validated ? 2 : 1 });
      page.drawRectangle({ x, y: y + height - 48, width, height: 48, color: index === 0 ? palette.accent : node.validated ? palette.success : palette.softInk });
      page.drawText(node.title, { x: x + 12, y: y + height - 30, size: 11, font: fonts.bold, color: palette.paper });
      drawWrapped(page, node.answer || labels.noContent, { x: x + 12, y: y + height - 72, width: width - 24, height: 245, font: fonts.regular, size: 9.5, color: palette.ink });
      page.drawLine({ start: { x: x + 12, y: y + 115 }, end: { x: x + width - 12, y: y + 115 }, thickness: 0.8, color: palette.line });
      page.drawText(index === 0 ? labels.impact : labels.causeEvidence, { x: x + 12, y: y + 95, size: 7.5, font: fonts.bold, color: palette.faint });
      drawWrapped(page, node.evidence || "-", { x: x + 12, y: y + 78, width: width - 24, height: 48, font: fonts.regular, size: 7.5, color: palette.softInk });
      if (index > 0) page.drawText(node.validated ? `[X] ${labels.validated}` : `[ ] ${labels.notValidated}`, { x: x + 12, y: y + 18, size: 7.2, font: fonts.bold, color: node.validated ? palette.success : palette.faint });
      if (index < nodes.length - 1) drawArrow(page, x + width + 2, y + height / 2, x + width + gap - 2, palette);
    });
    if (whys.length === 0) page.drawText(labels.noContent, { x: page.getWidth() / 2 - 45, y: 130, size: 9, font: fonts.regular, color: palette.faint });
    drawFooter(page, options, fonts, palette, doc.getPageCount());
  });
  if (whys.length) {
    const detailTitle = options.language === "tr" ? "5 NEDEN - AYRINTILI KAYIT" : "5 WHYS - DETAILED RECORD";
    addTextAppendixPages(doc, input, options, fonts, palette, detailTitle, whys.map((why, index) => ({
      heading: `${labels.why} ${index + 1}${why.validated ? ` - ${labels.validated}` : ` - ${labels.notValidated}`}`,
      body: `${why.answer}\n\n${labels.causeEvidence}: ${why.evidence || "-"}`,
    })));
  }
}

function addFishbonePages(doc: PDFDocument, input: ProblemReportInput, options: ProblemReportOptions, fonts: ReportFonts, palette: Palette) {
  const labels = copy[options.language];
  const categories = input.issue.fishbone.length ? input.issue.fishbone : [{ id: "empty", name: labels.possibleCause, causes: [] }];
  const chunks = Array.from({ length: Math.ceil(categories.length / 6) }, (_, index) => categories.slice(index * 6, index * 6 + 6));
  chunks.forEach((chunk, chunkIndex) => {
    const page = doc.addPage(A3_LANDSCAPE);
    drawReportHeader(page, input, options, fonts, palette, chunks.length > 1 ? `${labels.fishbone} (${chunkIndex + 1}/${chunks.length})` : labels.fishbone);
    const spineY = 400; const spineStart = 120; const spineEnd = 975;
    page.drawLine({ start: { x: spineStart, y: spineY }, end: { x: spineEnd, y: spineY }, thickness: 5, color: palette.ink });
    for (let index = 0; index < 5; index += 1) {
      const x = spineStart - 22 + index * 18;
      page.drawLine({ start: { x, y: spineY }, end: { x: x + 24, y: spineY + 20 }, thickness: 2, color: palette.ink });
      page.drawLine({ start: { x, y: spineY }, end: { x: x + 24, y: spineY - 20 }, thickness: 2, color: palette.ink });
    }
    page.drawRectangle({ x: 985, y: 330, width: 175, height: 140, color: palette.accentSoft, borderColor: palette.accent, borderWidth: 2 });
    page.drawText(labels.problem, { x: 999, y: 445, size: 9, font: fonts.bold, color: palette.accent });
    drawWrapped(page, input.issue.description || input.issue.title, { x: 999, y: 424, width: 147, height: 78, font: fonts.bold, size: 9.5, color: palette.ink });
    const upper = chunk.filter((_, index) => index % 2 === 0); const lower = chunk.filter((_, index) => index % 2 === 1);
    const drawCategory = (category: (typeof chunk)[number], position: number, top: boolean, count: number) => {
      const spacing = 720 / Math.max(1, count); const attachX = 230 + position * spacing + spacing / 2;
      const endX = attachX - 105; const endY = top ? 675 : 125;
      page.drawLine({ start: { x: attachX, y: spineY }, end: { x: endX, y: endY }, thickness: 3, color: palette.accent });
      page.drawRectangle({ x: endX - 70, y: top ? endY + 3 : endY - 30, width: 160, height: 28, color: palette.accentSoft, borderColor: palette.accent, borderWidth: 1 });
      drawWrapped(page, category.name, { x: endX - 62, y: top ? endY + 20 : endY - 13, width: 144, height: 17, font: fonts.bold, size: 8.2, color: palette.ink });
      const causes = category.causes.slice(0, 7);
      causes.forEach((cause, causeIndex) => {
        const t = (causeIndex + 1) / (causes.length + 1); const x = attachX + (endX - attachX) * t; const y = spineY + (endY - spineY) * t;
        const direction = causeIndex % 2 === 0 ? 1 : -1; const twig = 68 * direction;
        page.drawLine({ start: { x, y }, end: { x: x + twig, y }, thickness: cause.rootCause ? 2.5 : 1.2, color: cause.rootCause ? palette.danger : palette.softInk });
        if (cause.rootCause) page.drawCircle({ x: x + twig, y, size: 4, color: palette.danger });
        const labelFont = cause.rootCause ? fonts.bold : fonts.regular;
        const rawText = cause.text.trim() || labels.possibleCause;
        const short = rawText.length > 22 ? `${rawText.slice(0, 19).trim()}...` : rawText;
        const labelWidth = labelFont.widthOfTextAtSize(short, 6.3);
        const textX = direction > 0 ? x + 5 : x + twig - labelWidth;
        page.drawRectangle({ x: textX - 2, y: y + 2, width: labelWidth + 4, height: 10, color: palette.paper });
        page.drawText(short, { x: textX, y: y + 4, size: 6.3, font: labelFont, color: cause.rootCause ? palette.danger : palette.ink });
      });
      if (category.causes.length > 7) page.drawText(`+${category.causes.length - 7}`, { x: endX + 75, y: top ? endY - 9 : endY + 8, size: 7, font: fonts.bold, color: palette.warning });
    };
    upper.forEach((category, index) => drawCategory(category, index, true, upper.length));
    lower.forEach((category, index) => drawCategory(category, index, false, lower.length));
    page.drawText(`* ${labels.rootCause}`, { x: 32, y: 54, size: 8, font: fonts.bold, color: palette.danger });
    drawFooter(page, options, fonts, palette, doc.getPageCount());
  });
  const detailTitle = options.language === "tr" ? "BALIK KIL\u00c7I\u011eI - AYRINTILI NEDEN L\u0130STES\u0130" : "FISHBONE - DETAILED CAUSE LIST";
  addTextAppendixPages(doc, input, options, fonts, palette, detailTitle, categories.map((category) => ({
    heading: category.name,
    body: category.causes.length
      ? category.causes.map((cause, index) => {
        const rootMarker = cause.rootCause ? `[${labels.rootCause}] ` : "";
        return `${index + 1}. ${rootMarker}${cause.text || labels.possibleCause}\n   ${labels.evidence}: ${cause.evidence || "-"}`;
      }).join("\n\n")
      : labels.noContent,
  })));
}

function addTextSectionPages(doc: PDFDocument, input: ProblemReportInput, options: ProblemReportOptions, fonts: ReportFonts, palette: Palette) {
  const labels = copy[options.language];
  const page = doc.addPage(A4_PORTRAIT);
  drawReportHeader(page, input, options, fonts, palette, labels.summary);
  drawBox(page, fonts, palette, { x: 28, y: 520, width: 539, height: 220, title: labels.problem, text: `${input.issue.title}\n\n${input.issue.description}`, emptyText: labels.noContent });
  drawBox(page, fonts, palette, { x: 28, y: 350, width: 539, height: 150, title: labels.impact, text: input.issue.impact, emptyText: labels.noContent });
  drawBox(page, fonts, palette, { x: 28, y: 72, width: 539, height: 258, title: labels.observations, text: input.issue.evidence.map((entry, index) => `${index + 1}. ${entry.text}`).join("\n"), emptyText: labels.noContent });
  drawFooter(page, options, fonts, palette, doc.getPageCount());

  const actionChunks = input.issue.actions.length
    ? Array.from({ length: Math.ceil(input.issue.actions.length / 4) }, (_, index) => input.issue.actions.slice(index * 4, index * 4 + 4))
    : [[]];
  actionChunks.forEach((chunk, pageIndex) => {
    const actionPage = doc.addPage(A4_PORTRAIT);
    const title = actionChunks.length > 1 ? `${labels.actions} (${pageIndex + 1}/${actionChunks.length})` : labels.actions;
    drawReportHeader(actionPage, input, options, fonts, palette, title);
    let y = 730;
    chunk.forEach((action, chunkActionIndex) => {
      const owner = action.assigneeIds.map((id) => input.members.find((member) => member.id === id)?.name).filter(Boolean).join(", ") || "-";
      const detail = `${action.description}\n${labels.owner}: ${owner}   |   ${labels.due}: ${action.dueDate ?? "-"}   |   ${labels.effort}: ${action.effortPoints}`;
      const actionIndex = pageIndex * 4 + chunkActionIndex;
      drawBox(actionPage, fonts, palette, { x: 28, y: y - 112, width: 539, height: 102, title: `${actionIndex + 1}. ${action.title}`, text: detail, emptyText: labels.noContent });
      y -= 118;
    });
    if (!input.issue.actions.length) actionPage.drawText(labels.noContent, { x: 28, y: 700, size: 10, font: fonts.regular, color: palette.faint });
    if (pageIndex === actionChunks.length - 1) {
      const verificationTop = input.issue.actions.length ? y - 10 : 620;
      drawBox(actionPage, fonts, palette, {
        x: 28,
        y: 70,
        width: 539,
        height: Math.max(120, verificationTop - 70),
        title: labels.verification,
        text: `${input.issue.verificationEffective ? labels.effective : labels.ineffective}\n${labels.followUp}: ${input.issue.followUpDate ?? "-"}\n\n${input.issue.verificationNote}`,
        emptyText: labels.noContent,
      });
    }
    drawFooter(actionPage, options, fonts, palette, doc.getPageCount());
  });
}

function addCombinedRecordAppendix(doc: PDFDocument, input: ProblemReportInput, options: ProblemReportOptions, fonts: ReportFonts, palette: Palette) {
  const labels = copy[options.language];
  const title = options.language === "tr" ? "TAM SORUN \u00c7\u00d6ZME KAYDI" : "COMPLETE PROBLEM-SOLVING RECORD";
  const a3Fields: Array<[keyof ProblemIssue["a3"], string]> = [
    ["background", labels.background], ["currentState", labels.currentState], ["targetState", labels.targetState],
    ["rootCauseSummary", labels.rootCauseSummary], ["countermeasures", labels.countermeasures], ["implementationPlan", labels.implementationPlan],
    ["verificationResult", labels.verificationResult], ["standardization", labels.standardization], ["lessonsLearned", labels.lessonsLearned],
  ];
  const blocks: Array<{ heading: string; body: string }> = [
    { heading: labels.problem, body: `${input.issue.title}\n\n${input.issue.description}` },
    { heading: labels.impact, body: input.issue.impact },
    { heading: labels.observations, body: input.issue.evidence.map((entry, index) => `${index + 1}. ${entry.text}`).join("\n\n") },
    { heading: labels.rootCause, body: input.issue.rootCause },
    ...input.issue.actions.map((action, index) => {
      const owner = action.assigneeIds.map((id) => input.members.find((member) => member.id === id)?.name).filter(Boolean).join(", ") || "-";
      return {
        heading: `${labels.actions} ${index + 1}: ${action.title}`,
        body: `${action.description}\n\n${labels.owner}: ${owner}\n${labels.due}: ${action.dueDate ?? "-"}\n${labels.effort}: ${action.effortPoints}`,
      };
    }),
    ...a3Fields.map(([key, heading]) => ({ heading, body: input.issue.a3[key] })),
    {
      heading: labels.verification,
      body: `${input.issue.verificationEffective ? labels.effective : labels.ineffective}\n${labels.followUp}: ${input.issue.followUpDate ?? "-"}\n\n${input.issue.verificationNote}`,
    },
  ];
  addTextAppendixPages(doc, input, options, fonts, palette, title, blocks);
}

export async function createProblemReportPdf(input: ProblemReportInput, options: ProblemReportOptions, assets: ProblemReportFonts): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const fonts: ReportFonts = {
    regular: await document.embedFont(assets.regular, { subset: true }),
    bold: await document.embedFont(assets.bold, { subset: true }),
  };
  const palette = reportPalette(options.colorMode);
  document.setTitle(`${input.issue.title} - ${options.kind}`);
  document.setAuthor("Akış");
  document.setSubject("Offline problem-solving report");
  document.setCreator("Akış desktop application");
  document.setProducer("Akış / pdf-lib");
  document.setCreationDate(options.generatedAt ?? new Date());
  if (options.kind === "combined") {
    addTextSectionPages(document, input, options, fonts, palette);
    addCombinedRecordAppendix(document, input, options, fonts, palette);
    addFiveWhyPages(document, input, options, fonts, palette);
    addFishbonePages(document, input, options, fonts, palette);
    addA3Page(document, input, options, fonts, palette);
  } else if (options.kind === "a3") addA3Page(document, input, options, fonts, palette);
  else if (options.kind === "fishbone") addFishbonePages(document, input, options, fonts, palette);
  else addFiveWhyPages(document, input, options, fonts, palette);
  return document.save();
}

export function problemReportFilename(input: ProblemReportInput, options: ProblemReportOptions): string {
  const suffix = options.kind === "a3" ? "A3" : options.kind === "fishbone" ? "Balik-Kilcigi" : options.kind === "five-whys" ? "5-Neden" : "Sorun-Cozme-Dosyasi";
  const safe = input.issue.title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ -]/g, "").trim().replace(/\s+/g, "-").slice(0, 64) || "Sorun";
  return `${safe}-${suffix}.pdf`;
}

export function problemReportCopy(language: Language) {
  return copy[language];
}

export function problemReportOwnerNames(input: ProblemReportInput) {
  return ownerNames(input);
}
