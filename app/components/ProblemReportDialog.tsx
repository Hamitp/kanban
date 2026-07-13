import { FileDown, FolderOpen, Printer, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { openProblemReportFolder, saveProblemReportPdf, type ReportExportResult, type ReportWorkspaceIdentity } from "../desktopReports";
import {
  createProblemReportPdf,
  loadProblemReportFonts,
  problemReportCopy,
  problemReportFilename,
  problemReportFooterText,
  problemReportOwnerNames,
  problemReportSeverityLabel,
  problemReportStatusLabel,
  type ProblemReportColorMode,
  type ProblemReportInput,
  type ProblemReportKind,
} from "../problemReports";
import type { Language } from "../types";

const reportKinds: ProblemReportKind[] = ["a3", "fishbone", "five-whys", "combined"];

export function ProblemReportDialog({ input, workspace, appLanguage, initialKind, onClose }: { input: ProblemReportInput; workspace: ReportWorkspaceIdentity; appLanguage: Language; initialKind: ProblemReportKind; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLSelectElement>(null);
  const onCloseRef = useRef(onClose);
  const [kind, setKind] = useState<ProblemReportKind>(initialKind);
  const [language, setLanguage] = useState<Language>(appLanguage);
  const [colorMode, setColorMode] = useState<ProblemReportColorMode>("color");
  const [zoom, setZoom] = useState(72);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<ReportExportResult | null>(null);
  const tr = appLanguage === "tr";
  const labels = problemReportCopy(language);
  const kindLabels: Record<ProblemReportKind, string> = {
    a3: "A3", fishbone: language === "tr" ? "Balık kılçığı" : "Fishbone",
    "five-whys": language === "tr" ? "5 Neden" : "5 Whys",
    combined: language === "tr" ? "Birleşik dosya" : "Combined dossier",
  };
  const options = useMemo(() => ({ kind, language, colorMode } as const), [kind, language, colorMode]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => (initialFocusRef.current ?? dialogRef.current)?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const exportPdf = async () => {
    setBusy(true); setError(""); setSaved(null);
    try {
      const fonts = await loadProblemReportFonts();
      const bytes = await createProblemReportPdf(input, options, fonts);
      setSaved(await saveProblemReportPdf(bytes, problemReportFilename(input, options), workspace));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr ? "PDF oluşturulamadı." : "The PDF could not be created.");
    } finally { setBusy(false); }
  };

  const print = () => {
    document.body.classList.add("problem-report-printing");
    const cleanup = () => document.body.classList.remove("problem-report-printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1_000);
  };
  const successMessage = saved?.destination === "desktop-exports"
    ? tr ? `${saved.filename}, ${workspace.name} çalışma alanının Exports klasörüne kaydedildi.` : `${saved.filename} was saved to the ${workspace.name} workspace Exports folder.`
    : saved
      ? tr ? `${saved.filename} indirildi.` : `${saved.filename} was downloaded.`
      : "";

  return <div ref={dialogRef} className="problem-report-dialog" role="dialog" aria-modal="true" aria-labelledby="problem-report-dialog-title" tabIndex={-1}>
    <div className="report-dialog-shell">
      <header className="report-dialog-header">
        <div><span className="eyebrow">{tr ? "ÇEVRİMDIŞI RAPORLAMA" : "OFFLINE REPORTING"}</span><h2 id="problem-report-dialog-title">{tr ? "Baskı önizleme ve PDF" : "Print preview and PDF"}</h2><p>{tr ? "Metodolojiye uygun raporu dışa aktarın veya sistem yazdırma ekranını açın." : "Export a methodology-aligned report or open the system print dialog."}</p></div>
        <button className="icon-button" onClick={onClose} aria-label={tr ? "Kapat" : "Close"}><X size={20} /></button>
      </header>
      <div className="report-dialog-toolbar">
        <label>{tr ? "Rapor" : "Report"}<select ref={initialFocusRef} value={kind} onChange={(event) => { setKind(event.target.value as ProblemReportKind); setSaved(null); }}>{reportKinds.map((value) => <option key={value} value={value}>{kindLabels[value]}</option>)}</select></label>
        <label>{tr ? "Çıktı dili" : "Output language"}<select value={language} onChange={(event) => { setLanguage(event.target.value as Language); setSaved(null); }}><option value="tr">Türkçe</option><option value="en">English</option></select></label>
        <label>{tr ? "Görünüm" : "Appearance"}<select value={colorMode} onChange={(event) => { setColorMode(event.target.value as ProblemReportColorMode); setSaved(null); }}><option value="color">{tr ? "Renkli" : "Color"}</option><option value="monochrome">{tr ? "Siyah-beyaz" : "Black and white"}</option></select></label>
        <div className="report-zoom" role="group" aria-label={tr ? "Önizleme yakınlaştırma" : "Preview zoom"}><button className="micro-button" onClick={() => setZoom((value) => Math.max(45, value - 10))}><ZoomOut size={15} /></button><span>{zoom}%</span><button className="micro-button" onClick={() => setZoom((value) => Math.min(110, value + 10))}><ZoomIn size={15} /></button></div>
        <div className="spacer" />
        <button className="secondary-button" onClick={print}><Printer size={16} /> {tr ? "Yazdır" : "Print"}</button>
        <button className="primary-button" disabled={busy} onClick={exportPdf}><FileDown size={16} /> {busy ? tr ? "PDF hazırlanıyor..." : "Creating PDF..." : tr ? "PDF oluştur" : "Create PDF"}</button>
      </div>
      <div className="report-dialog-notice"><span lang={language}>{labels.reportLanguageNote}</span><strong>{tr ? "PDF üretimi internet bağlantısı kullanmaz." : "PDF generation does not use an internet connection."}</strong></div>
      {(saved || error) && <div className={`report-export-status ${error ? "error" : "success"}`}>{error || successMessage}{saved?.destination === "desktop-exports" && <button className="text-button" onClick={() => void openProblemReportFolder(workspace)}><FolderOpen size={15} /> {tr ? "Klasörü aç" : "Open folder"}</button>}</div>}
      <div className="report-preview-stage">
        <div className={`problem-report-print-root report-${colorMode}`} style={{ "--report-zoom": zoom / 100 } as React.CSSProperties}>
          <ReportPreview input={input} kind={kind} language={language} />
        </div>
      </div>
    </div>
  </div>;
}

function ReportPreview({ input, kind, language }: { input: ProblemReportInput; kind: ProblemReportKind; language: Language }) {
  if (kind === "a3") return <A3Preview input={input} language={language} />;
  if (kind === "fishbone") return <FishbonePreview input={input} language={language} />;
  if (kind === "five-whys") return <FiveWhysPreview input={input} language={language} />;
  return <><SummaryPreview input={input} language={language} /><FiveWhysPreview input={input} language={language} /><FishbonePreview input={input} language={language} /><A3Preview input={input} language={language} /><ActionsPreview input={input} language={language} /></>;
}

function PaperHeader({ input, language, title }: { input: ProblemReportInput; language: Language; title: string }) {
  const labels = problemReportCopy(language);
  return <header className="report-paper-header"><div><span>{title}</span><strong>{input.issue.title}</strong></div><dl><div><dt>{labels.project}</dt><dd>{input.project?.name ?? "-"}</dd></div><div><dt>{labels.status}</dt><dd>{problemReportStatusLabel(input.issue.status, language)}</dd></div><div><dt>{labels.severity}</dt><dd>{problemReportSeverityLabel(input.issue.severity, language)}</dd></div></dl></header>;
}

function A3Preview({ input, language }: { input: ProblemReportInput; language: Language }) {
  const labels = problemReportCopy(language);
  const fields: Array<[keyof typeof input.issue.a3, string]> = [["background", labels.background], ["currentState", labels.currentState], ["targetState", labels.targetState], ["rootCauseSummary", labels.rootCauseSummary], ["countermeasures", labels.countermeasures], ["implementationPlan", labels.implementationPlan], ["verificationResult", labels.verificationResult], ["standardization", labels.standardization], ["lessonsLearned", labels.lessonsLearned]];
  return <article className="report-paper a3-paper"><PaperHeader input={input} language={language} title={labels.a3} /><div className="a3-report-grid">{fields.map(([key, title], index) => <section key={key}><h3><i>{index + 1}</i>{title.replace(/^\d+\.\s*/, "")}</h3><p>{input.issue.a3[key] || labels.noContent}</p></section>)}</div><PaperFooter language={language} /></article>;
}

function FiveWhysPreview({ input, language }: { input: ProblemReportInput; language: Language }) {
  const labels = problemReportCopy(language);
  const whys = input.issue.whys.filter((why) => why.answer.trim() || why.evidence.trim());
  return <article className="report-paper why-paper"><PaperHeader input={input} language={language} title={labels.whys} /><div className="why-report-chain"><section className="problem-node"><small>{labels.problem}</small><strong>{input.issue.description || input.issue.title}</strong><p>{input.issue.impact}</p></section>{whys.map((why, index) => <section key={why.id} className={why.validated ? "validated" : ""}><span className="report-arrow">→</span><small>{labels.why} {index + 1}</small><strong>{why.answer || labels.noContent}</strong><p>{why.evidence || "-"}</p><em>{why.validated ? `✓ ${labels.validated}` : `○ ${labels.notValidated}`}</em></section>)}</div>{whys.length === 0 && <p className="report-empty">{labels.noContent}</p>}<PaperFooter language={language} /></article>;
}

function FishbonePreview({ input, language }: { input: ProblemReportInput; language: Language }) {
  const labels = problemReportCopy(language);
  const categories = input.issue.fishbone.slice(0, 6);
  return <article className="report-paper fishbone-paper"><PaperHeader input={input} language={language} title={labels.fishbone} /><svg className="fishbone-report-svg" viewBox="0 0 1000 540" role="img" aria-label={labels.fishbone}>
    <line className="fishbone-spine" x1="90" y1="270" x2="820" y2="270" />
    {Array.from({ length: 5 }, (_, index) => <g key={index}><line className="fish-tail" x1={90 + index * 15} y1="270" x2={120 + index * 15} y2="240" /><line className="fish-tail" x1={90 + index * 15} y1="270" x2={120 + index * 15} y2="300" /></g>)}
    {categories.map((category, index) => {
      const top = index % 2 === 0; const slot = Math.floor(index / 2); const attachX = 260 + slot * 210; const endX = attachX - 95; const endY = top ? 80 : 460;
      return <g key={category.id}><line className="fishbone-main-bone" x1={attachX} y1="270" x2={endX} y2={endY} /><rect className="fishbone-category-box" x={endX - 65} y={top ? endY - 32 : endY + 7} width="150" height="30" rx="7" /><text className="fishbone-category" x={endX + 10} y={top ? endY - 12 : endY + 27} textAnchor="middle">{category.name}</text>{category.causes.slice(0, 5).map((cause, causeIndex) => { const t = (causeIndex + 1) / (Math.min(5, category.causes.length) + 1); const x = attachX + (endX - attachX) * t; const y = 270 + (endY - 270) * t; const dir = causeIndex % 2 === 0 ? 1 : -1; return <g key={cause.id} className={cause.rootCause ? "root-cause" : ""}><line x1={x} y1={y} x2={x + dir * 58} y2={y} /><text x={x + dir * 62} y={y - 5} textAnchor={dir > 0 ? "start" : "end"}>{cause.rootCause ? "★ " : ""}{cause.text}</text></g>; })}</g>;
    })}
    <path className="fish-head" d="M830 205 L945 225 L980 270 L945 315 L830 335 Z" /><text className="fish-head-label" x="900" y="255" textAnchor="middle">{labels.problem}</text><foreignObject x="850" y="265" width="100" height="52"><div className="fish-head-copy">{input.issue.description || input.issue.title}</div></foreignObject>
  </svg>{categories.length === 0 && <p className="report-empty">{labels.noContent}</p>}<PaperFooter language={language} /></article>;
}

function SummaryPreview({ input, language }: { input: ProblemReportInput; language: Language }) {
  const labels = problemReportCopy(language);
  return <article className="report-paper portrait-paper"><PaperHeader input={input} language={language} title={labels.dossier} /><div className="report-summary-body"><h3>{labels.summary}</h3><h2>{input.issue.title}</h2><p>{input.issue.description || labels.noContent}</p><h3>{labels.impact}</h3><p>{input.issue.impact || labels.noContent}</p><h3>{labels.observations}</h3><ol>{input.issue.evidence.map((entry) => <li key={entry.id}>{entry.text}</li>)}</ol><dl><div><dt>{labels.owners}</dt><dd>{problemReportOwnerNames(input)}</dd></div><div><dt>{labels.rootCause}</dt><dd>{input.issue.rootCause || "-"}</dd></div></dl></div><PaperFooter language={language} /></article>;
}

function ActionsPreview({ input, language }: { input: ProblemReportInput; language: Language }) {
  const labels = problemReportCopy(language);
  return <article className="report-paper portrait-paper"><PaperHeader input={input} language={language} title={labels.actions} /><div className="report-action-table"><div className="action-head"><span>#</span><span>{language === "tr" ? "Aksiyon" : "Action"}</span><span>{labels.owner}</span><span>{labels.due}</span><span>{labels.effort}</span></div>{input.issue.actions.map((action, index) => <div key={action.id}><span>{index + 1}</span><span><strong>{action.title}</strong><small>{action.description}</small></span><span>{action.assigneeIds.map((id) => input.members.find((member) => member.id === id)?.name).filter(Boolean).join(", ") || "-"}</span><span>{action.dueDate ?? "-"}</span><span>{action.effortPoints}</span></div>)}</div><section className="report-verification"><h3>{labels.verification}</h3><strong>{input.issue.verificationEffective ? labels.effective : labels.ineffective}</strong><p>{input.issue.verificationNote || labels.noContent}</p></section><PaperFooter language={language} /></article>;
}

function PaperFooter({ language }: { language: Language }) {
  return <footer><span>{problemReportFooterText(language)}</span></footer>;
}
