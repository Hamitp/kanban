"use client";

import {
  AlertTriangle,
  BarChart3,
  Clock3,
  Gauge,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { formatTryKurus } from "../projectFinance";
import { getTaskWorkMs } from "../taskTiming";
import type { AppData, Screen } from "../types";
import { getWorkspaceInsights } from "../workspaceAnalytics";

export function InsightsScreen({
  data,
  onNavigate,
}: {
  data: AppData;
  onNavigate: (screen: Screen) => void;
}) {
  const [referenceTime] = useState(() => Date.now());
  const insights = getWorkspaceInsights(data);
  const flowTotal = Object.values(insights.flow).reduce((sum, value) => sum + value, 0);
  const maxThroughput = Math.max(1, ...insights.weeklyThroughput.map((item) => item.count));
  const maxCashflow = Math.max(1, ...insights.monthlyCashflow.map((item) => item.amountKurus));
  const maxWorkload = Math.max(1, ...insights.memberWorkload.map((item) => item.count));
  const completedLastFourWeeks = insights.weeklyThroughput
    .slice(-4)
    .reduce((sum, item) => sum + item.count, 0);
  const priorFourWeeks = insights.weeklyThroughput
    .slice(0, 4)
    .reduce((sum, item) => sum + item.count, 0);
  const throughputDelta = completedLastFourWeeks - priorFourWeeks;

  return (
    <main className="shell-page insights-page">
      <header className="page-header insights-header">
        <div>
          <span className="eyebrow">KARAR DESTEĞİ</span>
          <h1>İçgörüler</h1>
          <p>Akışınızdaki eğilimleri görün, darboğazı erken fark edin ve bir sonraki doğru adımı seçin.</p>
        </div>
      </header>

      <section className="insight-summary-grid" aria-label="İçgörü özeti">
        <article className="insight-summary-card">
          <span className="insight-icon violet"><Gauge size={20} /></span>
          <div><small>Ortanca çevrim</small><strong>{insights.cycle.samples ? `${insights.cycle.medianDays} gün` : "—"}</strong><p>{insights.cycle.samples ? `${insights.cycle.samples} tamamlanan görev` : "Veri biriktikçe hesaplanır"}</p></div>
        </article>
        <article className="insight-summary-card">
          <span className="insight-icon green"><TrendingUp size={20} /></span>
          <div><small>Son 4 hafta</small><strong>{completedLastFourWeeks} görev</strong><p>{throughputDelta === 0 ? "Önceki dönemle aynı" : `${throughputDelta > 0 ? "+" : ""}${throughputDelta} görev değişim`}</p></div>
        </article>
        <article className="insight-summary-card">
          <span className={`insight-icon ${insights.risks.length ? "amber" : "green"}`}><AlertTriangle size={20} /></span>
          <div><small>Dikkat isteyen</small><strong>{insights.risks.length}</strong><p>{insights.risks.length ? "Bekleyen, yaşlanan veya geciken" : "Akışta belirgin risk yok"}</p></div>
        </article>
      </section>

      <section className="insight-grid">
        <article className="insight-card throughput-card">
          <header><div><span className="eyebrow">TESLİM RİTMİ</span><h2>Haftalık tamamlanan görevler</h2></div><BarChart3 size={19} /></header>
          <div className="vertical-bar-chart" role="img" aria-label={`Son sekiz haftada toplam ${insights.weeklyThroughput.reduce((sum, item) => sum + item.count, 0)} görev tamamlandı`}>
            {insights.weeklyThroughput.map((item) => (
              <div className="bar-column" key={item.key}>
                <div className="bar-value">{item.count || ""}</div>
                <div className="bar-track"><i style={{ height: `${Math.max(item.count ? 12 : 2, (item.count / maxThroughput) * 100)}%` }} /></div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="insight-card flow-card">
          <header><div><span className="eyebrow">AKIŞ DAĞILIMI</span><h2>İşler nerede birikiyor?</h2></div><Gauge size={19} /></header>
          {flowTotal ? (
            <>
              <div className="flow-bar" role="img" aria-label={`${insights.flow.backlog} havuzda, ${insights.flow.planned} öncelikli, ${insights.flow.active} aktif, ${insights.flow.done} tamamlanan görev`}>
                <i className="backlog" style={{ flex: insights.flow.backlog || 0.001 }} />
                <i className="planned" style={{ flex: insights.flow.planned || 0.001 }} />
                <i className="active" style={{ flex: insights.flow.active || 0.001 }} />
                <i className="done" style={{ flex: insights.flow.done || 0.001 }} />
              </div>
              <div className="flow-breakdown">
                <FlowItem label="Havuz" value={insights.flow.backlog} tone="backlog" />
                <FlowItem label="Öncelikli" value={insights.flow.planned} tone="planned" />
                <FlowItem label="Aktif" value={insights.flow.active} tone="active" />
                <FlowItem label="Tamamlanan" value={insights.flow.done} tone="done" />
              </div>
              <p className="insight-note">
                {insights.flow.active > Math.max(3, insights.flow.planned)
                  ? "Aktif görev sayısı yüksek. Yeni göreve başlamadan önce eldeki görevleri bitirmek akışı rahatlatabilir."
                  : "Aktif görev yükü dengeli görünüyor. Öncelikli listedeki sırayı koruyarak ilerleyebilirsiniz."}
              </p>
            </>
          ) : <InsightEmpty text="Akış analizi için henüz görev yok." />}
        </article>

        <article className="insight-card cashflow-card">
          <header><div><span className="eyebrow">PARA AKIŞI</span><h2>Aylık tahsilatlar</h2></div><WalletCards size={19} /></header>
          {insights.finance.collectedKurus ? (
            <div className="vertical-bar-chart cashflow" role="img" aria-label={`Toplam tahsil edilen ${formatTryKurus(insights.finance.collectedKurus)}`}>
              {insights.monthlyCashflow.map((item) => (
                <div className="bar-column" key={item.key}>
                  <div className="bar-value">{item.amountKurus ? formatCompactTry(item.amountKurus) : ""}</div>
                  <div className="bar-track"><i style={{ height: `${Math.max(item.amountKurus ? 12 : 2, (item.amountKurus / maxCashflow) * 100)}%` }} /></div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ) : <InsightEmpty text="İlk tahsilat kaydı eklendiğinde aylık para akışı burada görünür." />}
        </article>

        <article className="insight-card workload-card">
          <header><div><span className="eyebrow">KAPASİTE</span><h2>Kişi bazlı görev yükü</h2></div><Users size={19} /></header>
          {insights.memberWorkload.some((item) => item.count) ? (
            <div className="horizontal-bars">
              {insights.memberWorkload.map(({ member, count }) => (
                <div className="horizontal-bar" key={member.id}>
                  <span className="member-avatar" style={{ background: member.color }}>{member.initials}</span>
                  <strong>{member.name}</strong>
                  <div><i style={{ width: `${(count / maxWorkload) * 100}%` }} /></div>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          ) : <InsightEmpty text="Öncelikli veya aktif görevler kişilere atandığında yük dağılımı görünür." />}
        </article>
      </section>

      <section className="insight-card risk-card">
        <header><div><span className="eyebrow">ODAK ÖNERİLERİ</span><h2>Şimdi neye bakmalısınız?</h2></div><Sparkles size={19} /></header>
        {insights.risks.length ? (
          <div className="risk-list">
            {insights.risks.slice(0, 6).map(({ task, board, role }) => {
              const activeDays = role === "active" ? Math.floor(getTaskWorkMs(task) / 86_400_000) : 0;
              const reason = task.waitingReason
                ? task.waitingReason
                : task.dueDate && new Date(`${task.dueDate}T23:59:59`).getTime() < referenceTime
                  ? "Son tarihi geçti"
                  : `${activeDays} gündür aktif`;
              return (
                <button key={task.id} onClick={() => onNavigate({ kind: "board", id: board.id })}>
                  <span className="risk-marker"><AlertTriangle size={15} /></span>
                  <span><strong>{task.title}</strong><small>{board.title} · {reason}</small></span>
                  <span className="risk-action">Boarda git</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="healthy-insight"><Clock3 size={21} /><div><strong>Akışınız sakin görünüyor</strong><span>Bekleyen, beş günden uzun süren veya son tarihi geçen açık görev yok.</span></div></div>
        )}
      </section>
    </main>
  );
}

function FlowItem({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div><i className={tone} /><span>{label}</span><strong>{value}</strong></div>;
}

function InsightEmpty({ text }: { text: string }) {
  return <div className="insight-empty"><TrendingUp size={22} /><span>{text}</span></div>;
}

function formatCompactTry(kurus: number) {
  return new Intl.NumberFormat("tr-TR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(kurus / 100);
}
