"use client";

import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n";
import type { AppData, Project } from "../types";
import { getProjectBurnup } from "../v4Workflows";

export function BurnupChart({ data, project }: { data: AppData; project: Project }) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [mode, setMode] = useState<"tasks" | "points">("tasks");
  const [days, setDays] = useState<30 | 90 | undefined>(30);
  const burnup = getProjectBurnup(data, project.id, { mode, days, language });
  const width = 720;
  const height = 230;
  const pad = 30;
  const max = Math.max(1, ...burnup.points.map((point) => point.scope));
  const coords = (key: "scope" | "completed") => burnup.points.map((point, index) => ({
    x: pad + (index / Math.max(1, burnup.points.length - 1)) * (width - pad * 2),
    y: height - pad - (point[key] / max) * (height - pad * 2),
  }));
  const path = (key: "scope" | "completed") => coords(key).map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const rangeOptions: Array<{ value: "30" | "90" | "all"; label: string }> = [
    { value: "30", label: tr ? "30 gün" : "30 days" },
    { value: "90", label: tr ? "90 gün" : "90 days" },
    { value: "all", label: tr ? "Tümü" : "All" },
  ];
  return <article className="burnup-card">
    <header><div><span className="eyebrow">BURN-UP</span><h2>{tr ? "Kapsam ve tamamlanma" : "Scope and completion"}</h2></div><TrendingUp size={20} /></header>
    <div className="burnup-controls"><div className="segmented-control"><button className={mode === "tasks" ? "active" : ""} onClick={() => setMode("tasks")}>{tr ? "Görev" : "Tasks"}</button><button className={mode === "points" ? "active" : ""} onClick={() => setMode("points")}>{tr ? "İş yükü" : "Effort"}</button></div><div className="segmented-control">{rangeOptions.map((option) => <button key={option.value} className={(option.value === "all" ? days === undefined : String(days) === option.value) ? "active" : ""} onClick={() => setDays(option.value === "all" ? undefined : Number(option.value) as 30 | 90)}>{option.label}</button>)}</div></div>
    <div className="burnup-summary"><span><small>{tr ? "Toplam kapsam" : "Total scope"}</small><strong>{burnup.total}</strong></span><span><small>{tr ? "Tamamlanan" : "Completed"}</small><strong>{burnup.completed}</strong></span><span><small>{tr ? "Kalan" : "Remaining"}</small><strong>{burnup.remaining}</strong></span><span><small>{tr ? "İlerleme" : "Progress"}</small><strong>{burnup.progress}%</strong></span></div>
    {burnup.total ? <div className="burnup-visual"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={tr ? `Toplam ${burnup.total}, tamamlanan ${burnup.completed}, kalan ${burnup.remaining}` : `Total ${burnup.total}, completed ${burnup.completed}, remaining ${burnup.remaining}`}><g className="burnup-grid">{[0, .25, .5, .75, 1].map((ratio) => <line key={ratio} x1={pad} x2={width - pad} y1={height - pad - ratio * (height - pad * 2)} y2={height - pad - ratio * (height - pad * 2)} />)}</g><path className="burnup-line scope" d={path("scope")} /><path className="burnup-line completed" d={path("completed")} /></svg><div className="burnup-axis"><span>{burnup.points[0]?.label}</span><span>{burnup.points.at(-1)?.label}</span></div><div className="burnup-legend"><span><i className="scope" /> {tr ? "Toplam planlanmış kapsam" : "Total planned scope"}</span><span><i className="completed" /> {tr ? "Tamamlanan kapsam" : "Completed scope"}</span></div></div> : <p className="burnup-empty">{tr ? "Önceliklendirilmiş bir görev olduğunda grafik oluşur." : "The chart appears when a task is prioritized."}</p>}
    {burnup.approximate && <small className="burnup-note">{tr ? "Eski görevlerin ilk kapsam tarihi mevcut kayıtlardan yaklaşık olarak oluşturuldu." : "Initial scope dates for older tasks were approximated from existing records."}</small>}
  </article>;
}
