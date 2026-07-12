"use client";

import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n";
import type { AppData, Project } from "../types";
import { getProjectBurnup } from "../v4Workflows";
import type { BurnupRangeDays } from "../v4Workflows";

function getTickIndexes(length: number) {
  if (length <= 1) return [0];
  const count = Math.min(length, length <= 7 ? 7 : 6);
  return Array.from(new Set(Array.from({ length: count }, (_, index) =>
    Math.round((index / (count - 1)) * (length - 1)),
  )));
}

export function BurnupChart({ data, project }: { data: AppData; project: Project }) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [mode, setMode] = useState<"tasks" | "points">("tasks");
  const [days, setDays] = useState<BurnupRangeDays | undefined>(15);
  const burnup = getProjectBurnup(data, project.id, { mode, days, language });
  const width = 820;
  const height = 280;
  const plot = { left: 82, right: 46, top: 24, bottom: 54 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const max = Math.max(1, ...burnup.points.map((point) => point.scope));
  const coords = (key: "scope" | "completed") => burnup.points.map((point, index) => ({
    x: plot.left + (index / Math.max(1, burnup.points.length - 1)) * plotWidth,
    y: plot.top + plotHeight - (point[key] / max) * plotHeight,
  }));
  const scopeCoords = coords("scope");
  const completedCoords = coords("completed");
  const path = (points: Array<{ x: number; y: number }>) => points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const rangeOptions: Array<{ value: BurnupRangeDays | "all"; label: string }> = [
    { value: 7, label: tr ? "7 gün" : "7 days" },
    { value: 15, label: tr ? "15 gün" : "15 days" },
    { value: 21, label: tr ? "21 gün" : "21 days" },
    { value: 30, label: tr ? "30 gün" : "30 days" },
    { value: 90, label: tr ? "90 gün" : "90 days" },
    { value: "all", label: tr ? "Tümü" : "All" },
  ];
  const xTicks = getTickIndexes(burnup.points.length).map((index) => ({ index, point: burnup.points[index] }));
  const yTicks = [0, .25, .5, .75, 1].map((ratio) => ({
    ratio,
    value: max * ratio,
    y: plot.top + plotHeight - ratio * plotHeight,
  }));
  const numberFormat = new Intl.NumberFormat(tr ? "tr-TR" : "en-GB", { maximumFractionDigits: 1 });
  const scopeEnd = scopeCoords.at(-1);
  const completedEnd = completedCoords.at(-1);
  const labelsAreClose = Boolean(scopeEnd && completedEnd && Math.abs(scopeEnd.y - completedEnd.y) < 20);
  const unit = mode === "tasks" ? tr ? "görev" : "tasks" : tr ? "puan" : "points";

  return <article className="burnup-card">
    <header><div><span className="eyebrow">BURN-UP</span><h2>{tr ? "Kapsam ve tamamlanma" : "Scope and completion"}</h2></div><TrendingUp size={20} /></header>
    <div className="burnup-controls"><div className="segmented-control"><button className={mode === "tasks" ? "active" : ""} onClick={() => setMode("tasks")}>{tr ? "Görev" : "Tasks"}</button><button className={mode === "points" ? "active" : ""} onClick={() => setMode("points")}>{tr ? "İş yükü" : "Effort"}</button></div><div className="segmented-control burnup-range-control">{rangeOptions.map((option) => <button key={option.value} className={(option.value === "all" ? days === undefined : days === option.value) ? "active" : ""} onClick={() => setDays(option.value === "all" ? undefined : option.value)}>{option.label}</button>)}</div></div>
    <div className="burnup-summary"><span><small>{tr ? "Toplam kapsam" : "Total scope"}</small><strong>{burnup.total}</strong></span><span><small>{tr ? "Tamamlanan" : "Completed"}</small><strong>{burnup.completed}</strong></span><span><small>{tr ? "Kalan" : "Remaining"}</small><strong>{burnup.remaining}</strong></span><span><small>{tr ? "İlerleme" : "Progress"}</small><strong>{burnup.progress}%</strong></span></div>
    {burnup.total ? <div className="burnup-visual">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={tr ? `Toplam ${burnup.total}, tamamlanan ${burnup.completed}, kalan ${burnup.remaining}. Yatay eksen tarih, dikey eksen yüzde ve ${unit}.` : `Total ${burnup.total}, completed ${burnup.completed}, remaining ${burnup.remaining}. Horizontal axis is date; vertical axis is percentage and ${unit}.`}>
        <title>{tr ? `Burn-up grafiği: ${burnup.progress}% tamamlandı` : `Burn-up chart: ${burnup.progress}% complete`}</title>
        <g className="burnup-grid horizontal">{yTicks.map((tick) => <line key={tick.ratio} x1={plot.left} x2={width - plot.right} y1={tick.y} y2={tick.y} />)}</g>
        <g className="burnup-grid vertical">{xTicks.map(({ index }) => { const x = plot.left + (index / Math.max(1, burnup.points.length - 1)) * plotWidth; return <line key={index} x1={x} x2={x} y1={plot.top} y2={plot.top + plotHeight} />; })}</g>
        <g className="burnup-y-axis">{yTicks.map((tick) => <text key={tick.ratio} x={plot.left - 10} y={tick.y + 4} textAnchor="end"><tspan>{Math.round(tick.ratio * 100)}%</tspan><tspan className="burnup-axis-value"> · {numberFormat.format(tick.value)}</tspan></text>)}</g>
        <text className="burnup-axis-title" x={10} y={14}>{tr ? `İlerleme · ${unit}` : `Progress · ${unit}`}</text>
        <path className="burnup-line scope" d={path(scopeCoords)} />
        <path className="burnup-line completed" d={path(completedCoords)} />
        {scopeEnd && <><circle className="burnup-point scope" cx={scopeEnd.x} cy={scopeEnd.y} r={4.5} /><text className="burnup-end-label scope" x={scopeEnd.x - 8} y={scopeEnd.y + (labelsAreClose ? -11 : -8)} textAnchor="end">{tr ? "Kapsam" : "Scope"} {burnup.total} · 100%</text></>}
        {completedEnd && <><circle className="burnup-point completed" cx={completedEnd.x} cy={completedEnd.y} r={4.5} /><text className="burnup-end-label completed" x={completedEnd.x - 8} y={completedEnd.y + (labelsAreClose ? 17 : -8)} textAnchor="end">{tr ? "Biten" : "Done"} {burnup.completed} · {burnup.progress}%</text></>}
        <g className="burnup-x-axis">{xTicks.map(({ index, point }, tickIndex) => { const x = plot.left + (index / Math.max(1, burnup.points.length - 1)) * plotWidth; const anchor = tickIndex === 0 ? "start" : tickIndex === xTicks.length - 1 ? "end" : "middle"; return <text key={index} x={x} y={height - 28} textAnchor={anchor}>{point.label}</text>; })}</g>
        <text className="burnup-x-title" x={plot.left + plotWidth / 2} y={height - 5} textAnchor="middle">{tr ? "Tarih" : "Date"}</text>
      </svg>
      <div className="burnup-legend"><span><i className="scope" /> {tr ? "Toplam planlanmış kapsam" : "Total planned scope"}</span><span><i className="completed" /> {tr ? "Tamamlanan kapsam" : "Completed scope"}</span></div>
      <p className="burnup-scale-note">{tr ? `Dikey eksende %100, seçili dönemdeki en yüksek kapsamı (${numberFormat.format(max)} ${unit}) gösterir.` : `On the vertical axis, 100% represents the highest scope in the selected period (${numberFormat.format(max)} ${unit}).`}</p>
    </div> : <p className="burnup-empty">{tr ? "Önceliklendirilmiş bir görev olduğunda grafik oluşur." : "The chart appears when a task is prioritized."}</p>}
    {burnup.approximate && <small className="burnup-note">{tr ? "Eski görevlerin ilk kapsam tarihi mevcut kayıtlardan yaklaşık olarak oluşturuldu." : "Initial scope dates for older tasks were approximated from existing records."}</small>}
  </article>;
}
