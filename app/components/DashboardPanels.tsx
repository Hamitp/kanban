"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Wrench,
} from "lucide-react";
import { useI18n } from "../i18n";
import { localDateKey, type CalendarAgendaEntry } from "../calendarAgenda";
import type { OpenIssueSummary } from "../dashboardAnalytics";
import type { AppData, IssueSeverity, IssueStatus, ProblemIssue, Screen } from "../types";

interface CommonPanelProps {
  data: AppData;
  onNavigate: (screen: Screen) => void;
}

const statusLabels: Record<IssueStatus, { tr: string; en: string }> = {
  open: { tr: "Açık", en: "Open" },
  investigating: { tr: "İnceleniyor", en: "Investigating" },
  implementing: { tr: "Çözüm uygulanıyor", en: "Implementing" },
  verifying: { tr: "Doğrulanıyor", en: "Verifying" },
  closed: { tr: "Kapalı", en: "Closed" },
};

const severityLabels: Record<IssueSeverity, { tr: string; en: string }> = {
  low: { tr: "Düşük", en: "Low" },
  medium: { tr: "Orta", en: "Medium" },
  high: { tr: "Yüksek", en: "High" },
  critical: { tr: "Kritik", en: "Critical" },
};

function IssueSummaryMetrics({ summary }: { summary: OpenIssueSummary }) {
  const { language } = useI18n();
  const tr = language === "tr";
  return (
    <div className="dashboard-issue-metrics" aria-label={tr ? "Açık sorun özeti" : "Open problem summary"}>
      <span><small>{tr ? "Açık" : "Open"}</small><strong>{summary.open}</strong></span>
      <span><small>{tr ? "Kritik / yüksek" : "Critical / high"}</small><strong>{summary.critical + summary.high}</strong></span>
      <span><small>{tr ? "Doğrulamada" : "Verifying"}</small><strong>{summary.verifying}</strong></span>
      <span className={summary.overdueFollowUps > 0 ? "overdue" : ""}><small>{tr ? "Takibi geciken" : "Follow-up overdue"}</small><strong>{summary.overdueFollowUps}</strong></span>
    </div>
  );
}

