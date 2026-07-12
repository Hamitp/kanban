"use client";

import { AlertTriangle, BarChart3, Clock3, Gauge, Sparkles, TrendingUp, Users, WalletCards, Wrench } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n";
import { formatCompactMoney, formatMoney, getPortfolioCurrencies } from "../projectFinance";
import { getTaskWorkMs } from "../taskTiming";
import type { AppData, CurrencyCode, Screen } from "../types";
import { getWorkspaceInsights } from "../workspaceAnalytics";
import { getIssueInsights } from "../v4Workflows";

export function InsightsScreen({ data, onNavigate }: { data: AppData; onNavigate: (screen: Screen) => void }) {
  const { language } = useI18n();
  const [referenceTime] = useState(() => Date.now());
  const insights = getWorkspaceInsights(data, new Date(), language);
  const flowTotal = Object.values(insights.flow).reduce((sum, value) => sum + value, 0);
  const maxThroughput = Math.max(1, ...insights.weeklyThroughput.map((item) => item.count));
  const cashflowCurrencies = getPortfolioCurrencies(insights.finance, "collectedKurus");
  const [requestedCashflowCurrency, setCashflowCurrency] = useState<CurrencyCode>(cashflowCurrencies[0]);
  const cashflowCurrency = cashflowCurrencies.includes(requestedCashflowCurrency) ? requestedCashflowCurrency : cashflowCurrencies[0];
  const maxCashflow = Math.max(1, ...insights.monthlyCashflow.map((item) => item.amounts[cashflowCurrency]));
  const maxWorkload = Math.max(1, ...insights.memberWorkload.map((item) => item.count));
  const completedLastFourWeeks = insights.weeklyThroughput.slice(-4).reduce((sum, item) => sum + item.count, 0);
  const priorFourWeeks = insights.weeklyThroughput.slice(0, 4).reduce((sum, item) => sum + item.count, 0);
  const throughputDelta = completedLastFourWeeks - priorFourWeeks;
  const issueInsights = getIssueInsights(data.issues);

  return (
    <main className="shell-page insights-page">
      <header className="page-header insights-header"><div><span className="eyebrow">{language === "tr" ? "KARAR DESTEĞİ" : "DECISION SUPPORT"}</span><h1>{language === "tr" ? "İçgörüler" : "Insights"}</h1><p>{language === "tr" ? "Akışınızdaki eğilimleri görün, darboğazı erken fark edin ve bir sonraki doğru adımı seçin." : "See trends in your flow, spot bottlenecks early and choose the next right step."}</p></div></header>

      <section className="insight-summary-grid" aria-label={language === "tr" ? "İçgörü özeti" : "Insights summary"}>
        <article className="insight-summary-card"><span className="insight-icon violet"><Gauge size={20} /></span><div><small>{language === "tr" ? "Ortanca çevrim" : "Median cycle"}</small><strong>{insights.cycle.samples ? `${insights.cycle.medianDays} ${language === "tr" ? "gün" : "days"}` : "—"}</strong><p>{insights.cycle.samples ? `${insights.cycle.samples} ${language === "tr" ? "tamamlanan görev" : "completed tasks"}` : language === "tr" ? "Veri biriktikçe hesaplanır" : "Calculated as data accumulates"}</p></div></article>
        <article className="insight-summary-card"><span className="insight-icon green"><TrendingUp size={20} /></span><div><small>{language === "tr" ? "Son 4 hafta" : "Last 4 weeks"}</small><strong>{completedLastFourWeeks} {language === "tr" ? "görev" : "tasks"}</strong><p>{throughputDelta === 0 ? language === "tr" ? "Önceki dönemle aynı" : "Same as previous period" : `${throughputDelta > 0 ? "+" : ""}${throughputDelta} ${language === "tr" ? "görev değişim" : "task change"}`}</p></div></article>
        <article className="insight-summary-card"><span className={`insight-icon ${insights.risks.length ? "amber" : "green"}`}><AlertTriangle size={20} /></span><div><small>{language === "tr" ? "Dikkat isteyen" : "Needs attention"}</small><strong>{insights.risks.length}</strong><p>{insights.risks.length ? language === "tr" ? "Bekleyen, yaşlanan veya geciken" : "Waiting, aging or overdue" : language === "tr" ? "Akışta belirgin risk yok" : "No clear flow risks"}</p></div></article>
      </section>

      <section className="insight-grid">
        <article className="insight-card throughput-card">
          <header><div><span className="eyebrow">{language === "tr" ? "TESLİM RİTMİ" : "DELIVERY RHYTHM"}</span><h2>{language === "tr" ? "Haftalık tamamlanan görevler" : "Tasks completed weekly"}</h2></div><BarChart3 size={19} /></header>
          <div className="vertical-bar-chart" role="img" aria-label={language === "tr" ? `Son sekiz haftada toplam ${insights.weeklyThroughput.reduce((sum, item) => sum + item.count, 0)} görev tamamlandı` : `${insights.weeklyThroughput.reduce((sum, item) => sum + item.count, 0)} tasks completed in the last eight weeks`}>
            {insights.weeklyThroughput.map((item) => <div className="bar-column" key={item.key}><div className="bar-value">{item.count || ""}</div><div className="bar-track"><i style={{ height: `${Math.max(item.count ? 12 : 2, (item.count / maxThroughput) * 100)}%` }} /></div><span>{item.label}</span></div>)}
          </div>
        </article>

        <article className="insight-card flow-card">
          <header><div><span className="eyebrow">{language === "tr" ? "AKIŞ DAĞILIMI" : "FLOW DISTRIBUTION"}</span><h2>{language === "tr" ? "İşler nerede birikiyor?" : "Where is work accumulating?"}</h2></div><Gauge size={19} /></header>
          {flowTotal ? <><div className="flow-bar" role="img" aria-label={language === "tr" ? `${insights.flow.backlog} havuzda, ${insights.flow.planned} öncelikli, ${insights.flow.active} aktif, ${insights.flow.done} tamamlanan görev` : `${insights.flow.backlog} backlog, ${insights.flow.planned} prioritized, ${insights.flow.active} active, ${insights.flow.done} completed tasks`}><i className="backlog" style={{ flex: insights.flow.backlog || 0.001 }} /><i className="planned" style={{ flex: insights.flow.planned || 0.001 }} /><i className="active" style={{ flex: insights.flow.active || 0.001 }} /><i className="done" style={{ flex: insights.flow.done || 0.001 }} /></div><div className="flow-breakdown"><FlowItem label={language === "tr" ? "Havuz" : "Backlog"} value={insights.flow.backlog} tone="backlog" /><FlowItem label={language === "tr" ? "Öncelikli" : "Prioritized"} value={insights.flow.planned} tone="planned" /><FlowItem label={language === "tr" ? "Aktif" : "Active"} value={insights.flow.active} tone="active" /><FlowItem label={language === "tr" ? "Tamamlanan" : "Completed"} value={insights.flow.done} tone="done" /></div><p className="insight-note">{insights.flow.active > Math.max(3, insights.flow.planned) ? language === "tr" ? "Aktif görev sayısı yüksek. Yeni göreve başlamadan önce eldeki görevleri bitirmek akışı rahatlatabilir." : "The active task count is high. Finishing current work before starting more may ease the flow." : language === "tr" ? "Aktif görev yükü dengeli görünüyor. Öncelikli listedeki sırayı koruyarak ilerleyebilirsiniz." : "The active workload looks balanced. Continue following the prioritized order."}</p></> : <InsightEmpty text={language === "tr" ? "Akış analizi için henüz görev yok." : "There are no tasks yet for flow analysis."} />}
        </article>

        <article className="insight-card cashflow-card">
          <header><div><span className="eyebrow">{language === "tr" ? "PARA AKIŞI" : "CASH FLOW"}</span><h2>{language === "tr" ? "Aylık tahsilatlar" : "Monthly collections"}</h2></div><WalletCards size={19} /></header>
          {cashflowCurrencies.length > 1 && <div className="currency-tabs" role="tablist" aria-label={language === "tr" ? "Para birimi" : "Currency"}>{cashflowCurrencies.map((currency) => <button key={currency} role="tab" aria-selected={currency === cashflowCurrency} className={currency === cashflowCurrency ? "active" : ""} onClick={() => setCashflowCurrency(currency)}>{currency}</button>)}</div>}
          {insights.finance[cashflowCurrency].collectedKurus ? <div className="vertical-bar-chart cashflow" role="img" aria-label={language === "tr" ? `Toplam tahsil edilen ${formatMoney(insights.finance[cashflowCurrency].collectedKurus, cashflowCurrency, language)}` : `Total collected ${formatMoney(insights.finance[cashflowCurrency].collectedKurus, cashflowCurrency, language)}`}>{insights.monthlyCashflow.map((item) => { const amount = item.amounts[cashflowCurrency]; return <div className="bar-column" key={item.key}><div className="bar-value">{amount ? formatCompactMoney(amount, cashflowCurrency, language) : ""}</div><div className="bar-track"><i style={{ height: `${Math.max(amount ? 12 : 2, (amount / maxCashflow) * 100)}%` }} /></div><span>{item.label}</span></div>; })}</div> : <InsightEmpty text={language === "tr" ? "İlk tahsilat kaydı eklendiğinde aylık para akışı burada görünür." : "Monthly cash flow will appear here after the first payment is recorded."} />}
        </article>

        <article className="insight-card workload-card"><header><div><span className="eyebrow">{language === "tr" ? "KAPASİTE" : "CAPACITY"}</span><h2>{language === "tr" ? "Kişi bazlı görev yükü" : "Workload by person"}</h2></div><Users size={19} /></header>{insights.memberWorkload.some((item) => item.count) ? <div className="horizontal-bars">{insights.memberWorkload.map(({ member, count }) => <div className="horizontal-bar" key={member.id}><span className="member-avatar" style={{ background: member.color }}>{member.initials}</span><strong>{member.name}</strong><div><i style={{ width: `${(count / maxWorkload) * 100}%` }} /></div><span>{count}</span></div>)}</div> : <InsightEmpty text={language === "tr" ? "Öncelikli veya aktif görevler kişilere atandığında yük dağılımı görünür." : "Workload distribution appears when prioritized or active tasks are assigned."} />}</article>

        <article className="insight-card issue-insight-card"><header><div><span className="eyebrow">{language === "tr" ? "SORUN ÖĞRENİMİ" : "PROBLEM LEARNING"}</span><h2>{language === "tr" ? "Kök neden ve çözüm görünümü" : "Root cause and resolution view"}</h2></div><Wrench size={19} /></header>{data.issues.length ? <><div className="issue-insight-metrics"><span><small>{language === "tr" ? "Açık" : "Open"}</small><strong>{issueInsights.open}</strong></span><span><small>{language === "tr" ? "Doğrulamada" : "Verifying"}</small><strong>{issueInsights.verifying}</strong></span><span><small>{language === "tr" ? "Ort. çözüm" : "Avg. resolution"}</small><strong>{issueInsights.averageResolutionDays ? `${issueInsights.averageResolutionDays} ${language === "tr" ? "gün" : "days"}` : "—"}</strong></span></div><div className="root-cause-list">{issueInsights.rootCauses.slice(0, 4).map(([cause, count]) => <div key={cause}><span>{cause}</span><strong>{count}</strong></div>)}{issueInsights.rootCauses.length === 0 && <small>{language === "tr" ? "Kök nedenler doğrulandıkça tekrar eden örüntüler burada görünür." : "Recurring patterns appear as root causes are validated."}</small>}</div><button className="text-button" onClick={() => onNavigate({ kind: "issues" })}>{language === "tr" ? "Sorun çözme araçlarını aç" : "Open problem-solving tools"}</button></> : <InsightEmpty text={language === "tr" ? "İlk sorun kaydıyla kök neden örüntülerini izlemeye başlayın." : "Create the first problem record to begin tracking root cause patterns."} />}</article>
      </section>

      <section className="insight-card risk-card"><header><div><span className="eyebrow">{language === "tr" ? "ODAK ÖNERİLERİ" : "FOCUS SUGGESTIONS"}</span><h2>{language === "tr" ? "Şimdi neye bakmalısınız?" : "What should you look at now?"}</h2></div><Sparkles size={19} /></header>{insights.risks.length ? <div className="risk-list">{insights.risks.slice(0, 6).map(({ task, board, role }) => { const activeDays = role === "active" ? Math.floor(getTaskWorkMs(task) / 86_400_000) : 0; const reason = task.waitingReason ? task.waitingReason : task.dueDate && new Date(`${task.dueDate}T23:59:59`).getTime() < referenceTime ? language === "tr" ? "Son tarihi geçti" : "Overdue" : language === "tr" ? `${activeDays} gündür aktif` : `Active for ${activeDays} days`; return <button key={task.id} onClick={() => onNavigate({ kind: "board", id: board.id })}><span className="risk-marker"><AlertTriangle size={15} /></span><span><strong>{task.title}</strong><small>{board.title} · {reason}</small></span><span className="risk-action">{language === "tr" ? "Boarda git" : "Open board"}</span></button>; })}</div> : <div className="healthy-insight"><Clock3 size={21} /><div><strong>{language === "tr" ? "Akışınız sakin görünüyor" : "Your flow looks calm"}</strong><span>{language === "tr" ? "Bekleyen, beş günden uzun süren veya son tarihi geçen açık görev yok." : "There are no waiting, overdue or open tasks running longer than five days."}</span></div></div>}</section>
    </main>
  );
}

function FlowItem({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div><i className={tone} /><span>{label}</span><strong>{value}</strong></div>;
}

function InsightEmpty({ text }: { text: string }) {
  return <div className="insight-empty"><TrendingUp size={22} /><span>{text}</span></div>;
}
