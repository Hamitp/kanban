"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import type { AppData, CalendarEvent, CalendarEventType, Project } from "../types";

interface CalendarScreenProps {
  data: AppData;
  onSave: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onNewId: () => string;
}

const eventTypes: CalendarEventType[] = ["meeting", "planned", "note"];

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function CalendarScreen({ data, onSave, onDelete, onNewId }: CalendarScreenProps) {
  const { language, locale } = useI18n();
  const tr = language === "tr";
  const today = localDateKey(new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const projects = data.projects.filter((project) => !project.archived);
  const dueDates = data.boards.filter((board) => !board.archived).flatMap((board) =>
    Object.values(board.tasks).filter((task) => task.dueDate && !task.completedAt).map((task) => ({
      id: `task-${board.id}-${task.id}`,
      title: task.title,
      date: task.dueDate!,
      projectId: board.projectId,
      kind: "task" as const,
    })),
  );
  const calendarEntries = [
    ...data.calendarEvents.map((event) => ({ ...event, kind: "event" as const })),
    ...dueDates,
  ];
  const cells = useMemo(() => {
    const first = new Date(month);
    const mondayIndex = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayIndex);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date, key: localDateKey(date), currentMonth: date.getMonth() === month.getMonth() };
    });
  }, [month]);
  const upcoming = calendarEntries.filter((entry) => entry.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  const projectById = (id?: string) => projects.find((project) => project.id === id);
  const openNew = (date = today) => setEditing({
    id: onNewId(),
    title: "",
    date,
    type: "planned",
    note: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return (
    <main className="shell-page calendar-page">
      <header className="page-header"><div><span className="eyebrow">{tr ? "ZAMAN YÖNETİMİ" : "TIME MANAGEMENT"}</span><h1>{tr ? "Takvim" : "Calendar"}</h1><p>{tr ? "Toplantılarınızı, planlı işlerinizi ve görev son tarihlerinizi tek yerde görün." : "See meetings, planned work and task due dates in one place."}</p></div><button className="primary-button large" onClick={() => openNew()}><Plus size={17} /> {tr ? "Etkinlik ekle" : "Add event"}</button></header>
      <div className="calendar-layout">
        <section className="calendar-card">
          <header className="calendar-toolbar"><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label={tr ? "Önceki ay" : "Previous month"}><ChevronLeft size={18} /></button><h2>{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month)}</h2><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label={tr ? "Sonraki ay" : "Next month"}><ChevronRight size={18} /></button><button className="text-button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>{tr ? "Bugün" : "Today"}</button></header>
          <div className="calendar-weekdays">{Array.from({ length: 7 }, (_, index) => { const date = new Date(2026, 0, 5 + index); return <span key={index}>{new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date)}</span>; })}</div>
          <div className="calendar-grid">{cells.map((cell) => { const entries = calendarEntries.filter((entry) => entry.date === cell.key); return <button key={cell.key} className={`${cell.currentMonth ? "" : "outside"} ${cell.key === today ? "today" : ""}`} onClick={() => openNew(cell.key)}><strong>{cell.date.getDate()}</strong><span className="calendar-cell-events">{entries.slice(0, 3).map((entry) => <i key={entry.id} className={entry.kind === "task" ? "task" : entry.type} title={entry.title}>{entry.title}</i>)}{entries.length > 3 && <em>+{entries.length - 3}</em>}</span></button>; })}</div>
        </section>
        <aside className="upcoming-card"><header><CalendarDays size={19} /><div><span className="eyebrow">{tr ? "YAKLAŞANLAR" : "UPCOMING"}</span><h2>{tr ? "Sıradaki planlar" : "Next plans"}</h2></div></header><div className="upcoming-list">{upcoming.map((entry) => { const project = projectById(entry.projectId); return <article key={entry.id}><time>{new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${entry.date}T12:00:00`))}</time><div><strong>{entry.title}</strong><small>{entry.kind === "task" ? tr ? "Görev son tarihi" : "Task due date" : entry.startTime ? `${entry.startTime}${entry.endTime ? `–${entry.endTime}` : ""}` : tr ? "Tüm gün" : "All day"}{project ? ` · ${project.name}` : ""}</small></div>{entry.kind === "event" && <button className="micro-button" onClick={() => setEditing(entry)} aria-label={tr ? "Etkinliği düzenle" : "Edit event"}><Pencil size={14} /></button>}</article>; })}{upcoming.length === 0 && <p className="calendar-empty">{tr ? "Yaklaşan kayıt yok." : "No upcoming entries."}</p>}</div></aside>
      </div>
      {editing && <EventEditor event={editing} projects={projects} onClose={() => setEditing(null)} onDelete={data.calendarEvents.some((event) => event.id === editing.id) ? () => { onDelete(editing.id); setEditing(null); } : undefined} onSave={(event) => { onSave({ ...event, updatedAt: new Date().toISOString() }); setEditing(null); }} />}
    </main>
  );
}

function EventEditor({ event, projects, onClose, onSave, onDelete }: { event: CalendarEvent; projects: Project[]; onClose: () => void; onSave: (event: CalendarEvent) => void; onDelete?: () => void }) {
  const { language } = useI18n();
  const tr = language === "tr";
  const [draft, setDraft] = useState(event);
  const typeLabels: Record<CalendarEventType, string> = { meeting: tr ? "Toplantı" : "Meeting", planned: tr ? "Planlı iş" : "Planned work", note: tr ? "Not" : "Note" };
  return <div className="modal-scrim" onMouseDown={onClose}><section className="modal-card event-editor" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={tr ? "Takvim kaydı" : "Calendar entry"}><header><div><span className="eyebrow">{tr ? "AJANDA" : "AGENDA"}</span><h2>{event.title ? tr ? "Etkinliği düzenle" : "Edit event" : tr ? "Yeni etkinlik" : "New event"}</h2></div><Clock3 size={20} /></header><div className="modal-content"><label className="field-label">{tr ? "Başlık" : "Title"}<input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label><div className="field-grid"><label className="field-label">{tr ? "Tarih" : "Date"}<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label><label className="field-label">{tr ? "Tür" : "Type"}<select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as CalendarEventType })}>{eventTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label></div><div className="field-grid"><label className="field-label">{tr ? "Başlangıç" : "Start"}<input type="time" value={draft.startTime ?? ""} onChange={(e) => setDraft({ ...draft, startTime: e.target.value || undefined })} /></label><label className="field-label">{tr ? "Bitiş" : "End"}<input type="time" value={draft.endTime ?? ""} onChange={(e) => setDraft({ ...draft, endTime: e.target.value || undefined })} /></label></div><label className="field-label">{tr ? "Proje" : "Project"}<select value={draft.projectId ?? ""} onChange={(e) => setDraft({ ...draft, projectId: e.target.value || undefined })}><option value="">{tr ? "Bağımsız" : "Independent"}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="field-label">{tr ? "Kısa not" : "Short note"}<textarea rows={3} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label><div className="modal-actions">{onDelete && <button className="danger-ghost" onClick={onDelete}><Trash2 size={15} /> {tr ? "Sil" : "Delete"}</button>}<div className="spacer" /><button className="secondary-button" onClick={onClose}>{tr ? "Vazgeç" : "Cancel"}</button><button className="primary-button" disabled={!draft.title.trim() || !draft.date} onClick={() => onSave({ ...draft, title: draft.title.trim() })}>{tr ? "Kaydet" : "Save"}</button></div></div></section></div>;
}