function IssueRows({
  issues,
  data,
  showProject,
  onNavigate,
}: {
  issues: ProblemIssue[];
  data: AppData;
  showProject: boolean;
  onNavigate: (screen: Screen) => void;
}) {
  const { language, locale } = useI18n();
  const tr = language === "tr";
  return (
    <div className="dashboard-issue-list">
      {issues.map((issue) => {
        const project = data.projects.find((item) => item.id === issue.projectId);
        const assignees = issue.assigneeIds
          .map((id) => data.members.find((member) => member.id === id)?.name)
          .filter(Boolean);
        const followUp = issue.followUpDate
          ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${issue.followUpDate}T12:00:00`))
          : undefined;
        const meta = followUp
          ? `${tr ? "Takip" : "Follow-up"} ${followUp}`
          : assignees.length
            ? assignees.slice(0, 2).join(", ")
            : tr ? "Sorumlu atanmamış" : "Unassigned";
        return (
          <button
            key={issue.id}
            className={`dashboard-issue-row severity-${issue.severity}`}
            onClick={() => onNavigate({ kind: "issue", id: issue.id })}
            aria-label={tr ? `${issue.title} sorununu aç` : `Open problem ${issue.title}`}
          >
            <i className="dashboard-issue-severity" aria-hidden="true" />
            <span className="dashboard-issue-copy">
              <small title={showProject ? project?.name : severityLabels[issue.severity][language]}>
                {showProject ? project?.name : severityLabels[issue.severity][language]}
              </small>
              <strong title={issue.title}>{issue.title}</strong>
            </span>
            <span className={`issue-status ${issue.status}`}>{statusLabels[issue.status][language]}</span>
            <span className="dashboard-issue-meta" title={meta}>{meta}</span>
            <ChevronRight size={16} />
          </button>
        );
      })}
    </div>
  );
}

export function PortfolioIssueSummaryPanel({
  summary,
  data,
  onNavigate,
}: CommonPanelProps & { summary: OpenIssueSummary }) {
  const { language } = useI18n();
  const tr = language === "tr";
  const visible = summary.items.slice(0, 5);
  return (
    <section className="dashboard-card portfolio-issues-card">
      <header className="section-header compact">
        <div><span className="eyebrow">{tr ? "PORTFÖY SORUN ÖZETİ" : "PORTFOLIO PROBLEM SUMMARY"}</span><h2>{tr ? "Aktif projelerde açık sorunlar" : "Open problems in active projects"}</h2></div>
        <button className="text-button" onClick={() => onNavigate({ kind: "issues" })}>{tr ? "Tümünü gör" : "View all"} <ArrowRight size={15} /></button>
      </header>
      <IssueSummaryMetrics summary={summary} />
      {visible.length > 0
        ? <IssueRows issues={visible} data={data} showProject onNavigate={onNavigate} />
        : <div className="dashboard-panel-empty"><CheckCircle2 size={22} /><strong>{tr ? "Aktif projelerde açık sorun yok" : "No open problems in active projects"}</strong><span>{tr ? "Yeni bir sorun kaydedildiğinde burada görünür." : "New problems will appear here when recorded."}</span></div>}
      {summary.items.length > visible.length && <button className="dashboard-more-button" onClick={() => onNavigate({ kind: "issues" })}>{tr ? `${summary.items.length - visible.length} sorun daha` : `${summary.items.length - visible.length} more problems`} <ArrowRight size={14} /></button>}
    </section>
  );
}

export function ProjectOpenIssuesPanel({
  summary,
  projectId,
  data,
  onNavigate,
}: CommonPanelProps & { summary: OpenIssueSummary; projectId: string }) {
  const { language } = useI18n();
  const tr = language === "tr";
  const visible = summary.items.slice(0, 4);
  return (
    <section className="project-open-issues-card">
      <header className="section-header compact">
        <div><span className="eyebrow">{tr ? "AÇIK SORUNLAR" : "OPEN PROBLEMS"}</span><h2>{tr ? "Çözüm sürecindeki kayıtlar" : "Problems being resolved"}</h2></div>
        <button className="text-button" onClick={() => onNavigate({ kind: "issues", projectId })}><Wrench size={15} /> {tr ? "Sorun çözmeye git" : "Open problem solving"}</button>
      </header>
      <IssueSummaryMetrics summary={summary} />
      {visible.length > 0
        ? <IssueRows issues={visible} data={data} showProject={false} onNavigate={onNavigate} />
        : <div className="dashboard-panel-empty compact"><CheckCircle2 size={21} /><strong>{tr ? "Bu projede açık sorun yok" : "No open problems in this project"}</strong><span>{tr ? "Çözüm sürecindeki kayıtlar burada listelenir." : "Problems being resolved will be listed here."}</span></div>}
      {summary.items.length > visible.length && <button className="dashboard-more-button" onClick={() => onNavigate({ kind: "issues", projectId })}>{tr ? `${summary.items.length - visible.length} sorun daha` : `${summary.items.length - visible.length} more problems`} <ArrowRight size={14} /></button>}
    </section>
  );
}

function agendaDateLabel(date: string, locale: string, tr: boolean): { primary: string; secondary: string } {
  const today = new Date();
  const todayKey = localDateKey(today);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 12);
  const primary = date === todayKey ? (tr ? "Bugün" : "Today")
    : date === localDateKey(tomorrow) ? (tr ? "Yarın" : "Tomorrow")
      : new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(`${date}T12:00:00`));
  return {
    primary,
    secondary: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`)),
  };
}

export function UpcomingSevenDaysPanel({
  entries,
  data,
  onNavigate,
}: CommonPanelProps & { entries: CalendarAgendaEntry[] }) {
  const { language, locale } = useI18n();
  const tr = language === "tr";
  const visible = entries.slice(0, 6);
  const typeLabel = (entry: CalendarAgendaEntry) => {
    if (entry.kind === "task") return tr ? "Görev son tarihi" : "Task due date";
    return ({
      meeting: tr ? "Toplantı" : "Meeting",
      planned: tr ? "Planlı iş" : "Planned work",
      note: tr ? "Not" : "Note",
    })[entry.type];
  };
  return (
    <section className="dashboard-card seven-days-card">
      <header className="section-header compact">
        <div><span className="eyebrow">{tr ? "ÖNÜMÜZDEKİ 7 GÜN" : "NEXT 7 DAYS"}</span><h2>{tr ? "Yaklaşan planlar" : "Upcoming plans"}</h2></div>
        <button className="text-button" onClick={() => onNavigate({ kind: "calendar" })}>{tr ? "Takvimi aç" : "Open calendar"} <ArrowRight size={15} /></button>
      </header>
      <div className="seven-days-list">
        {visible.map((entry) => {
          const date = agendaDateLabel(entry.date, locale, tr);
          const project = entry.projectId ? data.projects.find((item) => item.id === entry.projectId) : undefined;
          const board = entry.kind === "task" ? data.boards.find((item) => item.id === entry.boardId) : undefined;
          const context = [typeLabel(entry), project?.name, board?.title].filter(Boolean).join(" · ");
          const time = entry.kind === "event" && entry.startTime
            ? `${entry.startTime}${entry.endTime ? `–${entry.endTime}` : ""}`
            : tr ? "Tüm gün" : "All day";
          return (
            <button key={entry.id} onClick={() => onNavigate(entry.kind === "task" ? { kind: "board", id: entry.boardId } : { kind: "calendar" })}>
              <time dateTime={entry.date}><strong>{date.primary}</strong><small>{date.secondary}</small></time>
              <span className="seven-days-copy"><strong title={entry.title}>{entry.title}</strong><small title={context}>{context}</small></span>
              <span className="seven-days-time"><Clock3 size={13} /> {time}</span>
              <ChevronRight size={15} />
            </button>
          );
        })}
        {visible.length === 0 && <div className="dashboard-panel-empty"><CalendarDays size={22} /><strong>{tr ? "Önümüzdeki 7 gün için kayıt yok" : "Nothing scheduled for the next 7 days"}</strong><span>{tr ? "Toplantı, planlı iş ve görev son tarihleri burada görünür." : "Meetings, planned work and task due dates will appear here."}</span></div>}
      </div>
      {entries.length > visible.length && <button className="dashboard-more-button" onClick={() => onNavigate({ kind: "calendar" })}>{tr ? `${entries.length - visible.length} kayıt daha` : `${entries.length - visible.length} more entries`} <ArrowRight size={14} /></button>}
    </section>
  );
}
