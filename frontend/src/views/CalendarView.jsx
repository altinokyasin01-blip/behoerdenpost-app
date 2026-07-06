import { useMemo, useState } from "react";
import { DEADLINE_TYPE_LABEL } from "../utils/domainConstants.js";
import { TODAY, isoLocal, formatDate } from "../utils/format.js";

const WEEKDAY_HEADERS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function generateMonthCells(year, month) {
  const first = new Date(year, month, 1);
  const dayOfWeek = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - dayOfWeek + i);
    cells.push({
      iso: isoLocal(d),
      day: d.getDate(),
      inCurrentMonth: d.getMonth() === month,
    });
  }
  return cells;
}

export default function CalendarView({
  docs,
  reminders,
  events,
  googleEvents,
  contacts,
  onOpenDoc,
  onOpenReminder,
  onOpenEvent,
  onOpenGoogleEvent,
  onAddEvent,
}) {
  const [cursor, setCursor] = useState(
    () => new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(() => isoLocal(TODAY));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayISO = isoLocal(TODAY);

  const entriesByDay = useMemo(() => {
    const map = new Map();
    function push(iso, kind, item) {
      if (!iso) return;
      if (!map.has(iso)) {
        map.set(iso, { deadline: [], reminder: [], event: [], google: [] });
      }
      map.get(iso)[kind].push(item);
    }
    for (const d of docs) {
      if (d.deadline && d.status !== "Erledigt") push(d.deadline, "deadline", d);
    }
    for (const r of reminders) {
      if (r.date && !r.done) push(r.date, "reminder", r);
    }
    for (const e of events) {
      if (e.date) push(e.date, "event", e);
    }
    for (const ge of googleEvents || []) {
      const iso = ge.start?.date || ge.start?.dateTime?.slice(0, 10);
      if (iso) push(iso, "google", ge);
    }
    return map;
  }, [docs, reminders, events, googleEvents]);

  const cells = useMemo(() => generateMonthCells(year, month), [year, month]);

  const emptyDay = { deadline: [], reminder: [], event: [], google: [] };
  const selectedEntries = entriesByDay.get(selectedDate) || emptyDay;
  const selectedIsEmpty =
    selectedEntries.deadline.length === 0 &&
    selectedEntries.reminder.length === 0 &&
    selectedEntries.event.length === 0 &&
    selectedEntries.google.length === 0;

  const agenda = useMemo(() => {
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(
        TODAY.getFullYear(),
        TODAY.getMonth(),
        TODAY.getDate() + i
      );
      const iso = isoLocal(d);
      const entries = entriesByDay.get(iso);
      if (
        entries &&
        (entries.deadline.length ||
          entries.reminder.length ||
          entries.event.length ||
          entries.google.length)
      ) {
        days.push({ iso, entries });
      }
    }
    return days;
  }, [entriesByDay]);

  function contactName(id) {
    if (!id) return null;
    const c = contacts.find((x) => x.id === id);
    return c ? c.name : null;
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Kalender</h1>
        <p className="lead">
          Alle Fristen, Erinnerungen und Termine in einer Ansicht.
        </p>
      </header>

      <div className="calendar-nav">
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          aria-label="Voriger Monat"
        >
          ‹
        </button>
        <div className="calendar-title">
          {MONTH_NAMES[month]} {year}
        </div>
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          aria-label="Nächster Monat"
        >
          ›
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAY_HEADERS.map((h) => (
          <div key={h} className="calendar-weekday">
            {h}
          </div>
        ))}
        {cells.map((cell) => {
          const entry = entriesByDay.get(cell.iso);
          const isToday = cell.iso === todayISO;
          const isSelected = cell.iso === selectedDate;
          const classes = [
            "calendar-cell",
            isToday ? "today" : "",
            isSelected ? "selected" : "",
            cell.inCurrentMonth ? "" : "out-of-month",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={cell.iso}
              type="button"
              className={classes}
              onClick={() => setSelectedDate(cell.iso)}
            >
              <span className="calendar-day">{cell.day}</span>
              {entry && (
                <div className="calendar-dots">
                  {entry.deadline.length > 0 && (
                    <span className="calendar-dot dot-red" />
                  )}
                  {entry.reminder.length > 0 && (
                    <span className="calendar-dot dot-amber" />
                  )}
                  {entry.event.length > 0 && (
                    <span className="calendar-dot dot-blue" />
                  )}
                  {entry.google.length > 0 && (
                    <span className="calendar-dot dot-slate" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="day-panel">
        <div className="day-panel-head">
          <div className="day-panel-title">{formatDate(selectedDate)}</div>
          <button
            type="button"
            className="btn-primary btn-primary-sm"
            onClick={() => onAddEvent(selectedDate)}
          >
            + Termin
          </button>
        </div>
        <div className="day-entries">
          {selectedIsEmpty && (
            <div className="empty">Keine Einträge an diesem Tag.</div>
          )}
          {selectedEntries.deadline.map((d) => (
            <button
              key={d.id}
              type="button"
              className="day-entry"
              onClick={() => onOpenDoc(d.id)}
            >
              <span className="entry-marker marker-red" />
              <div className="entry-body">
                <div className="entry-title">{d.title}</div>
                <div className="entry-meta">
                  Frist
                  {d.deadlineType &&
                    ` · ${DEADLINE_TYPE_LABEL[d.deadlineType]}`}
                  {d.sender && ` · ${d.sender}`}
                </div>
              </div>
            </button>
          ))}
          {selectedEntries.reminder.map((r) => (
            <button
              key={r.id}
              type="button"
              className="day-entry"
              onClick={() => onOpenReminder(r.id)}
            >
              <span className="entry-marker marker-amber" />
              <div className="entry-body">
                <div className="entry-title">{r.title}</div>
                <div className="entry-meta">Erinnerung</div>
              </div>
            </button>
          ))}
          {selectedEntries.event.map((e) => {
            const cName = contactName(e.contactId);
            return (
              <button
                key={e.id}
                type="button"
                className="day-entry"
                onClick={() => onOpenEvent(e.id)}
              >
                <span className="entry-marker marker-blue" />
                <div className="entry-body">
                  <div className="entry-title">{e.title}</div>
                  <div className="entry-meta">
                    {e.time || "Termin"}
                    {cName && ` · ${cName}`}
                  </div>
                </div>
              </button>
            );
          })}
          {selectedEntries.google.map((ge) => {
            const time = ge.start?.dateTime?.slice(11, 16);
            return (
              <button
                key={"g" + ge.id}
                type="button"
                className="day-entry"
                onClick={() => onOpenGoogleEvent(ge)}
              >
                <span className="entry-marker marker-slate" />
                <div className="entry-body">
                  <div className="entry-title">
                    {ge.summary || "(Ohne Titel)"}
                  </div>
                  <div className="entry-meta">
                    Google Calendar
                    {time && ` · ${time}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="section-title">Kommende 30 Tage</h2>
      <div className="agenda">
        {agenda.length === 0 && (
          <div className="empty">Keine anstehenden Einträge.</div>
        )}
        {agenda.map((day) => (
          <div key={day.iso} className="agenda-day">
            <div className="agenda-date">{formatDate(day.iso)}</div>
            <div className="agenda-entries">
              {day.entries.deadline.map((d) => (
                <button
                  key={"d" + d.id}
                  type="button"
                  className="agenda-entry"
                  onClick={() => onOpenDoc(d.id)}
                >
                  <span className="calendar-dot dot-red" />
                  <span className="agenda-title">{d.title}</span>
                  <span className="agenda-kind">Frist</span>
                </button>
              ))}
              {day.entries.reminder.map((r) => (
                <button
                  key={"r" + r.id}
                  type="button"
                  className="agenda-entry"
                  onClick={() => onOpenReminder(r.id)}
                >
                  <span className="calendar-dot dot-amber" />
                  <span className="agenda-title">{r.title}</span>
                  <span className="agenda-kind">Erinnerung</span>
                </button>
              ))}
              {day.entries.event.map((e) => (
                <button
                  key={"e" + e.id}
                  type="button"
                  className="agenda-entry"
                  onClick={() => onOpenEvent(e.id)}
                >
                  <span className="calendar-dot dot-blue" />
                  <span className="agenda-title">{e.title}</span>
                  <span className="agenda-kind">
                    {e.time ? e.time : "Termin"}
                  </span>
                </button>
              ))}
              {day.entries.google.map((ge) => (
                <button
                  key={"g" + ge.id}
                  type="button"
                  className="agenda-entry"
                  onClick={() => onOpenGoogleEvent(ge)}
                >
                  <span className="calendar-dot dot-slate" />
                  <span className="agenda-title">
                    {ge.summary || "(Ohne Titel)"}
                  </span>
                  <span className="agenda-kind">Google</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
